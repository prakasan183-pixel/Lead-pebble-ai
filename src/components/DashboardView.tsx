import type { Lead } from '../utils/leadScoring.ts';
import { calculateLeadStats } from '../utils/leadScoring.ts';
import { ArrowUpRight, Download, MapPin, Navigation, Phone, Search } from 'lucide-react';
import { WebsiteStatusBadge } from './StatusBadge.tsx';

interface DashboardViewProps {
  leads: Lead[];
  onNavigateToDiscovery: (category?: string) => void;
  onNavigateToCrm: () => void;
  onFilterNoWebsite: () => void;
  onExportCsv: () => void;
  onNavigateToMap?: () => void;
  onSelectLead?: (lead: Lead) => void;
  locationName?: string;
}

export function DashboardView({
  leads,
  onNavigateToDiscovery,
  onNavigateToCrm,
  onFilterNoWebsite,
  onExportCsv,
  onNavigateToMap,
  onSelectLead,
  locationName = 'Unknown location',
}: DashboardViewProps) {
  const stats = calculateLeadStats(leads);
  const noWebsiteListed = leads.filter(
    (lead) => lead.websiteStatus === 'no_website_verified' || lead.websiteStatus === 'no_website_detected'
  ).length;
  const needsReview = leads.filter(
    (lead) => lead.websiteStatus === 'could_not_verify' || lead.websiteStatus === 'broken_website'
  ).length;

  const categoryCounts = new Map<string, {
    total: number;
    noWebsiteListed: number;
    websitesFound: number;
    needsReview: number;
  }>();

  for (const lead of leads) {
    const counts = categoryCounts.get(lead.category) ?? {
      total: 0,
      noWebsiteListed: 0,
      websitesFound: 0,
      needsReview: 0,
    };
    counts.total += 1;
    if (lead.websiteStatus === 'no_website_verified' || lead.websiteStatus === 'no_website_detected') {
      counts.noWebsiteListed += 1;
    } else if (lead.websiteStatus === 'active_website') {
      counts.websitesFound += 1;
    } else if (lead.websiteStatus === 'could_not_verify' || lead.websiteStatus === 'broken_website') {
      counts.needsReview += 1;
    }
    categoryCounts.set(lead.category, counts);
  }

  const categoryEntries = [...categoryCounts.entries()]
    .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]))
    .slice(0, 8);
  const topCandidates = leads
    .filter((lead) => lead.websiteStatus === 'no_website_verified')
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
    .slice(0, 4);

  const summaryCards = [
    {
      label: 'Companies in directory',
      value: stats.totalFound,
      note: 'Saved company records',
      color: 'text-slate-900 dark:text-white',
    },
    {
      label: 'Website not listed',
      value: noWebsiteListed,
      note: 'Google Maps did not list a website',
      color: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      label: 'Website found',
      value: stats.hasWebsite,
      note: 'Company identity verified',
      color: 'text-blue-700 dark:text-blue-300',
    },
    {
      label: 'Needs a closer look',
      value: needsReview,
      note: 'Could not verify or site appears broken',
      color: 'text-amber-700 dark:text-amber-300',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl space-y-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              Market overview · all saved locations
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Your market, at a glance.
            </h2>
            <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              A practical overview of the companies in your directory. Counts include saved records from all searches;
              website labels reflect the verification status shown on each company.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onNavigateToDiscovery()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Search className="h-4 w-4" />
              Browse companies
            </button>
            <button
              onClick={onExportCsv}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={onNavigateToCrm}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Open CRM <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>Current map location: {locationName}</span>
          <span>Company details retain their recorded sources</span>
          <span>Phone numbers are listed, not call-verified</span>
          {onNavigateToMap && (
            <button
              onClick={onNavigateToMap}
              className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300"
            >
              <MapPin className="h-3.5 w-3.5" />
              Open map
            </button>
          )}
        </div>
      </section>

      <section aria-label="Directory summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{card.label}</p>
            <p className={`mt-2 text-3xl font-semibold tabular-nums ${card.color}`}>{card.value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{card.note}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Business types in Google Maps</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Website status as recorded for each business. “Not listed” does not confirm that a business has no website.
            </p>
          </div>
          <button
            onClick={() => onNavigateToDiscovery()}
            className="inline-flex items-center gap-1 self-start text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200 sm:self-auto"
          >
            Search directory <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>

        {categoryEntries.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">
            No saved company records yet. Search the directory to start building this overview.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Business type</th>
                  <th className="px-5 py-3 text-right">Companies</th>
                  <th className="px-5 py-3 text-right">Website not listed</th>
                  <th className="px-5 py-3 text-right">Website found</th>
                  <th className="px-5 py-3 text-right">Needs review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {categoryEntries.map(([category, counts]) => (
                  <tr key={category} className="group">
                    <th scope="row" className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">
                      {category}
                    </th>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-700 dark:text-slate-300">{counts.total}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{counts.noWebsiteListed}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-blue-700 dark:text-blue-300">{counts.websitesFound}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-amber-700 dark:text-amber-300">{counts.needsReview}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Businesses with verified website gaps</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              These records have a verified no-website finding. Review the source before reaching out.
            </p>
          </div>
          <button
            onClick={onFilterNoWebsite}
            className="inline-flex items-center gap-1 self-start text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200 sm:self-auto"
          >
            View all {noWebsiteListed} listed <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>

        {topCandidates.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">
            No verified website-gap records are available in this directory yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {topCandidates.map((lead) => (
              <article key={lead.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => onSelectLead?.(lead)}
                      className="text-left font-semibold text-slate-900 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-300"
                    >
                      {lead.companyName}
                    </button>
                    <WebsiteStatusBadge status={lead.websiteStatus} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lead.category} · {lead.fullAddress || 'Address not listed'}
                  </p>
                  {lead.rating !== undefined && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Google rating: {lead.rating.toFixed(1)}
                      {lead.reviewCount !== undefined ? ` · ${lead.reviewCount} reviews` : ''}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {lead.phoneNumber && (
                    <a
                      href={`tel:${lead.phoneNumber}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Phone className="h-3.5 w-3.5" /> {lead.phoneNumber}
                    </a>
                  )}
                  {lead.googleMapsUrl && (
                    <a
                      href={lead.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open Google Maps source for ${lead.companyName}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Navigation className="h-3.5 w-3.5" /> Source
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
