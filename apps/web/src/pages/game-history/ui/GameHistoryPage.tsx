import { useParams } from 'react-router';
import { PlaceholderPage } from '#/shared/ui/placeholder-page';

export function GameHistoryPage() {
  const { gameId } = useParams();

  return (
    <PlaceholderPage
      description={`Replay завершённой партии ${gameId ?? 'не выбран'}.`}
      title="История игры"
    />
  );
}
