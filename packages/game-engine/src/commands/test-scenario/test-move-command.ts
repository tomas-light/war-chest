import type { TestMoveCommandData } from '../../command-data/test-scenario-command-data.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import { type GameState, cloneJsonValue } from '../../state.js';
import type { DecidableCommand } from '../decidable-command.js';

export class TestMoveCommand implements DecidableCommand<TestMoveCommandData> {
  private constructor(readonly data: TestMoveCommandData) {}

  static fromData(data: TestMoveCommandData): TestMoveCommand {
    if (data.privateData === undefined) {
      return new TestMoveCommand({ ...data });
    }

    return new TestMoveCommand({
      ...data,
      privateData: cloneJsonValue(data.privateData),
    });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    const isActiveGame = state.status === 'active';
    const isCurrentPlayer = state.currentPlayerId === playerId;

    if (!isActiveGame || !isCurrentPlayer) {
      return [];
    }

    const currentPlayerIndex = state.players.findIndex(
      (player) => player.id === playerId
    );
    const hasCurrentPlayer = currentPlayerIndex >= 0;
    const nextPlayerIndex = (currentPlayerIndex + 1) % state.players.length;
    const nextPlayer = state.players.at(nextPlayerIndex);
    const hasNextPlayer = nextPlayer !== undefined;

    if (!hasCurrentPlayer || !hasNextPlayer) {
      return [];
    }

    return [
      {
        payload: {
          moveNumber: state.moveCount + 1,
          nextPlayerId: nextPlayer.id,
          playerId,
          privateData: cloneJsonValue(this.data.privateData ?? null),
        },
        sequence: state.lastEventSequence + 1,
        type: 'TestMovePerformed',
        version: GAME_EVENT_VERSION,
      },
    ];
  }

  toData(): TestMoveCommandData {
    if (this.data.privateData === undefined) {
      return { ...this.data };
    }

    return {
      ...this.data,
      privateData: cloneJsonValue(this.data.privateData),
    };
  }
}
