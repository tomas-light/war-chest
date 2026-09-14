import clsx from 'clsx';
import GAME_ASSETS_LAYOUT from '../assets/gameAssets.json';
import GAME_ASSETS_IMAGE from '../assets/gameAssets.webp';
import type { UnitId, UnitTokenColor } from '../model/gameAssetTypes';
import { SpriteImage } from './SpriteImage';
import classes from './UnitToken.module.scss';

interface Props {
  alt?: string;
  className?: string;
  color: UnitTokenColor;
  size?: 'compact' | 'large' | 'regular';
  unit: UnitId;
}

export function UnitToken(props: Props) {
  const { alt = '', className, color, size = 'regular', unit } = props;
  const assetKey = `unitToken.${color}.${unit}` as const;

  return (
    <SpriteImage
      alt={alt}
      asset={GAME_ASSETS_LAYOUT.assets[assetKey]}
      className={clsx(classes.image, classes[size], className)}
      imageSource={GAME_ASSETS_IMAGE}
      layout={GAME_ASSETS_LAYOUT}
    />
  );
}
