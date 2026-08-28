import { useState } from 'react';
import classes from './UserAvatar.module.scss';

interface AvatarUser {
  avatarVersion: string | null;
  displayName: string;
  id: string;
}

interface Props {
  className?: string;
  size?: 'large' | 'medium' | 'small';
  user: AvatarUser;
}

export function UserAvatar(props: Props) {
  const { className, size = 'medium', user } = props;
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const avatarUrl = getAvatarUrl(user);
  const shouldShowImage = avatarUrl !== null && avatarUrl !== failedAvatarUrl;

  return (
    <span
      aria-label={`Аватар пользователя ${user.displayName}`}
      className={[classes.avatar, className].filter(Boolean).join(' ')}
      data-size={size}
      role="img"
    >
      {shouldShowImage ? (
        <img
          alt=""
          onError={() => setFailedAvatarUrl(avatarUrl)}
          src={avatarUrl}
        />
      ) : (
        <span aria-hidden="true">{getInitials(user.displayName)}</span>
      )}
    </span>
  );
}

function getAvatarUrl(user: AvatarUser): string | null {
  return user.avatarVersion === null
    ? null
    : `/api/users/${encodeURIComponent(user.id)}/avatar?v=${encodeURIComponent(user.avatarVersion)}`;
}

function getInitials(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part.at(0)?.toLocaleUpperCase('ru-RU') ?? '')
    .join('');

  return initials === '' ? '?' : initials;
}
