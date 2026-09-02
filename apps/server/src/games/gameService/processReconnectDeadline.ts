import { decidePresence } from '@war-chest/game-engine';
import type { GameServiceContext } from './GameServiceContext.js';
import type { ReconnectDeadlineInput } from './GameServiceTypes.js';
import { getCurrentDate } from './getCurrentDate.js';
import { savePresenceEvents } from './savePresenceEvents.js';

export async function processReconnectDeadline(
  context: GameServiceContext,
  input: ReconnectDeadlineInput
): Promise<void> {
  await context.options.activeGames.runExclusive(input.gameId, processDeadline);

  async function processDeadline(): Promise<void> {
    try {
      await defeatDisconnectedPlayer();
    } catch {
      context.reconnectDeadline.schedule({
        ...input,
        retryAttempt: input.retryAttempt + 1,
      });
    }
  }

  async function defeatDisconnectedPlayer(): Promise<void> {
    const activeGame = await context.gameLoader.load(input.gameId);
    const player = activeGame?.state.players.find(
      (candidate) => candidate.id === input.playerId
    );

    if (
      activeGame === null ||
      activeGame.state.status !== 'active' ||
      player?.presence !== 'disconnected' ||
      player.reconnectDeadline !== input.reconnectDeadline
    ) {
      return;
    }

    const defeatedAt = getCurrentDate().toISOString();
    const events = decidePresence(activeGame.state, {
      defeatedAt,
      playerId: input.playerId,
      reconnectDeadline: input.reconnectDeadline,
      type: 'DefeatDisconnectedPlayer',
    });

    if (events.length === 0) {
      context.reconnectDeadline.schedule({
        ...input,
        retryAttempt: input.retryAttempt + 1,
      });
      return;
    }

    const update = await savePresenceEvents(context, {
      activeGame,
      events,
      gameId: input.gameId,
    });

    if (update !== null) {
      context.gameUpdatePublisher.notify(update);
    }
  }
}
