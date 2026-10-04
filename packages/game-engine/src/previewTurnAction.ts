import type { GameViewBattlefieldState } from './Battlefield.js';
import type { TurnAction } from './command-data/TurnCommandData.js';
import { getTurnActionOptions } from './getTurnActionOptions.js';
import type { GameView } from './state.js';

interface Input {
  action: TurnAction;
  coinIndex: number;
  playerId: string;
  view: GameView;
}

export function previewTurnAction(
  input: Input
): GameViewBattlefieldState | null {
  const { action, coinIndex, playerId, view } = input;
  const battlefield = view.battlefield;

  if (battlefield === null) {
    return null;
  }

  const options = getTurnActionOptions(view, playerId, coinIndex);

  if (
    action.type === 'recruit' &&
    !options.recruitUnits.includes(action.unitId)
  ) {
    return null;
  }

  if (
    action.type === 'deploy' &&
    !options.deployCells.includes(action.cellId)
  ) {
    return null;
  }

  if (
    action.type === 'move' &&
    !options.moves.some(
      (move) =>
        move.battlefieldUnitId === action.battlefieldUnitId &&
        move.cellIds.includes(action.cellId)
    )
  ) {
    return null;
  }

  const projectedBattlefield: GameViewBattlefieldState = {
    controlPoints: battlefield.controlPoints.map((point) => ({ ...point })),
    playerResources: battlefield.playerResources.map((resources) => ({
      ...resources,
      discard: resources.discard.map((item) => ({
        coin: item.coin === null ? null : { ...item.coin },
        faceUp: item.faceUp,
      })),
      eliminated: [...resources.eliminated],
      hand:
        resources.hand === null
          ? null
          : resources.hand.map((coin) => ({ ...coin })),
      supply: resources.supply.map((item) => ({ ...item })),
    })),
    round: battlefield.round,
    units: battlefield.units.map((unit) => ({ ...unit })),
  };
  const resources = projectedBattlefield.playerResources.find(
    (item) => item.playerId === playerId
  );
  const selectedCoin = resources?.hand?.at(coinIndex);

  if (
    resources === undefined ||
    resources.hand === null ||
    selectedCoin === undefined
  ) {
    return null;
  }

  const hand = [...resources.hand];
  hand.splice(coinIndex, 1);
  const mutableResources = { ...resources, hand, handCount: hand.length };
  const resourceIndex = projectedBattlefield.playerResources.findIndex(
    (item) => item.playerId === playerId
  );
  const playerResources = [...projectedBattlefield.playerResources];
  playerResources[resourceIndex] = mutableResources;

  if (action.type === 'recruit') {
    mutableResources.discard = [
      ...mutableResources.discard,
      { coin: { ...selectedCoin }, faceUp: false },
      { coin: { kind: 'unit', unitId: action.unitId }, faceUp: true },
    ];
    mutableResources.supply = mutableResources.supply.map((item) => {
      if (item.unitId !== action.unitId) {
        return item;
      }

      return { ...item, count: item.count - 1 };
    });
  } else if (action.type === 'move') {
    mutableResources.discard = [
      ...mutableResources.discard,
      { coin: { ...selectedCoin }, faceUp: true },
    ];

    return {
      ...projectedBattlefield,
      playerResources,
      units: projectedBattlefield.units.map((unit) => {
        if (unit.id === action.battlefieldUnitId) {
          return { ...unit, cellId: action.cellId };
        }

        return unit;
      }),
    };
  } else {
    if (selectedCoin.kind !== 'unit') {
      return null;
    }

    return {
      ...projectedBattlefield,
      playerResources,
      units: [
        ...projectedBattlefield.units,
        {
          bolstered: 0,
          cellId: action.cellId,
          id: `${playerId}:${view.moveCount + 1}`,
          ownerId: playerId,
          unitId: selectedCoin.unitId,
        },
      ],
    };
  }

  return { ...projectedBattlefield, playerResources };
}
