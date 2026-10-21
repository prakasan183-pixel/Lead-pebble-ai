/**
 * Geolocation & Live GPS Service
 * Provides device GPS integration, real-time tracking, permission diagnosis,
 * and Coimbatore (Tamil Nadu, India) industrial presets.
 */

export interface GeoCoordinates {
  lat: number;
  lng: number;
  accuracy?: number; // in meters
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
}

export interface LocationPreset {
  id: string;
  name: string;
  shortName: string;
  region: string;
  state: string;
  country: string;
  coords: GeoCoordinates;
  description: string;
}

export const COIMBATORE_DEFAULT_HUB: LocationPreset = {
  id: 'cbe-central',
  name: 'Coimbatore, Tamil Nadu, India',
  shortName: 'Coimbatore (CBE)',
  region: 'Gandhipuram / Central CBE',
  state: 'Tamil Nadu',
  country: 'India',
  coords: { lat: 11.0168, lng: 76.9558, accuracy: 10 },
  description: 'The Manchester of South India - Major pump, motor, foundry, and textile cluster.',
};

export const INDUSTRIAL_HUBS_PRESETS: LocationPreset[] = [
  COIMBATORE_DEFAULT_HUB,
  {
    id: 'cbe-kurichi-sidco',
    name: 'SIDCO Industrial Estate, Kurichi, Coimbatore',
    shortName: 'Kurichi SIDCO (CBE)',
    region: 'Kurichi / Eachanari',
    state: 'Tamil Nadu',
    country: 'India',
    coords: { lat: 10.9382, lng: 76.9712, accuracy: 15 },
    description: 'Heavy pump manufacturing, foundry casting units, and valve fabrication.',
  },
  {
    id: 'cbe-peelamedu',
    name: 'Peelamedu & SITRA Industrial Corridor, Coimbatore',
    shortName: 'Peelamedu (CBE)',
    region: 'Avinashi Road / Aerodrome',
    state: 'Tamil Nadu',
    country: 'India',
    coords: { lat: 11.0285, lng: 77.0189, accuracy: 15 },
    description: 'Precision engineering, textile machinery spares, and CNC machine shops.',
  },
  {
    id: 'cbe-ganapathy',
    name: 'Ganapathy & Avarampalayam Industrial Belt, Coimbatore',
    shortName: 'Ganapathy (CBE)',
    region: 'Ganapathy',
    state: 'Tamil Nadu',
    country: 'India',
    coords: { lat: 11.036, lng: 76.978, accuracy: 15 },
    description: 'Submersible pumps, commercial wet grinder manufacturing, and electrical motors.',
  },
  {
    id: 'tirupur-knitwear',
    name: 'Tirupur, Tamil Nadu, India',
    shortName: 'Tirupur Knitwear Hub',
    region: 'Tirupur Industrial Corridor',
    state: 'Tamil Nadu',
    country: 'India',
    coords: { lat: 11.1085, lng: 77.3411, accuracy: 20 },
    description: 'India\'s knitwear and textile export powerhouse.',
  },
  {
    id: 'chennai-guindy',
    name: 'Guindy & Ambattur Industrial Estate, Chennai',
    shortName: 'Chennai Auto Corridor',
    region: 'Guindy / Ambattur',
    state: 'Tamil Nadu',
    country: 'India',
    coords: { lat: 13.0067, lng: 80.2026, accuracy: 25 },
    description: 'Automotive OEM components, electrical switchgear, and manufacturing.',
  },
  {
    id: 'bengaluru-peenya',
    name: 'Peenya Industrial Area, Bengaluru, Karnataka',
    shortName: 'Peenya, Bengaluru',
    region: 'Peenya',
    state: 'Karnataka',
    country: 'India',
    coords: { lat: 13.0285, lng: 77.5186, accuracy: 25 },
    description: 'One of the largest industrial clusters in South Asia for machine tools.',
  },
];

const STORAGE_KEY_LOCATION = 'leadpulse_location_preference';

export interface StoredLocation {
  mode: 'live_gps' | 'preset' | 'manual';
  coords: GeoCoordinates;
  name: string;
  isRealGps: boolean;
  updatedAt: number;
}

export function getStoredLocation(): StoredLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCATION);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredLocation(loc: StoredLocation): void {
  try {
    localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(loc));
  } catch (e) {
    console.warn('Failed to persist location preference:', e);
  }
}

/**
 * Check browser geolocation permission state
 */
export async function getGeolocationPermissionState(): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return 'unsupported';
  }
  if (!navigator.permissions || !navigator.permissions.query) {
    return 'prompt';
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return 'prompt';
  }
}

/**
 * Request single high-accuracy position with automatic retry fallback
 */
export function requestLivePosition(): Promise<GeoCoordinates> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    // Try high accuracy first
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
      },
      (highAccError) => {
        console.warn('High accuracy GPS timed out or failed, retrying with standard accuracy:', highAccError);
        // Fallback retry with lower accuracy requirement
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
              timestamp: pos.timestamp,
            });
          },
          (err) => {
            reject(err);
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 120000,
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000,
      }
    );
  });
}

/**
 * Start live GPS tracking watcher
 */
export function watchLivePosition(
  onUpdate: (coords: GeoCoordinates) => void,
  onError: (error: GeolocationPositionError) => void
): number | null {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return null;
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      onUpdate({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        timestamp: pos.timestamp,
      });
    },
    (err) => {
      onError(err);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    }
  );

  return watchId;
}

/**
 * Stop live GPS tracking watcher
 */
export function clearLiveTracking(watchId: number | null): void {
  if (typeof window !== 'undefined' && navigator.geolocation && watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Calculate distance in Kilometers using Haversine formula
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Format distance smartly (e.g. "2.4 km" or "850 m")
 */
export function formatDistanceKm(distanceKm: number | null | undefined): string {
  if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm)) {
    return '—';
  }
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}
