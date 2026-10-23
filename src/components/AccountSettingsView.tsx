import { useEffect, useState } from 'react';
import type { LocalUser } from '../types/localUser.ts';
import { Check, CircleHelp, Save, UserRound } from 'lucide-react';
import { ProfileAvatar } from './ProfileAvatar.tsx';
import { PROFILE_AVATARS } from '../utils/profileAvatars.ts';

interface AccountSettingsViewProps {
  user: LocalUser;
  avatarId: string;
  onUpdateName: (name: string) => Promise<void>;
  onSelectAvatar: (avatarId: string) => void;
  onShowTutorial: () => void;
}

export function AccountSettingsView({
  user,
  avatarId,
  onUpdateName,
  onSelectAvatar,
  onShowTutorial,
}: AccountSettingsViewProps) {
  const [nameDraft, setNameDraft] = useState(user.displayName || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    setNameDraft(user.displayName || '');
  }, [user.displayName]);

  const saveName = async () => {
    setNameError(null);
    setNameSaved(false);
    setIsSavingName(true);
    try {
      await onUpdateName(nameDraft);
      setNameSaved(true);
    } catch (reason) {
      setNameError(reason instanceof Error ? reason.message : 'Could not update your name.');
    } finally {
      setIsSavingName(false);
    }
  };

  const details = [
    { label: 'Workspace', value: 'This browser', icon: UserRound },
    { label: 'Saved companies', value: 'Stored only in this browser', icon: Save },
  ];

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Personal workspace
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Account settings</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Update your local profile and choose a business-themed avatar. No account or sign-in is required.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4 border-b border-slate-100 p-6 dark:border-slate-800">
          <ProfileAvatar avatarId={avatarId} name={user.displayName} sizeClassName="h-14 w-14" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-900 dark:text-white">
              {user.displayName || 'My workspace'}
            </p>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">LeadPebble local profile</p>
          </div>
        </div>

        <div className="space-y-5 border-b border-slate-100 p-6 dark:border-slate-800">
          <div>
            <label htmlFor="account-display-name" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">
              Display name
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="account-display-name"
                value={nameDraft}
                onChange={(event) => {
                  setNameDraft(event.target.value);
                  setNameSaved(false);
                }}
                maxLength={80}
                autoComplete="name"
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <button
                type="button"
                onClick={() => void saveName()}
                disabled={isSavingName || !nameDraft.trim() || nameDraft.trim() === (user.displayName || '')}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {nameSaved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {isSavingName ? 'Saving…' : nameSaved ? 'Saved' : 'Save name'}
              </button>
            </div>
            {(nameError || nameSaved) && (
              <p role={nameError ? 'alert' : 'status'} className={`mt-2 text-xs ${nameError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {nameError || 'Your display name has been updated.'}
              </p>
            )}
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Business avatar</legend>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {PROFILE_AVATARS.map((avatar) => {
                const selected = avatarId === avatar.id;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => onSelectAvatar(avatar.id)}
                    aria-label={`Choose ${avatar.label} avatar`}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20 dark:bg-indigo-950/40'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                    }`}
                  >
                    <ProfileAvatar avatarId={avatar.id} sizeClassName="h-11 w-11" />
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{avatar.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <dl className="divide-y divide-slate-100 dark:divide-slate-800">
          {details.map(({ label, value, icon: Icon }) => (
            <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 py-4">
              <dt className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Icon className="h-4 w-4" />
                {label}
              </dt>
              <dd className="max-w-[60%] truncate text-right text-sm font-medium text-slate-800 dark:text-slate-200">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="border-t border-slate-100 p-6 dark:border-slate-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                <CircleHelp className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Need a quick refresher?</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Replay the guided tour of company search, locations, categories, and results.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onShowTutorial}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
            >
              <CircleHelp className="h-4 w-4" />
              Show app tour
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 p-6 dark:border-slate-800">
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
            Companies and profile preferences stay on this device and browser. They are not synced to other devices.
          </p>
        </div>
      </div>
    </section>
  );
}
