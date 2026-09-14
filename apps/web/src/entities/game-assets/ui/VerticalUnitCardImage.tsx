import clsx from 'clsx';
import ENGLISH_CARDS_LAYOUT from '../assets/unitCards.en.json';
import ENGLISH_CARDS_IMAGE from '../assets/unitCards.en.webp';
import RUSSIAN_CARDS_LAYOUT from '../assets/unitCards.ru.json';
import RUSSIAN_CARDS_IMAGE from '../assets/unitCards.ru.webp';
import type { UnitCardLanguage, UnitId } from '../model/gameAssetTypes';
import { SpriteImage } from './SpriteImage';
import classes from './VerticalUnitCardImage.module.scss';

interface Props {
  alt?: string;
  className?: string;
  language: UnitCardLanguage;
  size?: 'compact' | 'large' | 'regular';
  unit: UnitId;
}

export function VerticalUnitCardImage(props: Props) {
  const { alt = '', className, language, size = 'regular', unit } = props;
  const layout =
    language === 'ru' ? RUSSIAN_CARDS_LAYOUT : ENGLISH_CARDS_LAYOUT;
  const imageSource =
    language === 'ru' ? RUSSIAN_CARDS_IMAGE : ENGLISH_CARDS_IMAGE;

  return (
    <SpriteImage
      alt={alt}
      asset={layout.assets[unit]}
      className={clsx(classes.image, classes[size], className)}
      imageSource={imageSource}
      layout={layout}
    />
  );
}
