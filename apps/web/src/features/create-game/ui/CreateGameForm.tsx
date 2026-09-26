import type { GameFormat } from '@war-chest/game-engine';
import { useState } from 'react';
import { GameSetupOption } from '#/entities/game';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { useCreateGameMutation } from '../api/useCreateGameMutation';
import classes from './CreateGameForm.module.scss';

interface Props {
  onCreated(this: void, gameId: string): void;
}

export function CreateGameForm(props: Props) {
  const { onCreated } = props;
  const { t } = useTranslation('features/create-game', {
    keyPrefix: 'CreateGameForm',
  });
  const [format, setFormat] = useState<GameFormat>('duel');
  const {
    isPending: isGameCreationPending,
    error: gameCreationError,
    mutate: createGame,
  } = useCreateGameMutation({ format, onCreated });

  return (
    <form
      aria-busy={isGameCreationPending}
      className={classes.form}
      onSubmit={(event) => {
        event.preventDefault();
        createGame();
      }}
    >
      <fieldset className={classes.group}>
        <legend>{t('format.legend')}</legend>
        <div className={classes.optionGrid}>
          <GameSetupOption
            description={t('format.duel.description')}
            isSelected={format === 'duel'}
            label={t('format.duel.title')}
            name="game-format"
            onSelect={() => setFormat('duel')}
            stateLabel={format === 'duel' ? t('selected') : t('select')}
          />
          <GameSetupOption
            description={t('format.team.description')}
            isSelected={format === 'team'}
            label={t('format.team.title')}
            name="game-format"
            onSelect={() => setFormat('team')}
            stateLabel={format === 'team' ? t('selected') : t('select')}
          />
        </div>
      </fieldset>

      <p className={classes.description}>{t('description')}</p>

      {gameCreationError && (
        <p className={classes.error} role="alert">
          {gameCreationError}
        </p>
      )}

      <Button disabled={isGameCreationPending} type="submit">
        {isGameCreationPending ? t('creating') : t('create')}
      </Button>
    </form>
  );
}
