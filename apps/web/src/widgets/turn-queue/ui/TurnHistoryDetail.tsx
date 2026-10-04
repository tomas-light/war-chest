import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import { useMemo } from 'react';
import { useGameEventsQuery } from '#/entities/game';
import { UnitToken } from '#/entities/game-assets';
import { UserAvatar } from '#/entities/user';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import CLOSE from '../assets/historyClose.svg';
import LOADING from '../assets/replayLoading.svg';
import { getTurnDetails } from '../model/getTurnDetails';
import classes from './TurnHistoryDetail.module.scss';

interface Props {
  eventSequence: number;
  gameId: string;
  onClose(this: void): void;
  onView?(this: void, sequence: number): void;
  profile: LobbyGamePlayer;
  sequence: number;
  userId: string;
}

export function TurnHistoryDetail(props: Props) {
  const { eventSequence, gameId, onClose, onView, profile, sequence, userId } =
    props;

  const { t } = useTranslation('widgets/turn-queue', {
    keyPrefix: 'TurnHistoryDetail',
  });
  const { t: tUnit } = useTranslation('entities/game-assets', {
    keyPrefix: 'units',
  });
  const { data, error, isPending, refetch } = useGameEventsQuery({
    enabled: true,
    eventSequence,
    gameId,
    userId,
  });
  const detail = useMemo(() => {
    if (data === undefined) {
      return null;
    }

    try {
      return getTurnDetails(data.events, sequence);
    } catch {
      return null;
    }
  }, [data, sequence]);
  const unitName =
    detail?.unitId === null || detail?.unitId === undefined
      ? ''
      : tUnit(detail.unitId);
  let coordinates: string | null = null;

  if (detail?.cellId !== null && detail?.cellId !== undefined) {
    coordinates = detail.cellId;

    if (detail.fromCellId !== null) {
      coordinates = `${detail.fromCellId} → ${detail.cellId}`;
    }
  }

  return (
    <section
      aria-busy={isPending}
      aria-label={t('label')}
      className={classes.card}
      role="dialog"
    >
      <div className={classes.metadataRow}>
        <p className={classes.metadata}>
          {detail === null
            ? t('label')
            : t('metadata', { turn: detail.moveNumber, round: detail.round })}
        </p>
        <button
          aria-label={t('close')}
          className={classes.close}
          onClick={onClose}
          type="button"
        >
          <img alt="" src={CLOSE} />
        </button>
      </div>

      <div className={classes.player}>
        <UserAvatar size="small" user={profile} />
        <p>
          {profile.displayName} · {t(`teams.${profile.team}`)}
        </p>
      </div>

      {isPending ? (
        <div className={classes.loading} role="status">
          <img alt="" src={LOADING} />
          {t('loading')}
        </div>
      ) : error !== null || detail === null ? (
        <>
          <p className={classes.error} role="alert">
            {error ?? t('unavailable')}
          </p>
          <Button
            onClick={() => {
              void refetch();
            }}
            variant="secondary"
          >
            {t('retry')}
          </Button>
        </>
      ) : (
        <>
          <div className={classes.action} data-action={detail.action}>
            {detail.unitId === null ? null : (
              <UnitToken color="brass" size="compact" unit={detail.unitId} />
            )}
            <strong>{t(`actions.${detail.action}`)}</strong>
          </div>

          {coordinates === null ? null : (
            <p className={classes.coordinates} data-action={detail.action}>
              {coordinates}
            </p>
          )}
          {(detail.maneuvers ?? []).map((maneuver) => (
            <p
              className={classes.coordinates}
              data-action="move"
              key={maneuver.battlefieldUnitId}
            >
              {maneuver.fromCellId} → {maneuver.cellId}
            </p>
          ))}
          <p className={classes.result}>
            {t(`results.${detail.action}`, {
              cell: detail.cellId ?? '',
              unit: unitName,
            })}
          </p>

          {onView === undefined ? null : (
            <Button className={classes.view} onClick={() => onView(sequence)}>
              {t('showTurn')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
