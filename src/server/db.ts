import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Lead } from '../utils/leadScoring.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(process.env.LEADPEBBLE_DATA_DIR || path.resolve(__dirname, '../../data'));
const DB_FILE = path.join(DATA_DIR, 'crm_leads.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function cleanLeadRecords(leads: Lead[]): Lead[] {
  return leads
    .filter((lead) =>
      !/^lead-cbe-\d+$/i.test(lead.id) &&
      !/^lead-gen-/i.test(lead.id) &&
      !/^Google (Maps|Search) Grounding$/i.test(lead.source || '')
    )
    .map((lead) => {
      if (
        lead.verificationDetails?.method === 'identity_verified' ||
        (lead.verificationDetails?.method === 'search_grounding' && lead.verificationDetails.sourceUrl)
      ) return lead;
      const manualEntry = lead.source === 'Manual Add' || lead.source === 'Manual entry (not independently verified)';
      const hasSource = (field: string) => Boolean(lead.fieldSources?.[field]?.length);
      return {
        ...lead,
        companyName: manualEntry || hasSource('companyName') ? lead.companyName : 'Unknown',
        category: manualEntry || hasSource('category') ? lead.category : 'Unknown',
        phoneNumber: manualEntry || hasSource('phoneNumber') ? lead.phoneNumber : undefined,
        email: manualEntry || hasSource('email') ? lead.email : undefined,
        fullAddress: manualEntry || hasSource('fullAddress') ? lead.fullAddress : 'Unknown',
        city: manualEntry || hasSource('city') ? lead.city : 'Unknown',
        state: manualEntry || hasSource('state') ? lead.state : undefined,
        country: manualEntry || hasSource('country') ? lead.country : 'Unknown',
        latitude: manualEntry || hasSource('latitude') ? lead.latitude : undefined,
        longitude: manualEntry || hasSource('longitude') ? lead.longitude : undefined,
        rating: manualEntry || hasSource('rating') ? lead.rating : undefined,
        reviewCount: manualEntry || hasSource('reviewCount') ? lead.reviewCount : undefined,
        yearsInBusiness: manualEntry || hasSource('yearsInBusiness') ? lead.yearsInBusiness : undefined,
        employeeRange: manualEntry || hasSource('employeeRange') ? lead.employeeRange : undefined,
        estimatedRevenueTier: manualEntry || hasSource('estimatedRevenueTier') ? lead.estimatedRevenueTier : undefined,
        websiteStatus: 'could_not_verify',
        websiteUrl: null,
        leadScore: undefined,
        opportunityTier: undefined,
        source: manualEntry ? 'Manual entry (not independently verified)' : (lead.source?.includes('Grounding')
          ? 'Legacy CRM record (not verified)'
          : lead.source || 'Not verified'),
        verificationDetails: {
          dnsChecked: false,
          hasActiveDns: false,
          notes: 'Legacy website information has not been re-verified.',
          verifiedAt: '',
          method: 'manual',
        },
      };
    });
}

export function getAllLeads(): Lead[] {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, '[]', 'utf-8');
    return [];
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Lead[];
    if (!Array.isArray(parsed)) {
      throw new Error('CRM data must be a JSON array');
    }
    const cleaned = cleanLeadRecords(parsed);
    if (JSON.stringify(cleaned) !== JSON.stringify(parsed)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(cleaned, null, 2), 'utf-8');
    }
    return cleaned;
  } catch (err) {
    console.error('Error reading leads database:', err);
    throw err;
  }
}

export function saveLead(lead: Lead): Lead {
  ensureDataDir();
  const leads = getAllLeads();
  const existingIndex = leads.findIndex((item) => item.id === lead.id);
  const updatedLead: Lead = { ...lead, leadScore: undefined, opportunityTier: undefined };

  if (existingIndex >= 0) {
    leads[existingIndex] = updatedLead;
  } else {
    leads.unshift(updatedLead);
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(leads, null, 2), 'utf-8');
  return updatedLead;
}

export function batchSaveLeads(newLeads: Lead[]): Lead[] {
  ensureDataDir();
  const currentLeads = getAllLeads();
  const saved: Lead[] = [];

  for (const lead of newLeads) {
    const existingIndex = currentLeads.findIndex((item) => item.id === lead.id);
    const updatedLead: Lead = { ...lead, leadScore: undefined, opportunityTier: undefined };

    if (existingIndex >= 0) {
      currentLeads[existingIndex] = updatedLead;
    } else {
      currentLeads.unshift(updatedLead);
    }
    saved.push(updatedLead);
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(currentLeads, null, 2), 'utf-8');
  return saved;
}

export function deleteLead(id: string): boolean {
  ensureDataDir();
  const leads = getAllLeads();
  const filtered = leads.filter((lead) => lead.id !== id);
  if (filtered.length !== leads.length) {
    fs.writeFileSync(DB_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  }
  return false;
}
