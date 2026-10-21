import React, { useState } from 'react';
import type { Lead, CrmStage } from '../utils/leadScoring.ts';
import { WebsiteStatusBadge, LeadScoreBadge } from './StatusBadge.tsx';
import {
  Kanban,
  Table as TableIcon,
  Phone,
  Sparkles,
  Search,
  Download,
  Calendar,
  Plus,
  ArrowRight,
  CheckCircle2,
  Trash2,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { exportLeadsToCsv } from '../utils/export.ts';

const PIPELINE_COLUMNS: { stage: CrmStage; label: string; headerColor: string }[] = [
  { stage: 'discovered', label: 'Discovered', headerColor: 'border-slate-400 text-slate-700 dark:text-slate-300' },
  { stage: 'saved', label: 'Saved Prospect', headerColor: 'border-indigo-500 text-indigo-700 dark:text-indigo-400' },
  { stage: 'contacted', label: 'Contacted', headerColor: 'border-cyan-500 text-cyan-700 dark:text-cyan-400' },
  { stage: 'interested', label: 'Interested', headerColor: 'border-violet-500 text-violet-700 dark:text-violet-400' },
  { stage: 'follow_up', label: 'Follow-Up Due', headerColor: 'border-amber-500 text-amber-700 dark:text-amber-400' },
  { stage: 'converted', label: 'Converted 🎉', headerColor: 'border-emerald-500 text-emerald-700 dark:text-emerald-400' },
];

const NEXT_STAGE_MAP: Record<CrmStage, CrmStage | null> = {
  discovered: 'saved',
  saved: 'contacted',
  contacted: 'interested',
  interested: 'converted',
  follow_up: 'interested',
  converted: null,
  unqualified: null,
};

interface CrmPipelineViewProps {
  leads: Lead[];
  onUpdateLead: (lead: Lead) => void;
  onDeleteLead: (id: string) => void;
  onSelectLead: (lead: Lead) => void;
  onAddNewLead: (newLead: Lead) => void;
}

export function CrmPipelineView({
  leads,
  onUpdateLead,
  onDeleteLead,
  onSelectLead,
  onAddNewLead,
}: CrmPipelineViewProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Lead form state
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCategory, setNewCategory] = useState('Precision Machining & CNC');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');

  const filteredLeads = leads.filter((l) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      l.companyName.toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q) ||
      l.city.toLowerCase().includes(q) ||
      (l.phoneNumber && l.phoneNumber.includes(q))
    );
  });

  const handleAdvanceStage = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    const next = NEXT_STAGE_MAP[lead.crmStatus];
    if (next) {
      onUpdateLead({
        ...lead,
        crmStatus: next,
        lastContactedAt: next === 'contacted' ? new Date().toISOString() : lead.lastContactedAt,
      });
    }
  };

  const handleCreateCustomLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    const id = `lead-custom-${Date.now()}`;
    const lead: Lead = {
      id,
      companyName: newCompanyName.trim(),
      category: newCategory,
      phoneNumber: newPhone.trim() || undefined,
      fullAddress: newAddress.trim() || 'Unknown',
      city: newCity.trim() || 'Unknown',
      country: 'Unknown',
      websiteStatus: 'could_not_verify',
      verificationDetails: {
        dnsChecked: false,
        hasActiveDns: false,
        notes: 'Manual CRM entry; company and website details have not been verified.',
        verifiedAt: '',
        method: 'manual',
      },
      crmStatus: 'saved',
      tags: ['Manual Prospect', newCategory],
      createdAt: new Date().toISOString(),
      source: 'Manual Add',
    };

    onAddNewLead(lead);
    setShowAddModal(false);
    setNewCompanyName('');
    setNewPhone('');
    setNewAddress('');
    setNewCity('');
  };

  return (
    <div className="space-y-6">
      
      {/* CRM Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Kanban className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            CRM Prospect Pipeline
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track outreach progress from initial discovery through cold calls and closed web development deals
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search CRM..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Prospect
          </button>

          <button
            onClick={() => exportLeadsToCsv(leads, 'crm_pipeline_export.csv')}
            aria-label="Export CRM to CSV"
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
        {PIPELINE_COLUMNS.map((col) => {
          const colLeads = filteredLeads.filter((l) => l.crmStatus === col.stage);
          return (
            <div
              key={col.stage}
              className="flex flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-2 border-b-2 border-slate-200 dark:border-slate-800">
                <span className={`text-xs font-bold uppercase tracking-wider ${col.headerColor}`}>
                  {col.label}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {colLeads.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {colLeads.map((lead) => {
                  const nextStage = NEXT_STAGE_MAP[lead.crmStatus];
                  return (
                    <div
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      className="p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xs hover:shadow-md hover:border-indigo-400 transition cursor-pointer space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight line-clamp-2">
                          {lead.companyName}
                        </h4>
                        <LeadScoreBadge score={lead.leadScore} />
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <p className="truncate font-medium text-slate-700 dark:text-slate-300">{lead.category}</p>
                        <p className="truncate">{lead.city}, {lead.state || lead.country}</p>
                        {lead.phoneNumber && (
                          <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-indigo-500" />
                            {lead.phoneNumber}
                          </p>
                        )}
                      </div>

                      <div className="pt-1">
                        <WebsiteStatusBadge status={lead.websiteStatus} />
                      </div>

                      {lead.nextFollowUpDate && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                          <Calendar className="w-3 h-3" />
                          Due: {lead.nextFollowUpDate}
                        </div>
                      )}

                      {/* Action buttons inside card */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectLead(lead);
                          }}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          Pitch Script
                        </button>

                        {nextStage && (
                          <button
                            onClick={(e) => handleAdvanceStage(e, lead)}
                            title={`Advance to ${nextStage}`}
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {colLeads.length === 0 && (
                  <div className="py-8 text-center text-slate-400 dark:text-slate-600 text-xs italic">
                    No leads in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Custom Prospect Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Add Custom Lead / Prospect</h3>
            <form onSubmit={handleCreateCustomLead} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Company name"
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="Precision Machining & CNC">Precision Machining & CNC</option>
                  <option value="Textiles & Garment Manufacturing">Textiles & Garment Manufacturing</option>
                  <option value="Metal Fabrication & Welding">Metal Fabrication & Welding</option>
                  <option value="Industrial Equipment & Valves">Industrial Equipment & Valves</option>
                  <option value="Packaging & Corrugated Boxes">Packaging & Corrugated Boxes</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Direct Phone</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Phone number (optional)"
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">City</label>
                  <input
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="City or region"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Full Address</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="Street address (optional)"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
