# Four-player team game

[Base game](./README.md) · [Русский](../ru/teamPlay.md) · Sources: PDFs, pp. 12–13.

## Setup and victory

Two teams of two use the team board layout. Each team has 8 control markers
and 3 starting locations; 8 more locations are neutral. The entire team wins
when it controls 8 locations simultaneously. The target is not 6 and is not
an individual player's score.

Each player receives 3 different unit types, personal supply, bag, hand and
discard pile, plus their own Royal Coin. Each starting bag contains 7 coins.
Teammates do not pool their personal resources.

## Turn order and drafting

Players are arranged so teammates are not adjacent. The initiative holder
acts first, then play follows a fixed circular order. Claiming initiative
does not change the order during the current round. A player with no hand
skips their opportunity without payment; their teammate continues. Empty
hands or bags do not separately eliminate a player.

For drafting, reveal 12 random cards and randomly choose the first team.
That team chooses its first drafter. Numbers below refer to circular order
from that person, not UI seat numbers. Individual picks follow
`1 → 2 → 3 → 4 → 4 → 3 → 2 → 1 → 2 → 3 → 4 → 1`.
Each player receives 3 cards. This is not three identical snake passes.

## Team interaction and information

- Either teammate may deploy on any empty team-controlled location.
- Friendly-unit effects include your teammate's units.
- You cannot recruit for your teammate or recruit from their supply.
- You cannot claim initiative from your teammate; the round's usual initiative
  restrictions still apply.
- Communication between teammates must be open to the other players. This
  is the original PDF rule and does not make hands public.

Project-specific digital exception, agreed on September 17: a shared private
turn draft. Its author may edit it; their teammate has read-only access.
Opponents and spectators receive only confirmed actions. Other resource
visibility rules remain unchanged. This exception is not implemented yet;
see the [turn draft contract](../../../development-plan/uiMigration/turnDraft.md).
