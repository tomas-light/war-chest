import { decidePresence } from '@war-chest/game-engine';
import type { GameServiceContext } from './GameServiceContext.js';
import type {
  DisconnectFromGameResult,
  GameConnectionInput,
} from './GameServiceTypes.js';
import { getCurrentDate } from './getCurrentDate.js';
import { savePresenceEvents } from './savePresenceEvents.js';

export function disconnect(
  context: GameServiceContext,
  input: GameConnectionInput
): Promise<DisconnectFromGameResult> {
  return context.options.activeGames.runExclusive(
    input.gameId,
    disconnectFromGame
  );

  async function disconnectFromGame(): Promise<DisconnectFromGameResult> {
    const activeGame = context.options.activeGames.get(input.gameId);
    const connectionIds = activeGame?.connectionsByUserId.get(input.userId);

    if (activeGame === null || connectionIds === undefined) {
      return { status: 'noChange' };
    }

    connectionIds.delete(input.connectionId);

    if (connectionIds.size === 0) {
      activeGame.connectionsByUserId.delete(input.userId);
    } else {
      return { status: 'noChange' };
    }

    const reconnectDeadline = new Date(
      getCurrentDate().getTime() + context.options.disconnectedPlayerTimeoutMs
    ).toISOString();
    const events = decidePresence(activeGame.state, {
      playerId: input.userId,
      reconnectDeadline,
      type: 'DisconnectPlayer',
    });

    if (events.length === 0) {
      return { status: 'noChange' };
    }

    const previousVersion = activeGame.state.lastEventSequence;
    const update = await savePresenceEvents(context, {
      activeGame,
      events,
      gameId: input.gameId,
    });

    if (update === null) {
      return { status: 'noChange' };
    }

    context.gameUpdatePublisher.notify(update);

    return {
      currentVersion: activeGame.state.lastEventSequence,
      previousVersion,
      status: 'disconnected',
    };
  }
}
