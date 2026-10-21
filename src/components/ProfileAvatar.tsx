import { PROFILE_AVATARS, DEFAULT_PROFILE_AVATAR_ID } from '../utils/profileAvatars.ts';

interface ProfileAvatarProps {
  avatarId?: string;
  name?: string | null;
  sizeClassName?: string;
}

export function ProfileAvatar({
  avatarId = DEFAULT_PROFILE_AVATAR_ID,
  name,
  sizeClassName = 'h-12 w-12',
}: ProfileAvatarProps) {
  const avatar = PROFILE_AVATARS.find((option) => option.id === avatarId) || PROFILE_AVATARS[0];
  const Icon = avatar.icon;

  return (
    <span
      role="img"
      aria-label={`${name ? `${name}'s ` : ''}${avatar.label} avatar`}
      className={`${sizeClassName} inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatar.className} text-white shadow-md shadow-indigo-950/15 ring-2 ring-white dark:ring-slate-900`}
    >
      <Icon className="h-1/2 w-1/2" strokeWidth={1.8} />
    </span>
  );
}
