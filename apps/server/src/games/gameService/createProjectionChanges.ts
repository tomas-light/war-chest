import type { GameEventData } from '@war-chest/game-engine';
import type { ProjectionChanges } from './GameServiceTypes.js';

export function createProjectionChanges(
  events: readonly GameEventData[],
  occurredAt: Date
): ProjectionChanges {
  const gameChanges: NonNullable<ProjectionChanges['gameChanges']> = {};
  const participantChanges: NonNullable<
    ProjectionChanges['participantChanges']
  >[number][] = [];

  for (const event of events) {
    if (event.type === 'PlayerJoined') {
      participantChanges.push({
        operation: 'addPlayer',
        seat: event.payload.seat,
        team: event.payload.team,
        userId: event.payload.playerId,
      });
    }

    if (event.type === 'PlayerPositionChanged') {
      participantChanges.push({
        operation: 'movePlayer',
        seat: event.payload.seat,
        team: event.payload.team,
        userId: event.payload.playerId,
      });
    }

    if (event.type === 'PlayerLeft') {
      participantChanges.push({
        operation: 'removePlayer',
        userId: event.payload.playerId,
      });
    }

    if (event.type === 'PlayerPositionsSwapped') {
      const [firstPosition, secondPosition] = event.payload.positions;

      participantChanges.push({
        operation: 'swapPlayers',
        positions: [
          {
            seat: firstPosition.seat,
            team: firstPosition.team,
            userId: firstPosition.playerId,
          },
          {
            seat: secondPosition.seat,
            team: secondPosition.team,
            userId: secondPosition.playerId,
          },
        ],
      });
    }

    if (event.type === 'GameStarted') {
      gameChanges.startedAt = occurredAt;
      gameChanges.status = 'active';
    }

    if (event.type === 'GameFinished') {
      gameChanges.finishedAt = occurredAt;
      gameChanges.status = 'finished';
      gameChanges.winnerTeam = event.payload.winnerTeam;
    }
  }

  return {
    ...(Object.keys(gameChanges).length === 0 ? {} : { gameChanges }),
    ...(participantChanges.length === 0 ? {} : { participantChanges }),
  };
}
