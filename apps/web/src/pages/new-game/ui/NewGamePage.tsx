import { useNavigate } from 'react-router';
import { CreateGameForm } from '#/features/create-game';
import { getGamePageUrl } from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { PlaceholderPage } from '#/shared/ui/placeholder-page';

export function NewGamePage() {
  const { t } = useTranslation('pages/new-game', {
    keyPrefix: 'NewGamePage',
  });
  const navigate = useNavigate();

  return (
    <PlaceholderPage description={t('description')} title={t('title')}>
      <CreateGameForm onCreated={openCreatedGame} />
    </PlaceholderPage>
  );

  function openCreatedGame(gameId: string): void {
    void navigate(getGamePageUrl(gameId));
  }
}
