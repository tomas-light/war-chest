import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameCoin, GameView } from '@war-chest/game-engine';
import { useState } from 'react';
import { getGameQueryKey } from '#/entities/game';
import { RoyalToken, UnitToken } from '#/entities/game-assets';
import { createSelectedGameApi, useApiErrorMessage } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
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

  const getApiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
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

  const mutation = useMutation({
    mutationFn: passTurn,
    onSuccess(game) {
      onPassed(game.view);
      queryClient.setQueryData(getGameQueryKey(gameId), game);
    },
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
            disabled={!canPass || mutation.isPending}
            key={getCoinKey(coin, index)}
            onClick={() => selectCoin(index)}
            type="button"
          >
            <Coin coin={coin} />
          </button>
        ))}
      </div>

      <Button
        disabled={!canPass || selectedCoinIndex === null || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? t('passing') : t('pass')}
      </Button>

      {mutation.error === null ? null : (
        <p role="alert">{getApiErrorMessage(mutation.error)}</p>
      )}
    </div>
  );

  async function passTurn() {
    if (selectedCoinIndex === null) {
      throw new Error('A coin must be selected before passing.');
    }

    const gameApi = await createSelectedGameApi();

    return gameApi.passTurn(gameId, {
      coinIndex: selectedCoinIndex,
      commandId: crypto.randomUUID(),
      expectedVersion: view.lastEventSequence,
    });
  }

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
