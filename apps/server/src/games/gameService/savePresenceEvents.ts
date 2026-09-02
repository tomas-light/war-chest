import { type GameEventData, applyEvent } from '@war-chest/game-engine';
import type { ActiveGame } from '../ActiveGames.js';
import { createProjectionChanges } from './createProjectionChanges.js';
import type { GameServiceContext } from './GameServiceContext.js';
import type { GameUpdate } from './GameServiceTypes.js';
import { getCurrentDate } from './getCurrentDate.js';

interface Input {
  activeGame: ActiveGame;
  events: readonly GameEventData[];
  gameId: string;
}

export async function savePresenceEvents(
  context: GameServiceContext,
  input: Input
): Promise<GameUpdate | null> {
  const previousVersion = input.activeGame.state.lastEventSequence;
  const projectionChanges = createProjectionChanges(
    input.events,
    getCurrentDate()
  );
  const saveResult = await context.options.gameRepository.saveSystemEvents({
    events: input.events,
    expectedVersion: previousVersion,
    gameChanges: projectionChanges.gameChanges,
    gameId: input.gameId,
  });

  if (saveResult.status === 'versionConflict') {
    await context.gameLoader.reload(input.gameId);
    return null;
  }

  input.activeGame.state = input.events.reduce(
    applyEvent,
    input.activeGame.state
  );
  context.reconnectDeadline.update(input.gameId, input.events);

  if (input.activeGame.state.status === 'finished') {
    context.options.activeGames.delete(input.gameId);
  }

  return { gameId: input.gameId, previousVersion };
}
