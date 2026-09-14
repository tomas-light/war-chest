import clsx from 'clsx';
import GAME_ASSETS_LAYOUT from '../assets/gameAssets.json';
import GAME_ASSETS_IMAGE from '../assets/gameAssets.webp';
import { SpriteImage } from './SpriteImage';
import classes from './Fortification.module.scss';

interface Props {
  alt?: string;
  broken: boolean;
  className?: string;
  size?: 'compact' | 'regular';
}

export function Fortification(props: Props) {
  const { alt = '', broken, className, size = 'regular' } = props;
  const asset = broken
    ? GAME_ASSETS_LAYOUT.assets.fortificationBroken
    : GAME_ASSETS_LAYOUT.assets.fortification;

  return (
    <SpriteImage
      alt={alt}
      asset={asset}
      className={clsx(classes[size], className)}
      imageSource={GAME_ASSETS_IMAGE}
      layout={GAME_ASSETS_LAYOUT}
    />
  );
}
