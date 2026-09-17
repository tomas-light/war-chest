# Board actions

[Base game](./README.md) · [Русский](../ru/actions.md) · Sources: PDFs, pp. 7–11.

Together with the three [face-down actions](./rounds.md), these cover all nine
main actions. A card may change their legality or add an effect.

## Deploy and bolster: hand to board

**Deploy.** Place a unit coin from your hand on an empty location you control.
In team play, any team-controlled location qualifies. If all such locations
are occupied, ordinary deployment is impossible. You cannot deploy a second
unit of a type you already have on the board unless its card permits this.
A destroyed unit can be deployed again if suitable coins remain.

**Bolster.** Place a matching hand coin on your existing unit. This increases
the hits needed to destroy it. There is no separate bolster limit beyond
available coins. All coins in the unit move together. An action by the unit
requires one ordinary payment, not payment for each bolstering coin.

For both actions the coin stays on the board; it is not discarded. The digital
interface represents bolstering with `bolstered` hearts on the unit instead
of a coin stack. The bolstering coin logically remains on the board, not in
supply, discard or the removed-coins area.

A coin in hand without a corresponding unit on the board does not by itself
allow a maneuver.

## Maneuvers: face-up discard

For an ordinary maneuver, discard a hand coin face-up matching your acting
unit. Choose exactly one maneuver:

- **Move.** Move to one adjacent empty space. Occupied spaces, including friendly
  ones, cannot be entered. Multi-space movement also requires empty intermediate
  spaces unless a card explicitly says otherwise.
- **Control.** A unit on a neutral or enemy-controlled location takes control
  of it, removing enemy control if present. You cannot control your own location
  again. Moving onto a location is not enough: control is a separate action.
  Enemy starting locations may also be captured. Control persists after the
  unit moves away or is destroyed, until an opponent takes control.
- **Attack.** Target an adjacent enemy unit and remove one of its coins from
  the game permanently, not to supply or discard. A bolstered unit loses one
  coin; when the last coin is removed the unit leaves the board. You cannot
  attack your own or your teammate's units.
- **Tactic.** Perform the special sequence on the card instead of an ordinary
  move, attack or control. Obey all restrictions; you cannot take only a useful
  part of a mandatory sequence.

## Attributes and restrictions

A tactic is a chosen action. An attribute or restriction applies whenever its
stated conditions arise, without choosing a separate action. For example,
Knight restricts attackers, while Footman permits two units of its type.
Attributes can trigger during a maneuver granted by another unit.

An additional effect does not override general prohibitions without explicit
permission. A decision or draw required by an effect remains part of the turn.
Controlling the last required location ends the game immediately. See
[unit clarifications](./unitClarifications.md) for specific interactions.
