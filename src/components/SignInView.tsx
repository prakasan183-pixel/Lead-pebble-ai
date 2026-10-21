import type { User } from 'firebase/auth';
import { ArrowRight, Building2, ShieldCheck } from 'lucide-react';
import { PebbleLoader } from './PebbleLoader.tsx';

interface SignInViewProps {
  isLoading: boolean;
  isSigningIn: boolean;
  error: string | null;
  user?: User | null;
  onSignIn: () => void;
}

export function SignInView({ isLoading, isSigningIn, error, user, onSignIn }: SignInViewProps) {
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
        <PebbleLoader message="Checking your account" detail="Connecting securely to LeadPebble" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f8fc] px-5 py-12 dark:bg-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute -left-28 -top-32 h-96 w-96 rounded-full bg-fuchsia-300/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative flex min-h-72 flex-col justify-between overflow-hidden bg-slate-950 p-8 text-white sm:p-12 lg:min-h-[580px]">
          <div aria-hidden="true" className="absolute -right-24 top-12 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <img src="/leadpebble-logo.png" alt="" className="h-10 w-10 object-contain pebble-loader-float" />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight">LeadPebble</p>
              <p className="text-xs text-slate-300">Industrial company discovery</p>
            </div>
          </div>

          <div className="relative my-12 max-w-md space-y-5 lg:my-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200">
              <Building2 className="h-3.5 w-3.5 text-cyan-300" />
              Your workspace, all in one place
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Find the right businesses. Build better connections.
            </h1>
            <p className="max-w-sm text-sm leading-6 text-slate-300">
              Sign in to access your company directory, saved leads, and outreach workspace.
            </p>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Your Google account controls access to this workspace.
          </div>
        </div>

        <div className="flex items-center justify-center p-7 sm:p-12">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">WELCOME TO LEADPEBBLE</p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {user ? 'Account access needed' : 'Sign in to continue'}
              </h2>
              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Use your Google account to securely open your workspace.
              </p>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={onSignIn}
              disabled={isSigningIn}
              className="group flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              {isSigningIn ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-slate-400 dark:border-t-slate-900" />
                  Connecting to Google…
                </>
              ) : (
                <>
                  <span aria-hidden="true" className="text-lg font-bold text-blue-500">G</span>
                  Continue with Google
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            <p className="text-center text-xs leading-5 text-slate-400">
              Google Chat and Forms permissions are optional and requested only when you choose to use those features.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
