import { useParams } from 'react-router';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { PlaceholderPage } from '#/shared/ui/placeholder-page';

export function GameHistoryPage() {
  const { t } = useTranslation('pages/game-history', {
    keyPrefix: 'GameHistoryPage',
  });
  const { gameId } = useParams();

  return (
    <PlaceholderPage
      description={t('description', { gameId: gameId ?? t('missingGame') })}
      title={t('title')}
    />
  );
}
