import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createSelectedLobbyConnection } from '#/shared/api';
import { invalidateLobbyGames } from './useLobbyGamesQuery';

export function useLobbyGamesConnection(userId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (userId === '') {
      return;
    }

    let isCancelled = false;
    let disconnect: (() => void) | undefined;

    void connectToLobby();

    return () => {
      isCancelled = true;
      disconnect?.();
    };

    async function connectToLobby(): Promise<void> {
      const connection = await createSelectedLobbyConnection({
        onSubscribed: refreshLobby,
        onUpdated: refreshLobby,
      });

      if (isCancelled) {
        connection.disconnect();
        return;
      }

      disconnect = connection.disconnect;
      connection.connect();
    }

    function refreshLobby(): void {
      void invalidateLobbyGames(queryClient);
    }
  }, [queryClient, userId]);
}
