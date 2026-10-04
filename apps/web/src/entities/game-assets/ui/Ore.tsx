import clsx from 'clsx';
import GAME_ASSETS_LAYOUT from '../assets/gameAssets.json';
import GAME_ASSETS_IMAGE from '../assets/gameAssets.webp';
import ORE_UNDER_UNIT_CYAN from '../assets/oreUnderUnitCyan.svg';
import ORE_UNDER_UNIT_NEUTRAL from '../assets/oreUnderUnitNeutral.svg';
import ORE_UNDER_UNIT_RED from '../assets/oreUnderUnitRed.svg';
import type { OreColor } from '../model/gameAssetTypes';
import { AvailableMoveHighlight } from './AvailableMoveHighlight';
import { Fortification } from './Fortification';
import { SpriteImage } from './SpriteImage';
import classes from './Ore.module.scss';

const ORE_ASSETS = {
  cyan: GAME_ASSETS_LAYOUT.assets.oreCyan,
  neutral: GAME_ASSETS_LAYOUT.assets.oreNeutral,
  red: GAME_ASSETS_LAYOUT.assets.oreRed,
};
const ORE_UNDER_UNIT_ASSETS = {
  cyan: ORE_UNDER_UNIT_CYAN,
  neutral: ORE_UNDER_UNIT_NEUTRAL,
  red: ORE_UNDER_UNIT_RED,
};

interface Props {
  alt?: string;
  availableToMove?: boolean;
  className?: string;
  color: OreColor;
  fortified: boolean;
  size?: 'compact' | 'large';
  underUnit: boolean;
}

export function Ore(props: Props) {
  const {
    alt = '',
    availableToMove = false,
    className,
    color,
    fortified,
    size = 'large',
    underUnit,
  } = props;

  return (
    <span className={clsx(classes.ore, classes[size], className)}>
      {availableToMove && (
        <AvailableMoveHighlight
          className={classes.availableMoveHighlight}
          size={size}
        />
      )}
      <SpriteImage
        alt={alt}
        asset={ORE_ASSETS[color]}
        className={classes.image}
        imageSource={GAME_ASSETS_IMAGE}
        layout={GAME_ASSETS_LAYOUT}
      />
      {fortified && (
        <Fortification
          alt=""
          broken={false}
          className={classes.fortification}
        />
      )}
      {underUnit && (
        <img
          alt=""
          aria-hidden="true"
          className={classes.underUnitSelection}
          src={ORE_UNDER_UNIT_ASSETS[color]}
        />
      )}
    </span>
  );
}
