/**
 * Pure logic for lead scoring, verification status classification,
 * duplicate detection, and lead filtering.
 */

export type WebsiteStatus =
  | 'no_website_verified'
  | 'no_website_detected'
  | 'could_not_verify'
  | 'broken_website'
  | 'active_website';

export type CrmStage =
  | 'discovered'
  | 'saved'
  | 'contacted'
  | 'interested'
  | 'follow_up'
  | 'converted'
  | 'unqualified';

export interface Lead {
  id: string;
  companyName: string;
  category: string;
  searchCategory?: string;
  searchLocation?: string;
  subCategory?: string;
  phoneNumber?: string;
  email?: string | null;
  fullAddress: string;
  city: string;
  state?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  description?: string;
  businessStatus?: string;
  openingHours?: string[];
  businessTypes?: string[];
  dataUpdatedAt?: string;
  websiteStatus: WebsiteStatus;
  websiteUrl?: string | null;
  verificationDetails?: {
    dnsChecked: boolean;
    hasActiveDns: boolean;
    httpStatus?: number;
    notes: string;
    verifiedAt: string;
    method: 'automated_probe' | 'search_grounding' | 'manual' | 'identity_verified';
    sourceUrl?: string;
    candidateUrl?: string;
  };
  fieldSources?: Record<string, string[]>;
  socialLinks?: {
    facebook?: string;
    linkedin?: string;
    instagram?: string;
    indiamart?: string;
  };
  yearsInBusiness?: string;
  employeeRange?: string;
  estimatedRevenueTier?: string;
  leadScore?: number;
  opportunityTier?: 'High' | 'Medium' | 'Low';
  crmStatus: CrmStage;
  tags: string[];
  notes?: string[];
  lastContactedAt?: string;
  nextFollowUpDate?: string;
  source: string;
  createdAt: string;
}

// Weighting parameters for B2B Industrial Lead Score (0 - 100)
export const HIGH_VALUE_INDUSTRIES: Record<string, number> = {
  'Precision Machining & CNC': 30,
  'Textiles & Garment Manufacturing': 28,
  'Metal Fabrication & Welding': 29,
  'Industrial Equipment & Valves': 30,
  'Chemical Processing & Polymers': 27,
  'Packaging & Corrugated Boxes': 25,
  'Plastic Injection Molding': 28,
  'Auto Components & Foundries': 29,
  'Hydraulics & Heavy Machinery': 30,
  'Electrical Switchgear & Motors': 27,
  'Food Processing & Cold Storage': 26,
};

/**
 * Calculates a lead score from 0 to 100 based on:
 * - High-value industry tier (up to 30 pts)
 * - Website gap opportunity (up to 35 pts)
 * - Reachability / phone presence (up to 20 pts)
 * - Business established reputation / reviews (up to 15 pts)
 */
export function calculateLeadScore(lead: {
  category: string;
  websiteStatus: WebsiteStatus;
  phoneNumber?: string;
  email?: string | null;
  fullAddress?: string;
  rating?: number;
  reviewCount?: number;
}): { score: number; opportunityTier: 'High' | 'Medium' | 'Low' } {
  let score = 0;

  // 1. Industry Value (up to 30)
  const industryWeight = HIGH_VALUE_INDUSTRIES[lead.category] ?? 22;
  score += industryWeight;

  // 2. Website Gap Opportunity (up to 35)
  // Businesses with VERIFIED no website are gold mines for agencies
  if (lead.websiteStatus === 'no_website_verified') {
    score += 35;
  } else if (lead.websiteStatus === 'no_website_detected') {
    score += 26;
  } else if (lead.websiteStatus === 'broken_website') {
    score += 24; // Big opportunity to fix a broken site
  } else if (lead.websiteStatus === 'active_website') {
    score += 5; // Active website = low opportunity for web dev, but possible redesign
  } else {
    score += 0; // An unverified website status is not evidence of a sales opportunity.
  }

  // 3. Contactability (up to 20)
  const hasPhone = Boolean(lead.phoneNumber && lead.phoneNumber.trim().length >= 7 && !lead.phoneNumber.toLowerCase().includes('not listed'));
  if (hasPhone) {
    score += 15;
  }
  if (lead.email && lead.email.includes('@')) {
    score += 5;
  }

  // 4. Reputation & Established Offline Traction (up to 15)
  const reviews = lead.reviewCount ?? 0;
  const rating = lead.rating ?? 0;

  if (reviews >= 20 && rating >= 4.0) {
    score += 15;
  } else if (reviews >= 5 && rating >= 3.8) {
    score += 10;
  } else if (reviews >= 1) {
    score += 5;
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(score)));

  let opportunityTier: 'High' | 'Medium' | 'Low' = 'Low';
  if (finalScore >= 75) {
    opportunityTier = 'High';
  } else if (finalScore >= 50) {
    opportunityTier = 'Medium';
  }

  return { score: finalScore, opportunityTier };
}

export interface DiscoveryScoreBreakdown {
  totalScore: number; // 0 - 100
  proximityScore: number; // 0 - 35
  categoryRelevanceScore: number; // 0 - 35
  websiteAbsenceScore: number; // 0 - 30
  distanceKm: number | null;
  priorityLabel: 'High Priority' | 'Medium Priority' | 'Low Priority';
}

/**
 * Calculates a dynamic Lead Score for DiscoveryView that ranks companies based on:
 * 1. Proximity to the user's location (up to 35 points)
 * 2. Business category relevance (up to 35 points)
 * 3. Absence of an active website (up to 30 points)
 */
export function calculateDiscoveryLeadScore(
  lead: {
    category: string;
    subCategory?: string;
    websiteStatus: WebsiteStatus;
    latitude?: number;
    longitude?: number;
  },
  userLocation: { lat: number; lng: number } | null,
  activeCategory: string = 'All Categories',
  distanceKmOverride?: number | null
): DiscoveryScoreBreakdown {
  // 1. Proximity Score (0 - 35 points)
  let distanceKm: number | null = distanceKmOverride ?? null;
  if (distanceKm === null && userLocation && lead.latitude && lead.longitude) {
    const R = 6371; // Earth radius in km
    const dLat = ((lead.latitude - userLocation.lat) * Math.PI) / 180;
    const dLng = ((lead.longitude - userLocation.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userLocation.lat * Math.PI) / 180) *
        Math.cos((lead.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    distanceKm = R * c;
  }

  let proximityScore = 20; // Default baseline if GPS not granted yet
  if (distanceKm !== null) {
    if (distanceKm <= 2) {
      proximityScore = 35; // Walking or immediate industrial neighborhood
    } else if (distanceKm <= 5) {
      proximityScore = 30; // Short 5-10 min drive
    } else if (distanceKm <= 10) {
      proximityScore = 25; // Metropolitan cluster
    } else if (distanceKm <= 20) {
      proximityScore = 18; // Suburb/corridor
    } else if (distanceKm <= 35) {
      proximityScore = 12; // Outer perimeter
    } else {
      proximityScore = Math.max(5, Math.round(35 - distanceKm * 0.5));
    }
  }

  // 2. Business Category Relevance (0 - 35 points)
  let categoryRelevanceScore = 24;
  const leadCat = (lead.category || '').toLowerCase();
  const leadSubCat = (lead.subCategory || '').toLowerCase();

  if (activeCategory && activeCategory !== 'All Categories') {
    const targetCat = activeCategory.toLowerCase();
    if (leadCat === targetCat) {
      categoryRelevanceScore = 35; // Direct exact match
    } else if (leadCat.includes(targetCat) || targetCat.includes(leadCat) || leadSubCat.includes(targetCat)) {
      categoryRelevanceScore = 30; // Close related match
    } else {
      categoryRelevanceScore = 14; // Different category
    }
  } else {
    // General industrial relevance weighting
    if (leadCat.includes('pump') || leadCat.includes('motor') || leadCat.includes('foundry')) {
      categoryRelevanceScore = 35;
    } else if (leadCat.includes('cnc') || leadCat.includes('machin')) {
      categoryRelevanceScore = 34;
    } else if (leadCat.includes('textile') || leadCat.includes('spinning')) {
      categoryRelevanceScore = 33;
    } else if (leadCat.includes('auto') || leadCat.includes('casting')) {
      categoryRelevanceScore = 32;
    } else if (leadCat.includes('valve') || leadCat.includes('hydraulic')) {
      categoryRelevanceScore = 31;
    } else if (leadCat.includes('grinder') || leadCat.includes('appliance')) {
      categoryRelevanceScore = 30;
    } else {
      categoryRelevanceScore = 26;
    }
  }

  // 3. Absence of an Active Website (0 - 30 points)
  let websiteAbsenceScore = 0;
  if (lead.websiteStatus === 'no_website_verified') {
    websiteAbsenceScore = 30; // Verified no website - top sales opportunity
  } else if (lead.websiteStatus === 'no_website_detected') {
    websiteAbsenceScore = 25; // No website listed on maps/directories
  } else if (lead.websiteStatus === 'broken_website') {
    websiteAbsenceScore = 20; // Broken/expired domain
  } else if (lead.websiteStatus === 'active_website') {
    websiteAbsenceScore = 5; // Active website
  }

  const totalScore = Math.min(100, Math.max(0, proximityScore + categoryRelevanceScore + websiteAbsenceScore));

  let priorityLabel: 'High Priority' | 'Medium Priority' | 'Low Priority' = 'Low Priority';
  if (totalScore >= 75) {
    priorityLabel = 'High Priority';
  } else if (totalScore >= 55) {
    priorityLabel = 'Medium Priority';
  }

  return {
    totalScore,
    proximityScore,
    categoryRelevanceScore,
    websiteAbsenceScore,
    distanceKm: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
    priorityLabel,
  };
}

/**
 * Normalizes a company name for duplicate detection (stripping LLC, Inc, Ltd, punctuation, whitespace).
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(llc|inc|ltd|corp|corporation|co|company|enterprises|pvt|private|limited)\b/gi, '')
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes phone numbers to comparable digits.
 */
export function normalizePhone(phone?: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').slice(-10);
}

/**
 * Deduplicates an array of leads based on phone number or normalized company name + city.
 */
export function deduplicateLeads<T extends { companyName: string; phoneNumber?: string; city?: string; fullAddress?: string }>(leads: T[]): T[] {
  const seenPhones = new Set<string>();
  const seenNameCity = new Set<string>();
  const result: T[] = [];

  for (const lead of leads) {
    const cleanPhone = normalizePhone(lead.phoneNumber);
    const cleanName = normalizeCompanyName(lead.companyName);
    const cleanCity = (lead.city || '').toLowerCase().trim();
    const nameCityKey = `${cleanName}__${cleanCity}`;

    let isDuplicate = false;

    if (cleanPhone.length >= 7 && seenPhones.has(cleanPhone)) {
      isDuplicate = true;
    }

    if (cleanName.length > 2 && seenNameCity.has(nameCityKey)) {
      isDuplicate = true;
    }

    if (!isDuplicate) {
      if (cleanPhone.length >= 7) seenPhones.add(cleanPhone);
      if (cleanName.length > 2) seenNameCity.add(nameCityKey);
      result.push(lead);
    }
  }

  return result;
}

export interface LeadFilterCriteria {
  searchQuery?: string;
  category?: string;
  websiteStatus?: string;
  minScore?: number;
  hasPhoneOnly?: boolean;
  opportunityTier?: string;
  crmStatus?: string;
}

/**
 * Filters a list of leads based on various user-selected criteria.
 */
export function filterLeads(leads: Lead[], criteria: LeadFilterCriteria): Lead[] {
  return leads.filter((lead) => {
    // Search query matches name, category, address, or phone
    if (criteria.searchQuery && criteria.searchQuery.trim()) {
      const q = criteria.searchQuery.toLowerCase().trim();
      const match =
        lead.companyName.toLowerCase().includes(q) ||
        lead.category.toLowerCase().includes(q) ||
        lead.city.toLowerCase().includes(q) ||
        (lead.phoneNumber && lead.phoneNumber.includes(q)) ||
        (lead.fullAddress && lead.fullAddress.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Category filter
    if (criteria.category && criteria.category !== 'all') {
      if (lead.category !== criteria.category) return false;
    }

    // Website status filter
    if (criteria.websiteStatus && criteria.websiteStatus !== 'all') {
      if (criteria.websiteStatus === 'no_website_any') {
        if (lead.websiteStatus !== 'no_website_verified' && lead.websiteStatus !== 'no_website_detected') {
          return false;
        }
      } else if (lead.websiteStatus !== criteria.websiteStatus) {
        return false;
      }
    }

    // Min Score
    if (typeof criteria.minScore === 'number' && criteria.minScore > 0) {
      if (lead.leadScore === undefined || lead.leadScore < criteria.minScore) return false;
    }

    // Has Phone
    if (criteria.hasPhoneOnly) {
      if (!lead.phoneNumber || lead.phoneNumber.toLowerCase().includes('not listed')) {
        return false;
      }
    }

    // Opportunity Tier
    if (criteria.opportunityTier && criteria.opportunityTier !== 'all') {
      if (lead.opportunityTier !== criteria.opportunityTier) return false;
    }

    // CRM Status
    if (criteria.crmStatus && criteria.crmStatus !== 'all') {
      if (lead.crmStatus !== criteria.crmStatus) return false;
    }

    return true;
  });
}

/**
 * Calculates aggregate statistics for the dashboard
 */
export function calculateLeadStats(leads: Lead[]) {
  const totalFound = leads.length;
  const verifiedNoWebsite = leads.filter((l) => l.websiteStatus === 'no_website_verified').length;
  const noWebsiteDetected = leads.filter((l) => l.websiteStatus === 'no_website_detected').length;
  const brokenWebsite = leads.filter((l) => l.websiteStatus === 'broken_website').length;
  const couldNotVerify = leads.filter(
    (l) => l.websiteStatus === 'could_not_verify' ||
      l.websiteStatus === 'no_website_detected' ||
      l.websiteStatus === 'broken_website'
  ).length;
  const hasWebsite = leads.filter((l) => l.websiteStatus === 'active_website').length;

  const totalWithoutWebsite = verifiedNoWebsite;

  const availablePhones = leads.filter(
    (l) => l.phoneNumber && l.phoneNumber.trim().length >= 7 && !l.phoneNumber.toLowerCase().includes('not listed')
  ).length;

  const qualifiedHighValue = leads.filter((l) => (l.leadScore ?? 0) >= 75).length;

  const crmConverted = leads.filter((l) => l.crmStatus === 'converted').length;
  const crmContacted = leads.filter((l) => l.crmStatus === 'contacted' || l.crmStatus === 'interested').length;

  return {
    totalFound,
    verifiedNoWebsite,
    noWebsiteDetected,
    brokenWebsite,
    couldNotVerify,
    hasWebsite,
    totalWithoutWebsite,
    availablePhones,
    qualifiedHighValue,
    crmConverted,
    crmContacted,
  };
}
