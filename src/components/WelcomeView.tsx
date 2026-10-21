import { useEffect, useState } from 'react';
import type { GeoCoordinates } from '../services/geolocation.ts';
import { PebbleLoader } from './PebbleLoader.tsx';
import { MapPin, ShieldCheck } from 'lucide-react';

interface WelcomeViewProps {
  displayName: string;
  locationName: string;
  isLocating: boolean;
  error: string | null;
  onUseDeviceLocation: () => Promise<void>;
  onContinueWithCurrentLocation: () => void;
  onContinueWithPreset: (coordinates: GeoCoordinates, location: string) => void;
  onFinishEntering: () => void;
  defaultCoordinates: GeoCoordinates;
}

export function WelcomeView({
  displayName,
  locationName,
  isLocating,
  error,
  onUseDeviceLocation,
  onContinueWithCurrentLocation,
  onContinueWithPreset,
  onFinishEntering,
  defaultCoordinates,
}: WelcomeViewProps) {
  const [isEntering, setIsEntering] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEntering) return;
    const timer = window.setTimeout(onFinishEntering, 1800);
    return () => window.clearTimeout(timer);
  }, [isEntering, onFinishEntering]);

  if (isEntering) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="welcome-pebble-orbit absolute left-[calc(50%-10rem)] top-[calc(50%-10rem)] h-80 w-80 rounded-full border border-fuchsia-400/15" />
          <span className="welcome-pebble-orbit welcome-pebble-orbit-slow absolute left-[calc(50%-13rem)] top-[calc(50%-13rem)] h-[26rem] w-[26rem] rounded-full border border-cyan-300/10" />
        </div>
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] px-10 py-12 backdrop-blur-sm">
          <PebbleLoader
            message={`Getting ${locationName} ready`}
            detail="Finding real businesses around your selected location."
          />
        </div>
      </main>
    );
  }

  const enterWorkspace = async (action: () => Promise<void> | void) => {
    setActionError(null);
    try {
      await action();
      setIsEntering(true);
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : 'Could not get your location. You can continue with the selected location instead.'
      );
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f8fc] px-5 py-10 dark:bg-slate-950">
      <div aria-hidden="true" className="welcome-color-wash pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-fuchsia-300/25 blur-3xl" />
      <div aria-hidden="true" className="welcome-color-wash welcome-color-wash-delay pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-cyan-300/25 blur-3xl" />

      <section className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-indigo-950/10 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative overflow-hidden bg-slate-950 px-7 py-9 text-white sm:px-12 sm:py-12">
          <div aria-hidden="true" className="welcome-pebble-halo absolute -right-20 -top-36 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl" />
          <div className="relative flex flex-col items-center text-center">
            <div className="welcome-logo-stage relative mb-7 flex h-36 w-36 items-center justify-center">
              <span className="welcome-pebble-orbit absolute inset-1 rounded-full border border-fuchsia-300/30" />
              <span className="welcome-pebble-orbit welcome-pebble-orbit-slow absolute inset-[-10px] rounded-full border border-cyan-300/20" />
              <span className="welcome-pebble-spark absolute left-4 top-7 h-2 w-2 rounded-full bg-fuchsia-300" />
              <span className="welcome-pebble-spark welcome-pebble-spark-delay absolute bottom-5 right-4 h-2.5 w-2.5 rounded-full bg-cyan-300" />
              <img src="/leadpebble-logo.png" alt="LeadPebble" className="welcome-logo relative z-10 h-28 w-28 object-contain" />
            </div>
            <p className="text-sm font-medium text-cyan-200">Welcome{displayName ? `, ${displayName}` : ''}</p>
            <h1 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Let’s find businesses near you.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">
              Allow location access to search nearby companies. Your precise location is used to find and sort local results.
            </p>
          </div>
        </div>

        <div className="space-y-5 p-6 sm:p-9">
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <span className="mt-0.5 rounded-lg bg-white p-2 text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
              <MapPin className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Your location stays in your control</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                You can deny access and continue with the current selected location. You can change this choice later.
              </p>
            </div>
            <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
          </div>

          {(actionError || error) && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {actionError || error}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={isLocating}
              onClick={() => void enterWorkspace(onUseDeviceLocation)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
            >
              <MapPin className="h-4 w-4" />
              {isLocating ? 'Finding your location…' : 'Allow location & continue'}
            </button>
            <button
              type="button"
              disabled={isLocating}
              onClick={() => void enterWorkspace(onContinueWithCurrentLocation)}
              className="min-h-12 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Continue with {locationName.split(',')[0]}
            </button>
          </div>

          {locationName !== 'Coimbatore, Tamil Nadu, India' && (
            <button
              type="button"
              disabled={isLocating}
              onClick={() => void enterWorkspace(() => onContinueWithPreset(defaultCoordinates, 'Coimbatore, Tamil Nadu, India'))}
              className="w-full text-center text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
            >
              Use Coimbatore instead
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
