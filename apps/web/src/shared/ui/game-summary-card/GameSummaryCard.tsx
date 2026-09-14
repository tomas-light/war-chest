import type { ReactNode } from 'react';
import classes from './GameSummaryCard.module.scss';

export interface GameSummaryMember {
  content: ReactNode;
  id: string;
}

export interface GameSummaryTeam {
  isWinner?: boolean;
  members: readonly GameSummaryMember[];
  name: string;
}

interface Props {
  action: ReactNode;
  actionPlacement?: 'footer' | 'header';
  dateLabel: string;
  dateTime: string;
  description?: ReactNode;
  heading: string;
  headingTone: 'active' | 'defeat' | 'victory' | 'waiting';
  teams: readonly [GameSummaryTeam, GameSummaryTeam];
  versusLabel: string;
  winnerLabel?: string;
}

export function GameSummaryCard(props: Props) {
  const {
    action,
    actionPlacement = 'footer',
    dateLabel,
    dateTime,
    description,
    heading,
    headingTone,
    teams,
    versusLabel,
    winnerLabel,
  } = props;
  const [firstTeam, secondTeam] = teams;

  return (
    <article className={classes.card}>
      <header className={classes.header}>
        <div>
          <strong className={classes.heading} data-tone={headingTone}>
            {heading}
          </strong>
          {description === undefined ? null : (
            <div className={classes.description}>{description}</div>
          )}
        </div>
        <div className={classes.headerActions}>
          <time dateTime={dateTime}>{dateLabel}</time>
          {actionPlacement === 'header' ? action : null}
        </div>
      </header>

      <div className={classes.teams}>
        <Team team={firstTeam} winnerLabel={winnerLabel} />
        <span aria-hidden="true" className={classes.versus}>
          {versusLabel}
        </span>
        <Team team={secondTeam} winnerLabel={winnerLabel} />
      </div>

      {actionPlacement === 'footer' ? (
        <div className={classes.footer}>{action}</div>
      ) : null}
    </article>
  );
}

interface TeamProps {
  team: GameSummaryTeam;
  winnerLabel: string | undefined;
}

function Team(props: TeamProps) {
  const { team, winnerLabel } = props;

  return (
    <section className={classes.team} data-winner={team.isWinner === true}>
      <div className={classes.teamHeader}>
        <h3>{team.name}</h3>
        {team.isWinner === true && winnerLabel !== undefined ? (
          <span>{winnerLabel}</span>
        ) : null}
      </div>
      <ul>
        {team.members.map((member) => (
          <li key={member.id}>{member.content}</li>
        ))}
      </ul>
    </section>
  );
}
