import { useParams } from 'react-router';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { PlaceholderPage } from '#/shared/ui/placeholder-page';

export function UserProfilePage() {
  const { t } = useTranslation('pages/user-profile', {
    keyPrefix: 'UserProfilePage',
  });
  const { userId } = useParams();
  const description =
    userId === undefined
      ? t('currentUserDescription')
      : t('publicUserDescription', { userId });

  return <PlaceholderPage description={description} title={t('title')} />;
}
