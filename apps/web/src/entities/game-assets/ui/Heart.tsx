import clsx from 'clsx';
import GAME_ASSETS_LAYOUT from '../assets/gameAssets.json';
import GAME_ASSETS_IMAGE from '../assets/gameAssets.webp';
import { SpriteImage } from './SpriteImage';
import classes from './Heart.module.scss';

interface Props {
  alt?: string;
  className?: string;
  size?: 'large' | 'regular';
  state: 'broken' | 'intact';
}

export function Heart(props: Props) {
  const { alt = '', className, size = 'regular', state } = props;
  const asset =
    state === 'intact'
      ? GAME_ASSETS_LAYOUT.assets.heartIntact
      : GAME_ASSETS_LAYOUT.assets.heartBroken;

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
