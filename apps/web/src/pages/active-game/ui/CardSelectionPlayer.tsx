import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type { UnitId } from '@war-chest/game-engine';
import clsx from 'clsx';
import { UnitPortrait } from '#/entities/game-assets';
import { UserAvatar } from '#/entities/user';
import { useTranslation } from '#/shared/i18n/useTranslation';
import classes from './CardSelectionPlayer.module.scss';

interface Props {
  banUnitId: UnitId | undefined;
  cardsPerPlayer: number;
  className: string;
  isCurrent: boolean;
  isElimination: boolean;
  isTeam: boolean;
  isYou: boolean;
  number: number;
  picks: readonly UnitId[];
  profile: LobbyGamePlayer;
}

export function CardSelectionPlayer(props: Props) {
  const {
    banUnitId,
    cardsPerPlayer,
    className,
    isCurrent,
    isElimination,
    isTeam,
    isYou,
    number,
    picks,
    profile,
  } = props;

  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'CardSelectionPage',
  });

  const teamLabel = profile.team === 'white' ? t('whiteTeam') : t('blackTeam');
  const countClassName = isCurrent ? classes.desktopCount : undefined;
  const countLabel = isCurrent ? 'currentCount' : 'count';
  const banCount = banUnitId === undefined ? 0 : 1;

  return (
    <article
      className={clsx(classes.player, className, { [classes.team]: isTeam })}
      data-current={isCurrent}
    >
      <div className={classes.identity}>
        <p className={classes.number}>
          {number} · {teamLabel}
        </p>
        <div className={classes.user}>
          <UserAvatar size="small" user={profile} />
          <strong className={classes.name}>
            {profile.displayName}
            {isYou ? t('youSuffix') : ''}
          </strong>
        </div>
        <p className={classes.count}>
          <span className={countClassName}>
            {t(countLabel, {
              count: picks.length,
              total: cardsPerPlayer,
            })}
          </span>
          {isCurrent && isTeam ? (
            <span className={classes.mobileCount}>
              {t('currentCountMobile', {
                count: picks.length,
                total: cardsPerPlayer,
              })}
            </span>
          ) : null}
        </p>
      </div>
      <div className={classes.selections}>
        <p className={classes.label}>{t('selectedCards')}</p>
        <div className={classes.slots}>
          {Array.from({ length: cardsPerPlayer }, (_, index) => {
            const unitId = picks[index];
            return (
              <div
                className={clsx(classes.slot, {
                  [classes.picked]: unitId !== undefined,
                })}
                key={index}
              >
                {unitId === undefined ? (
                  <span aria-hidden="true" className={classes.emptyArtwork}>
                    —
                  </span>
                ) : (
                  <UnitPortrait className={classes.artwork} unit={unitId} />
                )}
                <span className={classes.unitName}>{getUnitLabel(unitId)}</span>
              </div>
            );
          })}
        </div>
        {isElimination ? (
          <>
            <p className={classes.banLabel}>
              {t('banCount', { count: banCount })}
            </p>
            <div className={classes.ban}>
              {banUnitId === undefined ? (
                <span aria-hidden="true" className={classes.emptyBan}>
                  —
                </span>
              ) : (
                <UnitPortrait className={classes.banArtwork} unit={banUnitId} />
              )}
              <span className={classes.unitName}>
                {getUnitLabel(banUnitId)}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </article>
  );

  function getUnitLabel(unitId: UnitId | undefined): string {
    if (unitId === undefined) {
      return t('emptyCard');
    }

    return t(`units.${unitId}`);
  }
}
