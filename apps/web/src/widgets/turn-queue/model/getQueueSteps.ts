import type { GameTurnHistoryItem } from '@war-chest/api-contracts';
import type {
  CardSelection,
  GameView,
  GameViewPlayer,
} from '@war-chest/game-engine';

export interface QueueStep {
  action: 'ban' | 'deploy' | 'move' | 'pass' | 'pick' | 'recruit' | 'turn';
  key: string;
  playerId: string;
  state: 'current' | 'done' | 'upcoming';
  sequence?: number;
}

export interface PendingTurn {
  playerId: string;
  sequence: number;
}

export function getQueueSteps(
  view: GameView,
  historyItems: readonly GameTurnHistoryItem[],
  pendingTurns: readonly PendingTurn[]
): QueueStep[] {
  if (view.status === 'cardSelection' && view.cardSelection !== null) {
    return getCardSelectionSteps(
      view.cardSelection,
      view.settings.cardSelectionMode === 'eliminationDraft'
    );
  }

  if (view.status === 'active' || view.status === 'finished') {
    const completedSteps = [
      ...historyItems.map((item) => ({
        sequence: item.sequence,
        step: {
          action: item.action,
          key: `history-${item.sequence}`,
          playerId: item.playerId,
          sequence: item.sequence,
          state: 'done' as const,
        },
      })),
      ...pendingTurns.map((turn) => ({
        sequence: turn.sequence,
        step: {
          action: 'turn' as const,
          key: `history-${turn.sequence}`,
          playerId: turn.playerId,
          state: 'done' as const,
        },
      })),
    ]
      .sort((first, second) => first.sequence - second.sequence)
      .map((item) => item.step);

    if (view.status === 'finished') {
      return completedSteps;
    }

    return [...completedSteps, ...getActiveGameSteps(view)];
  }

  return [];
}

function getCardSelectionSteps(
  selection: CardSelection,
  isElimination: boolean
): QueueStep[] {
  const actions: QueueStep['action'][] = [];

  if (isElimination) {
    actions.push(...selection.playerOrder.map(() => 'ban' as const));
  }

  const cardsPerPlayer = selection.playerOrder.length === 2 ? 4 : 3;
  const totalPicks = cardsPerPlayer * selection.playerOrder.length;
  const playerIds: string[] = [];

  if (isElimination) {
    playerIds.push(...selection.playerOrder);
  }

  for (let pickIndex = 0; pickIndex < totalPicks; pickIndex += 1) {
    const round = Math.floor(pickIndex / selection.playerOrder.length);
    const position = pickIndex % selection.playerOrder.length;
    const playerIndex =
      round % 2 === 0 ? position : selection.playerOrder.length - 1 - position;
    const playerId = selection.playerOrder[playerIndex];

    if (playerId !== undefined) {
      playerIds.push(playerId);
      actions.push('pick');
    }
  }

  const steps: QueueStep[] = playerIds.map((playerId, index) => ({
    action: actions[index] ?? 'pick',
    key: `selection-${index}`,
    playerId,
    state: getStepState(index, selection.choices.length),
  }));

  return limitFutureSteps(steps);
}

function getActiveGameSteps(view: GameView): QueueStep[] {
  const players = [...view.players].sort(comparePlayers);
  const currentPlayerIndex = players.findIndex(
    (player) => player.id === view.currentPlayerId
  );

  if (currentPlayerIndex < 0) {
    return [];
  }

  const remainingResources = players.map((player) => {
    const resources = view.battlefield?.playerResources.find(
      (item) => item.playerId === player.id
    );

    return {
      bagCount: resources?.bagCount ?? 0,
      discardCount: resources?.discard.length ?? 0,
      handCount: resources?.handCount ?? 0,
    };
  });
  const currentPlayer = players[currentPlayerIndex];

  if (currentPlayer === undefined) {
    return [];
  }

  const steps: QueueStep[] = [
    {
      action: 'turn',
      key: `active-${view.moveCount}`,
      playerId: currentPlayer.id,
      state: 'current',
    },
  ];
  const remainingTurnCount = remainingResources.reduce(
    (count, resources) => count + resources.handCount,
    0
  );
  let activePlayerIndex = currentPlayerIndex;

  for (let turn = 0; turn < remainingTurnCount; turn += 1) {
    const activeResources = remainingResources[activePlayerIndex];

    if (activeResources === undefined || activeResources.handCount === 0) {
      break;
    }

    activeResources.handCount -= 1;
    activeResources.discardCount += 1;

    if (remainingResources.every((resources) => resources.handCount === 0)) {
      const initiativePlayerIndex = players.findIndex(
        (player) => player.id === view.initiativePlayerId
      );

      if (initiativePlayerIndex < 0) {
        break;
      }

      for (let offset = 0; offset < players.length; offset += 1) {
        const playerIndex = (initiativePlayerIndex + offset) % players.length;
        const player = players[playerIndex];
        const resources = remainingResources[playerIndex];

        if (
          player === undefined ||
          resources === undefined ||
          (resources.discardCount === 0 && resources.bagCount === 0)
        ) {
          continue;
        }

        steps.push({
          action: 'turn',
          key: `active-${view.moveCount + steps.length}`,
          playerId: player.id,
          state: 'upcoming',
        });

        if (player.id === currentPlayer.id) {
          return steps;
        }
      }

      break;
    }

    for (let offset = 1; offset <= players.length; offset += 1) {
      const playerIndex = (activePlayerIndex + offset) % players.length;
      const player = players[playerIndex];
      const resources = remainingResources[playerIndex];

      if (player === undefined || resources?.handCount === 0) {
        continue;
      }

      steps.push({
        action: 'turn',
        key: `active-${view.moveCount + steps.length}`,
        playerId: player.id,
        state: 'upcoming',
      });

      if (player.id === currentPlayer.id) {
        return steps;
      }

      activePlayerIndex = playerIndex;
      break;
    }
  }

  return steps;
}

function limitFutureSteps(steps: QueueStep[]): QueueStep[] {
  const currentStepIndex = steps.findIndex((step) => step.state === 'current');

  if (currentStepIndex < 0) {
    return steps;
  }

  let lastVisibleIndex = currentStepIndex;

  for (let index = 0; index <= currentStepIndex; index += 1) {
    const playerId = steps[index]?.playerId;
    const nextOwnTurnIndex = steps.findIndex(
      (step, stepIndex) => stepIndex > index && step.playerId === playerId
    );

    if (nextOwnTurnIndex < 0) {
      return steps;
    }

    lastVisibleIndex = Math.max(lastVisibleIndex, nextOwnTurnIndex);
  }

  return steps.slice(0, lastVisibleIndex + 1);
}

function comparePlayers(first: GameViewPlayer, second: GameViewPlayer): number {
  if (first.seat !== second.seat) {
    return first.seat - second.seat;
  }

  return first.team.localeCompare(second.team);
}

function getStepState(
  index: number,
  completedCount: number
): QueueStep['state'] {
  if (index < completedCount) {
    return 'done';
  }

  if (index === completedCount) {
    return 'current';
  }

  return 'upcoming';
}
