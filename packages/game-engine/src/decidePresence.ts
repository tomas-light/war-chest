import type {
  DefeatDisconnectedPlayerCommandData,
  DisconnectPlayerCommandData,
  PresenceCommandData,
  ReconnectPlayerCommandData,
} from './command-data/PresenceCommandData.js';
import { type GameEventData, GAME_EVENT_VERSION } from './events.js';
import type { GamePlayer, GameState } from './state.js';

export function decidePresence(
  state: GameState,
  command: PresenceCommandData
): GameEventData[] {
  switch (command.type) {
    case 'DisconnectPlayer':
      return decideDisconnect(state, command);
    case 'ReconnectPlayer':
      return decideReconnect(state, command);
    case 'DefeatDisconnectedPlayer':
      return decideDefeat(state, command);
  }
}

function decideDisconnect(
  state: GameState,
  command: DisconnectPlayerCommandData
): GameEventData[] {
  const player = findPlayer(state, command.playerId);

  if (
    state.status !== 'active' ||
    player?.presence !== 'connected' ||
    !isIsoDateTime(command.reconnectDeadline)
  ) {
    return [];
  }

  return [
    {
      payload: {
        playerId: command.playerId,
        reconnectDeadline: command.reconnectDeadline,
      },
      sequence: state.lastEventSequence + 1,
      type: 'PlayerDisconnected',
      version: GAME_EVENT_VERSION,
    },
  ];
}

function decideReconnect(
  state: GameState,
  command: ReconnectPlayerCommandData
): GameEventData[] {
  const player = findPlayer(state, command.playerId);
  const reconnectDeadline = player?.reconnectDeadline;

  if (
    state.status !== 'active' ||
    player?.presence !== 'disconnected' ||
    reconnectDeadline === null ||
    reconnectDeadline === undefined ||
    !isIsoDateTime(command.reconnectedAt) ||
    command.reconnectedAt > reconnectDeadline
  ) {
    return [];
  }

  return [
    {
      payload: { playerId: command.playerId },
      sequence: state.lastEventSequence + 1,
      type: 'PlayerReconnected',
      version: GAME_EVENT_VERSION,
    },
  ];
}

function decideDefeat(
  state: GameState,
  command: DefeatDisconnectedPlayerCommandData
): GameEventData[] {
  const player = findPlayer(state, command.playerId);

  if (
    state.status !== 'active' ||
    player?.presence !== 'disconnected' ||
    player.reconnectDeadline !== command.reconnectDeadline ||
    !isIsoDateTime(command.defeatedAt) ||
    command.defeatedAt < command.reconnectDeadline
  ) {
    return [];
  }

  const defeatedEvent: GameEventData = {
    payload: {
      playerId: command.playerId,
      reason: 'disconnectTimeout',
    },
    sequence: state.lastEventSequence + 1,
    type: 'PlayerDefeated',
    version: GAME_EVENT_VERSION,
  };
  const winningPlayer = state.players.find(
    (candidate) =>
      candidate.id !== command.playerId && candidate.presence !== 'defeated'
  );

  if (winningPlayer === undefined) {
    return [defeatedEvent];
  }

  return [
    defeatedEvent,
    {
      payload: { winnerTeam: winningPlayer.team },
      sequence: state.lastEventSequence + 2,
      type: 'GameFinished',
      version: GAME_EVENT_VERSION,
    },
  ];
}

function findPlayer(state: GameState, playerId: string): GamePlayer | null {
  return state.players.find((player) => player.id === playerId) ?? null;
}

function isIsoDateTime(value: string): boolean {
  const parsedDate = new Date(value);

  return (
    !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString() === value
  );
}
