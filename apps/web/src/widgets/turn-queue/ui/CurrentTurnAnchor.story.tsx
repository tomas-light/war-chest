import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import { useState } from 'react';
import { CurrentTurnAnchor } from './CurrentTurnAnchor';

const PROFILE: LobbyGamePlayer = {
  avatarVersion: 'avatar-1',
  displayName: 'Copper Fox',
  id: 'player-one',
  seat: 1,
  team: 'white',
};

export function ReplayControls() {
  const [status, setStatus] = useState<'review' | 'playing' | 'paused'>(
    'review'
  );

  return (
    <CurrentTurnAnchor
      onPause={() => setStatus('paused')}
      onPlay={() => setStatus('playing')}
      onReturnToLive={() => setStatus('review')}
      onRetry={() => setStatus('review')}
      profile={PROFILE}
      status={status}
      turnNumber={25}
      viewedTurnNumber={12}
    />
  );
}

export function ReplayLoading() {
  return (
    <CurrentTurnAnchor
      onPause={ignoreAction}
      onPlay={ignoreAction}
      onReturnToLive={ignoreAction}
      onRetry={ignoreAction}
      profile={PROFILE}
      status="loading"
      turnNumber={25}
      viewedTurnNumber={12}
    />
  );
}

export function ReplayError() {
  const [failed, setFailed] = useState(true);
  let status: 'error' | 'review' = 'review';
  let error: string | null = null;

  if (failed) {
    status = 'error';
    error = 'Не удалось загрузить историю';
  }

  return (
    <CurrentTurnAnchor
      error={error}
      onPause={ignoreAction}
      onPlay={ignoreAction}
      onReturnToLive={() => setFailed(false)}
      onRetry={() => setFailed(false)}
      profile={PROFILE}
      status={status}
      turnNumber={25}
      viewedTurnNumber={12}
    />
  );
}

function ignoreAction(): void {}
