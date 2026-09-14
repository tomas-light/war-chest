import clsx from 'clsx';
import GAME_ASSETS_LAYOUT from '../assets/gameAssets.json';
import GAME_ASSETS_IMAGE from '../assets/gameAssets.webp';
import { SpriteImage } from './SpriteImage';
import classes from './InitiativeToken.module.scss';

interface Props {
  alt?: string;
  className?: string;
  size?: 'large' | 'medium' | 'small';
}

export function InitiativeToken(props: Props) {
  const { alt = '', className, size = 'medium' } = props;

  return (
    <SpriteImage
      alt={alt}
      asset={GAME_ASSETS_LAYOUT.assets.initiative}
      className={clsx(classes[size], className)}
      imageSource={GAME_ASSETS_IMAGE}
      layout={GAME_ASSETS_LAYOUT}
    />
  );
}
