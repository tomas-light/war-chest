import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import { createPublicUser } from '../../users/PublicUser.js';
import type { StoredGamePlayer } from '../GameRepository.js';

export function createGamePlayers(
  players: readonly StoredGamePlayer[]
): readonly LobbyGamePlayer[] {
  return players.map((player) => ({
    ...createPublicUser(player),
    seat: player.seat,
    team: player.team,
  }));
}
