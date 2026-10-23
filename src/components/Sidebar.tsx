import React from 'react';
import {
  Building2,
  LayoutDashboard,
  Search,
  MapPin,
  Kanban,
  ShieldAlert,
  Send,
  Download,
  Moon,
  Sun,
  LocateFixed,
  Radio,
  X,
  ChevronRight,
  Mail,
  Settings,
} from 'lucide-react';
import type { Lead } from '../utils/leadScoring.ts';
import type { LocalUser } from '../types/localUser.ts';
import { ProfileAvatar } from './ProfileAvatar.tsx';
import {
  INDUSTRIAL_HUBS_PRESETS,
  type GeoCoordinates,
  type LocationPreset,
} from '../services/geolocation.ts';

export type NavTab = 'discovery' | 'outreach' | 'dashboard' | 'map' | 'crm' | 'verified_only' | 'workspace' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  leads: Lead[];
  isDark: boolean;
  onToggleTheme: () => void;
  onExportCsv: () => void;
  user: LocalUser;
  avatarId: string;
  userLocation: GeoCoordinates | null;
  isGpsLocation: boolean;
  locationName: string;
  isTrackingLiveGps: boolean;
  isLocating: boolean;
  onToggleLiveGps: () => void;
  onSelectPreset: (preset: LocationPreset) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  leads,
  isDark,
  onToggleTheme,
  onExportCsv,
  user,
  avatarId,
  userLocation: _userLocation,
  isGpsLocation,
  locationName,
  isTrackingLiveGps,
  isLocating,
  onToggleLiveGps,
  onSelectPreset,
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const missingWebsiteCount = leads.filter((l) =>
    l.websiteStatus === 'no_website_verified' || l.websiteStatus === 'no_website_detected'
  ).length;
  const crmCount = leads.filter((l) => l.crmStatus !== 'discovered').length;

  const navItems: {
    id: NavTab;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeStyle?: string;
  }[] = [
    {
      id: 'discovery',
      label: 'Company Directory',
      sublabel: 'Google Places results',
      icon: Building2,
      badge: leads.length,
      badgeStyle: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    },
    {
      id: 'outreach',
      label: 'Outreach Generator',
      sublabel: 'Groq email & LinkedIn',
      icon: Mail,
      badgeStyle: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold',
    },
    {
      id: 'verified_only',
      label: 'Website Not Listed',
      sublabel: 'Grounded search findings',
      icon: ShieldAlert,
      badge: missingWebsiteCount,
      badgeStyle: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold',
    },
    {
      id: 'dashboard',
      label: 'Dashboard & Metrics',
      sublabel: 'Overview & analytics',
      icon: LayoutDashboard,
    },
    {
      id: 'map',
      label: 'Live Map View',
      sublabel: 'Nearby GPS radius',
      icon: MapPin,
      badge: leads.length,
      badgeStyle: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold',
    },
    {
      id: 'crm',
      label: 'CRM Prospect Board',
      sublabel: 'Follow-ups & pipeline',
      icon: Kanban,
      badge: crmCount,
      badgeStyle: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold',
    },
    {
      id: 'workspace',
      label: 'Dispatch & Forms',
      sublabel: 'Google Chat & Sheets',
      icon: Send,
    },
    {
      id: 'settings',
      label: 'Account Settings',
      sublabel: 'Local profile',
      icon: Settings,
    },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
      
      {/* 1. Header & Brand */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-100 to-cyan-100 dark:from-fuchsia-950/60 dark:to-cyan-950/60 flex items-center justify-center shadow-xs">
            <img src="/leadpebble-logo.png" alt="LeadPebble" className="w-9 h-9 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                LeadPebble
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                B2B CRM
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {locationName} Company Directory
            </p>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          aria-label="Close sidebar"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Current Location & Live GPS Status Card */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
        <div className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
              Active Location
            </span>
            {isTrackingLiveGps && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Live GPS
              </span>
            )}
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {locationName}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {leads.length} saved company records
              </p>
              {_userLocation && isGpsLocation && (
                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  GPS: {_userLocation.lat.toFixed(5)}, {_userLocation.lng.toFixed(5)}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onToggleLiveGps}
            disabled={isLocating}
            className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition border ${
              isTrackingLiveGps
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700'
            }`}
          >
            <LocateFixed className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-blue-600' : ''}`} />
            {isLocating
              ? 'Detecting GPS...'
              : isTrackingLiveGps
              ? 'Live Tracking Active'
              : 'Detect My Location'}
          </button>
        </div>
      </div>

      {/* 3. Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <div className="px-2 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Main Navigation
        </div>

        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              data-tour={item.id === 'discovery' ? 'navigation' : undefined}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate leading-tight">{item.label}</p>
                  <p
                    className={`text-[10px] truncate ${
                      isActive ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {item.sublabel}
                  </p>
                </div>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ml-2 ${
                    isActive ? 'bg-white/20 text-white' : item.badgeStyle || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* 4. Location Presets */}
        <div className="pt-4">
          <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>Location Presets</span>
            <span className="text-[10px] font-normal text-slate-400">Quick Select</span>
          </div>

          <div className="space-y-1">
            {INDUSTRIAL_HUBS_PRESETS.map((hub) => {
              const isSelected = locationName === hub.name;
              return (
                <button
                  key={hub.id}
                  onClick={() => {
                    onSelectPreset(hub);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition text-left ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-900'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{hub.name.replace(', Coimbatore', '')}</span>
                  {isSelected && <ChevronRight className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* 5. Footer & User Controls */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-950/40">
        
        {/* Export CSV Button */}
        <button
          onClick={onExportCsv}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          Export All Companies (CSV)
        </button>

        {/* Theme and User Profile */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex min-w-0 items-center gap-2">
            <ProfileAvatar avatarId={avatarId} name={user.displayName} sizeClassName="h-7 w-7" />
            <p className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {user.displayName}
            </p>
          </div>

          {/* Theme switch button */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle dark mode"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>

      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 xl:w-72 lg:shrink-0 lg:h-screen lg:sticky lg:top-0 z-30 shadow-xs">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay / Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Slide-out drawer */}
          <div className="fixed inset-y-0 left-0 max-w-xs w-full shadow-2xl z-10 flex">
            <div className="w-full h-full flex flex-col">
              {sidebarContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
