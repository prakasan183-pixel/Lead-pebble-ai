import React from 'react';
import {
  MapPin,
  LocateFixed,
  Radio,
  Building,
  RotateCcw,
} from 'lucide-react';
import {
  COIMBATORE_DEFAULT_HUB,
  INDUSTRIAL_HUBS_PRESETS,
  type GeoCoordinates,
  type LocationPreset,
} from '../services/geolocation.ts';

interface LiveLocationControlProps {
  userLocation: GeoCoordinates | null;
  locationName: string;
  isLocating: boolean;
  isTrackingLiveGps: boolean;
  onToggleLiveGps: () => void;
  onSelectPreset: (preset: LocationPreset) => void;
  onRefreshLocation: () => void;
  permissionError?: string | null;
  distanceFilter?: number | null;
  onChangeDistanceFilter?: (km: number | null) => void;
}

export function LiveLocationControl({
  userLocation,
  locationName,
  isLocating,
  isTrackingLiveGps,
  onToggleLiveGps,
  onSelectPreset,
  permissionError,
  distanceFilter = null,
  onChangeDistanceFilter,
}: LiveLocationControlProps) {
  // Coimbatore industrial hubs
  const coimbatoreHubs = INDUSTRIAL_HUBS_PRESETS.filter((h) => h.id.startsWith('cbe-'));

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 shadow-xs transition-colors">
      
      {/* Top Row: Current Location Display & Toggle Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isTrackingLiveGps
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
            }`}
          >
            {isTrackingLiveGps ? (
              <Radio className="w-5 h-5 animate-pulse" />
            ) : (
              <MapPin className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {isTrackingLiveGps ? '🟢 Live Device GPS' : '📍 Location'}
              </span>
              {isTrackingLiveGps && userLocation?.accuracy && (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  ±{Math.round(userLocation.accuracy)}m accuracy
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              {locationName || 'Unknown location'}
            </h2>
          </div>
        </div>

        {/* Action Button: Live GPS Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleLiveGps}
            disabled={isLocating}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border min-h-[40px] ${
              isTrackingLiveGps
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                : 'bg-blue-600 hover:bg-blue-700 text-white border-transparent'
            } disabled:opacity-50`}
          >
            <LocateFixed className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
            <span>
              {isLocating
                ? 'Getting GPS...'
                : isTrackingLiveGps
                ? 'Live GPS: Active'
                : 'Turn On Live Location'}
            </span>
          </button>

          {/* Reset to Coimbatore Central */}
          <button
            type="button"
            onClick={() => onSelectPreset(COIMBATORE_DEFAULT_HUB)}
            className="px-3 py-2 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition min-h-[40px]"
            title="Reset location to Central Coimbatore"
          >
            Coimbatore (CBE)
          </button>
        </div>
      </div>

      {/* Permission message if blocked */}
      {permissionError && (
        <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
          <span>{permissionError}</span>
          <button
            onClick={() => onSelectPreset(COIMBATORE_DEFAULT_HUB)}
            className="text-xs font-bold underline ml-2 shrink-0"
          >
            Use Coimbatore Hub
          </button>
        </div>
      )}

      {/* Area Quick Selector */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 mr-1 flex items-center gap-1">
          <Building className="w-3.5 h-3.5" />
          <span>Industrial Areas:</span>
        </span>

        {coimbatoreHubs.map((hub) => {
          const isSelected =
            userLocation &&
            Math.abs(userLocation.lat - hub.coords.lat) < 0.015 &&
            Math.abs(userLocation.lng - hub.coords.lng) < 0.015;
          return (
            <button
              key={hub.id}
              type="button"
              onClick={() => onSelectPreset(hub)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                isSelected
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {hub.shortName.replace(' (CBE)', '')}
            </button>
          );
        })}
      </div>

      {/* Distance Filter Chips */}
      {onChangeDistanceFilter && (
        <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-gray-500 dark:text-gray-400">
            Distance from location:
          </span>

          <div className="flex items-center gap-1 flex-wrap">
            {[
              { label: 'All distances', value: null },
              { label: 'Within 5 km', value: 5 },
              { label: 'Within 15 km', value: 15 },
              { label: 'Within 30 km', value: 30 },
            ].map((option) => {
              const active = distanceFilter === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => onChangeDistanceFilter(option.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    active
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-bold'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
