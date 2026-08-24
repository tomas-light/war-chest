export interface DisconnectPlayerCommandData {
  playerId: string;
  reconnectDeadline: string;
  type: 'DisconnectPlayer';
}

export interface ReconnectPlayerCommandData {
  playerId: string;
  reconnectedAt: string;
  type: 'ReconnectPlayer';
}

export interface DefeatDisconnectedPlayerCommandData {
  defeatedAt: string;
  playerId: string;
  reconnectDeadline: string;
  type: 'DefeatDisconnectedPlayer';
}

export type PresenceCommandData =
  | DefeatDisconnectedPlayerCommandData
  | DisconnectPlayerCommandData
  | ReconnectPlayerCommandData;
