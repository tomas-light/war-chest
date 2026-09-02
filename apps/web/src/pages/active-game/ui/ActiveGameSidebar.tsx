import type { GameView } from '@war-chest/game-engine';
import { SurrenderGameButton } from '#/features/surrender-game';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import classes from './ActiveGameSidebar.module.scss';

interface Props {
  gameId: string;
  onSurrendered(this: void, view: GameView): void;
  userId: string;
  view: GameView;
}

export function ActiveGameSidebar(props: Props) {
  const { gameId, onSurrendered, userId, view } = props;
  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'ActiveGameSidebar',
  });
  const isSpectator = !view.players.some((player) => player.id === userId);

  return (
    <aside className={classes.sidebar}>
      {view.status === 'active' ? (
        <section className={classes.sidebarSection}>
          <p className={classes.sidebarEyebrow}>{t('turnEyebrow')}</p>
          <h2>{t('actionsTitle')}</h2>
          <p>{getTurnDescription()}</p>
          <div className={classes.placeholderActions}>
            <Button disabled>{t('chooseSquad')}</Button>
            <Button disabled variant="secondary">
              {t('finishAction')}
            </Button>
            {isSpectator ? null : (
              <SurrenderGameButton
                gameId={gameId}
                onSurrendered={onSurrendered}
                view={view}
              />
            )}
          </div>
        </section>
      ) : null}

      <section className={classes.sidebarSection}>
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
