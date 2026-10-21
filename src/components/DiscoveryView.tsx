import React, { useState, useMemo, useEffect } from 'react';
import type { Lead } from '../utils/leadScoring.ts';
import { PebbleLoader } from './PebbleLoader.tsx';
import { WebsiteStatusBadge } from './StatusBadge.tsx';
import {
  Search,
  MapPin,
  Phone,
  Navigation,
  MessageCircle,
  ExternalLink,
  Download,
  Building,
  X,
  FileText,
  Check,
  Bookmark,
  BookmarkCheck,
  Mail,
  ArrowUpDown,
  Clock3,
} from 'lucide-react';
import { exportLeadsToCsv } from '../utils/export.ts';
import { calculateDistanceKm, formatDistanceKm } from '../services/geolocation.ts';

const CATEGORY_LIST = [
  'All Categories',
  'Pumps, Motors & Foundry Castings',
  'Textiles & Spinning Mill Spares',
  'Precision Machining & CNC',
  'Commercial Wet Grinders & Appliances',
  'Auto Components & Foundries',
  'Industrial Equipment & Valves',
  'Hydraulics & Heavy Machinery',
];

interface DiscoveryViewProps {
  leads: Lead[];
  onSaveLead: (lead: Lead) => void;
  onBatchSaveLeads?: (leads: Lead[]) => void;
  onSelectLead: (lead: Lead) => void;
  onDraftOutreach?: (lead: Lead) => void;
  onDiscover?: (
    industry: string,
    location: string,
    companyName?: string
  ) => Promise<Lead[] | void> | Lead[] | void;
  isDiscovering?: boolean;
  discoveryError?: string | null;
  initialCategory?: string;
  initialWebsiteFilter?: string;
  showLocationFilter?: boolean;
  userLocation?: { lat: number; lng: number } | null;
  onRequestUserLocation?: () => void;
  isLocating?: boolean;
  locationName?: string;
  distanceFilter?: number | null;
  userName?: string;
}

export function DiscoveryView({
  leads,
  onSaveLead,
  onSelectLead,
  onDraftOutreach,
  onDiscover,
  isDiscovering = false,
  discoveryError,
  initialCategory,
  initialWebsiteFilter,
  showLocationFilter = true,
  userLocation,
  locationName = 'Unknown location',
  distanceFilter = null,
  userName = '',
}: DiscoveryViewProps) {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [companyNameResults, setCompanyNameResults] = useState<Lead[] | null>(null);
  const [searchLocation, setSearchLocation] = useState(locationName);
  const [customCategory, setCustomCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'All Categories');
  const [websiteFilter, setWebsiteFilter] = useState<'all' | 'no_website' | 'has_website'>(
    initialWebsiteFilter === 'no_website_verified' ? 'no_website' : 'all'
  );
  const [sortBy, setSortBy] = useState<'rating' | 'name' | 'proximity' | 'no_website'>('rating');

  const searchForCustomCategory = () => {
    const category = customCategory.trim();
    const location = searchLocation.trim();
    if (!category || !location || isDiscovering) return;
    setSelectedCategory(category);
    setSearchQuery('');
    setCompanyNameResults(null);
    setWebsiteFilter('all');
    setSortBy('rating');
    onDiscover?.(category, location);
  };

  const searchForCompanyName = async () => {
    const companyName = searchQuery.trim();
    const location = searchLocation.trim();
    if (!companyName || !location || isDiscovering || !onDiscover) return;
    setSelectedCategory('All Categories');
    setWebsiteFilter('all');
    setSortBy('rating');
    setCompanyNameResults([]);
    const results = await onDiscover('All Categories', location, companyName);
    if (searchQuery.trim() === companyName && searchLocation.trim() === location) {
      setCompanyNameResults(Array.isArray(results) ? results : []);
    }
  };

  const searchAllCategoriesInLocation = () => {
    const location = searchLocation.trim();
    if (!location || isDiscovering) return;
    setSelectedCategory('All Categories');
    setWebsiteFilter('all');
    setSortBy('rating');
    setCompanyNameResults(null);
    onDiscover?.('All Categories', location);
  };

  useEffect(() => {
    setSearchLocation(locationName);
  }, [locationName]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const matchesSelectedLocation = (lead: Lead) => {
    const requestedLocation = searchLocation.trim().toLowerCase();
    if (!requestedLocation) return false;
    if (lead.searchLocation?.trim().toLowerCase() === requestedLocation) {
      return true;
    }
    if (
      isCurrentLocationSearch &&
      userLocation &&
      Number.isFinite(lead.latitude) &&
      Number.isFinite(lead.longitude)
    ) {
      return calculateDistanceKm(userLocation.lat, userLocation.lng, lead.latitude!, lead.longitude!) <= 25;
    }
    const address = `${lead.fullAddress || ''}, ${lead.city || ''}`.toLowerCase();
    return requestedLocation
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length >= 3)
      .some((part) => address.includes(part));
  };
  const isCurrentLocationSearch =
    searchLocation.trim().toLowerCase() === locationName.trim().toLowerCase();

  // Only display distances when the record contains verified coordinates.
  const enrichedLeads = useMemo(() => {
    return (companyNameResults ?? leads).map((lead) => {
      const distanceKm = isCurrentLocationSearch && userLocation && Number.isFinite(lead.latitude) && Number.isFinite(lead.longitude)
        ? calculateDistanceKm(userLocation.lat, userLocation.lng, lead.latitude!, lead.longitude!)
        : null;

      return { ...lead, distanceKm };
    });
  }, [leads, companyNameResults, userLocation, isCurrentLocationSearch]);

  // Unknown website status is never treated as a website opportunity.
  const filteredLeads = useMemo(() => {
    return enrichedLeads
      .filter((lead) => {
        if (showLocationFilter && !matchesSelectedLocation(lead)) return false;

        // 1. Search text
        if (searchQuery.trim() && companyNameResults === null) {
          const q = searchQuery.toLowerCase().trim();
          const matchesName = lead.companyName.toLowerCase().includes(q);
          const matchesCategory =
            lead.category.toLowerCase().includes(q) ||
            (lead.subCategory || '').toLowerCase().includes(q);
          const matchesAddress =
            (lead.fullAddress || '').toLowerCase().includes(q) ||
            (lead.city || '').toLowerCase().includes(q);
          const matchesPhone = (lead.phoneNumber || '').includes(q);
          const matchesTags = (lead.tags || []).some((t) => t.toLowerCase().includes(q));
          if (!matchesName && !matchesCategory && !matchesAddress && !matchesPhone && !matchesTags) {
            return false;
          }
        }

        // 2. Category
        if (
          selectedCategory !== 'All Categories' &&
          lead.searchCategory !== selectedCategory &&
          lead.category !== selectedCategory
        ) {
          return false;
        }

        // 3. Website status
        if (
          websiteFilter === 'no_website' &&
          lead.websiteStatus !== 'no_website_verified' &&
          lead.websiteStatus !== 'no_website_detected'
        ) {
          return false;
        }
        if (websiteFilter === 'has_website' && lead.websiteStatus !== 'active_website') {
          return false;
        }

        // Nearby searches are capped to the same 25 km area used by Places discovery.
        if (isCurrentLocationSearch && lead.distanceKm !== null && lead.distanceKm > 25) {
          return false;
        }

        // 4. User-selected distance radius
        if (isCurrentLocationSearch && distanceFilter !== null && lead.distanceKm !== null) {
          if (lead.distanceKm > distanceFilter) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') {
          const ratingA = a.rating ?? -1;
          const ratingB = b.rating ?? -1;
          return ratingB - ratingA || (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
        }
        if (sortBy === 'proximity') {
          const distA = a.distanceKm !== null ? a.distanceKm : 9999;
          const distB = b.distanceKm !== null ? b.distanceKm : 9999;
          return distA - distB;
        }
        if (sortBy === 'no_website') {
          const websitePriority = (lead: Lead) =>
            lead.websiteStatus === 'no_website_verified' || lead.websiteStatus === 'no_website_detected' ? 1 : 0;
          return websitePriority(b) - websitePriority(a) ||
            (b.rating ?? -1) - (a.rating ?? -1) ||
            (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
        }
        return a.companyName.localeCompare(b.companyName);
      });
  }, [enrichedLeads, searchQuery, companyNameResults, selectedCategory, websiteFilter, distanceFilter, sortBy, searchLocation, isCurrentLocationSearch, showLocationFilter]);

  // WhatsApp Link Helper
  const getWhatsAppUrl = (lead: Lead) => {
    const rawPhone = (lead.phoneNumber || '').replace(/\D/g, '');
    const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const text = `Hello ${lead.companyName}, I am reaching out to learn more about your business and ask whether digital improvements are a current priority.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const scopedLeads = enrichedLeads.filter((lead) => {
    if (showLocationFilter && !matchesSelectedLocation(lead)) return false;
    const matchesCategory = selectedCategory === 'All Categories' ||
      lead.searchCategory === selectedCategory ||
      lead.category === selectedCategory;
    if (!matchesCategory) return false;
    if (isCurrentLocationSearch && lead.distanceKm !== null && lead.distanceKm > 25) return false;
    return distanceFilter === null || lead.distanceKm === null || lead.distanceKm <= distanceFilter;
  });
  const noWebsiteCount = scopedLeads.filter((l) =>
    l.websiteStatus === 'no_website_verified' || l.websiteStatus === 'no_website_detected'
  ).length;
  const hasWebsiteCount = scopedLeads.filter((l) => l.websiteStatus === 'active_website').length;
  const localHour = currentTime.getHours();
  const greeting = localHour < 12 ? 'Good morning' : localHour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = userName.trim().split(/\s+/)[0];
  const localTime = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(currentTime);

  return (
    <div className="space-y-5">
      <section className="relative grid min-w-0 grid-cols-1 grid-rows-[auto_auto_auto] items-center gap-y-3 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-white to-indigo-50/70 px-3.5 py-4 shadow-xs dark:border-slate-800 dark:from-[#111214] dark:via-[#111214] dark:to-[#18151d] sm:px-5 lg:flex lg:justify-between lg:gap-3 lg:px-6">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 sm:gap-3.5 lg:flex-1">
          <img
            src="/leadpebble-logo.png"
            alt="LeadPebble"
            className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white p-1 object-contain shadow-sm sm:h-14 sm:w-14 sm:rounded-2xl sm:p-1.5 dark:border-slate-700 dark:bg-[#1b1c1e]"
          />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase leading-4 tracking-[0.08em] text-indigo-600 dark:text-indigo-300 sm:text-xs sm:tracking-[0.12em]">
              LeadPebble <span className="text-slate-400 dark:text-slate-500">·</span> Company Directory
            </p>
            <span aria-hidden="true" className="mt-1 block h-0.5 w-12 rounded-full bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-cyan-500 sm:mt-1.5 sm:w-16" />
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
              {greeting}{displayName ? ',' : ''}
            </p>
            <h2 className="mt-0.5 max-w-full truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              {displayName || 'welcome'} <span aria-hidden="true">👋</span>
            </h2>
            <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400 sm:text-xs">
              Let’s find the right businesses for you.
            </p>
          </div>
        </div>
        <div className="col-start-1 row-start-3 flex min-w-0 items-center justify-center gap-2 text-[10px] font-semibold tracking-wide text-slate-500 dark:text-slate-400 sm:gap-3 sm:text-[11px] lg:col-span-1 lg:row-start-1 lg:min-w-[260px] lg:flex-1 lg:px-4">
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
            Discover
          </span>
          <span aria-hidden="true" className="h-px min-w-3 flex-1 bg-gradient-to-r from-fuchsia-400/70 to-indigo-400/70 sm:min-w-8" />
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Verify
          </span>
          <span aria-hidden="true" className="h-px min-w-3 flex-1 bg-gradient-to-r from-indigo-400/70 to-cyan-400/70 sm:min-w-8" />
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-cyan-500" />
            Connect
          </span>
        </div>
        <div className="col-start-1 row-start-2 inline-flex shrink-0 items-center justify-self-end gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-2 py-2 text-xs font-semibold tabular-nums text-slate-700 dark:border-slate-700 dark:bg-[#1b1c1e] dark:text-slate-200 sm:gap-2 sm:px-3 sm:text-sm lg:col-start-auto lg:row-start-auto">
          <Clock3 className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300 sm:h-4 sm:w-4" />
          <time className="whitespace-nowrap" dateTime={currentTime.toISOString()}>{localTime}</time>
          <span className="hidden whitespace-nowrap font-normal text-slate-500 dark:text-slate-400 sm:inline">local time</span>
        </div>
      </section>
      
      {/* Search Bar & Clean Filters */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-xs space-y-3">
        
        {/* Search Input Box */}
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCompanyNameResults(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && searchQuery.trim() && searchLocation.trim() && !isDiscovering) {
                void searchForCompanyName();
              }
            }}
            placeholder="Search saved companies, or look up a company by name..."
            aria-label="Search saved companies or search Google Maps by company name"
            className="w-full pl-11 pr-10 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {onDiscover && searchQuery.trim() && (
          <button
            type="button"
            onClick={() => void searchForCompanyName()}
            disabled={isDiscovering || !searchLocation.trim()}
            className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left text-xs font-semibold text-blue-800 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950 sm:w-auto"
          >
            {isDiscovering
              ? `Searching Google Maps for “${searchQuery.trim()}”…`
              : `Search Google Maps for “${searchQuery.trim()}” in ${searchLocation.trim()}`}
          </button>
        )}

        {showLocationFilter && <label className="block" data-tour="location-search">
          <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">
            City or area to search
          </span>
          <div className="relative">
            <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchLocation}
              onChange={(event) => {
                setSearchLocation(event.target.value);
                setCompanyNameResults(null);
                setSelectedCategory('All Categories');
                setWebsiteFilter('all');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && searchLocation.trim() && !isDiscovering) {
                  searchAllCategoriesInLocation();
                }
              }}
              placeholder="Enter a city or area (e.g. Chennai, India)"
              aria-label="City or area to search"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2.5 pl-9 pr-3 text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="mt-1 block text-[11px] text-gray-500 dark:text-gray-400">
            Search results are shown for this city. A different city won’t use your current GPS distance filter.
          </span>
        </label>}

        {/* Website Status & Ranking Sorter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setWebsiteFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                websiteFilter === 'all'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-bold'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Companies ({scopedLeads.length})
            </button>

            <button
              onClick={() => {
                setWebsiteFilter('no_website');
                setSortBy('no_website');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                websiteFilter === 'no_website'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
              }`}
            >
              No website listed / found ({noWebsiteCount})
            </button>

            <button
              onClick={() => {
                setWebsiteFilter('has_website');
                setSortBy('rating');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                websiteFilter === 'has_website'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Has Website ({hasWebsiteCount})
            </button>
          </div>

          {onDiscover && (
            <button
              type="button"
              onClick={searchAllCategoriesInLocation}
              disabled={isDiscovering || !searchLocation.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isDiscovering ? 'Searching all business types…' : 'Search all businesses here'}
            </button>
          )}

          {/* Sort only by directly available data */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Rank by:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="rating">Top rated on Google</option>
              <option value="name">Company name</option>
              <option value="proximity">📍 Nearest Distance</option>
              <option value="no_website">🌐 Website status</option>
            </select>
          </div>

          {discoveryError && (
            <p role="status" className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs">
              {discoveryError}
            </p>
          )}
        </div>

        {/* Category Pills */}
        <div className="space-y-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <div data-tour="categories" className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORY_LIST.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  disabled={isDiscovering}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSearchQuery('');
                    setCompanyNameResults(null);
                    setWebsiteFilter('all');
                    setSortBy('rating');
                    if (searchLocation.trim()) onDiscover?.(cat, searchLocation.trim());
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition disabled:opacity-50 disabled:cursor-wait ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {selectedCategory !== 'All Categories' && !CATEGORY_LIST.includes(selectedCategory) && (
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Custom business type: <span className="font-semibold">{selectedCategory}</span>
            </p>
          )}

          {onDiscover && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="custom-business-category" className="shrink-0 text-xs font-semibold text-gray-600 dark:text-gray-300">
                Or search another business type
              </label>
              <div className="flex min-w-0 flex-1 gap-2">
                <input
                  id="custom-business-category"
                  type="text"
                  value={customCategory}
                  onChange={(event) => setCustomCategory(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') searchForCustomCategory();
                  }}
                  placeholder="e.g. furniture shops"
                  disabled={isDiscovering}
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={searchForCustomCategory}
                  disabled={isDiscovering || !customCategory.trim() || !searchLocation.trim()}
                  className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  {isDiscovering ? 'Searching…' : 'Search type'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clean Company Cards Grid */}
      {isDiscovering && filteredLeads.length === 0 && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-8 text-center">
          <PebbleLoader
            compact
            message={`Searching Google Maps for ${selectedCategory === 'All Categories' ? 'nearby companies' : selectedCategory}…`}
            detail="Checking returned company websites before showing results. This can take a little while."
          />
        </div>
      )}
      {!isDiscovering && filteredLeads.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            {leads.length === 0 ? 'No company records yet' : 'No companies match these filters'}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {leads.length === 0
              ? 'Choose a category to search Google Maps for nearby businesses, or use “All Categories” for a broader search.'
              : websiteFilter === 'no_website'
                ? 'Google Maps did not return any businesses without a website listed in these results. This does not prove that every business has a website.'
                : selectedCategory !== 'All Categories'
                  ? `No results for “${selectedCategory}” at this location. Try “All Categories” or a nearby location.`
              : 'Change the search text or filters to see the saved company records.'}
          </p>
          {leads.length === 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Search results come directly from Google Maps. Only returned business details are shown.
            </p>
          )}
        </div>
      )}
      <div data-tour="company-results" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLeads.map((lead) => {
          const isSaved = lead.crmStatus && lead.crmStatus !== 'discovered';

          return (
            <div
              key={lead.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-xs hover:border-gray-300 dark:hover:border-gray-700 transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                
                {/* Header: Name, Distance, Website Status */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      onClick={() => onSelectLead(lead)}
                      className="text-base sm:text-lg font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition leading-snug"
                    >
                      {lead.companyName}
                    </h3>

                    {/* Bookmark / Save icon */}
                    <button
                      type="button"
                      onClick={() => {
                        onSaveLead({
                          ...lead,
                          crmStatus: isSaved ? 'discovered' : 'saved',
                        });
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition shrink-0"
                      title={isSaved ? 'Remove from saved' : 'Save business'}
                    >
                      {isSaved ? (
                        <BookmarkCheck className="w-5 h-5 text-blue-600 fill-blue-600" />
                      ) : (
                        <Bookmark className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* Category & Proximity */}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                    <span className="font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                      {lead.category}
                    </span>

                    {lead.distanceKm !== null && (
                      <span className="font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-red-500" />
                        <span>{formatDistanceKm(lead.distanceKm)}</span>
                      </span>
                    )}

                    <WebsiteStatusBadge status={lead.websiteStatus} />
                  </div>
                </div>

                {lead.searchCategory && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Search match: {lead.searchCategory}
                  </p>
                )}

                {lead.description && (
                  <p className="line-clamp-2 text-xs leading-5 text-gray-600 dark:text-gray-400">
                    {lead.description}
                    {lead.fieldSources?.description?.[0] && (
                      <a
                        href={lead.fieldSources.description[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="ml-1 whitespace-nowrap text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Source
                      </a>
                    )}
                  </p>
                )}

                {lead.businessStatus && (
                  <p className="text-[11px] font-medium capitalize text-slate-500 dark:text-slate-400">
                    Google status: {lead.businessStatus.replace(/_/g, ' ').toLowerCase()}
                  </p>
                )}

                {/* Subcategory / Specialty */}
                {lead.subCategory && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                    Specialty: {lead.subCategory}
                  </p>
                )}

                {/* Physical Street Address */}
                <div className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{lead.fullAddress || 'Unknown'}</span>
                </div>

                {/* Phone Number & Google Reviews */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[11px] text-gray-400 block">Contact Phone:</span>
                    {lead.phoneNumber ? (
                      <a
                        href={`tel:${lead.phoneNumber}`}
                        className="font-bold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 text-sm"
                      >
                        {lead.phoneNumber}
                      </a>
                    ) : <span className="font-bold text-gray-500">Unknown</span>}
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-gray-400 block">Google rating:</span>
                    <span className="font-bold text-gray-500">
                      {lead.rating !== undefined
                        ? `${lead.rating.toFixed(1)} / 5${lead.reviewCount !== undefined ? ` (${lead.reviewCount} reviews)` : ''}`
                        : 'Not listed by Google'}
                    </span>
                    {lead.googleMapsUrl && (
                      <a
                        href={lead.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-0.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Google Maps source
                      </a>
                    )}
                  </div>
                </div>

                {/* Plain-English Verification Note */}
                {lead.verificationDetails?.notes && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 line-clamp-2">
                    {lead.verificationDetails.notes}
                  </p>
                )}
              </div>

              {/* Bottom Action Area */}
              <div className="pt-4 mt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                {/* Primary Button: Draft Personalized Outreach */}
                {onDraftOutreach && (
                  <button
                    type="button"
                    onClick={() => onDraftOutreach(lead)}
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Draft Email / LinkedIn Outreach</span>
                  </button>
                )}

                {/* Secondary Action Buttons Grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {/* 1. Call Button */}
                  <a
                    href={`tel:${lead.phoneNumber}`}
                    className="py-2 px-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center justify-center gap-1 shadow-xs"
                    title={`Call ${lead.companyName}`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>

                  {/* 2. Directions Button */}
                  <a
                    href={
                      userLocation
                        ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${encodeURIComponent(
                            lead.fullAddress || lead.companyName
                          )}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            lead.fullAddress || lead.companyName
                          )}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-2 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition flex items-center justify-center gap-1"
                    title="Get driving directions"
                  >
                    <Navigation className="w-3.5 h-3.5 text-blue-600" />
                    <span>Route</span>
                  </a>

                  {/* 3. WhatsApp Button */}
                  <a
                    href={getWhatsAppUrl(lead)}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-2 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition flex items-center justify-center gap-1"
                    title="Send WhatsApp message"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Chat</span>
                  </a>

                  {/* 4. Details Button */}
                  <button
                    type="button"
                    onClick={() => onSelectLead(lead)}
                    className="py-2 px-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Details</span>
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {filteredLeads.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl space-y-2">
          <Building className="w-8 h-8 text-gray-400 mx-auto" />
          <h4 className="text-base font-bold text-gray-900 dark:text-white">
            No companies found
          </h4>
          <p className="text-xs text-gray-500">
            Try clearing your search query or selecting &quot;All Categories&quot;.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All Categories');
              setWebsiteFilter('all');
            }}
            className="px-4 py-2 mt-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
          >
            Reset Filters
          </button>
        </div>
      )}

    </div>
  );
}
