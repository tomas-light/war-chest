import type { RuntimeFeatureFlags } from '@war-chest/feature-flags';
import type { UpdateGameSettingsCommandData } from '../../command-data/LifecycleCommandData.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import type { GameExpansion } from '../../GameSettings.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../DecidableCommand.js';

const EXPANSION_FEATURE_FLAGS: Record<
  GameExpansion,
  keyof RuntimeFeatureFlags
> = {
  nightfall: 'nightfallExpansion',
  nobility: 'nobilityExpansion',
  siege: 'siegeExpansion',
};

type SettingsCommand = DecidableCommand<UpdateGameSettingsCommandData>;

export class UpdateGameSettingsCommand implements SettingsCommand {
  private constructor(readonly data: UpdateGameSettingsCommandData) {}

  static fromData(
    data: UpdateGameSettingsCommandData
  ): UpdateGameSettingsCommand {
    return new UpdateGameSettingsCommand({
      ...data,
      expansions: [...data.expansions],
    });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    const hasUniqueExpansions =
      new Set(this.data.expansions).size === this.data.expansions.length;
    const hasOnlyEnabledExpansions = this.data.expansions.every(
      (expansion) => state.featureFlags[EXPANSION_FEATURE_FLAGS[expansion]]
    );
    const hasChanges =
      state.settings.cardSelectionMode !== this.data.cardSelectionMode ||
      !haveSameExpansions(state.settings.expansions, this.data.expansions);

    if (
      state.status !== 'waiting' ||
      state.creatorId !== playerId ||
      !hasUniqueExpansions ||
      !hasOnlyEnabledExpansions ||
      !hasChanges
    ) {
      return [];
    }

    return [
      {
        payload: {
          cardSelectionMode: this.data.cardSelectionMode,
          expansions: [...this.data.expansions],
        },
        sequence: state.lastEventSequence + 1,
        type: 'GameSettingsUpdated',
        version: GAME_EVENT_VERSION,
      },
    ];
  }

  toData(): UpdateGameSettingsCommandData {
    return {
      ...this.data,
      expansions: [...this.data.expansions],
    };
  }
}

function haveSameExpansions(
  firstExpansions: readonly GameExpansion[],
  secondExpansions: readonly GameExpansion[]
): boolean {
  return (
    firstExpansions.length === secondExpansions.length &&
    firstExpansions.every((expansion) => secondExpansions.includes(expansion))
  );
}
