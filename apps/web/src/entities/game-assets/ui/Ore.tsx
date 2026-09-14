import clsx from 'clsx';
import GAME_ASSETS_LAYOUT from '../assets/gameAssets.json';
import GAME_ASSETS_IMAGE from '../assets/gameAssets.webp';
import type { OreColor } from '../model/gameAssetTypes';
import { Fortification } from './Fortification';
import { SpriteImage } from './SpriteImage';
import classes from './Ore.module.scss';

const ORE_ASSETS = {
  cyan: GAME_ASSETS_LAYOUT.assets.oreCyan,
  neutral: GAME_ASSETS_LAYOUT.assets.oreNeutral,
  red: GAME_ASSETS_LAYOUT.assets.oreRed,
};

interface Props {
  alt?: string;
  className?: string;
  color: OreColor;
  fortified: boolean;
  size?: 'compact' | 'large';
  underUnit: boolean;
}

export function Ore(props: Props) {
  const {
    alt = '',
    className,
    color,
    fortified,
    size = 'large',
    underUnit,
  } = props;
  return (
    <span className={clsx(classes.ore, classes[size], className)}>
      {underUnit && (
        <span
          aria-hidden="true"
          className={clsx(classes.markers, classes[color])}
        >
          <span />
          <span />
          <span />
          <span />
        </span>
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
    </span>
  );
}
