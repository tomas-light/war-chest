import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type {
  GameViewPlayer,
  GameViewPlayerBattlefieldResources,
  UnitId,
} from '@war-chest/game-engine';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import {
  GameTokenBack,
  GameTokenBag,
  InitiativeToken,
  UnitToken,
} from '#/entities/game-assets';
import { UserAvatar, UserProfileLink } from '#/entities/user';
import { useTranslation } from '#/shared/i18n/useTranslation';
import eliminatedCross from '../assets/eliminatedCross.svg';
import emptyHandSlot from '../assets/emptyHandSlot.png';
import classes from './PlayerPanel.module.scss';

interface Props {
  hasInitiative: boolean;
  isCurrent?: boolean;
  label: string;
  mobileSwitchControl?: ReactNode;
  player: GameViewPlayer | undefined;
  profile: LobbyGamePlayer | undefined;
  resources: GameViewPlayerBattlefieldResources | undefined;
}

export function PlayerPanel(props: Props) {
  const {
    hasInitiative,
    isCurrent = false,
    label,
    mobileSwitchControl,
    player,
    profile,
    resources,
  } = props;
  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'PlayerPanel',
  });

  return (
    <article className={classes.playerPanel} data-current={isCurrent}>
      <div className={classes.topRow}>
        <div className={classes.identity}>
          <span className={classes.avatarWrap}>
            {profile === undefined ? (
              <span aria-hidden="true" className={classes.emptyAvatar} />
            ) : (
              <UserAvatar
                className={classes.playerAvatar}
                size="large"
                user={profile}
              />
            )}
            {hasInitiative ? (
              <InitiativeToken
                alt={t('initiative')}
                className={classes.initiativeToken}
                size="small"
              />
            ) : null}
          </span>
          <div className={classes.profile}>
            <span>{label}</span>
            <strong>
              {profile === undefined ? (
                player === undefined ? (
                  t('empty')
                ) : (
                  t('playerFallback', { playerId: player.id.slice(0, 8) })
                )
              ) : (
                <UserProfileLink user={profile} />
              )}
            </strong>
            <small>{getPresenceLabel()}</small>
          </div>
        </div>

        <div className={classes.privateResources}>
          <span className={classes.bag}>
            <GameTokenBag alt={t('bag')} />
            {isCurrent && resources?.bagCount !== null ? (
              <strong>{resources?.bagCount ?? 0}</strong>
            ) : null}
          </span>
          <div className={classes.hand}>
            <strong>{t('hand', { count: resources?.handCount ?? 0 })}</strong>
            <div className={classes.handSlots}>
              {Array.from({ length: 3 }, (_, index) => (
                <HandSlot
                  index={index}
                  isPrivate={
                    resources?.hand !== null && resources?.hand !== undefined
                  }
                  key={index}
                  unitId={resources?.hand?.[index]}
                  visibleCount={resources?.handCount ?? 0}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {resources === undefined ? null : (
        <div className={classes.publicResources}>
          <ResourceSection
            items={resources.supply}
            label={t('supply')}
            variant="supply"
          />
          {resources.eliminated.length === 0 ? null : (
            <ResourceSection
              items={resources.supply
                .map((item) => ({
                  ...item,
                  count: resources.eliminated.filter(
                    (unitId) => unitId === item.unitId
                  ).length,
                }))
                .filter((item) => item.count > 0)}
              label={t('eliminated')}
              variant="eliminated"
            />
          )}
          {mobileSwitchControl === undefined ? null : (
            <span className={classes.mobileSwitchControl}>
              {mobileSwitchControl}
            </span>
          )}
        </div>
      )}
    </article>
  );

  function getPresenceLabel(): string {
    if (player === undefined) {
      return t('noPlayer');
    }

    if (player.presence === 'connected') {
      return player.team === 'white' ? t('whiteTeam') : t('blackTeam');
    }

    return player.presence === 'disconnected' ? t('disconnected') : t('left');
  }
}

interface HandSlotProps {
  index: number;
  isPrivate: boolean;
  unitId: UnitId | undefined;
  visibleCount: number;
}

function HandSlot(props: HandSlotProps) {
  const { index, isPrivate, unitId, visibleCount } = props;

  if (unitId !== undefined) {
    return <UnitToken color="brass" size="regular" unit={unitId} />;
  }

  if (!isPrivate && index < visibleCount) {
    return <GameTokenBack />;
  }

  return <img alt="" className={classes.emptyHandSlot} src={emptyHandSlot} />;
}

interface ResourceItem {
  count: number;
  total: number;
  unitId: UnitId;
}

interface ResourceSectionProps {
  items: readonly ResourceItem[];
  label: string;
  variant: 'eliminated' | 'supply';
}

function ResourceSection(props: ResourceSectionProps) {
  const { items, label, variant } = props;
  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'PlayerPanel',
  });

  return (
    <section className={classes.resourceSection}>
      <h3>{label}</h3>
      <div className={classes.resourceItems}>
        {items.map((item) => (
          <span className={classes.resourceItem} key={item.unitId}>
            <span className={classes.resourceToken}>
              <UnitToken
                className={clsx(classes.resourceUnitToken, {
                  [classes.eliminatedUnitToken]: variant === 'eliminated',
                })}
                color="brass"
                size="regular"
                unit={item.unitId}
              />
              {variant === 'eliminated' ? (
                <span className={classes.eliminatedMarker}>
                  <img alt="" src={eliminatedCross} />
                </span>
              ) : null}
            </span>
            <strong
              className={clsx({
                [classes.eliminatedCount]: variant === 'eliminated',
              })}
            >
              {t('unitCount', { count: item.count, total: item.total })}
            </strong>
          </span>
        ))}
      </div>
    </section>
  );
}
