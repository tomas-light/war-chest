import type { GameCoin, GameView } from '@war-chest/game-engine';
import { useState } from 'react';
import { RoyalToken, UnitToken } from '#/entities/game-assets';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { usePassTurnMutation } from '../api/usePassTurnMutation';
import classes from './PassTurnAction.module.scss';

interface Props {
  gameId: string;
  onPassed(this: void, view: GameView): void;
  userId: string;
  view: GameView;
}

interface CoinSelection {
  eventSequence: number;
  index: number;
}

export function PassTurnAction(props: Props) {
  const { gameId, onPassed, userId, view } = props;

  const { t } = useTranslation('features/pass-turn', {
    keyPrefix: 'PassTurnAction',
  });

  const [coinSelection, setCoinSelection] = useState<CoinSelection | null>(
    null
  );

  const resources = view.battlefield?.playerResources.find(
    (item) => item.playerId === userId
  );
  const hand = resources?.hand ?? [];
  const canPass = view.currentPlayerId === userId && hand.length > 0;
  const selectedCoinIndex =
    coinSelection?.eventSequence === view.lastEventSequence
      ? coinSelection.index
      : null;

  const {
    error: passError,
    isPending: isPassing,
    mutate: passTurn,
  } = usePassTurnMutation({
    coinIndex: selectedCoinIndex,
    gameId,
    onPassed,
    view,
  });

  return (
    <div className={classes.action}>
      <p>{t('selectCoin')}</p>

      <div className={classes.coins}>
        {hand.map((coin, index) => (
          <button
            aria-label={getCoinLabel(coin, index)}
            aria-pressed={selectedCoinIndex === index}
            className={classes.coinButton}
            disabled={!canPass || isPassing}
            key={getCoinKey(coin, index)}
            onClick={() => selectCoin(index)}
            type="button"
          >
            <Coin coin={coin} />
          </button>
        ))}
      </div>

      <Button
        disabled={!canPass || selectedCoinIndex === null || isPassing}
        onClick={() => passTurn()}
      >
        {isPassing ? t('passing') : t('pass')}
      </Button>

      {passError && <p role="alert">{passError}</p>}
    </div>
  );

  function selectCoin(index: number): void {
    setCoinSelection({ eventSequence: view.lastEventSequence, index });
  }

  function getCoinLabel(coin: GameCoin, index: number): string {
    const position = t('coin', { number: index + 1 });

    if (coin.kind === 'royal') {
      return `${position}: ${t('royalCoin')}`;
    }

    return `${position}: ${t('unitCoin', { unitId: coin.unitId })}`;
  }
}

function getCoinKey(coin: GameCoin, index: number): string {
  if (coin.kind === 'unit') {
    return `${coin.kind}-${coin.unitId}-${index}`;
  }

  return `${coin.kind}-${index}`;
}

interface CoinProps {
  coin: GameCoin;
}

function Coin(props: CoinProps) {
  const { coin } = props;

  if (coin.kind === 'royal') {
    return <RoyalToken size="compact" />;
  }

  return <UnitToken color="brass" size="compact" unit={coin.unitId} />;
}
