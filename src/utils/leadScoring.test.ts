import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateLeadScore,
  calculateDiscoveryLeadScore,
  deduplicateLeads,
  filterLeads,
  calculateLeadStats,
  normalizeCompanyName,
  normalizePhone,
} from './leadScoring.ts';
import type { Lead } from './leadScoring.ts';

test('calculateLeadScore assigns highest tier to verified no-website with phone and good ratings', () => {
  const result = calculateLeadScore({
    category: 'Precision Machining & CNC',
    websiteStatus: 'no_website_verified',
    phoneNumber: '+1 (555) 234-5678',
    email: 'info@precisionmfg.com',
    rating: 4.8,
    reviewCount: 35,
  });

  assert.ok(result.score >= 80, `Expected score >= 80, got ${result.score}`);
  assert.equal(result.opportunityTier, 'High');
});

test('calculateLeadScore assigns lower score when business already has an active website', () => {
  const withWebsite = calculateLeadScore({
    category: 'Packaging & Corrugated Boxes',
    websiteStatus: 'active_website',
    phoneNumber: '+1 555-111-2222',
    rating: 4.2,
    reviewCount: 10,
  });

  const withoutWebsite = calculateLeadScore({
    category: 'Packaging & Corrugated Boxes',
    websiteStatus: 'no_website_verified',
    phoneNumber: '+1 555-111-2222',
    rating: 4.2,
    reviewCount: 10,
  });

  assert.ok(
    withoutWebsite.score > withWebsite.score + 25,
    `Without website (${withoutWebsite.score}) should be significantly higher than with website (${withWebsite.score})`
  );
});

test('normalizeCompanyName strips legal suffixes and punctuation', () => {
  assert.equal(normalizeCompanyName('Apex Machining & Tooling, LLC'), 'apex machining tooling');
  assert.equal(normalizeCompanyName('Sunrise Textiles Pvt. Ltd.'), 'sunrise textiles');
});

test('normalizePhone extracts last 10 clean digits', () => {
  assert.equal(normalizePhone('+1 (312) 555-0199'), '3125550199');
  assert.equal(normalizePhone('555-0199'), '5550199');
});

test('deduplicateLeads correctly removes duplicates by phone or company name + city', () => {
  const items = [
    { companyName: 'Apex Machining LLC', phoneNumber: '(312) 555-0199', city: 'Chicago' },
    { companyName: 'Apex Machining Inc.', phoneNumber: '(312) 555-0199', city: 'Chicago' }, // duplicate phone & name
    { companyName: 'Apex Machining Ltd.', phoneNumber: '(312) 999-9999', city: 'Chicago' }, // duplicate name+city
    { companyName: 'Delta Fabrication', phoneNumber: '(312) 555-4321', city: 'Chicago' },
  ];

  const unique = deduplicateLeads(items);
  assert.equal(unique.length, 2);
  assert.equal(unique[0].companyName, 'Apex Machining LLC');
  assert.equal(unique[1].companyName, 'Delta Fabrication');
});

test('filterLeads filters by category, websiteStatus, minScore and hasPhone', () => {
  const sampleLeads: Lead[] = [
    {
      id: '1',
      companyName: 'Titan CNC',
      category: 'Precision Machining & CNC',
      phoneNumber: '555-1234567',
      fullAddress: '123 Industrial Way, Detroit, MI',
      city: 'Detroit',
      country: 'USA',
      rating: 4.6,
      reviewCount: 18,
      websiteStatus: 'no_website_verified',
      leadScore: 92,
      opportunityTier: 'High',
      crmStatus: 'discovered',
      tags: ['machining'],
      source: 'Google Maps',
      createdAt: '2026-10-16T00:00:00Z',
    },
    {
      id: '2',
      companyName: 'Brite Threads Mill',
      category: 'Textiles & Garment Manufacturing',
      phoneNumber: 'Not listed',
      fullAddress: '456 Loom St, Charlotte, NC',
      city: 'Charlotte',
      country: 'USA',
      rating: 3.5,
      reviewCount: 3,
      websiteStatus: 'active_website',
      leadScore: 38,
      opportunityTier: 'Low',
      crmStatus: 'discovered',
      tags: ['textiles'],
      source: 'Google Maps',
      createdAt: '2026-10-16T00:00:00Z',
    },
  ];

  const highOnly = filterLeads(sampleLeads, { minScore: 80 });
  assert.equal(highOnly.length, 1);
  assert.equal(highOnly[0].companyName, 'Titan CNC');

  const phoneOnly = filterLeads(sampleLeads, { hasPhoneOnly: true });
  assert.equal(phoneOnly.length, 1);
  assert.equal(phoneOnly[0].companyName, 'Titan CNC');
});

test('calculateLeadStats produces accurate metric aggregates', () => {
  const leads: Lead[] = [
    {
      id: '1',
      companyName: 'A',
      category: 'Precision Machining & CNC',
      phoneNumber: '555-111-2222',
      fullAddress: 'A',
      city: 'A',
      country: 'USA',
      rating: 5,
      reviewCount: 10,
      websiteStatus: 'no_website_verified',
      leadScore: 90,
      opportunityTier: 'High',
      crmStatus: 'contacted',
      tags: [],
      source: 'G',
      createdAt: '',
    },
    {
      id: '2',
      companyName: 'B',
      category: 'Textiles & Garment Manufacturing',
      phoneNumber: '555-333-4444',
      fullAddress: 'B',
      city: 'B',
      country: 'USA',
      rating: 4,
      reviewCount: 5,
      websiteStatus: 'no_website_detected',
      leadScore: 78,
      opportunityTier: 'High',
      crmStatus: 'converted',
      tags: [],
      source: 'G',
      createdAt: '',
    },
    {
      id: '3',
      companyName: 'C',
      category: 'Metal Fabrication & Welding',
      fullAddress: 'C',
      city: 'C',
      country: 'USA',
      rating: 4,
      reviewCount: 2,
      websiteStatus: 'active_website',
      leadScore: 40,
      opportunityTier: 'Low',
      crmStatus: 'discovered',
      tags: [],
      source: 'G',
      createdAt: '',
    },
  ];

  const stats = calculateLeadStats(leads);
  assert.equal(stats.totalFound, 3);
  assert.equal(stats.verifiedNoWebsite, 1);
  assert.equal(stats.noWebsiteDetected, 1);
  assert.equal(stats.hasWebsite, 1);
  assert.equal(stats.totalWithoutWebsite, 1);
  assert.equal(stats.availablePhones, 2);
  assert.equal(stats.qualifiedHighValue, 2);
  assert.equal(stats.crmConverted, 1);
  assert.equal(stats.crmContacted, 1);
});

test('calculateDiscoveryLeadScore ranks companies based on proximity, category relevance, and website absence', () => {
  const userLoc = { lat: 11.0168, lng: 76.9558 }; // Gandhipuram, Coimbatore

  // Lead A: Close (1.5 km), Exact category match (Pumps), Verified NO website
  const leadA = {
    category: 'Pumps, Motors & Foundry Castings',
    subCategory: 'Submersible Pumps',
    websiteStatus: 'no_website_verified' as const,
    latitude: 11.025,
    longitude: 76.96,
  };

  // Lead B: Far (25 km), Different category, Active website
  const leadB = {
    category: 'Textiles & Spinning Mill Spares',
    subCategory: 'Ring Frames',
    websiteStatus: 'active_website' as const,
    latitude: 11.2,
    longitude: 77.15,
  };

  const scoreA = calculateDiscoveryLeadScore(leadA, userLoc, 'Pumps, Motors & Foundry Castings');
  const scoreB = calculateDiscoveryLeadScore(leadB, userLoc, 'Pumps, Motors & Foundry Castings');

  // Lead A should have high scores across proximity, category relevance, and website absence
  assert.ok(scoreA.proximityScore >= 30, `Expected proximity >= 30, got ${scoreA.proximityScore}`);
  assert.equal(scoreA.categoryRelevanceScore, 35);
  assert.equal(scoreA.websiteAbsenceScore, 30);
  assert.ok(scoreA.totalScore >= 90, `Expected scoreA >= 90, got ${scoreA.totalScore}`);
  assert.equal(scoreA.priorityLabel, 'High Priority');

  // Lead B should score significantly lower on all 3 factors
  assert.ok(scoreB.proximityScore <= 18, `Expected proximity <= 18, got ${scoreB.proximityScore}`);
  assert.ok(scoreB.categoryRelevanceScore <= 20, `Expected category <= 20, got ${scoreB.categoryRelevanceScore}`);
  assert.equal(scoreB.websiteAbsenceScore, 5);
  assert.ok(scoreA.totalScore > scoreB.totalScore + 40, `scoreA (${scoreA.totalScore}) should far exceed scoreB (${scoreB.totalScore})`);
});
