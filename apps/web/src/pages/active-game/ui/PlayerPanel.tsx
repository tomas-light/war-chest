import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type {
  GameCoin,
  GameViewDiscardedCoin,
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
  RoyalToken,
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
  onHandCoinClick?(this: void, input: HandCoinClickInput): void;
  player: GameViewPlayer | undefined;
  profile: LobbyGamePlayer | undefined;
  resources: GameViewPlayerBattlefieldResources | undefined;
  selectedCoinIndex?: number | null;
}

export interface HandCoinClickInput {
  anchorElement: HTMLButtonElement;
  coin: GameCoin;
  index: number;
}

export function PlayerPanel(props: Props) {
  const {
    hasInitiative,
    isCurrent = false,
    label,
    mobileSwitchControl,
    onHandCoinClick,
    player,
    profile,
    resources,
    selectedCoinIndex = null,
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
                  coin={resources?.hand?.[index]}
                  index={index}
                  isPrivate={
                    resources?.hand !== null && resources?.hand !== undefined
                  }
                  key={index}
                  onCoinClick={onHandCoinClick}
                  selected={selectedCoinIndex === index}
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
          {resources.discard.length === 0 ? null : (
            <DiscardSection items={resources.discard} label={t('discard')} />
          )}
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
  coin: GameCoin | undefined;
  index: number;
  isPrivate: boolean;
  onCoinClick?(this: void, input: HandCoinClickInput): void;
  selected: boolean;
  visibleCount: number;
}

function HandSlot(props: HandSlotProps) {
  const { coin, index, isPrivate, onCoinClick, selected, visibleCount } = props;
  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'PlayerPanel',
  });

  if (coin !== undefined) {
    if (onCoinClick === undefined) {
      return <CoinToken coin={coin} />;
    }

    return (
      <button
        aria-label={getCoinLabel()}
        aria-pressed={selected}
        className={classes.handCoinButton}
        onClick={(event) =>
          onCoinClick({
            anchorElement: event.currentTarget,
            coin,
            index,
          })
        }
        type="button"
      >
        <CoinToken coin={coin} />
      </button>
    );
  }

  if (!isPrivate && index < visibleCount) {
    return <GameTokenBack />;
  }

  return <img alt="" className={classes.emptyHandSlot} src={emptyHandSlot} />;

  function getCoinLabel(): string {
    if (coin?.kind === 'royal') {
      return t('royalCoin', { number: index + 1 });
    }

    return t('unitCoin', { number: index + 1, unitId: coin?.unitId ?? '' });
  }
}

interface CoinTokenProps {
  coin: GameCoin;
}

function CoinToken(props: CoinTokenProps) {
  const { coin } = props;

  if (coin.kind === 'royal') {
    return <RoyalToken />;
  }

  return <UnitToken color="brass" size="regular" unit={coin.unitId} />;
}

interface DiscardSectionProps {
  items: readonly GameViewDiscardedCoin[];
  label: string;
}

function DiscardSection(props: DiscardSectionProps) {
  const { items, label } = props;
  const topItem = items.at(-1);

  return (
    <section className={clsx(classes.resourceSection, classes.discardSection)}>
      <h3>{label}</h3>
      <span className={classes.discardPile}>
        <span className={classes.discardCoin}>
          {topItem?.coin === null || topItem === undefined ? (
            <GameTokenBack />
          ) : (
            <CoinToken coin={topItem.coin} />
          )}
        </span>
        <strong>{items.length}</strong>
      </span>
    </section>
  );
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
