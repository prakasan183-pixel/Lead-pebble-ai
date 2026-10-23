import React, { useState, useEffect } from 'react';
import type { Lead } from '../utils/leadScoring.ts';
import { apiFetch } from '../services/api.ts';
import {
  Send,
  FileText,
  ShieldCheck,
  ExternalLink,
  Check,
  AlertTriangle,
  Building2,
  Sparkles,
  Users,
} from 'lucide-react';

interface GoogleWorkspaceHubProps {
  userToken: string | null;
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
}

export function GoogleWorkspaceHub({
  userToken,
  leads,
  onSelectLead,
}: GoogleWorkspaceHubProps) {
  const [spaces, setSpaces] = useState<any[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || '');
  const [customNote, setCustomNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Forms State
  const [formCategory, setFormCategory] = useState('Precision Machining & CNC');
  const [formCompanyName, setFormCompanyName] = useState('Apex Industrial Manufacturing');
  const [isCreatingForm, setIsCreatingForm] = useState(false);
  const [createdForm, setCreatedForm] = useState<{ editUrl: string; responderUri: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (userToken) {
      apiFetch('/api/workspace/chat/spaces', {
        headers: { Authorization: `Bearer ${userToken}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.spaces) {
            setSpaces(d.spaces);
            if (d.spaces.length > 0) setSelectedSpace(d.spaces[0].name);
          }
        })
        .catch((err) => console.warn('Could not load chat spaces:', err));
    }
  }, [userToken]);

  const handleSendChatAlert = async () => {
    if (!userToken) {
      setSendError('Google Chat requires a separate Google OAuth connection. Company discovery does not.');
      return;
    }

    const targetLead = leads.find((l) => l.id === selectedLeadId) || leads[0];
    if (!targetLead) {
      setSendError('Please select a lead');
      return;
    }

    if (!selectedSpace) {
      setSendError('Please select a Google Chat space or room');
      return;
    }

    setIsSending(true);
    setSendError(null);
    setSendSuccess(null);

    try {
      const res = await apiFetch('/api/workspace/chat/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          spaceName: selectedSpace,
          lead: targetLead,
          customNote,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to dispatch alert to Google Chat');

      setSendSuccess(`Lead alert for ${targetLead.companyName} dispatched to Google Chat!`);
      setCustomNote('');
    } catch (err: any) {
      setSendError(err.message || 'Chat transmission failed');
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateForm = async () => {
    if (!userToken) {
      setFormError('Google Forms requires a separate Google OAuth connection. Company discovery does not.');
      return;
    }

    if (!formCompanyName.trim()) {
      setFormError('Please enter a target enterprise name');
      return;
    }

    setIsCreatingForm(true);
    setFormError(null);
    try {
      const res = await apiFetch('/api/workspace/forms/create-intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          companyName: formCompanyName.trim(),
          category: formCategory,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to generate Google Form');

      setCreatedForm({
        editUrl: data.editUrl,
        responderUri: data.responderUri,
      });
    } catch (err: any) {
      setFormError(err.message || 'Google Forms API error');
    } finally {
      setIsCreatingForm(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Google Workspace Team Hub
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Integrate directly with Google Chat for agency notifications and Google Forms for prospective client discovery questionnaires
            </p>
          </div>
        </div>

        {!userToken && (
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
            Google Chat and Forms are optional and require a separate Google OAuth connection. Company discovery, saved leads, and CRM do not require sign-in.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Feature 1: Google Chat Dispatcher */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Google Chat Lead Dispatcher</h3>
              <p className="text-xs text-slate-500">Post card-style lead alerts into team channels</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Select Lead to Broadcast:
              </label>
              <select
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.companyName} ({l.category}) - Score {l.leadScore ?? 'Not verified'} - {l.websiteStatus}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Google Chat Space Name:
              </label>
              {spaces.length > 0 ? (
                <select
                  value={selectedSpace}
                  onChange={(e) => setSelectedSpace(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {spaces.map((s) => (
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
                  placeholder="spaces/XXXXXXXX (or space resource ID)"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              )}
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Internal Rep Note:
              </label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="e.g., Assigned to outbound sales for immediate call"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={handleSendChatAlert}
                disabled={isSending}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSending ? 'Sending Card to Google Chat...' : 'Broadcast Lead to Chat Space'}
              </button>
            </div>

            {sendSuccess && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {sendSuccess}
              </p>
            )}
            {sendError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {sendError}
              </p>
            )}
          </div>
        </div>

        {/* Feature 2: Google Forms Intake Generator */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Google Forms Client Intake Builder</h3>
              <p className="text-xs text-slate-500">Auto-create branded onboarding questionnaires</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Prospect Company Name:
              </label>
              <input
                type="text"
                value={formCompanyName}
                onChange={(e) => setFormCompanyName(e.target.value)}
                placeholder="e.g. Continental Precision Castings"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Industry Segment:
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="Precision Machining & CNC">Precision Machining & CNC</option>
                <option value="Textiles & Garment Manufacturing">Textiles & Garment Manufacturing</option>
                <option value="Metal Fabrication & Welding">Metal Fabrication & Welding</option>
                <option value="Industrial Equipment & Valves">Industrial Equipment & Valves</option>
                <option value="Packaging & Corrugated Boxes">Packaging & Corrugated Boxes</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/60 text-slate-700 dark:text-slate-300 space-y-1">
              <p className="font-semibold text-purple-900 dark:text-purple-200">Automatically Included Form Questions:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                <li>Machine list and capability specs for online catalog</li>
                <li>Target buyer persona checkboxes (OEMs, defense, Tier-1)</li>
                <li>Preferred web domain name selection</li>
              </ul>
            </div>

            <div className="pt-2">
              <button
                onClick={handleCreateForm}
                disabled={isCreatingForm}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                {isCreatingForm ? 'Creating Google Form in Workspace...' : 'Generate Questionnaire in Google Forms'}
              </button>
            </div>

            {createdForm && (
              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-2">
                <p className="font-bold text-purple-900 dark:text-purple-200">
                  ✓ Form successfully created in your Google Workspace!
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={createdForm.editUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-purple-700 dark:text-purple-300 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Form Editor
                  </a>
                  <a
                    href={createdForm.responderUri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-indigo-700 dark:text-indigo-300 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Client Survey Link
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

      </div>

    </div>
  );
}
