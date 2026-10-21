/**
 * Utility for managing and normalizing Google Maps API Keys.
 * Auto-corrects common OCR/font typos (e.g. lowercase 'l' or '1' instead of capital 'I' in 'AIzaSy').
 */

export function normalizeGoogleMapsApiKey(rawKey?: string | null): string {
  if (!rawKey) return '';
  let cleaned = rawKey.trim();
  // Remove enclosing quotes if pasted with quotes
  cleaned = cleaned.replace(/^['"]|['"]$/g, '');

  // Auto-correct 'AlzaSy' (lowercase L) or 'A1zaSy' (digit 1) -> 'AIzaSy' (capital I)
  if (cleaned.startsWith('AlzaSy')) {
    cleaned = 'AIzaSy' + cleaned.slice(6);
  } else if (cleaned.startsWith('A1zaSy')) {
    cleaned = 'AIzaSy' + cleaned.slice(6);
  }

  return cleaned;
}

const LOCAL_STORAGE_KEY = 'leadpulse_custom_maps_key';

export function getStoredMapsApiKey(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (custom && custom.trim()) {
      return normalizeGoogleMapsApiKey(custom);
    }
  }

  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (envKey) {
    return normalizeGoogleMapsApiKey(envKey);
  }

  return '';
}

export function setStoredMapsApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    const normalized = normalizeGoogleMapsApiKey(key);
    if (normalized) {
      localStorage.setItem(LOCAL_STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent('maps-key-changed', { detail: normalized }));
  }
}
