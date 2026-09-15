import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type { UnitId } from '@war-chest/game-engine';
import clsx from 'clsx';
import { VerticalUnitCardImage } from '#/entities/game-assets';
import { UserAvatar } from '#/entities/user';
import { useTranslation } from '#/shared/i18n/useTranslation';
import classes from './CardSelectionCard.module.scss';

interface Props {
  action: 'ban' | 'pick' | undefined;
  disabled: boolean;
  isAlly: boolean;
  isCandidate: boolean;
  isOwn: boolean;
  onSelect(this: void): void;
  owner: LobbyGamePlayer | undefined;
  unitId: UnitId;
}

export function CardSelectionCard(props: Props) {
  const {
    action,
    disabled,
    isAlly,
    isCandidate,
    isOwn,
    onSelect,
    owner,
    unitId,
  } = props;

  const { i18n, t } = useTranslation('pages/active-game', {
    keyPrefix: 'CardSelectionPage',
  });

  const language = i18n.resolvedLanguage === 'ru' ? 'ru' : 'en';
  const status = getStatus();

  return (
    <button
      aria-label={`${t(`units.${unitId}`)} · ${status}`}
      aria-pressed={isCandidate}
      className={clsx(classes.card, {
        [classes.candidate]: isCandidate,
        [classes.banned]: action === 'ban',
        [classes.picked]: action === 'pick',
        [classes.own]: action === 'pick' && isOwn,
      })}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <VerticalUnitCardImage
        alt=""
        className={classes.artwork}
        language={language}
        size="responsive"
        unit={unitId}
      />
      <span className={classes.status}>{status}</span>
      {owner === undefined ? null : <UserAvatar user={owner} />}
    </button>
  );

  function getStatus(): string {
    if (action === 'ban') {
      return t('banned');
    }

    if (action === 'pick') {
      if (isOwn) {
        return t('selectedByYou');
      }

      if (isAlly) {
        return t('selectedByAlly');
      }

      return t('selectedByOpponent');
    }

    if (isCandidate) {
      return t('candidate');
    }

    return t('available');
  }
}
