import React, { useState, useEffect, useMemo } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import type { Lead } from '../utils/leadScoring.ts';
import { WebsiteStatusBadge, LeadScoreBadge } from './StatusBadge.tsx';
import {
  MapPin,
  ExternalLink,
  Phone,
  ShieldCheck,
  LocateFixed,
  Compass,
  Filter,
  Route,
  Key,
  AlertTriangle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { getStoredMapsApiKey } from '../utils/mapsKey.ts';
import { InteractiveMapFallback } from './InteractiveMapFallback.tsx';
import { MapApiKeyModal } from './MapApiKeyModal.tsx';

interface LeadMapViewProps {
  leads: Lead[];
  userLocation: { lat: number; lng: number } | null;
  onSelectLead: (lead: Lead) => void;
  onRequestUserLocation?: () => void;
  isLocating?: boolean;
}

// Controller component to smoothly pan/zoom map when user location or leads change
function MapRecenterController({
  center,
  zoom,
}: {
  center: { lat: number; lng: number };
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (map && center) {
      map.panTo(center);
    }
  }, [map, center]);
  return null;
}

function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of the Earth in miles
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

export function LeadMapView({
  leads,
  userLocation,
  onSelectLead,
  onRequestUserLocation,
  isLocating,
}: LeadMapViewProps) {
  const [apiKey, setApiKey] = useState<string>(() => getStoredMapsApiKey());
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified_only' | 'missing_only'>('all');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [hasAuthError, setHasAuthError] = useState(false);
  const [useFallbackMap, setUseFallbackMap] = useState(() => !apiKey);

  // Listen for key changes in localStorage
  useEffect(() => {
    const handleKeyChange = (e: any) => {
      const nextKey = typeof e.detail === 'string' ? e.detail : '';
      setApiKey(nextKey);
      setHasAuthError(false);
      setUseFallbackMap(!nextKey);
    };
    window.addEventListener('maps-key-changed', handleKeyChange);
    return () => window.removeEventListener('maps-key-changed', handleKeyChange);
  }, []);

  // Catch Google Maps authentication failures (e.g. InvalidKeyMapError, BillingNotEnabledMapError)
  useEffect(() => {
    const prevAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      console.warn('[LeadMapView] Google Maps Authentication Failure detected. Switching to resilient map mode.');
      setHasAuthError(true);
      setUseFallbackMap(true);
      if (typeof prevAuthFailure === 'function') {
        prevAuthFailure();
      }
    };

    // Global listener for cross-origin or script error from Google Maps
    const errorHandler = (event: ErrorEvent) => {
      const msg = String(event.message || '');
      if (
        msg.includes('InvalidKeyMapError') ||
        msg.includes('Google Maps') ||
        msg.includes('gm_authFailure') ||
        event.filename?.includes('maps.googleapis.com')
      ) {
        console.warn('[LeadMapView] Caught Google Maps script error:', msg);
        setHasAuthError(true);
        setUseFallbackMap(true);
      }
    };

    window.addEventListener('error', errorHandler);

    return () => {
      (window as any).gm_authFailure = prevAuthFailure;
      window.removeEventListener('error', errorHandler);
    };
  }, []);

  // Default center uses the user's location or a company coordinate that has a source.
  const defaultCenter = useMemo(() => {
    if (userLocation) return userLocation;
    const firstWithCoords = leads.find((l) => l.latitude !== undefined && l.longitude !== undefined &&
      Number.isFinite(l.latitude) && Number.isFinite(l.longitude));
    if (firstWithCoords) {
      return { lat: firstWithCoords.latitude!, lng: firstWithCoords.longitude! };
    }
    return { lat: 0, lng: 0 };
  }, [userLocation, leads]);

  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(12);

  // Recenter when user location changes
  useEffect(() => {
    if (userLocation) {
      setMapCenter(userLocation);
      setMapZoom(12);
    }
  }, [userLocation]);

  // Filter leads based on map filter
  const displayedLeads = useMemo(() => {
    return leads.filter((l) => {
      if (!Number.isFinite(l.latitude) || !Number.isFinite(l.longitude)) return false;
      if (statusFilter === 'verified_only') return l.websiteStatus === 'no_website_verified';
      if (statusFilter === 'missing_only') return l.websiteStatus === 'could_not_verify';
      return true;
    });
  }, [leads, statusFilter]);

  // Compute pins with coordinates and distance to live user location
  const pinnedLeads = useMemo(() => {
    return displayedLeads.map((lead) => {
      const lat = lead.latitude!;
      const lng = lead.longitude!;

      const distanceKm =
        userLocation && Number.isFinite(lat) && Number.isFinite(lng)
          ? Math.round(
              6371 *
                2 *
                Math.atan2(
                  Math.sqrt(
                    Math.sin((((lat - userLocation.lat) * Math.PI) / 180) / 2) ** 2 +
                      Math.cos((userLocation.lat * Math.PI) / 180) *
                        Math.cos((lat * Math.PI) / 180) *
                        Math.sin((((lng - userLocation.lng) * Math.PI) / 180) / 2) ** 2
                  ),
                  Math.sqrt(
                    1 -
                      (Math.sin((((lat - userLocation.lat) * Math.PI) / 180) / 2) ** 2 +
                        Math.cos((userLocation.lat * Math.PI) / 180) *
                          Math.cos((lat * Math.PI) / 180) *
                          Math.sin((((lng - userLocation.lng) * Math.PI) / 180) / 2) ** 2)
                  )
                ) *
                10
            ) / 10
          : null;

      const distanceMiles = distanceKm ? Math.round(distanceKm * 0.621371 * 10) / 10 : null;

      return {
        ...lead,
        resolvedLat: lat,
        resolvedLng: lng,
        distanceToUser: distanceKm,
        distanceKm,
        distanceMiles,
      };
    });
  }, [displayedLeads, userLocation]);

  return (
    <div className="relative w-full h-[680px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl bg-slate-100 dark:bg-slate-900 flex flex-col">
      
      {/* Top Map Action Strip */}
      <div className="absolute top-3 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        
        {/* Real Live Map Status Badge */}
        <div className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg flex items-center gap-2.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {useFallbackMap ? 'Interactive Live Map' : 'Google Maps Live'}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            ({pinnedLeads.length} leads in view)
          </span>
          {userLocation && (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-[10px]">
              GPS Live
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          
          {/* Target Filter */}
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-md flex items-center text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-slate-700 dark:text-slate-300 font-medium text-xs focus:outline-hidden pr-2 cursor-pointer"
            >
              <option value="all">All Targets</option>
              <option value="verified_only">No website found</option>
              <option value="missing_only">Could not verify</option>
            </select>
          </div>

          {/* Map Layer Mode */}
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-md flex items-center text-xs">
            <button
              onClick={() => setMapType('roadmap')}
              className={`px-2 py-1 rounded-lg font-medium transition ${
                mapType === 'roadmap'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Street
            </button>
            <button
              onClick={() => setMapType('satellite')}
              className={`px-2 py-1 rounded-lg font-medium transition ${
                mapType === 'satellite' || mapType === 'hybrid'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Satellite
            </button>
          </div>

          {/* Live Current Location GPS Trigger */}
          {onRequestUserLocation && (
            <button
              onClick={onRequestUserLocation}
              disabled={isLocating}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <LocateFixed className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {isLocating
                  ? 'Acquiring GPS...'
                  : userLocation
                  ? 'Re-Center GPS'
                  : 'Use My Live Location'}
              </span>
            </button>
          )}

          {/* Map Engine Toggle */}
          <button
            onClick={() => setUseFallbackMap(!useFallbackMap)}
            className="px-2.5 py-2 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
            title="Toggle between Google Maps and Resilient Interactive Map"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden md:inline">
              {useFallbackMap ? 'Use Google Maps' : 'Use Leaflet Map'}
            </span>
          </button>

          {/* API Key Settings Button */}
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="p-2 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-1"
            title="Configure Google Maps API Key"
          >
            <Key className="w-3.5 h-3.5 text-amber-500" />
          </button>
        </div>
      </div>

      {/* Auth / Billing Notice Banner if Google Maps had an issue */}
      {hasAuthError && (
        <div className="absolute top-16 left-3 right-3 z-30 bg-amber-500/95 text-white backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg flex items-center justify-between gap-2 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Google Maps Notice: Key requires billing enablement in Google Cloud Console. Seamlessly displaying interactive live map fallback.
            </span>
          </div>
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-black/20 hover:bg-black/30 font-semibold transition shrink-0"
          >
            Update Key
          </button>
        </div>
      )}

      {/* Main Map Render: Google Maps or Resilient Fallback Map */}
      <div className="flex-1 w-full h-full relative" style={{ minHeight: '520px' }}>
        {useFallbackMap ? (
          <InteractiveMapFallback
            leads={pinnedLeads}
            userLocation={userLocation}
            selectedLead={selectedLead}
            onSelectLead={onSelectLead}
            mapType={mapType}
            center={mapCenter}
            zoom={mapZoom}
          />
        ) : (
          <APIProvider
            apiKey={apiKey}
            onError={(err) => {
              console.warn('[LeadMapView] APIProvider onError:', err);
              setHasAuthError(true);
              setUseFallbackMap(true);
            }}
          >
            <Map
              defaultCenter={defaultCenter}
              defaultZoom={mapZoom}
              mapId="DEMO_MAP_ID"
              mapTypeId={mapType}
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
              gestureHandling="greedy"
              disableDefaultUI={false}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            >
              <MapRecenterController center={mapCenter} zoom={mapZoom} />

              {/* User Live Location Marker with Animated Pulse */}
              {userLocation && (
                <AdvancedMarker
                  position={{ lat: userLocation.lat, lng: userLocation.lng }}
                  title="Your Current Live Location"
                >
                  <div className="relative flex items-center justify-center cursor-pointer">
                    <span className="animate-ping absolute inline-flex h-9 w-9 rounded-full bg-blue-500 opacity-75" />
                    <div className="relative w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-black">
                      📍
                    </div>
                    <span className="absolute -bottom-5 bg-blue-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                      You Are Here
                    </span>
                  </div>
                </AdvancedMarker>
              )}

              {/* Plotted Business Leads Markers */}
              {pinnedLeads.map((lead) => {
                const isVerifiedNoWebsite = lead.websiteStatus === 'no_website_verified';
                const pinColor = isVerifiedNoWebsite
                  ? 'bg-emerald-600 border-white text-white'
                  : lead.websiteStatus === 'active_website'
                    ? 'bg-blue-600 border-white text-white'
                    : 'bg-amber-600 border-white text-white';

                return (
                  <AdvancedMarker
                    key={lead.id}
                    position={{ lat: lead.resolvedLat, lng: lead.resolvedLng }}
                    onClick={() => setSelectedLead(lead)}
                    title={lead.companyName}
                  >
                    <div
                      className={`cursor-pointer group transform hover:scale-110 transition flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-xl border-2 ${pinColor}`}
                    >
                      {isVerifiedNoWebsite ? (
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="max-w-[130px] truncate text-[11px]">
                        {lead.companyName}
                      </span>
                    </div>
                  </AdvancedMarker>
                );
              })}

              {/* InfoWindow for Selected Lead */}
              {selectedLead && (
                <InfoWindow
                  position={{
                    lat: (selectedLead as any).resolvedLat || selectedLead.latitude || defaultCenter.lat,
                    lng: (selectedLead as any).resolvedLng || selectedLead.longitude || defaultCenter.lng,
                  }}
                  onCloseClick={() => setSelectedLead(null)}
                >
                  <div className="p-2.5 max-w-xs space-y-2.5 text-slate-900 font-sans">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm leading-snug text-slate-900">
                          {selectedLead.companyName}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {selectedLead.category} {selectedLead.subCategory ? `• ${selectedLead.subCategory}` : ''}
                        </p>
                      </div>
                      <LeadScoreBadge score={selectedLead.leadScore} />
                    </div>

                    <div>
                      <WebsiteStatusBadge status={selectedLead.websiteStatus} />
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1 pt-1.5 border-t border-slate-200">
                      <p className="flex items-center gap-1 font-medium">
                        <Phone className="w-3 h-3 text-indigo-600" />
                        {selectedLead.phoneNumber || 'Not listed'}
                      </p>
                      <p className="flex items-center gap-1 truncate text-slate-700">
                        <MapPin className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span className="truncate">{selectedLead.fullAddress}</span>
                      </p>
                      {(selectedLead as any).distanceToUser !== undefined && (selectedLead as any).distanceToUser !== null && (
                        <p className="flex items-center gap-1 text-blue-700 font-semibold text-[11px]">
                          <Route className="w-3 h-3 text-blue-600 shrink-0" />
                          {(selectedLead as any).distanceKm || (selectedLead as any).distanceToUser} km ({(selectedLead as any).distanceMiles || Math.round((selectedLead as any).distanceToUser * 0.62)} mi) from your live location
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500">
                        Rating: {selectedLead.rating ?? 'Not verified'}{selectedLead.reviewCount !== undefined ? ` (${selectedLead.reviewCount} reviews)` : ''}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200">
                      {userLocation ? (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${encodeURIComponent(
                            selectedLead.fullAddress !== 'Unknown' ? selectedLead.fullAddress : `${selectedLead.latitude},${selectedLead.longitude}`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Route className="w-3 h-3" />
                          Directions
                        </a>
                      ) : selectedLead.googleMapsUrl ? (
                        <a
                          href={selectedLead.googleMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Google Maps
                        </a>
                      ) : null}

                      <button
                        onClick={() => onSelectLead(selectedLead)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition"
                      >
                        Open Dossier & Pitch
                      </button>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        )}
      </div>

      {/* Map Legend & Summary Footer */}
      <div className="px-5 py-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-slate-800 dark:text-slate-200">Map Legend:</span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            No website found
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            Website found
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
            Could not verify
          </span>
          {userLocation && (
            <span className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
              Live Current Location
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsKeyModalOpen(true)}
            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium flex items-center gap-1"
          >
            <Key className="w-3 h-3" />
            Configure Google Maps Key
          </button>
        </div>
      </div>

      {/* API Key Modal */}
      <MapApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        onKeyUpdated={() => {
          setApiKey(getStoredMapsApiKey());
          setHasAuthError(false);
          setUseFallbackMap(false);
        }}
      />

    </div>
  );
}
