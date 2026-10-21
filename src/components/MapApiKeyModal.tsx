import React, { useState } from 'react';
import { Key, CheckCircle, AlertTriangle, X, RefreshCw, ExternalLink } from 'lucide-react';
import { getStoredMapsApiKey, setStoredMapsApiKey, normalizeGoogleMapsApiKey } from '../utils/mapsKey.ts';
import { apiFetch } from '../services/api.ts';

interface MapApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdated: () => void;
}

export function MapApiKeyModal({ isOpen, onClose, onKeyUpdated }: MapApiKeyModalProps) {
  const currentKey = getStoredMapsApiKey();
  const [apiKeyInput, setApiKeyInput] = useState(currentKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    valid: boolean;
    message: string;
    isBillingIssue?: boolean;
    isInvalidKey?: boolean;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    const cleaned = normalizeGoogleMapsApiKey(apiKeyInput);
    if (!cleaned) {
      setTestResult({
        tested: true,
        valid: false,
        message: 'Please enter a valid Google Maps API Key.',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await apiFetch(`/api/location/test-maps-key?key=${encodeURIComponent(cleaned)}`);
      const data = await res.json();

      setTestResult({
        tested: true,
        valid: Boolean(data.valid),
        message: data.message || (data.valid ? 'Key is valid and active!' : data.errorMessage),
        isBillingIssue: data.isBillingIssue,
        isInvalidKey: data.isInvalidKey,
      });
    } catch (err: any) {
      setTestResult({
        tested: true,
        valid: false,
        message: 'Could not connect to test server: ' + err.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const cleaned = normalizeGoogleMapsApiKey(apiKeyInput);
    setStoredMapsApiKey(cleaned);
    onKeyUpdated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Google Maps API Configuration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure your Google Cloud API key for Maps & Geocoding
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Google Maps JavaScript API Key
            </label>
            <div className="relative">
              <input
                type="text"
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  setTestResult(null);
                }}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Note: Key format always starts with <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400">AIzaSy</code> (capital 'I', not lowercase 'l'). Typos are automatically auto-corrected.
            </p>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                testResult.valid
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
              }`}
            >
              {testResult.valid ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">{testResult.message}</p>
                {testResult.isBillingIssue && (
                  <p className="text-[11px] opacity-90">
                    Google Maps Platform requires an active Google Cloud Billing account linked to your project. You can link billing in Google Cloud Console.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Setup tips */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1.5 text-slate-600 dark:text-slate-400 text-[11px]">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              Quick Setup Checklist:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Enable "Maps JavaScript API" & "Geocoding API" in your Google Cloud project.</li>
              <li>Ensure Billing is enabled on the Google Cloud project.</li>
              <li>Or simply use the integrated Leaflet live map fallback with zero keys required!</li>
            </ul>
            <div className="pt-1">
              <a
                href="https://console.cloud.google.com/google/maps-apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 font-semibold"
              >
                Google Cloud Console Credentials <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleTestKey}
            disabled={isTesting}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Testing Key...' : 'Test Key'}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold shadow-md transition"
          >
            Save & Apply Key
          </button>
        </div>

      </div>
    </div>
  );
}
