import type { Lead } from '../utils/leadScoring.ts';

const SAVED_LEADS_KEY = 'leadpebble_saved_leads';
const PROFILE_NAME_KEY = 'leadpebble_profile_name';

function isLead(value: unknown): value is Lead {
  if (!value || typeof value !== 'object') return false;
  return 'id' in value &&
    typeof value.id === 'string' &&
    'companyName' in value &&
    typeof value.companyName === 'string';
}

export function getSavedLeads(): Lead[] {
  const saved = localStorage.getItem(SAVED_LEADS_KEY);
  if (!saved) return [];

  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed) || !parsed.every(isLead)) {
    throw new Error('Saved companies data is invalid. Clear this browser’s LeadPebble storage to continue.');
  }
  return parsed;
}

export function saveLeads(leads: Lead[]): void {
  localStorage.setItem(SAVED_LEADS_KEY, JSON.stringify(leads));
}

export function getLocalProfileName(): string {
  return localStorage.getItem(PROFILE_NAME_KEY) || 'My workspace';
}

export function saveLocalProfileName(name: string): void {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Enter a name before saving.');
  localStorage.setItem(PROFILE_NAME_KEY, normalizedName);
}
