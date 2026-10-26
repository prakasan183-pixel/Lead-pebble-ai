import React, { Suspense, lazy, useState, useEffect, useMemo, useRef } from 'react';
import type { Lead } from './utils/leadScoring.ts';
import { calculateLeadStats } from './utils/leadScoring.ts';
import { deduplicateLeads } from './utils/leadScoring.ts';
import { Sidebar, type NavTab } from './components/Sidebar.tsx';
import { DiscoveryView } from './components/DiscoveryView.tsx';
import { PebbleLoader } from './components/PebbleLoader.tsx';
import { FirstRunTutorial } from './components/FirstRunTutorial.tsx';
import { exportLeadsToCsv } from './utils/export.ts';
import { apiFetch } from './services/api.ts';
import { getStoredProfileAvatar, storeProfileAvatar } from './utils/profileAvatars.ts';
import { getLocalProfileName, getSavedLeads, saveLeads } from './services/leadStorage.ts';
import type { LocalUser } from './types/localUser.ts';
import {
  COIMBATORE_DEFAULT_HUB,
  requestLivePosition,
  watchLivePosition,
  clearLiveTracking,
  getStoredLocation,
  setStoredLocation,
  type GeoCoordinates,
  type LocationPreset,
} from './services/geolocation.ts';
import {
  Building2,
  LayoutDashboard,
  Mail as MailIcon,
  Map as MapIcon,
  ShieldAlert as ShieldAlertIcon,
  Kanban as KanbanIcon,
  MessageSquare,
  Menu,
  MapPin,
  LocateFixed,
  Radio,
  SlidersHorizontal,
  Download,
  Moon,
  Sun,
  ShieldAlert,
  AlertCircle,
  Mail,
  Settings as SettingsIcon,
} from 'lucide-react';

const DashboardView = lazy(() =>
  import('./components/DashboardView.tsx').then((module) => ({ default: module.DashboardView }))
);
const CrmPipelineView = lazy(() =>
  import('./components/CrmPipelineView.tsx').then((module) => ({ default: module.CrmPipelineView }))
);
const LeadMapView = lazy(() =>
  import('./components/LeadMapView.tsx').then((module) => ({ default: module.LeadMapView }))
);
const LeadDetailModal = lazy(() =>
  import('./components/LeadDetailModal.tsx').then((module) => ({ default: module.LeadDetailModal }))
);
const GoogleWorkspaceHub = lazy(() =>
  import('./components/GoogleWorkspaceHub.tsx').then((module) => ({ default: module.GoogleWorkspaceHub }))
);
const OutreachTemplateGenerator = lazy(() =>
  import('./components/OutreachTemplateGenerator.tsx').then((module) => ({ default: module.OutreachTemplateGenerator }))
);
const AccountSettingsView = lazy(() =>
  import('./components/AccountSettingsView.tsx').then((module) => ({ default: module.AccountSettingsView }))
);

class MapViewErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Unable to load Live Map view:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">The Live Map failed to load.</p>
          <p className="mt-1">Reload the app to retry loading the map module.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

async function resolveLocationName(coords: GeoCoordinates): Promise<string> {
  try {
    const response = await apiFetch(
      `/api/location/reverse-geocode?lat=${encodeURIComponent(coords.lat)}&lng=${encodeURIComponent(coords.lng)}`
    );
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Location name could not be resolved');
    }
    if (data.source !== 'coordinates_only' && typeof data.city === 'string' && data.city.trim()) {
      return data.city.trim();
    }
  } catch (error) {
    console.warn('Unable to resolve live GPS location name:', error);
  }
  return `Near ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
}

const LOCAL_USER_ID = 'local';

function hasCompletedTutorial(): boolean {
  try {
    return localStorage.getItem(`leadpebble_tutorial_completed:${LOCAL_USER_ID}`) === 'true';
  } catch (error) {
    console.warn('Unable to read tutorial status:', error);
    return false;
  }
}

function saveTutorialCompletion(): void {
  try {
    localStorage.setItem(`leadpebble_tutorial_completed:${LOCAL_USER_ID}`, 'true');
  } catch (error) {
    console.warn('Unable to save tutorial status:', error);
  }
}

function loadLocalUser(): LocalUser {
  try {
    return { uid: LOCAL_USER_ID, displayName: getLocalProfileName(), email: null };
  } catch (error) {
    console.warn('Unable to read local profile:', error);
    return { uid: LOCAL_USER_ID, displayName: 'My workspace', email: null };
  }
}

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>('discovery');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [outreachLeadId, setOutreachLeadId] = useState<string | null>(null);

  // Mobile sidebar drawer open/close
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Live Location & GPS state
  const initialStoredLoc = useMemo(() => getStoredLocation(), []);
  const [userLocation, setUserLocation] = useState<GeoCoordinates | null>(
    initialStoredLoc?.coords || COIMBATORE_DEFAULT_HUB.coords
  );
  const [locationName, setLocationName] = useState<string>(
    initialStoredLoc?.name || COIMBATORE_DEFAULT_HUB.name
  );
  const [isGpsLocation, setIsGpsLocation] = useState(Boolean(initialStoredLoc?.isRealGps));
  const [isLocating, setIsLocating] = useState(false);
  const [isTrackingLiveGps, setIsTrackingLiveGps] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const watchIdRef = React.useRef<number | null>(null);

  // Distance filter state: null = all, 3 = <= 3km, 5 = <= 5km, etc.
  const [distanceFilter, setDistanceFilter] = useState<number | null>(null);

  const [user, setUser] = useState<LocalUser>(loadLocalUser);
  const [userToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasCompletedFirstRunTutorial, setHasCompletedFirstRunTutorial] = useState(hasCompletedTutorial);
  const [isFirstRunTutorialVisible, setIsFirstRunTutorialVisible] = useState(false);
  const [profileAvatarId, setProfileAvatarId] = useState(() => getStoredProfileAvatar(LOCAL_USER_ID));
  const initialSearchStartedRef = useRef(false);
  const discoverHandlerRef = useRef<
    ((
      industry: string,
      searchLocation: string,
      companyName?: string,
      coordinatesOverride?: GeoCoordinates
    ) => Promise<Lead[]>) | null
  >(null);

  // Clean Light Theme by default
  const [isDark, setIsDark] = useState<boolean>(false);

  // Clean up live tracking watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        clearLiveTracking(watchIdRef.current);
      }
    };
  }, []);

  // Sync theme class
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Load saved companies from this browser.
  useEffect(() => {
    try {
      setLeads(getSavedLeads());
    } catch (error) {
      console.error('Could not load browser-saved companies:', error);
      setDiscoveryError(error instanceof Error ? error.message : 'Could not load saved companies.');
    } finally {
      setIsLoadingLeads(false);
    }
  }, []);

  useEffect(() => {
    if (initialStoredLoc?.isRealGps) {
      void resolveLocationName(initialStoredLoc.coords).then((resolvedName) => {
        setLocationName(resolvedName);
        setStoredLocation({
          ...initialStoredLoc,
          name: resolvedName,
          updatedAt: Date.now(),
        });
      });
    }
  }, [initialStoredLoc]);

  useEffect(() => {
    if (!isLoadingLeads && !isDiscovering && leads.length > 0 && !hasCompletedFirstRunTutorial) {
      setIsFirstRunTutorialVisible(true);
    }
  }, [isLoadingLeads, isDiscovering, leads.length, hasCompletedFirstRunTutorial]);

  // Live Geolocation Handlers
  const handleToggleLiveGps = async () => {
    setPermissionError(null);

    if (isTrackingLiveGps) {
      if (watchIdRef.current !== null) {
        clearLiveTracking(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTrackingLiveGps(false);
      return;
    }

    setIsLocating(true);
    try {
      const coords = await requestLivePosition();
      setUserLocation(coords);
      const liveName = await resolveLocationName(coords);
      setLocationName(liveName);
      setIsGpsLocation(true);
      setStoredLocation({
        mode: 'live_gps',
        coords,
        name: liveName,
        isRealGps: true,
        updatedAt: Date.now(),
      });
      setIsTrackingLiveGps(true);

      const id = watchLivePosition(
        (updatedCoords) => {
          setUserLocation(updatedCoords);
        },
        (err) => {
          console.warn('Live location watch error:', err);
        }
      );
      watchIdRef.current = id;
    } catch (err: any) {
      console.warn('GPS location error:', err);
      setPermissionError(err.message || 'Location permission was denied.');
      setIsTrackingLiveGps(false);
    } finally {
      setIsLocating(false);
    }
  };

  const handleSelectPreset = (preset: LocationPreset) => {
    if (isTrackingLiveGps && watchIdRef.current !== null) {
      clearLiveTracking(watchIdRef.current);
      watchIdRef.current = null;
      setIsTrackingLiveGps(false);
    }
    setUserLocation(preset.coords);
    setLocationName(preset.name);
    setIsGpsLocation(false);
    setStoredLocation({
      mode: 'preset',
      coords: preset.coords,
      name: preset.name,
      isRealGps: false,
      updatedAt: Date.now(),
    });
    setPermissionError(null);
  };

  // Saved companies belong to this browser, so the app does not need an account or database.
  const handleSaveLead = async (leadToSave: Lead) => {
    try {
      const next = deduplicateLeads([leadToSave, ...getSavedLeads()]);
      saveLeads(next);
      setLeads(next);
    } catch (err) {
      console.error('Error persisting lead:', err);
      setDiscoveryError(err instanceof Error ? err.message : 'Could not save this company in this browser.');
    }
  };

  const handleBatchSaveLeads = async (newLeads: Lead[]) => {
    try {
      const next = deduplicateLeads([...newLeads, ...getSavedLeads()]);
      saveLeads(next);
      setLeads(next);
    } catch (err) {
      console.error('Error batch persisting leads:', err);
      setDiscoveryError(err instanceof Error ? err.message : 'Could not save companies in this browser.');
    }
  };

  const handleDiscoverLeads = async (
    industry: string,
    searchLocation: string,
    companyName?: string,
    coordinatesOverride?: GeoCoordinates
  ): Promise<Lead[]> => {
    setIsDiscovering(true);
    setDiscoveryError(null);
    try {
      const requestedLocation = searchLocation.trim();
      if (!requestedLocation) {
        throw new Error('Enter a city or area before searching.');
      }
      const useCurrentCoordinates =
        coordinatesOverride !== undefined ||
        requestedLocation.toLowerCase() === locationName.trim().toLowerCase();
      const response = await apiFetch('/api/leads/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry,
          allCategories: industry === 'All Categories' && !companyName,
          companyName,
          city: requestedLocation,
          location: requestedLocation,
          searchMode: 'maps',
          strictNoWebsite: false,
          lat: useCurrentCoordinates ? (coordinatesOverride || userLocation)?.lat : undefined,
          lng: useCurrentCoordinates ? (coordinatesOverride || userLocation)?.lng : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Company discovery failed');
      }
      if (!Array.isArray(data.leads)) {
        throw new Error('Discovery response did not contain a leads list');
      }
      const searchCategory = industry === 'All Categories' || companyName ? undefined : industry;
      const discoveredLeads = data.leads.map((lead: Lead) => ({
        ...lead,
        searchCategory: lead.searchCategory || searchCategory,
        searchLocation: requestedLocation,
      }));
      const savedLeads = deduplicateLeads([...discoveredLeads, ...getSavedLeads()]);
      saveLeads(savedLeads);
      setLeads(savedLeads);
      if (data.leads.length === 0) {
        setDiscoveryError(companyName
          ? `No Google Maps listing was found for “${companyName}” in ${requestedLocation}. Try another spelling or nearby area.`
          : 'Google Maps Places returned no matches. Try a broader category or nearby location.');
      }
      return discoveredLeads;
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Company discovery failed';
      setDiscoveryError(rawMessage);
      return [];
    } finally {
      setIsDiscovering(false);
    }
  };
  discoverHandlerRef.current = handleDiscoverLeads;

  useEffect(() => {
    if (isLoadingLeads || leads.length > 0 || initialSearchStartedRef.current) return;
    initialSearchStartedRef.current = true;
    void discoverHandlerRef.current?.(
      'All Categories',
      locationName,
      undefined,
      userLocation || COIMBATORE_DEFAULT_HUB.coords
    );
  }, [isLoadingLeads, leads.length, locationName, userLocation]);

  const handleDeleteLead = async (leadId: string) => {
    try {
      const next = getSavedLeads().filter((lead) => lead.id !== leadId);
      saveLeads(next);
      setLeads(next);
    } catch (err) {
      console.error('Error deleting lead:', err);
      setDiscoveryError(err instanceof Error ? err.message : 'Could not delete this company.');
    }
  };

  const handleDraftOutreach = (lead: Lead) => {
    setOutreachLeadId(lead.id);
    setCurrentTab('outreach');
    if (selectedLead) setSelectedLead(null);
  };

  const handleWorkspaceAuthorization = () => {
    setAuthError(null);
    setAuthError('Google Workspace integrations require a separate Google OAuth setup. Google Places discovery works without sign-in.');
  };

  const handleCompleteFirstRunTutorial = () => {
    saveTutorialCompletion();
    setHasCompletedFirstRunTutorial(true);
    setIsFirstRunTutorialVisible(false);
  };

  const handleShowTutorial = () => {
    setCurrentTab('discovery');
    setIsMobileSidebarOpen(false);
    setIsFirstRunTutorialVisible(true);
  };

  const handleUpdateAccountName = async (name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error('Enter a name before saving.');
    localStorage.setItem('leadpebble_profile_name', normalizedName);
    setUser((currentUser) => ({ ...currentUser, displayName: normalizedName }));
  };

  const handleSelectProfileAvatar = (avatarId: string) => {
    try {
      storeProfileAvatar(LOCAL_USER_ID, avatarId);
      setProfileAvatarId(avatarId);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not save your avatar.');
    }
  };

  const missingWebsiteCount = leads.filter((l) =>
    l.websiteStatus === 'no_website_verified' || l.websiteStatus === 'no_website_detected'
  ).length;
  const headerItems: Record<NavTab, { title: string; icon: React.ComponentType<{ className?: string }> }> = {
    discovery: { title: 'Company Directory', icon: Building2 },
    outreach: { title: 'Outreach Template Generator', icon: MailIcon },
    dashboard: { title: 'Dashboard & Market Overview', icon: LayoutDashboard },
    map: { title: 'Live Location Map', icon: MapIcon },
    verified_only: { title: 'Website Not Listed', icon: ShieldAlertIcon },
    crm: { title: 'CRM Prospect Board', icon: KanbanIcon },
    workspace: { title: 'Dispatch & Intake Forms', icon: MessageSquare },
    settings: { title: 'Account Settings', icon: SettingsIcon },
  };
  const HeaderIcon = headerItems[currentTab].icon;

  return (
    <div className="min-h-screen bg-[#f7f9fc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row font-sans antialiased">
      
      {/* 1. SIDEBAR (Navbar on side, not on top) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        leads={leads}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onExportCsv={() => exportLeadsToCsv(leads)}
        user={user}
        avatarId={profileAvatarId}
        userLocation={userLocation}
        isGpsLocation={isGpsLocation}
        locationName={locationName}
        isTrackingLiveGps={isTrackingLiveGps}
        isLocating={isLocating}
        onToggleLiveGps={handleToggleLiveGps}
        onSelectPreset={handleSelectPreset}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Bar */}
        <header className="app-topbar sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200 bg-white/95 px-3 py-2.5 shadow-xs backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95 sm:flex-nowrap sm:px-6 sm:py-3">
          
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Button to open side navbar */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              data-tour="navigation"
              aria-label="Open side navigation"
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* View Title */}
            <div>
              <h1 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white sm:gap-2 sm:text-lg">
                <HeaderIcon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 sm:h-5 sm:w-5" />
                {headerItems[currentTab].title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Company records &middot; {locationName}
                {isGpsLocation && userLocation &&
                  ` · GPS ${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`}
              </p>
            </div>
          </div>

          {/* Right Header Controls: Location Badge & Distance Radius */}
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            
            {/* Live Location Chip */}
            <div
              data-tour="location"
              onClick={handleToggleLiveGps}
              className={`flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 truncate rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition sm:flex-none ${
                isTrackingLiveGps
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
              }`}
              title={isGpsLocation && userLocation
                ? `GPS location · ${locationName} · ${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`
                : 'Click to detect device GPS'}
            >
              <Radio className={`w-3.5 h-3.5 ${isTrackingLiveGps ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
              <span className="hidden md:inline font-bold">
                {isTrackingLiveGps ? 'GPS Active:' : 'Location:'}
              </span>
              <span className="truncate">
                {locationName.split(',')[0]}
              </span>
            </div>

            {/* Distance Filter Quick Buttons */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-400 px-1.5">Radius:</span>
              <button
                onClick={() => setDistanceFilter(null)}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition ${
                  distanceFilter === null
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setDistanceFilter(3)}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition ${
                  distanceFilter === 3
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ≤3 km
              </button>
              <button
                onClick={() => setDistanceFilter(5)}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition ${
                  distanceFilter === 5
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ≤5 km
              </button>
              <button
                onClick={() => setDistanceFilter(10)}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition ${
                  distanceFilter === 10
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ≤10 km
              </button>
            </div>

            {/* Quick Export CSV Button */}
            <button
              onClick={() => exportLeadsToCsv(leads)}
              title="Export leads to CSV"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Download className="w-4 h-4" />
            </button>

          </div>
        </header>

        {/* Permission Error Notification (if GPS blocked) */}
        {permissionError && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{permissionError} Using the selected location preset.</span>
            </div>
            <button
              onClick={handleToggleLiveGps}
              className="px-2.5 py-1 rounded-md bg-amber-600 text-white font-bold hover:bg-amber-700 shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Content Container */}
        <main className="flex-1 space-y-5 p-3 sm:space-y-4 sm:p-4 lg:p-3">
          {isLoadingLeads ? (
            <div className="py-20">
              <PebbleLoader
                message="Loading your company directory"
                detail={locationName}
              />
            </div>
          ) : (
            <>
              {/* 1. All Companies Directory */}
              {currentTab === 'discovery' && (
                <DiscoveryView
                  leads={leads}
                  onDiscover={handleDiscoverLeads}
                  isDiscovering={isDiscovering}
                  discoveryError={discoveryError}
                  onSaveLead={handleSaveLead}
                  onBatchSaveLeads={handleBatchSaveLeads}
                  onSelectLead={(lead) => setSelectedLead(lead)}
                  onDraftOutreach={handleDraftOutreach}
                  userLocation={userLocation}
                  locationName={locationName}
                  distanceFilter={distanceFilter}
                  userName={user.displayName}
                />
              )}

              {/* 2. Outreach Template Generator (Email & LinkedIn Drafts via Gemini) */}
              {currentTab === 'outreach' && (
                <Suspense fallback={<PebbleLoader message="Loading outreach tools" compact />}>
                  <OutreachTemplateGenerator
                    leads={leads}
                    selectedLeadId={outreachLeadId}
                    onSelectLead={(lead) => setOutreachLeadId(lead.id)}
                    onSaveLead={handleSaveLead}
                    userLocation={userLocation}
                  />
                </Suspense>
              )}

              {/* 3. Missing Website Targets Only */}
              {currentTab === 'verified_only' && (
                <DiscoveryView
                  leads={leads}
                  onSaveLead={handleSaveLead}
                  onBatchSaveLeads={handleBatchSaveLeads}
                  onSelectLead={(lead) => setSelectedLead(lead)}
                  onDraftOutreach={handleDraftOutreach}
                  initialWebsiteFilter="no_website_verified"
                  showLocationFilter={false}
                  userLocation={userLocation}
                  locationName={locationName}
                  distanceFilter={distanceFilter}
                />
              )}

              {/* 3. Executive Dashboard & Metrics */}
              {currentTab === 'dashboard' && (
                <Suspense fallback={<PebbleLoader message="Loading dashboard" compact />}>
                  <DashboardView
                    leads={leads}
                    onNavigateToDiscovery={() => setCurrentTab('discovery')}
                    onNavigateToCrm={() => setCurrentTab('crm')}
                    onFilterNoWebsite={() => setCurrentTab('verified_only')}
                    onExportCsv={() => exportLeadsToCsv(leads)}
                    onNavigateToMap={() => setCurrentTab('map')}
                    onSelectLead={(lead) => setSelectedLead(lead)}
                    locationName={locationName}
                  />
                </Suspense>
              )}

              {currentTab === 'settings' && (
                <Suspense fallback={<PebbleLoader message="Loading account settings" compact />}>
                  <AccountSettingsView
                    user={user}
                    avatarId={profileAvatarId}
                    onUpdateName={handleUpdateAccountName}
                    onSelectAvatar={handleSelectProfileAvatar}
                    onShowTutorial={handleShowTutorial}
                  />
                </Suspense>
              )}

              {/* 4. Interactive Live Map */}
              {currentTab === 'map' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-rose-500" />
                        Live Proximity Map &middot; {locationName}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {leads.length} saved company records; map markers appear only where coordinates are available
                      </p>
                    </div>

                    <button
                      onClick={handleToggleLiveGps}
                      disabled={isLocating}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      <LocateFixed className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-blue-600' : ''}`} />
                      {isLocating ? 'Locating...' : 'Center On My GPS'}
                    </button>
                  </div>

                  <div className="h-[55vh] min-h-[360px] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 sm:h-[650px]">
                    <MapViewErrorBoundary>
                      <Suspense fallback={<PebbleLoader message="Loading company map" compact />}>
                        <LeadMapView
                          leads={leads}
                          userLocation={userLocation}
                          onSelectLead={(lead) => setSelectedLead(lead)}
                          onRequestUserLocation={handleToggleLiveGps}
                          isLocating={isLocating}
                        />
                      </Suspense>
                    </MapViewErrorBoundary>
                  </div>
                </div>
              )}

              {/* 5. CRM Prospect Board */}
              {currentTab === 'crm' && (
                <Suspense fallback={<PebbleLoader message="Loading CRM pipeline" compact />}>
                  <CrmPipelineView
                    leads={leads}
                    onUpdateLead={handleSaveLead}
                    onDeleteLead={handleDeleteLead}
                    onSelectLead={(lead) => setSelectedLead(lead)}
                    onAddNewLead={handleSaveLead}
                  />
                </Suspense>
              )}

              {/* 6. Google Workspace Integration */}
              {currentTab === 'workspace' && (
                <Suspense fallback={<PebbleLoader message="Loading Google Workspace" compact />}>
                  <GoogleWorkspaceHub
                    userToken={userToken}
                    leads={leads}
                    onSelectLead={(lead) => setSelectedLead(lead)}
                  />
                </Suspense>
              )}
            </>
          )}
        </main>
      </div>

      {/* Company Details Modal */}
      {selectedLead && (
        <Suspense fallback={null}>
          <LeadDetailModal
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onUpdateLead={handleSaveLead}
            userToken={userToken}
            onPromptLogin={handleWorkspaceAuthorization}
            onRequestWorkspaceAccess={handleWorkspaceAuthorization}
            isAuthorizingWorkspace={false}
            authError={authError}
            onDraftOutreach={handleDraftOutreach}
          />
        </Suspense>
      )}

      {isFirstRunTutorialVisible && (
        <FirstRunTutorial onComplete={handleCompleteFirstRunTutorial} />
      )}

    </div>
  );
}
