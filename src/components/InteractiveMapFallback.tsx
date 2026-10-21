import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Lead } from '../utils/leadScoring.ts';
import { WebsiteStatusBadge, LeadScoreBadge } from './StatusBadge.tsx';

interface InteractiveMapFallbackProps {
  leads: (Lead & { resolvedLat?: number; resolvedLng?: number; distanceToUser?: number | null })[];
  userLocation: { lat: number; lng: number } | null;
  selectedLead: Lead | null;
  onSelectLead: (lead: Lead) => void;
  mapType: 'roadmap' | 'satellite' | 'hybrid';
  center: { lat: number; lng: number };
  zoom: number;
}

export function InteractiveMapFallback({
  leads,
  userLocation,
  selectedLead,
  onSelectLead,
  mapType,
  center,
  zoom,
}: InteractiveMapFallbackProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: zoom,
        zoomControl: true,
      });

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update center when center prop changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([center.lat, center.lng], zoom, {
        animate: true,
      });
    }
  }, [center.lat, center.lng, zoom]);

  // Update base tile layer based on mapType (street vs satellite)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (mapType === 'satellite' || mapType === 'hybrid') {
      // Esri World Imagery for satellite
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
          maxZoom: 18,
        }
      ).addTo(map);
    } else {
      // CartoDB Voyager / OpenStreetMap for clean modern street view
      tileLayerRef.current = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map);
    }
  }, [mapType]);

  // Update markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // 1. User Live Location Marker
    if (userLocation) {
      const userHtml = `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(59, 130, 246, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 18px; height: 18px; border-radius: 50%; background: #2563eb; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);"></div>
          <div style="position: absolute; bottom: -18px; background: #1d4ed8; color: white; font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 4px; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">You Are Here</div>
        </div>
      `;

      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: userHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon });
      userMarker.bindTooltip('Your Live Current Location', { direction: 'top' });
      layer.addLayer(userMarker);
    }

    // 2. Business Leads Markers
    leads.forEach((lead) => {
      const lat = lead.resolvedLat ?? lead.latitude;
      const lng = lead.resolvedLng ?? lead.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const isVerifiedNoWebsite = lead.websiteStatus === 'no_website_verified';
      const bgColor = isVerifiedNoWebsite
        ? '#059669'
        : lead.websiteStatus === 'active_website'
          ? '#2563eb'
          : '#d97706';

      const iconHtml = `
        <div style="
          background: ${bgColor};
          color: white;
          border: 2px solid white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          border-radius: 9999px;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          cursor: pointer;
          transform: translate(-50%, -50%);
        ">
          <span>${isVerifiedNoWebsite ? '🛡️' : '📍'}</span>
          <span style="max-width: 100px; overflow: hidden; text-overflow: ellipsis;">${lead.companyName}</span>
        </div>
      `;

      const leadIcon = L.divIcon({
        className: 'custom-lead-marker',
        html: iconHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lng], { icon: leadIcon });

      marker.on('click', () => {
        onSelectLead(lead);
      });

      layer.addLayer(marker);
    });
  }, [leads, userLocation, onSelectLead]);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full z-0" />
      
      {/* Selected Lead Floating Overlay Card on top of map */}
      {selectedLead && (
        <div className="absolute bottom-4 left-4 z-20 max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                {selectedLead.companyName}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedLead.category} • {selectedLead.city}, {selectedLead.state}
              </p>
            </div>
            <LeadScoreBadge score={selectedLead.leadScore} />
          </div>

          <div className="mb-2.5">
            <WebsiteStatusBadge status={selectedLead.websiteStatus} />
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 mb-3">
            <p className="flex items-center gap-1.5 font-medium">
              📞 {selectedLead.phoneNumber || 'Not listed'}
            </p>
            <p className="truncate text-slate-500 dark:text-slate-400">
              📍 {selectedLead.fullAddress}
            </p>
            {(selectedLead as any).distanceToUser && (
              <p className="text-blue-600 dark:text-blue-400 font-semibold text-xs">
                🚗 {(selectedLead as any).distanceKm || (selectedLead as any).distanceToUser} km ({(selectedLead as any).distanceMiles || Math.round((selectedLead as any).distanceToUser * 0.62)} mi) from your live location
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {userLocation && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${encodeURIComponent(
                  selectedLead.fullAddress !== 'Unknown'
                    ? selectedLead.fullAddress
                    : `${selectedLead.latitude},${selectedLead.longitude}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition flex items-center gap-1"
              >
                🗺️ Directions
              </a>
            )}
            <button
              onClick={() => onSelectLead(selectedLead)}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition text-center"
            >
              Open Lead Dossier & Pitch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
