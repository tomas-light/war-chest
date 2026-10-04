import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import clsx from 'clsx';
import { UserAvatar } from '#/entities/user';
import { useTranslation } from '#/shared/i18n/useTranslation';
import FOCUS from '../assets/replayControlsFocus.svg';
import PAUSE from '../assets/replayControlsPause.svg';
import PLAY from '../assets/replayControlsPlay.svg';
import PRESSED from '../assets/replayControlsPressed.svg';
import RETRY from '../assets/replayControlsRetry.svg';
import LOADING from '../assets/replayLoading.svg';
import classes from './CurrentTurnAnchor.module.scss';

interface Props {
  error?: string | null;
  onPause(this: void): void;
  onPlay(this: void): void;
  onReturnToLive(this: void): void;
  onRetry(this: void): void;
  profile: LobbyGamePlayer;
  status: 'idle' | 'review' | 'loading' | 'playing' | 'paused' | 'error';
  turnNumber: number;
  viewedTurnNumber: number;
}

export function CurrentTurnAnchor(props: Props) {
  const {
    error,
    onPause,
    onPlay,
    onReturnToLive,
    onRetry,
    profile,
    status,
    turnNumber,
    viewedTurnNumber,
  } = props;
  const { t } = useTranslation('widgets/turn-queue', {
    keyPrefix: 'CurrentTurnAnchor',
  });

  let controls = PLAY;
  let label = t('play');
  let onAction = onPlay;
  let caption = t('turn', { turnNumber });

  if (status === 'playing') {
    controls = PAUSE;
    label = t('pause');
    onAction = onPause;
    caption = t('progress', { from: viewedTurnNumber, to: turnNumber });
  } else if (status === 'paused') {
    caption = t('paused');
  } else if (status === 'error') {
    controls = RETRY;
    label = t('retry');
    onAction = onRetry;
    caption = t('error');
  } else if (status === 'loading') {
    caption = t('loading');
  }
  const isPlayAction = controls === PLAY;

  return (
    <div className={classes.anchor} data-state={status}>
      <strong className={classes.label}>{t('now')}</strong>

      <span className={classes.avatar}>
        <UserAvatar size="medium" user={profile} />
      </span>

      {status === 'loading' ? (
        <span aria-hidden="true" className={classes.loading}>
          <img alt="" src={LOADING} />
        </span>
      ) : (
        <div
          className={clsx(classes.controls, {
            [classes.playControls]: isPlayAction,
          })}
        >
          <img alt="" className={classes.controlsImage} src={controls} />
          {isPlayAction ? (
            <>
              <img alt="" className={classes.focusImage} src={FOCUS} />
              <img alt="" className={classes.pressedImage} src={PRESSED} />
            </>
          ) : null}
          <button aria-label={label} onClick={onAction} type="button" />
          <button
            aria-label={t('returnToLive')}
            onClick={onReturnToLive}
            type="button"
          />
        </div>
      )}

      <span
        aria-live="polite"
        className={classes.caption}
        title={error ?? undefined}
      >
        {caption}
      </span>
      {error ? (
        <span className={classes.accessibleError} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
