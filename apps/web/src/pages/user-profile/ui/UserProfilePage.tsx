import { useParams } from 'react-router';
import { PlaceholderPage } from '#/shared/ui/placeholder-page';

export function UserProfilePage() {
  const { userId } = useParams();
  const description =
    userId === undefined
      ? 'Профиль текущего пользователя и его завершённые партии.'
      : `Публичный профиль пользователя ${userId}.`;

  return <PlaceholderPage description={description} title="Профиль" />;
}
