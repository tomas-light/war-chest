import clsx from 'clsx';
import { useState } from 'react';
import { getUserAvatarUrl } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
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
  const { i18n, t } = useTranslation('entities/user', {
    keyPrefix: 'UserAvatar',
  });
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const avatarUrl = getUserAvatarUrl(user);
  const shouldShowImage = avatarUrl !== null && avatarUrl !== failedAvatarUrl;

  return (
    <span
      aria-label={t('label', { userName: user.displayName })}
      className={clsx(classes.avatar, className)}
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
        <span aria-hidden="true">
          {getInitials(user.displayName, i18n.resolvedLanguage)}
        </span>
      )}
    </span>
  );
}

function getInitials(
  displayName: string,
  language: string | undefined
): string {
  const initials = displayName
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part.at(0)?.toLocaleUpperCase(language) ?? '')
    .join('');

  return initials === '' ? '?' : initials;
}
