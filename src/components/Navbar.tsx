import React from 'react';
import type { LocalUser } from '../types/localUser.ts';
import {
  Building2,
  MapPin,
  Radio,
  Sun,
  Moon,
  Building,
  Map as MapIcon,
  Bookmark,
  LocateFixed,
  Download,
} from 'lucide-react';
import type { NavTab } from './Sidebar.tsx';

interface NavbarProps {
  user: LocalUser | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn: boolean;
  pipelineValue?: number;
  totalMissingWebsite?: number;
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  locationName: string;
  isTrackingLiveGps: boolean;
  isLocating?: boolean;
  onToggleLiveGps?: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  leadsCount: number;
  savedCount?: number;
  onExportCsv?: () => void;
}

export function Navbar({
  user,
  onLogin,
  onLogout,
  isLoggingIn,
  currentTab,
  onSelectTab,
  locationName = 'Unknown location',
  isTrackingLiveGps = false,
  isLocating = false,
  onToggleLiveGps,
  isDark = false,
  onToggleTheme,
  leadsCount = 0,
  savedCount = 0,
  onExportCsv,
}: NavbarProps) {
  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {locationName} Business Directory
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Company records with visible verification status
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs (Clean, simple, human) */}
          <nav className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => onSelectTab('discovery')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-2 ${
                currentTab === 'discovery' || currentTab === 'dashboard'
                  ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>All Companies</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold">
                {leadsCount}
              </span>
            </button>

            <button
              onClick={() => onSelectTab('map')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-2 ${
                currentTab === 'map'
                  ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span>Interactive Map</span>
            </button>

            <button
              onClick={() => onSelectTab('crm')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-2 ${
                currentTab === 'crm'
                  ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>Saved Contacts</span>
              {savedCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold">
                  {savedCount}
                </span>
              )}
            </button>
          </nav>

          {/* Right Section: GPS Location Toggle, Theme, Export */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live GPS Button */}
            {onToggleLiveGps && (
              <button
                type="button"
                onClick={onToggleLiveGps}
                disabled={isLocating}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border min-h-[40px] ${
                  isTrackingLiveGps
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100'
                }`}
                title="Detect your device's live location"
              >
                {isTrackingLiveGps ? (
                  <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                ) : (
                  <LocateFixed className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                )}
                <span className="hidden sm:inline">
                  {isLocating
                    ? 'Locating...'
                    : isTrackingLiveGps
                    ? 'Live GPS Active'
                    : 'Use My GPS'}
                </span>
              </button>
            )}

            {/* Export CSV button */}
            {onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                className="hidden sm:flex p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition items-center justify-center"
                title="Download company list as CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Light / Dark Mode toggle */}
            <button
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-gray-600" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => onSelectTab('discovery')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              currentTab === 'discovery' || currentTab === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Companies ({leadsCount})</span>
          </button>

          <button
            onClick={() => onSelectTab('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              currentTab === 'map'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            <span>Map</span>
          </button>

          <button
            onClick={() => onSelectTab('crm')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              currentTab === 'crm'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Saved</span>
          </button>
        </div>
      </div>
    </header>
  );
}
