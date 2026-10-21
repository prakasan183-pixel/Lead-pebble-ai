import React, { useState, useEffect } from 'react';
import type { Lead, CrmStage, WebsiteStatus } from '../utils/leadScoring.ts';
import { WebsiteStatusBadge, LeadScoreBadge, CrmStageBadge } from './StatusBadge.tsx';
import {
  X,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  PhoneCall,
  MessageSquare,
  FileText,
  Image as ImageIcon,
  Send,
  Calendar,
  Save,
  Check,
  Copy,
  Download,
  AlertTriangle,
  Star,
} from 'lucide-react';
import { getAccessToken } from '../services/auth.ts';

interface LeadDetailModalProps {
  lead: Lead | null;
  onClose: () => void;
  onUpdateLead: (updated: Lead) => void;
  userToken: string | null;
  onPromptLogin?: () => void;
  onRequestWorkspaceAccess?: () => void;
  isAuthorizingWorkspace?: boolean;
  authError?: string | null;
  onDraftOutreach?: (lead: Lead) => void;
}

export function LeadDetailModal({
  lead,
  onClose,
  onUpdateLead,
  userToken,
  onPromptLogin,
  onRequestWorkspaceAccess,
  isAuthorizingWorkspace = false,
  authError,
  onDraftOutreach,
}: LeadDetailModalProps) {
  if (!lead) return null;

  const [activeTab, setActiveTab] = useState<'overview' | 'outreach' | 'mockup' | 'workspace' | 'notes'>('overview');

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // AI Outreach state
  const [outreachData, setOutreachData] = useState<any>(null);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false);
  const [outreachAngle, setOutreachAngle] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // AI Mockup state (gemini-3-pro-image-preview with 1K, 2K, 4K)
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | '1:1'>('16:9');
  const [isGeneratingMockup, setIsGeneratingMockup] = useState(false);
  const [mockupResult, setMockupResult] = useState<string | null>(null);
  const [mockupError, setMockupError] = useState<string | null>(null);

  // Google Workspace state
  const [chatSpaces, setChatSpaces] = useState<any[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [chatNote, setChatNote] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatSuccessMessage, setChatSuccessMessage] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const [isCreatingForm, setIsCreatingForm] = useState(false);
  const [createdFormData, setCreatedFormData] = useState<{ editUrl: string; responderUri: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // CRM status & notes
  const [crmStatus, setCrmStatus] = useState<CrmStage>(lead.crmStatus);
  const [nextFollowUp, setNextFollowUp] = useState<string>(lead.nextFollowUpDate || '');
  const [noteInput, setNoteInput] = useState('');
  const [notesList, setNotesList] = useState<string[]>(lead.notes || []);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Re-verify website status
  const handleReVerify = async () => {
    setIsVerifying(true);
    setVerificationError(null);
    try {
      const res = await fetch('/api/leads/verify-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: lead.companyName,
          city: lead.city,
          websiteUrl: lead.websiteUrl || lead.verificationDetails?.candidateUrl,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Verification failed');

      const updatedLead: Lead = {
        ...lead,
        websiteStatus: data.result.websiteStatus,
        websiteUrl: data.result.websiteUrl || null,
        verificationDetails: {
          dnsChecked: data.result.dnsChecked,
          hasActiveDns: data.result.hasActiveDns,
          httpStatus: data.result.httpStatus,
          notes: data.result.notes,
          verifiedAt: data.result.verifiedAt,
          method: data.result.method,
          sourceUrl: data.result.sourceUrl,
          candidateUrl: data.result.candidateUrl,
        },
      };
      onUpdateLead(updatedLead);
    } catch (err: any) {
      setVerificationError(err.message || 'Verification probe encountered an error');
    } finally {
      setIsVerifying(false);
    }
  };

  // Generate AI Outreach
  const handleGenerateOutreach = async () => {
    setIsGeneratingOutreach(true);
    setOutreachError(null);
    setOutreachData(null);
    try {
      const res = await fetch('/api/ai/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead,
          customOffer: outreachAngle,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Outreach generation failed');
      setOutreachData(data.outreach);
    } catch (err: any) {
      console.error(err);
      setOutreachError(err.message || 'Outreach draft generation failed');
    } finally {
      setIsGeneratingOutreach(false);
    }
  };

  // Generate Mockup Image (gemini-3-pro-image-preview with 1K, 2K, 4K)
  const handleGenerateMockup = async () => {
    setIsGeneratingMockup(true);
    setMockupError(null);
    try {
      const res = await fetch('/api/ai/generate-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: lead.companyName,
          category: lead.category,
          city: lead.city,
          imageSize,
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Mockup generation failed');
      setMockupResult(data.imageUrl);
    } catch (err: any) {
      setMockupError(err.message || 'Image generation failed');
    } finally {
      setIsGeneratingMockup(false);
    }
  };

  // Fetch Google Chat Spaces if user is authenticated
  useEffect(() => {
    if (activeTab === 'workspace' && userToken) {
      fetch('/api/workspace/chat/spaces', {
        headers: { Authorization: `Bearer ${userToken}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.spaces) {
            setChatSpaces(d.spaces);
            if (d.spaces.length > 0) setSelectedSpace(d.spaces[0].name);
          }
        })
        .catch((err) => console.warn('Could not fetch spaces:', err));
    }
  }, [activeTab, userToken]);

  // Send Google Chat Card
  const handleSendChat = async () => {
    if (!userToken) {
      if (onRequestWorkspaceAccess) onRequestWorkspaceAccess();
      else if (onPromptLogin) onPromptLogin();
      return;
    }
    if (!selectedSpace) {
      setChatError('Please select a Google Chat space or room');
      return;
    }

    setIsSendingChat(true);
    setChatError(null);
    setChatSuccessMessage(null);

    try {
      const res = await fetch('/api/workspace/chat/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          spaceName: selectedSpace,
          lead,
          customNote: chatNote,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to post message to Google Chat');
      setChatSuccessMessage('Lead alert successfully posted to Google Chat!');
      setChatNote('');
    } catch (err: any) {
      setChatError(err.message || 'Google Chat delivery failed');
    } finally {
      setIsSendingChat(false);
    }
  };

  // Create Google Form Questionnaire
  const handleCreateGoogleForm = async () => {
    if (!userToken) {
      if (onRequestWorkspaceAccess) onRequestWorkspaceAccess();
      else if (onPromptLogin) onPromptLogin();
      return;
    }

    setIsCreatingForm(true);
    setFormError(null);
    try {
      const res = await fetch('/api/workspace/forms/create-intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          companyName: lead.companyName,
          category: lead.category,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create Google Form');
      setCreatedFormData({
        editUrl: data.editUrl,
        responderUri: data.responderUri,
      });
    } catch (err: any) {
      setFormError(err.message || 'Google Forms creation failed');
    } finally {
      setIsCreatingForm(false);
    }
  };

  // Save CRM changes
  const handleSaveCrmChanges = () => {
    let updatedNotes = [...notesList];
    if (noteInput.trim()) {
      const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      updatedNotes.unshift(`[${timestamp}] ${noteInput.trim()}`);
      setNoteInput('');
      setNotesList(updatedNotes);
    }

    const updatedLead: Lead = {
      ...lead,
      crmStatus,
      nextFollowUpDate: nextFollowUp || undefined,
      notes: updatedNotes,
      lastContactedAt: crmStatus !== 'discovered' ? new Date().toISOString() : lead.lastContactedAt,
    };
    onUpdateLead(updatedLead);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-xs animate-in fade-in duration-150 sm:p-4">
      <div className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900 sm:max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50 sm:px-6 sm:py-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{lead.companyName}</h2>
              <WebsiteStatusBadge status={lead.websiteStatus} />
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {lead.category} {lead.subCategory ? `• ${lead.subCategory}` : ''} • {lead.city}, {lead.state || lead.country}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onDraftOutreach && (
              <button
                onClick={() => onDraftOutreach(lead)}
                className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Outreach Generator</span>
                <span className="sm:hidden">Draft</span>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Clean, Simple Tab Navigation */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3 dark:border-gray-800 dark:bg-gray-900 sm:gap-2 sm:px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Company Profile</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('outreach');
              if (!outreachData) handleGenerateOutreach();
            }}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition ${
              activeTab === 'outreach'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <PhoneCall className="w-4 h-4" />
            <span>Call & Message Script</span>
          </button>
          <button
            onClick={() => setActiveTab('mockup')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition ${
              activeTab === 'mockup'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>AI Concept</span>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition ${
              activeTab === 'notes'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-bold'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Notes & Follow-up</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:space-y-6 sm:p-6">

          {/* TAB 1: OVERVIEW & VERIFICATION AUDIT */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Quick Contact & Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Direct Contact Details</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="font-semibold text-slate-900 dark:text-white">Phone:</span>
                    {lead.phoneNumber && !lead.phoneNumber.toLowerCase().includes('not listed') ? (
                      <a href={`tel:${lead.phoneNumber}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                        {lead.phoneNumber}
                      </a>
                    ) : (
                      <span className="text-slate-400">Not listed in public registry</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="font-semibold text-slate-900 dark:text-white">Email:</span>
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                        {lead.email}
                      </a>
                    ) : (
                      <span className="text-slate-400">No public email listed</span>
                    )}
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">Address:</span>{' '}
                      <span className="text-slate-700 dark:text-slate-300">{lead.fullAddress}</span>
                    </div>
                  </div>
                  <div className="pt-2 flex items-center gap-2 flex-wrap">
                    {lead.phoneNumber && (
                      <a
                        href={`tel:${lead.phoneNumber}`}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call Now
                      </a>
                    )}
                    {lead.phoneNumber && (
                      <a
                        href={`https://wa.me/${(lead.phoneNumber || '').replace(/\D/g, '').length === 10 ? '91' + (lead.phoneNumber || '').replace(/\D/g, '') : (lead.phoneNumber || '').replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Hello ${lead.companyName} team, I am reaching out to ask whether you are reviewing your company website or online catalog.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 transition inline-flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                    )}
                    {lead.fullAddress && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(lead.fullAddress || lead.companyName)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition inline-flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Directions
                      </a>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Business Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Rating</p>
                      <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 inline" />
                        <span>{lead.rating ?? 'Unknown'}</span>
                        {lead.reviewCount !== undefined && (
                          <span className="text-slate-400 font-normal">({lead.reviewCount} reviews)</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Est. Revenue Tier</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{lead.estimatedRevenueTier || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Staff Headcount</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{lead.employeeRange || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Experience</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{lead.yearsInBusiness || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Google business status</p>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {lead.businessStatus?.replace(/_/g, ' ').toLowerCase() || 'Not listed'}
                      </p>
                    </div>
                    {lead.businessTypes?.length ? (
                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">Listed business types</p>
                        <p className="font-semibold capitalize text-slate-900 dark:text-white">
                          {lead.businessTypes.join(', ')}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  {lead.description && (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-xs font-semibold text-slate-500">Google business summary</p>
                      <p className="mt-1 text-sm leading-5 text-slate-800 dark:text-slate-200">{lead.description}</p>
                      {lead.fieldSources?.description?.[0] && (
                        <a
                          href={lead.fieldSources.description[0]}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Source: Google Maps
                        </a>
                      )}
                    </div>
                  )}
                  {lead.openingHours?.length ? (
                    <details className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Regular opening hours (Google)
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        {lead.openingHours.map((hours) => <li key={hours}>{hours}</li>)}
                      </ul>
                      {lead.fieldSources?.openingHours?.[0] && (
                        <a
                          href={lead.fieldSources.openingHours[0]}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Source: Google Maps
                        </a>
                      )}
                    </details>
                  ) : null}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Revenue, staff size, and years in business are shown only when a source is available; they are not estimated.
                    {lead.dataUpdatedAt && ` Google Places data retrieved ${new Date(lead.dataUpdatedAt).toLocaleString()}.`}
                  </p>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs text-slate-500">CRM Stage:</span>
                    <CrmStageBadge stage={lead.crmStatus} />
                  </div>
                </div>
              </div>

              {/* Website Verification Certificate Card */}
              <div className="p-5 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-base">
                        Intelligent Website Presence Audit
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Verification status: <strong className="text-slate-900 dark:text-white">{lead.websiteStatus.replace(/_/g, ' ').toUpperCase()}</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleReVerify}
                    disabled={isVerifying}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-sm disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                    {isVerifying ? 'Probing...' : 'Re-Verify Web Presence'}
                  </button>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-200/60 dark:border-emerald-900 text-sm text-slate-700 dark:text-slate-300 space-y-1">
                  <p>
                    <strong>Audit Findings:</strong>{' '}
                    {lead.verificationDetails?.notes ||
                      'Website ownership has not been verified.'}
                  </p>
                  {lead.verificationDetails && (
                    <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                      <span className="flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-slate-400" />
                        <span>Probe: HTTP(S) request</span>
                      </span>
                      <span>DNS: Not independently checked</span>
                      {lead.verificationDetails.httpStatus && (
                        <span>HTTP Code: {lead.verificationDetails.httpStatus}</span>
                      )}
                      {lead.verificationDetails.verifiedAt && (
                        <span>Verified: {new Date(lead.verificationDetails.verifiedAt).toLocaleDateString()}</span>
                      )}
                      {lead.verificationDetails.sourceUrl && (
                        <a href={lead.verificationDetails.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                          Verification source
                        </a>
                      )}
                      {lead.websiteStatus === 'active_website' && lead.websiteUrl && (
                        <a href={lead.websiteUrl} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                          Open verified website
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {verificationError && (
                  <p className="mt-2 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {verificationError}
                  </p>
                )}
              </div>

              {/* Opportunity Pitch Synopsis */}
              <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60">
                <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Verification Summary
                </h4>
                <p className="mt-1 text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                  Company and website facts are shown only when supported by the listed sources. Unknown information is not estimated.
                </p>
              </div>

            </div>
          )}

          {/* TAB 2: OUTREACH & COLD CALL */}
          {activeTab === 'outreach' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Neutral Outreach Drafts</h3>
                  <p className="text-xs text-slate-500">Drafts use the supplied company name and optional offer, not unverified company details.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={outreachAngle}
                    onChange={(e) => setOutreachAngle(e.target.value)}
                    placeholder="Optional offer you can actually provide"
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-full sm:w-64"
                  />
                  <button
                    onClick={handleGenerateOutreach}
                    disabled={isGeneratingOutreach}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingOutreach ? 'animate-spin' : ''}`} />
                    {isGeneratingOutreach ? 'Writing...' : 'Regenerate'}
                  </button>
                </div>
              </div>

              {outreachError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{outreachError}</p>
              )}

              {isGeneratingOutreach ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-8 h-8 mx-auto border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Preparing neutral outreach drafts...
                  </p>
                </div>
              ) : outreachData ? (
                <div className="space-y-5">
                  
                  {/* Cold Call Script Section */}
                  <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          Personalized Cold-Call Script & Objection Rebuttals
                        </h4>
                      </div>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(outreachData.coldCallScript, null, 2), 'cold-script')}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {copiedField === 'cold-script' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedField === 'cold-script' ? 'Copied' : 'Copy Script'}
                      </button>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                        <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 block mb-1">Opener:</span>
                        <p className="text-slate-800 dark:text-slate-200 italic">"{outreachData.coldCallScript?.opener}"</p>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                        <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 block mb-1">Discussion Prompt:</span>
                        <p className="text-slate-800 dark:text-slate-200">"{outreachData.coldCallScript?.theHook}"</p>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                        <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400 block mb-1">Value Proposition:</span>
                        <p className="text-slate-800 dark:text-slate-200">"{outreachData.coldCallScript?.pitch}"</p>
                      </div>

                      {/* Objection Rebuttals */}
                      {outreachData.coldCallScript?.objectionRebuttals && (
                        <div className="space-y-2 pt-2">
                          <span className="text-xs font-bold uppercase text-slate-500 block">If They Decline:</span>
                          {outreachData.coldCallScript.objectionRebuttals.map((item: any, i: number) => (
                            <div key={i} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                              <p className="font-semibold text-rose-600 dark:text-rose-400">Objection: "{item.objection}"</p>
                              <p className="text-slate-700 dark:text-slate-300">Rebuttal: "{item.response}"</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                        <span className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300 block mb-1">Closing Question:</span>
                        <p className="text-emerald-900 dark:text-emerald-200 font-medium">"{outreachData.coldCallScript?.callToAction}"</p>
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp / SMS Pitch */}
                  <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">Direct WhatsApp / SMS Pitch</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(outreachData.whatsappMessage, 'wa-msg')}
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {copiedField === 'wa-msg' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedField === 'wa-msg' ? 'Copied' : 'Copy'}
                        </button>
                        {lead.phoneNumber && (
                          <a
                            href={`https://wa.me/${lead.phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(outreachData.whatsappMessage)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition"
                          >
                            Open in WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs font-mono whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                      {outreachData.whatsappMessage}
                    </div>
                  </div>

                  {/* Cold Email Pitch */}
                  <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">Cold Email Template</h4>
                      </div>
                      <button
                        onClick={() => copyToClipboard(outreachData.emailPitch?.body || '', 'email-body')}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {copiedField === 'email-body' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedField === 'email-body' ? 'Copied' : 'Copy Email Body'}
                      </button>
                    </div>

                    {outreachData.emailPitch?.subjectOptions && (
                      <div>
                        <span className="text-xs font-semibold text-slate-500 block mb-1">Subject Line Options:</span>
                        <div className="space-y-1">
                          {outreachData.emailPitch.subjectOptions.map((subj: string, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/60 text-xs">
                              <span className="text-slate-800 dark:text-slate-200">Option {idx + 1}: <strong>{subj}</strong></span>
                              <button
                                onClick={() => copyToClipboard(subj, `subj-${idx}`)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              >
                                {copiedField === `subj-${idx}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs whitespace-pre-wrap text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                      {outreachData.emailPitch?.body}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="py-8 text-center">
                  <button
                    onClick={handleGenerateOutreach}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate AI Outreach Script
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AI MOCKUP GENERATOR (Gemini 3 Pro Image Preview with 1K, 2K, 4K) */}
          {activeTab === 'mockup' && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Generate AI Website Concept
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Generate an illustrative design concept only. It is not the company's actual website and does not verify its products, services, or certifications.
                  </p>
                </div>

                {/* Resolution & Aspect Ratio Selectors (1K, 2K, 4K affordance) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Mockup Image Resolution:
                    </label>
                    <div className="flex gap-2">
                      {(['1K', '2K', '4K'] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => setImageSize(size)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition ${
                            imageSize === size
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {size} {size === '4K' ? '(Ultra HD)' : size === '2K' ? '(Crisp)' : '(Standard)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Aspect Ratio:
                    </label>
                    <div className="flex gap-2">
                      {(['16:9', '4:3', '1:1'] as const).map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() => setAspectRatio(ratio)}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition ${
                            aspectRatio === ratio
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleGenerateMockup}
                    disabled={isGeneratingMockup}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isGeneratingMockup ? 'animate-spin' : ''}`} />
                    {isGeneratingMockup ? `Rendering ${imageSize} concept...` : `Render ${imageSize} concept`}
                  </button>
                </div>

                {mockupError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {mockupError}
                  </p>
                )}
              </div>

              {/* Mockup Preview */}
              {isGeneratingMockup && (
                <div className="py-16 text-center space-y-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="w-10 h-10 mx-auto border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Generating customized {imageSize} website preview for {lead.companyName}...
                  </p>
                  <p className="text-xs text-slate-400">Rendering industrial UI header, capability tabs, and quote forms.</p>
                </div>
              )}

              {mockupResult && !isGeneratingMockup && (
                <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      AI-generated concept preview for {lead.companyName}
                    </span>
                    <a
                      href={mockupResult}
                      download={`${lead.companyName.toLowerCase().replace(/\s+/g, '_')}_mockup_${imageSize}.png`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Image
                    </a>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center max-h-[460px]">
                    <img
                      src={mockupResult}
                      alt={`Mockup for ${lead.companyName}`}
                      className="w-full h-auto object-contain max-h-[460px]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: GOOGLE WORKSPACE (CHAT & FORMS) */}
          {activeTab === 'workspace' && (
            <div className="space-y-6">
              
              {!userToken && (
                <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex items-center justify-between">
                  <div className="text-xs space-y-0.5">
                  <p className="font-bold">Google Workspace permission required</p>
                  <p>Grant Chat and Forms access only if you want to use these integrations.</p>
                  {authError && <p role="alert" className="text-rose-700 dark:text-rose-300">{authError}</p>}
                </div>
                {onRequestWorkspaceAccess && (
                  <button
                    onClick={onRequestWorkspaceAccess}
                    disabled={isAuthorizingWorkspace}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm disabled:opacity-60"
                  >
                    {isAuthorizingWorkspace ? 'Connecting…' : 'Grant Workspace access'}
                  </button>
                )}
                </div>
              )}

              {/* Google Chat Space Broadcast Card */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Post Lead to Google Chat Space</h4>
                    <p className="text-xs text-slate-500">Send an interactive B2B prospect alert card directly to your agency's Chat room</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Target Google Chat Space:
                    </label>
                    {chatSpaces.length > 0 ? (
                      <select
                        value={selectedSpace}
                        onChange={(e) => setSelectedSpace(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        {chatSpaces.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.displayName || s.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={selectedSpace}
                        onChange={(e) => setSelectedSpace(e.target.value)}
                        placeholder="spaces/XXXXXXXX (or enter Space ID)"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Custom Note / Assignment (optional):
                    </label>
                    <input
                      type="text"
                      value={chatNote}
                      onChange={(e) => setChatNote(e.target.value)}
                      placeholder="e.g., Assigned to Mike for cold outreach call today"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSendChat}
                      disabled={isSendingChat}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isSendingChat ? 'Sending to Space...' : 'Post Alert to Google Chat'}
                    </button>
                  </div>

                  {chatSuccessMessage && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      {chatSuccessMessage}
                    </p>
                  )}
                  {chatError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {chatError}
                    </p>
                  )}
                </div>
              </div>

              {/* Google Forms Lead Intake Form Generator */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Create Google Form Intake Questionnaire</h4>
                    <p className="text-xs text-slate-500">Auto-generate a client onboarding & RFQ questionnaire in your Google Forms</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Generates an online intake form titled <em>"{lead.companyName} - Web Capability & RFQ Portal Questionnaire"</em> with questions tailored to {lead.category} products, target buyers, and preferred domain names.
                </p>

                <div className="flex justify-end">
                  <button
                    onClick={handleCreateGoogleForm}
                    disabled={isCreatingForm}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {isCreatingForm ? 'Generating Form in Google Workspace...' : 'Create Form in Google Forms'}
                  </button>
                </div>

                {createdFormData && (
                  <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs space-y-2">
                    <p className="font-semibold text-purple-900 dark:text-purple-200">
                      ✓ Google Form successfully generated!
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={createdFormData.editUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300 font-bold hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Edit Form in Google Forms
                      </a>
                      <a
                        href={createdFormData.responderUri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-300 font-bold hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Client Respondent Form Link
                      </a>
                    </div>
                  </div>
                )}

                {formError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {formError}
                  </p>
                )}
              </div>

            </div>
          )}

          {/* TAB 5: CRM PIPELINE & NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Pipeline Stage & Follow-Up</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Lead Pipeline Stage:
                    </label>
                    <select
                      value={crmStatus}
                      onChange={(e) => setCrmStatus(e.target.value as CrmStage)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                    >
                      <option value="discovered">Discovered (New)</option>
                      <option value="saved">Saved Prospect</option>
                      <option value="contacted">Contacted (Called / Messaged)</option>
                      <option value="interested">Interested / Meeting Scheduled</option>
                      <option value="follow_up">Follow-Up Due</option>
                      <option value="converted">Converted (Deal Won 🎉)</option>
                      <option value="unqualified">Archived / Disqualified</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Next Follow-Up Date:
                    </label>
                    <input
                      type="date"
                      value={nextFollowUp}
                      onChange={(e) => setNextFollowUp(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Add Activity Note / Call Log:
                  </label>
                  <textarea
                    rows={3}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Log call conversation, gatekeeper notes, customer objections, or budget discussion..."
                    className="w-full text-xs p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveCrmChanges}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm inline-flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Pipeline Changes
                  </button>
                </div>
              </div>

              {/* Notes History */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Activity History & Notes</h5>
                {notesList.length > 0 ? (
                  <div className="space-y-2">
                    {notesList.map((note, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200">
                        {note}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No notes logged yet.</p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60 sm:px-6">
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {lead.fieldSources?.companyName?.length ? 'Company name sources:' : 'Company name source: Not verified'}
            </span>
            {lead.fieldSources?.companyName?.map((sourceUrl, index) => (
              <a key={`${sourceUrl}-${index}`} href={sourceUrl} target="_blank" rel="noreferrer" className="ml-2 text-indigo-600 dark:text-indigo-400 hover:underline">
                Source {index + 1}
              </a>
            ))}
            {!lead.fieldSources?.companyName?.length && lead.source && (
              <span className="ml-2 text-slate-500">{lead.source}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
