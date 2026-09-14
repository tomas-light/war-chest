import clsx from 'clsx';
import GAME_ASSETS_LAYOUT from '../assets/gameAssets.json';
import GAME_ASSETS_IMAGE from '../assets/gameAssets.webp';
import { SpriteImage } from './SpriteImage';
import classes from './GameTokenBack.module.scss';

interface Props {
  alt?: string;
  className?: string;
}

export function GameTokenBack(props: Props) {
  const { alt = '', className } = props;

  return (
    <SpriteImage
      alt={alt}
      asset={GAME_ASSETS_LAYOUT.assets.tokenBack}
      className={clsx(classes.image, className)}
      imageSource={GAME_ASSETS_IMAGE}
      layout={GAME_ASSETS_LAYOUT}
    />
  );
}
