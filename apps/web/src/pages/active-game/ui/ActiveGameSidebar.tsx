import type { GameView } from '@war-chest/game-engine';
import clsx from 'clsx';
import { PassTurnAction } from '#/features/pass-turn';
import { SurrenderGameButton } from '#/features/surrender-game';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import classes from './ActiveGameSidebar.module.scss';

interface Props {
  gameId: string;
  onViewChanged(this: void, view: GameView): void;
  userId: string;
  view: GameView;
}

export function ActiveGameSidebar(props: Props) {
  const { gameId, onViewChanged, userId, view } = props;
  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'ActiveGameSidebar',
  });
  const isSpectator = !view.players.some((player) => player.id === userId);

  return (
    <aside className={classes.sidebar} data-spectator={isSpectator}>
      {view.status === 'active' ? (
        <section
          className={clsx(classes.sidebarSection, classes.actionsSection)}
        >
          <p className={classes.sidebarEyebrow}>{t('turnEyebrow')}</p>
          <h2>
            {t('actionsTitle')} ·{' '}
            {t('round', { round: view.battlefield?.round ?? 1 })}
          </h2>
          <p>{getTurnDescription()}</p>

          <div className={classes.placeholderActions}>
            {isSpectator || view.settings.format !== 'duel' ? null : (
              <PassTurnAction
                gameId={gameId}
                onPassed={onViewChanged}
                userId={userId}
                view={view}
              />
            )}
            <Button disabled>{t('unitActionsUnavailable')}</Button>
            {isSpectator ? null : (
              <SurrenderGameButton
                gameId={gameId}
                onSurrendered={onViewChanged}
                view={view}
              />
            )}
          </div>
        </section>
      ) : null}

      <section className={clsx(classes.sidebarSection, classes.historySection)}>
        <p className={classes.sidebarEyebrow}>{t('historyEyebrow')}</p>
        <h2>{t('historyTitle')}</h2>
        <p>{t('historyDescription')}</p>

        <Button disabled variant="secondary">
          {t('openHistory')}
        </Button>
      </section>
    </aside>
  );

  function getTurnDescription(): string {
    if (isSpectator) {
      return t('actionsDescriptionSpectator');
    }

    return view.currentPlayerId === userId
      ? t('actionsDescriptionYou')
      : t('actionsDescriptionOpponent');
  }
}
