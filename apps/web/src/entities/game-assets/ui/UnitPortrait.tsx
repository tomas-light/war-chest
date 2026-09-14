import clsx from 'clsx';
import UNIT_PORTRAITS_LAYOUT from '../assets/unitPortraits.json';
import UNIT_PORTRAITS_IMAGE from '../assets/unitPortraits.webp';
import type { UnitId } from '../model/gameAssetTypes';
import { SpriteImage } from './SpriteImage';
import classes from './UnitPortrait.module.scss';

interface Props {
  alt?: string;
  className?: string;
  size?: 'compact' | 'large' | 'regular';
  unit: UnitId;
}

export function UnitPortrait(props: Props) {
  const { alt = '', className, size = 'regular', unit } = props;

  return (
    <SpriteImage
      alt={alt}
      asset={UNIT_PORTRAITS_LAYOUT.assets[unit]}
      className={clsx(classes.image, classes[size], className)}
      imageSource={UNIT_PORTRAITS_IMAGE}
      layout={UNIT_PORTRAITS_LAYOUT}
    />
  );
}
