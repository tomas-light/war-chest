import type { PublicUser } from '@war-chest/api-contracts';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { appRoutes } from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import classes from './UserProfileLink.module.scss';

interface Props {
  children?: ReactNode;
  className?: string;
  user: Pick<PublicUser, 'displayName' | 'id'>;
}

export function UserProfileLink(props: Props) {
  const { children, className, user } = props;
  const { t } = useTranslation('entities/user', {
    keyPrefix: 'UserProfileLink',
  });

  return (
    <Link
      aria-label={t('label', { userName: user.displayName })}
      className={clsx(classes.link, className)}
      to={appRoutes.users.userId(user.id).url()}
    >
      {children ?? user.displayName}
    </Link>
  );
}
