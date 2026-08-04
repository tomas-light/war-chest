import {
  type GameState,
  type GameView,
  type Viewer,
  cloneGameTeams,
  cloneJsonValue,
} from './state.js';

export function createViewFor(state: GameState, viewer: Viewer): GameView {
  const viewedPlayer =
    viewer.role === 'player'
      ? state.players.find((player) => player.id === viewer.playerId)
      : undefined;

  return {
    currentPlayerId: state.currentPlayerId,
    featureFlags: { ...state.featureFlags },
    lastEventSequence: state.lastEventSequence,
    moveCount: state.moveCount,
    players: state.players.map((player) => ({
      id: player.id,
      moveCount: player.moveCount,
      seat: player.seat,
      team: player.team,
    })),
    privateMoves:
      viewedPlayer?.privateMoves.map((move) => ({
        data: cloneJsonValue(move.data),
        moveNumber: move.moveNumber,
      })) ?? [],
    rulesVersion: state.rulesVersion,
    status: state.status,
    teams: cloneGameTeams(state.teams),
    winnerTeam: state.winnerTeam,
  };
}
