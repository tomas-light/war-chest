import classes from './GameSeatSelector.module.scss';

export type GameTeam = 'black' | 'white';

interface Props {
  disabled?: boolean;
  occupiedTeams?: readonly GameTeam[];
  onSelect(this: void, team: GameTeam): void;
  selectedTeam: GameTeam | null;
}

const GAME_TEAMS: readonly GameTeam[] = ['white', 'black'];

export function GameSeatSelector(props: Props) {
  const {
    disabled = false,
    occupiedTeams = [],
    onSelect,
    selectedTeam,
  } = props;

  return (
    <fieldset className={classes.selector} disabled={disabled}>
      <legend>Выберите сторону</legend>
      <div className={classes.seats}>
        {GAME_TEAMS.map((team) => {
          const isOccupied = occupiedTeams.includes(team);
          const isSelected = selectedTeam === team;
          const teamName =
            team === 'white' ? 'Белая команда' : 'Чёрная команда';

          return (
            <label
              className={getSeatClassName(isOccupied, isSelected)}
              key={team}
            >
              <input
                checked={isSelected}
                disabled={disabled || isOccupied}
                name="game-team"
                onChange={() => onSelect(team)}
                type="radio"
                value={team}
              />
              <span className={classes.team}>{teamName}</span>
              <span className={classes.position}>Место 1</span>
              <span className={classes.availability}>
                {isOccupied ? 'Занято' : 'Свободно'}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function getSeatClassName(isOccupied: boolean, isSelected: boolean): string {
  if (isOccupied) {
    return `${classes.seat} ${classes.occupied}`;
  }

  return isSelected ? `${classes.seat} ${classes.selected}` : classes.seat;
}
