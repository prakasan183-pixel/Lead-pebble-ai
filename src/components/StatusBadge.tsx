import React from 'react';
import type { WebsiteStatus, CrmStage } from '../utils/leadScoring.ts';
import { CheckCircle2, AlertCircle, Globe, ShieldCheck, Flame, Zap, Sprout } from 'lucide-react';

export function WebsiteStatusBadge({ status }: { status: WebsiteStatus }) {
  switch (status) {
    case 'no_website_verified':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          No website found
        </span>
      );
    case 'no_website_detected':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Website not listed
        </span>
      );
    case 'could_not_verify':
    case 'broken_website':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Could not verify
        </span>
      );
    case 'active_website':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <Globe className="w-3.5 h-3.5 text-slate-500" />
          Website found
        </span>
      );
  }
}

export function LeadScoreBadge({ score }: { score?: number }) {
  let color = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  let icon = <Sprout className="w-3 h-3 text-slate-500" />;

  if (score === undefined || !Number.isFinite(score)) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border ${color}`}>
        {icon}
        <span>Not verified</span>
      </div>
    );
  }

  if (score >= 80) {
    color = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold';
    icon = <Flame className="w-3.5 h-3.5 text-amber-500" />;
  } else if (score >= 60) {
    color = 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 font-semibold';
    icon = <Zap className="w-3 h-3 text-blue-500" />;
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border ${color}`}>
      {icon}
      <span>Score {score}</span>
    </div>
  );
}

export function CrmStageBadge({ stage }: { stage: CrmStage }) {
  const configs: Record<CrmStage, { label: string; bg: string; text: string; border: string }> = {
    discovered: {
      label: 'Discovered',
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-300 dark:border-slate-700',
    },
    saved: {
      label: 'Prospect Saved',
      bg: 'bg-indigo-50 dark:bg-indigo-950/60',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-200 dark:border-indigo-800',
    },
    contacted: {
      label: 'Contacted',
      bg: 'bg-cyan-50 dark:bg-cyan-950/60',
      text: 'text-cyan-700 dark:text-cyan-300',
      border: 'border-cyan-200 dark:border-cyan-800',
    },
    interested: {
      label: 'Interested / In Talk',
      bg: 'bg-violet-50 dark:bg-violet-950/60',
      text: 'text-violet-700 dark:text-violet-300',
      border: 'border-violet-200 dark:border-violet-800',
    },
    follow_up: {
      label: 'Follow-Up Due',
      bg: 'bg-amber-50 dark:bg-amber-950/60',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
    },
    converted: {
      label: 'Converted (Won) 🎉',
      bg: 'bg-emerald-50 dark:bg-emerald-950/60',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
    unqualified: {
      label: 'Archived',
      bg: 'bg-zinc-100 dark:bg-zinc-800',
      text: 'text-zinc-600 dark:text-zinc-400',
      border: 'border-zinc-200 dark:border-zinc-700',
    },
  };

  const c = configs[stage] || configs.discovered;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  );
}
