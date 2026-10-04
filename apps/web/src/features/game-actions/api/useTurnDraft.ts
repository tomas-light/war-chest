import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GameTurnDraft } from '@war-chest/api-contracts';
import type { GameView, TurnAction } from '@war-chest/game-engine';
import { setCachedGame } from '#/entities/game';
import { createSelectedGameApi } from '#/shared/api';

interface Options {
  gameId: string;
  onConfirmed(this: void, view: GameView): void;
  userId: string;
  view: GameView | null;
}

interface SaveDraftInput {
  action: TurnAction;
  coinIndex: number;
}

export function useTurnDraft(options: Options) {
  const { gameId, onConfirmed, userId, view } = options;
  const queryClient = useQueryClient();
  const queryKey = ['turnDraft', gameId, view?.lastEventSequence ?? 0, userId];
  const canAct = view?.status === 'active' && view.currentPlayerId === userId;

  const draftQuery = useQuery({
    enabled: canAct,
    queryFn: async () => {
      const gameApi = await createSelectedGameApi();
      return gameApi.getTurnDraft(gameId);
    },
    queryKey,
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (input: SaveDraftInput) => {
      if (view === null) {
        throw new Error('Game view is unavailable.');
      }

      const gameApi = await createSelectedGameApi();
      return gameApi.saveTurnDraft(gameId, {
        ...input,
        expectedVersion: view.lastEventSequence,
      });
    },
    onSuccess(response) {
      queryClient.setQueryData(queryKey, response);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (draft: GameTurnDraft) => {
      const gameApi = await createSelectedGameApi();
      return gameApi.cancelTurnDraft(gameId, {
        draftId: draft.id,
        revision: draft.revision,
      });
    },
    onSuccess(response) {
      queryClient.setQueryData(queryKey, response);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (draft: GameTurnDraft) => {
      const gameApi = await createSelectedGameApi();
      return gameApi.confirmTurnDraft(gameId, {
        commandId: crypto.randomUUID(),
        draftId: draft.id,
        expectedVersion: draft.baseVersion,
        revision: draft.revision,
      });
    },
    onSuccess(game) {
      setCachedGame(queryClient, game);
      onConfirmed(game.view);
      queryClient.setQueryData(queryKey, { draft: null });
    },
  });

  const draft = draftQuery.data?.draft ?? null;
  const error =
    saveMutation.error ??
    cancelMutation.error ??
    confirmMutation.error ??
    draftQuery.error;
  const isPending =
    saveMutation.isPending ||
    cancelMutation.isPending ||
    confirmMutation.isPending;

  return {
    cancelDraft: cancelMutation.mutate,
    confirmDraft: confirmMutation.mutate,
    draft,
    error,
    isLoading: draftQuery.isLoading,
    isPending,
    saveDraft: saveMutation.mutate,
  };
}
