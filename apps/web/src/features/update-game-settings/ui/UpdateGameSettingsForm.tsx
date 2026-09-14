import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CardSelectionMode,
  GameExpansion,
  GameView,
} from '@war-chest/game-engine';
import type { ReactNode } from 'react';
import { GameSetupOption, getGameQueryKey } from '#/entities/game';
import { createSelectedGameApi, useApiErrorMessage } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import classes from './UpdateGameSettingsForm.module.scss';

interface Props {
  gameId: string;
  isEditable: boolean;
  onUpdated(this: void, view: GameView): void;
  view: GameView;
}

const EXPANSIONS: readonly GameExpansion[] = ['nobility', 'siege', 'nightfall'];
const CARD_SELECTION_MODES: readonly CardSelectionMode[] = [
  'random',
  'draft',
  'eliminationDraft',
];

export function UpdateGameSettingsForm(props: Props) {
  const { gameId, isEditable, onUpdated, view } = props;
  const { t } = useTranslation('features/update-game-settings', {
    keyPrefix: 'UpdateGameSettingsForm',
  });
  const getApiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: async (settings: {
      cardSelectionMode: CardSelectionMode;
      expansions: readonly GameExpansion[];
    }) => {
      const gameApi = await createSelectedGameApi();

      return gameApi.updateGameSettings(gameId, {
        ...settings,
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
      });
    },
    onSuccess: (game) => {
      queryClient.setQueryData(getGameQueryKey(gameId), game);
      onUpdated(game.view);
    },
  });
  const isDisabled = !isEditable || updateMutation.isPending;

  return (
    <section aria-busy={updateMutation.isPending} className={classes.settings}>
      <SettingsGroup
        description={t('expansions.description')}
        title={t('expansions.title')}
      >
        {EXPANSIONS.map((expansion) => {
          const isSelected = view.settings.expansions.includes(expansion);
          const isAvailable = view.featureFlags[getExpansionFlag(expansion)];

          return (
            <GameSetupOption
              description={
                isAvailable
                  ? t(`expansions.${expansion}.description`)
                  : t('unavailable')
              }
              disabled={isDisabled || !isAvailable}
              inputType="checkbox"
              isSelected={isSelected}
              key={expansion}
              label={t(`expansions.${expansion}.title`)}
              name="game-expansions"
              onSelect={() => updateExpansion(expansion, isSelected)}
              stateLabel={isSelected ? t('selected') : t('select')}
            />
          );
        })}
      </SettingsGroup>

      <SettingsGroup
        description={t('selection.description')}
        title={t('selection.title')}
      >
        {CARD_SELECTION_MODES.map((mode) => {
          const isSelected = view.settings.cardSelectionMode === mode;

          return (
            <GameSetupOption
              description={t(`selection.${mode}.description`)}
              disabled={isDisabled}
              isSelected={isSelected}
              key={mode}
              label={t(`selection.${mode}.title`)}
              name="card-selection-mode"
              onSelect={() => updateCardSelectionMode(mode)}
              stateLabel={isSelected ? t('selected') : t('select')}
            />
          );
        })}
      </SettingsGroup>

      {updateMutation.error === null ? null : (
        <p className={classes.error} role="alert">
          {getApiErrorMessage(updateMutation.error)}
        </p>
      )}
    </section>
  );

  function updateExpansion(
    expansion: GameExpansion,
    isSelected: boolean
  ): void {
    const expansions = isSelected
      ? view.settings.expansions.filter((item) => item !== expansion)
      : [...view.settings.expansions, expansion];

    updateMutation.mutate({
      cardSelectionMode: view.settings.cardSelectionMode,
      expansions,
    });
  }

  function updateCardSelectionMode(mode: CardSelectionMode): void {
    if (mode !== view.settings.cardSelectionMode) {
      updateMutation.mutate({
        cardSelectionMode: mode,
        expansions: view.settings.expansions,
      });
    }
  }
}

interface SettingsGroupProps {
  children: ReactNode;
  description: string;
  title: string;
}

function SettingsGroup(props: SettingsGroupProps) {
  const { children, description, title } = props;

  return (
    <div className={classes.group}>
      <div className={classes.heading}>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className={classes.options}>{children}</div>
    </div>
  );
}

function getExpansionFlag(expansion: GameExpansion) {
  if (expansion === 'nobility') {
    return 'nobilityExpansion' as const;
  }

  if (expansion === 'siege') {
    return 'siegeExpansion' as const;
  }

  return 'nightfallExpansion' as const;
}
