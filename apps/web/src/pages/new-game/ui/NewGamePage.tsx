import { useNavigate } from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { CreateGameForm } from '#/features/create-game';
import { getGamePageUrl } from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { PlaceholderPage } from '#/shared/ui/placeholder-page';

export function NewGamePage() {
  const { t } = useTranslation('pages/new-game', {
    keyPrefix: 'NewGamePage',
  });
  const navigate = useNavigate();
  const { session } = useAuthSession();
  const userId = session?.user.id ?? '';

  return (
    <PlaceholderPage description={t('description')} title={t('title')}>
      <CreateGameForm onCreated={openCreatedGame} userId={userId} />
    </PlaceholderPage>
  );

  function openCreatedGame(gameId: string): void {
    void navigate(getGamePageUrl(gameId));
  }
}
