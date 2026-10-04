import type { BattlefieldUnit } from '../Battlefield.js';
import type { UnitManeuver } from '../command-data/TurnCommandData.js';
import { getTurnActionOptions } from '../getTurnActionOptions.js';
import type {
  UnitTacticInput,
  UnitTacticValidationMode,
} from '../UnitTacticInput.js';
import type { UnitTacticOptions } from '../UnitTacticOptions.js';
import { StandardUnitStrategy } from './StandardUnitStrategy.js';

export class FootmanStrategy extends StandardUnitStrategy {
  readonly unitId = 'footman';
  private readonly battlefieldUnitLimit = 2;
  private readonly tacticManeuverCount = 2;

  getTacticOptions(input: UnitTacticInput): UnitTacticOptions | null {
    const { coinIndex, game, maneuvers, playerId } = input;
    const battlefield = game.battlefield;

    if (
      battlefield === null ||
      !this.canUseTactic(battlefield.units, playerId) ||
      !this.hasValidManeuverSequence(maneuvers)
    ) {
      return null;
    }

    let units: BattlefieldUnit[] = battlefield.units.map((unit) => ({
      ...unit,
    }));

    for (const maneuver of maneuvers) {
      const options = getTurnActionOptions(
        { ...game, battlefield: { ...battlefield, units } },
        playerId,
        coinIndex
      );

      if (
        !options.moves.some(
          (move) =>
            move.battlefieldUnitId === maneuver.battlefieldUnitId &&
            move.cellIds.includes(maneuver.cellId)
        )
      ) {
        return null;
      }

      units = units.map((unit) => {
        if (unit.id === maneuver.battlefieldUnitId) {
          return { ...unit, cellId: maneuver.cellId };
        }

        return unit;
      });
    }

    const options = getTurnActionOptions(
      { ...game, battlefield: { ...battlefield, units } },
      playerId,
      coinIndex
    );
    const usedUnitIds = new Set(
      maneuvers.map((maneuver) => maneuver.battlefieldUnitId)
    );
    const moves = options.moves.filter(
      (move) =>
        maneuvers.length < this.tacticManeuverCount &&
        !usedUnitIds.has(move.battlefieldUnitId)
    );

    return {
      canSave: this.isTacticActionValid(maneuvers, 'draft'),
      isComplete: this.isTacticActionValid(maneuvers, 'complete'),
      maneuverLimit: this.tacticManeuverCount,
      moves,
      unitId: this.unitId,
      units,
    };
  }

  isTacticActionValid(
    maneuvers: readonly UnitManeuver[],
    mode: UnitTacticValidationMode
  ): boolean {
    return (
      this.hasValidManeuverSequence(maneuvers) &&
      maneuvers.length > 0 &&
      (mode === 'draft' || maneuvers.length === this.tacticManeuverCount)
    );
  }

  canDeploy(units: readonly BattlefieldUnit[], playerId: string): boolean {
    return this.getOwnedUnitCount(units, playerId) < this.battlefieldUnitLimit;
  }

  private canUseTactic(
    units: readonly BattlefieldUnit[],
    playerId: string
  ): boolean {
    return (
      this.getOwnedUnitCount(units, playerId) === this.battlefieldUnitLimit
    );
  }

  private getOwnedUnitCount(
    units: readonly BattlefieldUnit[],
    playerId: string
  ): number {
    return units.filter(
      (unit) => unit.ownerId === playerId && unit.unitId === this.unitId
    ).length;
  }

  private hasValidManeuverSequence(
    maneuvers: readonly UnitManeuver[]
  ): boolean {
    const usedUnitIds = new Set(
      maneuvers.map((maneuver) => maneuver.battlefieldUnitId)
    );

    return (
      maneuvers.length <= this.tacticManeuverCount &&
      maneuvers.every((maneuver) => maneuver.type === 'move') &&
      usedUnitIds.size === maneuvers.length
    );
  }
}
