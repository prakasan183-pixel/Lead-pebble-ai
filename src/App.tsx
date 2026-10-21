import React, { Suspense, lazy, useState, useEffect, useMemo, useRef } from 'react';
import type { Lead } from './utils/leadScoring.ts';
import { calculateLeadStats } from './utils/leadScoring.ts';
import { deduplicateLeads } from './utils/leadScoring.ts';
import { Sidebar, type NavTab } from './components/Sidebar.tsx';
import { DiscoveryView } from './components/DiscoveryView.tsx';
import { PebbleLoader } from './components/PebbleLoader.tsx';
import { SignInView } from './components/SignInView.tsx';
import { WelcomeView } from './components/WelcomeView.tsx';
import { FirstRunTutorial } from './components/FirstRunTutorial.tsx';
import { exportLeadsToCsv } from './utils/export.ts';
import {
  initAuth,
  googleSignIn,
  requestWorkspaceAccess,
  logout as authLogout,
  updateAccountName,
} from './services/auth.ts';
import { getStoredProfileAvatar, storeProfileAvatar } from './utils/profileAvatars.ts';
import type { User } from 'firebase/auth';
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

async function resolveLocationName(coords: GeoCoordinates): Promise<string> {
  try {
    const response = await fetch(
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

function hasCompletedWelcome(uid: string): boolean {
  try {
    return localStorage.getItem(`leadpebble_welcome_completed:${uid}`) === 'true';
  } catch (error) {
    console.warn('Unable to read welcome status:', error);
    return false;
  }
}

function saveWelcomeCompletion(uid: string): void {
  try {
    localStorage.setItem(`leadpebble_welcome_completed:${uid}`, 'true');
  } catch (error) {
    console.warn('Unable to save welcome status:', error);
  }
}

function hasCompletedTutorial(uid: string): boolean {
  try {
    return localStorage.getItem(`leadpebble_tutorial_completed:${uid}`) === 'true';
  } catch (error) {
    console.warn('Unable to read tutorial status:', error);
    return false;
  }
}

function saveTutorialCompletion(uid: string): void {
  try {
    localStorage.setItem(`leadpebble_tutorial_completed:${uid}`, 'true');
  } catch (error) {
    console.warn('Unable to save tutorial status:', error);
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

  // Authentication
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAuthorizingWorkspace, setIsAuthorizingWorkspace] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasCompletedFirstRun, setHasCompletedFirstRun] = useState(false);
  const [hasCompletedFirstRunTutorial, setHasCompletedFirstRunTutorial] = useState(false);
  const [isFirstRunTutorialVisible, setIsFirstRunTutorialVisible] = useState(false);
  const [profileAvatarId, setProfileAvatarId] = useState('factory');
  const [pendingInitialSearch, setPendingInitialSearch] = useState<{
    coordinates: GeoCoordinates;
    location: string;
  } | null>(null);
  const savedLeadsLoadedForUidRef = useRef<string | null>(null);
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

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setUserToken(token);
        setHasCompletedFirstRun(hasCompletedWelcome(currentUser.uid));
        setHasCompletedFirstRunTutorial(hasCompletedTutorial(currentUser.uid));
        setIsFirstRunTutorialVisible(false);
        setProfileAvatarId(getStoredProfileAvatar(currentUser.uid));
        setIsAuthReady(true);
      },
      () => {
        setUser(null);
        setUserToken(null);
        setHasCompletedFirstRun(false);
        setHasCompletedFirstRunTutorial(false);
        setIsFirstRunTutorialVisible(false);
        setIsAuthReady(true);
      }
    );
    return () => unsubscribe && unsubscribe();
  }, []);

  // Load saved leads only after first-run location setup is complete.
  useEffect(() => {
    if (!user) {
      savedLeadsLoadedForUidRef.current = null;
      setIsLoadingLeads(true);
      return;
    }
    if (!hasCompletedFirstRun || savedLeadsLoadedForUidRef.current === user.uid) return;

    savedLeadsLoadedForUidRef.current = user.uid;
    setIsLoadingLeads(true);
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
    fetch('/api/leads/saved')
      .then((response) => {
        if (!response.ok) throw new Error(`Saved company request failed (${response.status}).`);
        return response.json();
      })
      .then((data) => {
        if (!data.success || !Array.isArray(data.leads)) {
          throw new Error(data.error || 'Saved companies response was invalid.');
        }
        setLeads(data.leads);
      })
      .catch((err) => {
        console.error('Error fetching leads:', err);
        setDiscoveryError(err instanceof Error ? err.message : 'Could not load saved companies.');
      })
      .finally(() => {
        setIsLoadingLeads(false);
        if (pendingInitialSearch && discoverHandlerRef.current) {
          void discoverHandlerRef.current(
            'All Categories',
            pendingInitialSearch.location,
            undefined,
            pendingInitialSearch.coordinates
          );
          setPendingInitialSearch(null);
        }
      });
  }, [user, hasCompletedFirstRun, initialStoredLoc, pendingInitialSearch]);

  useEffect(() => {
    if (
      user &&
      hasCompletedFirstRun &&
      !isLoadingLeads &&
      !hasCompletedFirstRunTutorial
    ) {
      setIsFirstRunTutorialVisible(true);
    }
  }, [user, hasCompletedFirstRun, isLoadingLeads, hasCompletedFirstRunTutorial]);

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

  const finishFirstRun = (
    coordinates: GeoCoordinates,
    selectedLocation: string,
    isRealGps: boolean,
    mode: 'live_gps' | 'preset' | 'manual'
  ) => {
    if (!user) return;
    setUserLocation(coordinates);
    setLocationName(selectedLocation);
    setIsGpsLocation(isRealGps);
    setStoredLocation({
      mode,
      coords: coordinates,
      name: selectedLocation,
      isRealGps,
      updatedAt: Date.now(),
    });
    setPendingInitialSearch({ coordinates, location: selectedLocation });
  };

  const handleCompleteFirstRun = () => {
    if (!user) return;
    saveWelcomeCompletion(user.uid);
    setHasCompletedFirstRun(true);
  };

  const handleWelcomeUseDeviceLocation = async () => {
    setIsLocating(true);
    setPermissionError(null);
    try {
      const coordinates = await requestLivePosition();
      const resolvedName = await resolveLocationName(coordinates);
      finishFirstRun(coordinates, resolvedName, true, 'live_gps');
    } finally {
      setIsLocating(false);
    }
  };

  const handleWelcomeContinueWithLocation = () => {
    finishFirstRun(
      userLocation || COIMBATORE_DEFAULT_HUB.coords,
      locationName,
      isGpsLocation,
      initialStoredLoc?.mode || 'preset'
    );
  };

  // Lead CRUD Handlers
  const handleSaveLead = async (leadToSave: Lead) => {
    try {
      const response = await fetch('/api/leads/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: leadToSave }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.lead) {
        throw new Error(data.error || 'Lead save failed');
      }
      setLeads((prev) => {
        const exists = prev.some((lead) => lead.id === data.lead.id);
        return exists
          ? prev.map((lead) => (lead.id === data.lead.id ? data.lead : lead))
          : [data.lead, ...prev];
      });
    } catch (err) {
      console.error('Error persisting lead:', err);
    }
  };

  const handleBatchSaveLeads = async (newLeads: Lead[]) => {
    try {
      const response = await fetch('/api/leads/batch-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: newLeads }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.leads)) {
        throw new Error(data.error || 'Batch lead save failed');
      }
      setLeads((previous) => deduplicateLeads([...data.leads, ...previous]));
    } catch (err) {
      console.error('Error batch persisting leads:', err);
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
      const response = await fetch('/api/leads/discover', {
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
      const saveResponse = await fetch('/api/leads/batch-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: discoveredLeads }),
      });
      const savedData = await saveResponse.json();
      if (!saveResponse.ok || !savedData.success || !Array.isArray(savedData.leads)) {
        throw new Error(savedData.error || 'Companies were found but could not be saved. Try again.');
      }
      setLeads((previous) => deduplicateLeads([...savedData.leads, ...previous]));
      if (data.leads.length === 0) {
        setDiscoveryError(companyName
          ? `No Google Maps listing was found for “${companyName}” in ${requestedLocation}. Try another spelling or nearby area.`
          : 'Google Maps Places returned no matches. Try a broader category or nearby location.');
      }
      return savedData.leads;
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Company discovery failed';
      setDiscoveryError(rawMessage);
      return [];
    } finally {
      setIsDiscovering(false);
    }
  };
  discoverHandlerRef.current = handleDiscoverLeads;

  const handleDeleteLead = async (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    try {
      await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error deleting lead:', err);
    }
  };

  const handleDraftOutreach = (lead: Lead) => {
    setOutreachLeadId(lead.id);
    setCurrentTab('outreach');
    if (selectedLead) setSelectedLead(null);
  };

  // Authentication Handlers
  const handleLogin = async () => {
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      setUser(result.user);
      setUserToken(result.accessToken);
    } catch (err: unknown) {
      console.error('Login error:', err);
      const code = typeof err === 'object' && err !== null && 'code' in err
        ? String(err.code)
        : '';
      setAuthError(
        code === 'auth/popup-closed-by-user'
          ? 'Sign-in was cancelled.'
          : code === 'auth/unauthorized-domain'
            ? 'This site is not authorized for Firebase sign-in. Add its domain in Firebase Authentication settings.'
            : code === 'auth/operation-not-allowed'
              ? 'Google sign-in is not enabled for this Firebase project. Enable Google in Firebase Authentication settings.'
            : err instanceof Error
              ? err.message
              : 'Google sign-in failed. Please try again.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleWorkspaceAuthorization = async () => {
    setAuthError(null);
    if (!user) {
      await handleLogin();
      return;
    }

    setIsAuthorizingWorkspace(true);
    try {
      const result = await requestWorkspaceAccess();
      setUser(result.user);
      setUserToken(result.accessToken);
    } catch (err: unknown) {
      console.error('Google Workspace authorization error:', err);
      const code = typeof err === 'object' && err !== null && 'code' in err
        ? String(err.code)
        : '';
      setAuthError(
        code === 'auth/unauthorized-domain'
          ? 'This site is not authorized for Firebase sign-in. Add its domain in Firebase Authentication settings.'
          : err instanceof Error
            ? err.message
            : 'Google Workspace authorization failed. Please try again.'
      );
    } finally {
      setIsAuthorizingWorkspace(false);
    }
  };

  const handleLogout = async () => {
    setAuthError(null);
    setIsSigningOut(true);
    try {
      await authLogout();
      setUser(null);
      setUserToken(null);
    } catch (err) {
      console.error('Logout error:', err);
      setAuthError(err instanceof Error ? err.message : 'Sign out failed. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleCompleteFirstRunTutorial = () => {
    if (user) saveTutorialCompletion(user.uid);
    setHasCompletedFirstRunTutorial(true);
    setIsFirstRunTutorialVisible(false);
  };

  const handleShowTutorial = () => {
    setCurrentTab('discovery');
    setIsMobileSidebarOpen(false);
    setIsFirstRunTutorialVisible(true);
  };

  const handleUpdateAccountName = async (name: string) => {
    const updatedUser = await updateAccountName(name);
    setUser(updatedUser);
  };

  const handleSelectProfileAvatar = (avatarId: string) => {
    if (!user) return;
    try {
      storeProfileAvatar(user.uid, avatarId);
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

  if (!isAuthReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <PebbleLoader message="Checking your account" detail="Connecting securely to LeadPebble" />
      </main>
    );
  }

  if (!user) {
    return (
      <SignInView
        isLoading={false}
        isSigningIn={isLoggingIn}
        error={authError}
        onSignIn={handleLogin}
      />
    );
  }

  if (!hasCompletedFirstRun) {
    return (
      <WelcomeView
        displayName={user.displayName || user.email?.split('@')[0] || ''}
        locationName={locationName}
        isLocating={isLocating}
        error={permissionError}
        onUseDeviceLocation={handleWelcomeUseDeviceLocation}
        onContinueWithCurrentLocation={handleWelcomeContinueWithLocation}
        onContinueWithPreset={(coordinates, selectedLocation) =>
          finishFirstRun(coordinates, selectedLocation, false, 'preset')
        }
        onFinishEntering={handleCompleteFirstRun}
        defaultCoordinates={COIMBATORE_DEFAULT_HUB.coords}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row font-sans antialiased">
      
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
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoggingIn={isLoggingIn}
        authError={authError}
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
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-200 bg-white/95 px-3 py-2.5 shadow-xs backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95 sm:flex-nowrap sm:px-6 sm:py-3">
          
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
        <main className="flex-1 space-y-5 p-3 sm:space-y-6 sm:p-6 lg:p-8">
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
                  userName={user.displayName || user.email?.split('@')[0] || ''}
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
                    isSigningOut={isSigningOut}
                    error={authError}
                    onUpdateName={handleUpdateAccountName}
                    onSelectAvatar={handleSelectProfileAvatar}
                    onShowTutorial={handleShowTutorial}
                    onSignOut={handleLogout}
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
                    <Suspense fallback={<PebbleLoader message="Loading company map" compact />}>
                      <LeadMapView
                        leads={leads}
                        userLocation={userLocation}
                        onSelectLead={(lead) => setSelectedLead(lead)}
                        onRequestUserLocation={handleToggleLiveGps}
                        isLocating={isLocating}
                      />
                    </Suspense>
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
                    isAuthenticated={Boolean(user)}
                    authError={authError}
                    isAuthorizing={isAuthorizingWorkspace || isLoggingIn}
                    leads={leads}
                    onPromptLogin={handleLogin}
                    onAuthorizeWorkspace={handleWorkspaceAuthorization}
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
            onPromptLogin={handleLogin}
            onRequestWorkspaceAccess={handleWorkspaceAuthorization}
            isAuthorizingWorkspace={isAuthorizingWorkspace || isLoggingIn}
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
