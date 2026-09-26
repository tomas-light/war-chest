import type { GameView } from '@war-chest/game-engine';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { SwapPositionsButton } from '#/shared/ui/swap-positions-button';
import { useSwapPlayerPositionsMutation } from '../api/useSwapPlayerPositionsMutation';
import classes from './SwapPlayerPositionsButton.module.scss';

interface Props {
  gameId: string;
  onSwapped(this: void, view: GameView): void;
  view: GameView;
}

export function SwapPlayerPositionsButton(props: Props) {
  const { gameId, onSwapped, view } = props;

  const { t } = useTranslation('features/swap-player-positions', {
    keyPrefix: 'SwapPlayerPositionsButton',
  });

  const {
    error: swapError,
    isPending: isSwapping,
    mutate: swapPlayerPositions,
  } = useSwapPlayerPositionsMutation({
    gameId,
    onSwapped,
    view,
  });

  return (
    <div className={classes.action}>
      <SwapPositionsButton
        aria-label={t('label')}
        disabled={isSwapping}
        onClick={() => swapPlayerPositions()}
        title={t('label')}
      />

      {swapError && <p role="alert">{swapError}</p>}
    </div>
  );
}
