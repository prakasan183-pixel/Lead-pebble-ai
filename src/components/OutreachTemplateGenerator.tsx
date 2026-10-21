import React, { useState, useEffect } from 'react';
import type { Lead } from '../utils/leadScoring.ts';
import { apiFetch } from '../services/api.ts';
import { WebsiteStatusBadge, LeadScoreBadge } from './StatusBadge.tsx';
import {
  Mail,
  Linkedin,
  MessageSquare,
  PhoneCall,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Download,
  Building2,
  RefreshCw,
  Search,
  Bookmark,
  ChevronDown,
  Send,
  FileText,
  AlertCircle,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';

interface OutreachTemplateGeneratorProps {
  leads: Lead[];
  selectedLeadId?: string | null;
  onSelectLead: (lead: Lead) => void;
  onSaveLead: (updatedLead: Lead) => void;
  userLocation?: { lat: number; lng: number } | null;
}

export function OutreachTemplateGenerator({
  leads,
  selectedLeadId,
  onSelectLead,
  onSaveLead,
  userLocation: _userLocation,
}: OutreachTemplateGeneratorProps) {
  // Currently selected lead
  const initialLead = leads.find((l) => l.id === selectedLeadId) || leads[0] || null;
  const [currentLead, setCurrentLead] = useState<Lead | null>(initialLead);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Outreach options
  const [tone, setTone] = useState<string>('Direct & Professional');
  const [customOffer, setCustomOffer] = useState<string>('');

  // Generation state
  const [isLoading, setIsLoading] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [outreachData, setOutreachData] = useState<any>(null);

  // Active channel tab: 'email' | 'linkedin' | 'whatsapp' | 'call'
  const [channelTab, setChannelTab] = useState<'email' | 'linkedin' | 'whatsapp' | 'call'>('email');

  // Copied field feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSavedToCrm, setIsSavedToCrm] = useState(false);

  // Editable fields for user tweaking
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [connectionNote, setConnectionNote] = useState<string>('');
  const [inMailBody, setInMailBody] = useState<string>('');

  // Update currentLead if selectedLeadId prop changes from outside
  useEffect(() => {
    if (selectedLeadId) {
      const found = leads.find((l) => l.id === selectedLeadId);
      if (found) {
        setCurrentLead(found);
      }
    }
  }, [selectedLeadId, leads]);

  // When currentLead changes, trigger generation or reset
  useEffect(() => {
    if (currentLead) {
      handleGenerate();
    }
  }, [currentLead?.id]);

  const handleGenerate = async () => {
    if (!currentLead) return;
    setIsLoading(true);
    setGenerationError(null);
    setIsSavedToCrm(false);
    setOutreachData(null);
    setSelectedSubject('');
    setEmailBody('');
    setConnectionNote('');
    setInMailBody('');

    try {
      const res = await apiFetch('/api/ai/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: currentLead,
          tone,
          customOffer,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate outreach templates');
      }

      const generated = data.outreach;
      setOutreachData(generated);

      // Populate editable fields
      if (generated.emailPitch?.subjectOptions?.[0]) {
        setSelectedSubject(generated.emailPitch.subjectOptions[0]);
      }
      setEmailBody(generated.emailPitch?.body || '');
      setConnectionNote(generated.linkedInOutreach?.connectionNote || '');
      setInMailBody(generated.linkedInOutreach?.inMailMessage?.body || '');
    } catch (err: any) {
      console.error('Outreach generation error:', err);
      setGenerationError(err.message || 'Generation error');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Save generated templates into lead notes and push stage to contacted/follow_up
  const handleSaveToLeadNotes = () => {
    if (!currentLead || !outreachData) return;
    const timestamp = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newNote = `[Outreach Drafted - ${timestamp}]
Subject: ${selectedSubject}
Channel: ${channelTab.toUpperCase()}
Tone: ${tone}`;

    const updatedLead: Lead = {
      ...currentLead,
      crmStatus: currentLead.crmStatus === 'discovered' ? 'saved' : currentLead.crmStatus,
      notes: [newNote, ...(currentLead.notes || [])],
    };

    onSaveLead(updatedLead);
    setCurrentLead(updatedLead);
    setIsSavedToCrm(true);
    setTimeout(() => setIsSavedToCrm(false), 3000);
  };

  // Download all templates as markdown file
  const handleDownloadTemplates = () => {
    if (!currentLead || !outreachData) return;
    const content = `# B2B Outreach Drafts for ${currentLead.companyName}
Industry: ${currentLead.category || 'Unknown'}${currentLead.subCategory ? ` (${currentLead.subCategory})` : ''}
Location: ${currentLead.city || 'Unknown'}
Website Status: ${currentLead.websiteStatus}
Phone: ${currentLead.phoneNumber || 'N/A'}
Date Generated: ${new Date().toLocaleString()}

---

## 1. Personalized Cold Email

### Subject Options:
${(outreachData.emailPitch?.subjectOptions || []).map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

### Email Body:
${emailBody || outreachData.emailPitch?.body}

### 3-Day Follow-Up Note:
${outreachData.emailPitch?.followUpSnippet}

---

## 2. LinkedIn Outreach

### Connection Request Note (<= 300 chars):
${connectionNote || outreachData.linkedInOutreach?.connectionNote}

### InMail / Direct Message:
Subject: ${outreachData.linkedInOutreach?.inMailMessage?.subject}
${inMailBody || outreachData.linkedInOutreach?.inMailMessage?.body}

### Post-Connection Follow-up:
${outreachData.linkedInOutreach?.followUpMessage}

---

## 3. WhatsApp Message
${outreachData.whatsappMessage}

---

## 4. Cold Call Script
Opener: ${outreachData.coldCallScript?.opener}
The Hook: ${outreachData.coldCallScript?.theHook}
Objection Rebuttal: ${outreachData.coldCallScript?.objectionRebuttal}
Closing CTA: ${outreachData.coldCallScript?.callToAction}
`;

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `outreach-${currentLead.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtered leads for selector dropdown
  const filteredLeads = leads.filter((l) => {
    if (!leadSearchQuery.trim()) return true;
    const q = leadSearchQuery.toLowerCase();
    return (
      l.companyName.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q) ||
      l.city.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* 1. Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Mail className="w-4 h-4" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Outreach Template Generator
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Create editable outreach drafts. Review each draft and verify its details before sending.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {outreachData && (
              <button
                onClick={handleDownloadTemplates}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export All</span>
              </button>
            )}

            <button
              onClick={handleGenerate}
              disabled={isLoading || !currentLead}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Generating...' : 'Re-Generate with OpenAI'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Target Prospect Selector & Strategy Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Lead Selector & Lead Card (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Target Prospect
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                {leads.length} companies available
              </span>
            </div>

            {/* Dropdown Lead Picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-left flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white hover:border-blue-400 transition"
              >
                <span className="truncate pr-2">
                  {currentLead ? currentLead.companyName : 'Select a target lead...'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-72 flex flex-col">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={leadSearchQuery}
                        onChange={(e) => setLeadSearchQuery(e.target.value)}
                        placeholder="Search company or industry..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:border-blue-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredLeads.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => {
                          setCurrentLead(lead);
                          onSelectLead(lead);
                          setIsDropdownOpen(false);
                          setLeadSearchQuery('');
                        }}
                        className={`w-full p-2.5 text-left text-xs transition flex items-start justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                          currentLead?.id === lead.id ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {lead.companyName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {lead.category} &middot; {lead.city}
                          </p>
                        </div>
                        <WebsiteStatusBadge status={lead.websiteStatus} />
                      </button>
                    ))}
                    {filteredLeads.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No companies match "{leadSearchQuery}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Prospect Details Snapshot Card */}
            {currentLead && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {currentLead.companyName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {currentLead.category} {currentLead.subCategory ? `• ${currentLead.subCategory}` : ''}
                    </p>
                  </div>
                  <LeadScoreBadge score={currentLead.leadScore} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Website Status</span>
                    <WebsiteStatusBadge status={currentLead.websiteStatus} />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Phone</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {currentLead.phoneNumber || 'Not listed'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Location</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                      {currentLead.fullAddress || currentLead.city}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Est. Revenue</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {currentLead.estimatedRevenueTier || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Strategy & Tone Settings */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Outreach Strategy & Tone
            </h4>

            {/* Tone Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Voice & Tone
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  'Direct & Professional',
                  'Consultative & Value-First',
                ].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition text-left ${
                      tone === t
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Value Hook / Custom Offer */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Value Proposition Hook</span>
              </label>
              <input
                type="text"
                value={customOffer}
                onChange={(e) => setCustomOffer(e.target.value)}
                placeholder="Optional offer you can actually provide"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Quick Action: Save to CRM Notes */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSaveToLeadNotes}
                disabled={!outreachData}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  isSavedToCrm
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {isSavedToCrm ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Saved to Lead CRM Notes!</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Save Draft to Lead CRM Notes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Channel Switcher & Generated Templates (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Channel Tabs */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xs flex items-center gap-1">
            <button
              onClick={() => setChannelTab('email')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                channelTab === 'email'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Personalized Email</span>
            </button>

            <button
              onClick={() => setChannelTab('linkedin')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                channelTab === 'linkedin'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Linkedin className="w-3.5 h-3.5" />
              <span>LinkedIn Messages</span>
            </button>

            <button
              onClick={() => setChannelTab('whatsapp')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                channelTab === 'whatsapp'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={() => setChannelTab('call')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                channelTab === 'call'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call Script</span>
            </button>
          </div>

          {/* Industry Insight Banner */}
          {outreachData?.industryInsight && (
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
              <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  Industry Angle &middot; {currentLead?.category}
                </span>
                <p className="mt-0.5 text-blue-800 dark:text-blue-300">
                  {outreachData.industryInsight}
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {generationError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{generationError}. No draft was returned.</span>
            </div>
          )}

          {/* Loading Skeleton */}
          {isLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <div className="w-8 h-8 mx-auto border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Drafting an outreach message...
              </p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Only supplied company details are available; verify the draft before sending.
              </p>
            </div>
          ) : (
            <>
              {/* TAB 1: PERSONALIZED COLD EMAIL */}
              {channelTab === 'email' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span>Email Pitch Draft</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(emailBody || outreachData?.emailPitch?.body || '', 'email_body')}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 text-slate-700 dark:text-slate-200"
                      >
                        {copiedKey === 'email_body' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'email_body' ? 'Copied Body!' : 'Copy Body'}</span>
                      </button>

                      {currentLead?.email && (
                        <a
                          href={`mailto:${currentLead.email}?subject=${encodeURIComponent(selectedSubject)}&body=${encodeURIComponent(emailBody)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Open in Mail</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Subject Line Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Subject line
                    </label>
                    <div className="space-y-1">
                      {(outreachData?.emailPitch?.subjectOptions || []).map((subj: string, idx: number) => {
                        const isSelected = selectedSubject === subj;
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedSubject(subj)}
                            className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-900 dark:text-blue-200 font-semibold'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="truncate pr-2">{subj}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(subj, `subj_${idx}`);
                              }}
                              title="Copy subject line"
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600"
                            >
                              {copiedKey === `subj_${idx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        );
                      })}
                      {!outreachData?.emailPitch?.subjectOptions?.length && (
                        <p className="text-xs text-slate-500">Generate a draft to see subject suggestions.</p>
                      )}
                    </div>
                  </div>

                  {/* Editable Email Body */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Email Body (Editable)</span>
                      <span className="text-[11px] font-normal text-slate-400">Click text to edit</span>
                    </label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={11}
                      className="w-full p-3.5 rounded-xl text-xs sm:text-sm font-sans leading-relaxed bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  {/* 3-Day Follow-Up Snippet */}
                  {outreachData?.emailPitch?.followUpSnippet && (
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          ⏱️ 3-Day Follow-Up Snippet
                        </span>
                        <button
                          onClick={() => copyToClipboard(outreachData.emailPitch.followUpSnippet, 'followup')}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {copiedKey === 'followup' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'followup' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                        "{outreachData.emailPitch.followUpSnippet}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: LINKEDIN MESSAGES */}
              {channelTab === 'linkedin' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Linkedin className="w-4 h-4 text-blue-600" />
                      <span>LinkedIn Personalized Outreach</span>
                    </h3>
                    
                    {/* LinkedIn search button */}
                    <a
                      href={`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(
                        `${currentLead?.companyName} ${
                          currentLead?.city && currentLead.city !== 'Unknown' ? currentLead.city : ''
                        }`.trim()
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                      <span>Search on LinkedIn</span>
                    </a>
                  </div>

                  {/* 1. Connection Request Note (<300 chars) */}
                  <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          1. Connection Request Note
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          connectionNote.length <= 300
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {connectionNote.length} / 300 chars (LinkedIn Limit)
                        </span>
                      </div>

                      <button
                        onClick={() => copyToClipboard(connectionNote, 'li_note')}
                        className="px-2.5 py-1 rounded-lg border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-800 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 flex items-center gap-1"
                      >
                        {copiedKey === 'li_note' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'li_note' ? 'Copied Note!' : 'Copy Note'}</span>
                      </button>
                    </div>

                    <textarea
                      value={connectionNote}
                      onChange={(e) => setConnectionNote(e.target.value)}
                      rows={3}
                      className="w-full p-2.5 rounded-lg text-xs font-sans leading-relaxed bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                    />
                    <p className="text-[11px] text-slate-500">
                      Include this customized note when clicking "Add a note" on LinkedIn before sending the connection invitation.
                    </p>
                  </div>

                  {/* 2. InMail / Direct Message */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          2. Full InMail / Direct Message
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Subject: {outreachData?.linkedInOutreach?.inMailMessage?.subject || 'Introduction'}
                        </p>
                      </div>

                      <button
                        onClick={() => copyToClipboard(inMailBody, 'inmail_body')}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 text-slate-700 dark:text-slate-200"
                      >
                        {copiedKey === 'inmail_body' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'inmail_body' ? 'Copied InMail!' : 'Copy InMail'}</span>
                      </button>
                    </div>

                    <textarea
                      value={inMailBody}
                      onChange={(e) => setInMailBody(e.target.value)}
                      rows={7}
                      className="w-full p-3 rounded-xl text-xs sm:text-sm font-sans leading-relaxed bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  {/* 3. Post-Connection Follow-up */}
                  {outreachData?.linkedInOutreach?.followUpMessage && (
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          3. Post-Connection Accepted Message
                        </span>
                        <button
                          onClick={() => copyToClipboard(outreachData.linkedInOutreach.followUpMessage, 'li_followup')}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {copiedKey === 'li_followup' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'li_followup' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        "{outreachData.linkedInOutreach.followUpMessage}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: WHATSAPP OUTREACH */}
              {channelTab === 'whatsapp' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <span>WhatsApp Direct Outreach</span>
                    </h3>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(outreachData?.whatsappMessage || '', 'wa_text')}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 text-slate-700 dark:text-slate-200"
                      >
                        {copiedKey === 'wa_text' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'wa_text' ? 'Copied!' : 'Copy'}</span>
                      </button>

                      {currentLead?.phoneNumber && (
                        <a
                          href={`https://wa.me/${currentLead.phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
                            outreachData?.whatsappMessage || ''
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Open in WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-xs sm:text-sm font-sans leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                    {outreachData?.whatsappMessage || 'Generate a draft to display a message.'}
                  </div>
                </div>
              )}

              {/* TAB 4: COLD CALL SCRIPT */}
              {channelTab === 'call' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-indigo-600" />
                      <span>Phone Script & Objection Rebuttals</span>
                    </h3>

                    {currentLead?.phoneNumber && (
                      <a
                        href={`tel:${currentLead.phoneNumber}`}
                        className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Call {currentLead.phoneNumber}</span>
                      </a>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850">
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                        1. Phone Opener
                      </span>
                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-1">
                        {outreachData?.coldCallScript?.opener}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850">
                      <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                        2. Discussion Prompt
                      </span>
                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-1">
                        {outreachData?.coldCallScript?.theHook}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850">
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                        3. Objection: "We get enough work through brokers & word-of-mouth"
                      </span>
                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-1">
                        {outreachData?.coldCallScript?.objectionRebuttal}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850">
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                        4. Closing Call-To-Action (5-Minute Screen Share)
                      </span>
                      <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-1 font-semibold">
                        {outreachData?.coldCallScript?.callToAction}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>

    </div>
  );
}
