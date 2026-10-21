import {
  Boxes,
  Building2,
  Cog,
  Factory,
  BriefcaseBusiness,
  Store,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ProfileAvatarOption {
  id: string;
  label: string;
  icon: LucideIcon;
  className: string;
}

export const PROFILE_AVATARS: ProfileAvatarOption[] = [
  {
    id: 'factory',
    label: 'Factory',
    icon: Factory,
    className: 'from-fuchsia-500 to-indigo-600',
  },
  {
    id: 'building',
    label: 'Business building',
    icon: Building2,
    className: 'from-indigo-500 to-cyan-500',
  },
  {
    id: 'briefcase',
    label: 'Briefcase',
    icon: BriefcaseBusiness,
    className: 'from-violet-500 to-fuchsia-500',
  },
  {
    id: 'cog',
    label: 'Engineering',
    icon: Cog,
    className: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'store',
    label: 'Storefront',
    icon: Store,
    className: 'from-fuchsia-500 to-cyan-500',
  },
  {
    id: 'boxes',
    label: 'Supply and logistics',
    icon: Boxes,
    className: 'from-indigo-500 to-violet-600',
  },
];

export const DEFAULT_PROFILE_AVATAR_ID = 'factory';

export function getStoredProfileAvatar(uid: string): string {
  try {
    const selected = localStorage.getItem(`leadpebble_profile_avatar:${uid}`);
    return PROFILE_AVATARS.some((avatar) => avatar.id === selected)
      ? selected!
      : DEFAULT_PROFILE_AVATAR_ID;
  } catch {
    return DEFAULT_PROFILE_AVATAR_ID;
  }
}

export function storeProfileAvatar(uid: string, avatarId: string): void {
  if (!PROFILE_AVATARS.some((avatar) => avatar.id === avatarId)) {
    throw new Error('Choose a valid business avatar.');
  }
  localStorage.setItem(`leadpebble_profile_avatar:${uid}`, avatarId);
}
