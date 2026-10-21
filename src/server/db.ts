import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FieldValue } from 'firebase-admin/firestore';
import type { Lead } from '../utils/leadScoring.ts';
import { firestore } from './firebaseAdmin.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(process.env.LEADPEBBLE_DATA_DIR || path.resolve(__dirname, '../../data'));
const DB_FILE = path.join(DATA_DIR, 'crm_leads.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function usesFirestore(): boolean {
  return process.env.NODE_ENV === 'production';
}

function getLeadCollection(userId: string) {
  if (!userId) {
    throw new Error('A signed-in user is required to access saved leads.');
  }
  return firestore.collection('users').doc(userId).collection('leads');
}

function getLeadDocumentId(id: string): string {
  return Buffer.from(id).toString('base64url');
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

function getLocalLeads(): Lead[] {
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

export async function getAllLeads(userId: string): Promise<Lead[]> {
  if (usesFirestore()) {
    const snapshot = await getLeadCollection(userId).orderBy('_savedAt', 'desc').get();
    return snapshot.docs.map((document) => {
      const lead = document.data();
      delete lead._savedAt;
      return lead as Lead;
    });
  }
  return getLocalLeads();
}

export async function saveLead(userId: string, lead: Lead): Promise<Lead> {
  const updatedLead: Lead = { ...lead, leadScore: undefined, opportunityTier: undefined };
  if (usesFirestore()) {
    await getLeadCollection(userId).doc(getLeadDocumentId(lead.id)).set({
      ...JSON.parse(JSON.stringify(updatedLead)),
      _savedAt: FieldValue.serverTimestamp(),
    });
    return updatedLead;
  }

  ensureDataDir();
  const leads = getLocalLeads();
  const existingIndex = leads.findIndex((item) => item.id === lead.id);

  if (existingIndex >= 0) {
    leads[existingIndex] = updatedLead;
  } else {
    leads.unshift(updatedLead);
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(leads, null, 2), 'utf-8');
  return updatedLead;
}

export async function batchSaveLeads(userId: string, newLeads: Lead[]): Promise<Lead[]> {
  const saved = newLeads.map((lead) => ({
    ...lead,
    leadScore: undefined,
    opportunityTier: undefined,
  }));
  if (usesFirestore()) {
    const collection = getLeadCollection(userId);
    const latestById = new Map<string, Lead>();
    saved.forEach((lead) => latestById.set(lead.id, lead));
    const entries = Array.from(latestById.entries());

    for (let offset = 0; offset < entries.length; offset += 500) {
      const batch = firestore.batch();
      entries.slice(offset, offset + 500).forEach(([id, lead]) => {
        batch.set(collection.doc(getLeadDocumentId(id)), {
          ...JSON.parse(JSON.stringify(lead)),
          _savedAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }
    return saved;
  }

  ensureDataDir();
  const currentLeads = getLocalLeads();

  for (const lead of saved) {
    const existingIndex = currentLeads.findIndex((item) => item.id === lead.id);

    if (existingIndex >= 0) {
      currentLeads[existingIndex] = lead;
    } else {
      currentLeads.unshift(lead);
    }
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(currentLeads, null, 2), 'utf-8');
  return saved;
}

export async function deleteLead(userId: string, id: string): Promise<boolean> {
  if (usesFirestore()) {
    const document = getLeadCollection(userId).doc(getLeadDocumentId(id));
    const existing = await document.get();
    if (existing.exists) {
      await document.delete();
      return true;
    }
    return false;
  }

  ensureDataDir();
  const leads = getLocalLeads();
  const filtered = leads.filter((lead) => lead.id !== id);
  if (filtered.length !== leads.length) {
    fs.writeFileSync(DB_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  }
  return false;
}
