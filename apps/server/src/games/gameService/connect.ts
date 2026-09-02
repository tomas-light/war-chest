import { createViewFor, decidePresence } from '@war-chest/game-engine';
import type { GameServiceContext } from './GameServiceContext.js';
import type {
  ConnectToGameResult,
  GameConnectionInput,
} from './GameServiceTypes.js';
import { getCurrentDate } from './getCurrentDate.js';
import { getPlayerViewer } from './getPlayerViewer.js';
import { savePresenceEvents } from './savePresenceEvents.js';

export function connect(
  context: GameServiceContext,
  input: GameConnectionInput
): Promise<ConnectToGameResult> {
  return context.options.activeGames.runExclusive(input.gameId, connectToGame);

  async function connectToGame(): Promise<ConnectToGameResult> {
    const activeGame = await context.gameLoader.load(input.gameId);

    if (activeGame === null) {
      return { status: 'gameNotFound' };
    }

    const connectionIds =
      activeGame.connectionsByUserId.get(input.userId) ?? new Set<string>();

    connectionIds.add(input.connectionId);
    activeGame.connectionsByUserId.set(input.userId, connectionIds);
    const previousVersion = activeGame.state.lastEventSequence;
    const reconnectedEvents = decidePresence(activeGame.state, {
      playerId: input.userId,
      reconnectedAt: getCurrentDate().toISOString(),
      type: 'ReconnectPlayer',
    });

    if (reconnectedEvents.length > 0) {
      const update = await savePresenceEvents(context, {
        activeGame,
        events: reconnectedEvents,
        gameId: input.gameId,
      });

      if (update !== null) {
        context.gameUpdatePublisher.notify(update);
        const viewer = getPlayerViewer(input.userId);

        return {
          currentVersion: activeGame.state.lastEventSequence,
          gameId: input.gameId,
          previousVersion,
          status: 'reconnected',
          view: createViewFor(activeGame.state, viewer),
        };
      }
    }

    const currentGame =
      context.options.activeGames.get(input.gameId) ?? activeGame;
    const currentConnectionIds =
      currentGame.connectionsByUserId.get(input.userId) ?? new Set<string>();

    currentConnectionIds.add(input.connectionId);
    currentGame.connectionsByUserId.set(input.userId, currentConnectionIds);
    const viewer = await context.gameLoader.resolveViewer({
      gameId: input.gameId,
      state: currentGame.state,
      userId: input.userId,
    });

    return {
      gameId: input.gameId,
      status: 'connected',
      view: createViewFor(currentGame.state, viewer),
    };
  }
}
