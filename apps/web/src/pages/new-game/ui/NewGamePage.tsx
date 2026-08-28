import { useNavigate } from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { CreateGameForm } from '#/features/create-game';
import { getGamePageUrl } from '#/shared/config';
import { PlaceholderPage } from '#/shared/ui/placeholder-page';

export function NewGamePage() {
  const navigate = useNavigate();
  const { session } = useAuthSession();
  const userId = session?.user.id ?? '';

  return (
    <PlaceholderPage
      description="Сначала создайте пустую игру. После этого каждый игрок отдельно выбирает свободное место."
      title="Новая игра"
    >
      <CreateGameForm onCreated={openCreatedGame} userId={userId} />
    </PlaceholderPage>
  );

  function openCreatedGame(gameId: string): void {
    void navigate(getGamePageUrl(gameId));
  }
}
