import clsx from 'clsx';
import ENGLISH_CARDS_LAYOUT from '../assets/unitCards.en.json';
import ENGLISH_CARDS_IMAGE from '../assets/unitCards.en.webp';
import RUSSIAN_CARDS_LAYOUT from '../assets/unitCards.ru.json';
import RUSSIAN_CARDS_IMAGE from '../assets/unitCards.ru.webp';
import COMPACT_RUSSIAN_CARDS_LAYOUT from '../assets/unitCardsCompact.ru.json';
import COMPACT_RUSSIAN_CARDS_IMAGE from '../assets/unitCardsCompact.ru.webp';
import type { UnitCardLanguage, UnitId } from '../model/gameAssetTypes';
import { SpriteImage } from './SpriteImage';
import classes from './VerticalUnitCardImage.module.scss';

interface Props {
  alt?: string;
  className?: string;
  language: UnitCardLanguage;
  size?: 'compact' | 'large' | 'regular' | 'responsive';
  unit: UnitId;
}

export function VerticalUnitCardImage(props: Props) {
  const { alt = '', className, language, size = 'regular', unit } = props;

  const layout =
    language === 'ru' ? RUSSIAN_CARDS_LAYOUT : ENGLISH_CARDS_LAYOUT;
  const imageSource =
    language === 'ru' ? RUSSIAN_CARDS_IMAGE : ENGLISH_CARDS_IMAGE;
  const hasCompactArtwork = language === 'ru' && size === 'responsive';

  return (
    <>
      <SpriteImage
        alt={alt}
        asset={layout.assets[unit]}
        className={clsx(classes.image, classes[size], className, {
          [classes.desktopArtwork]: hasCompactArtwork,
        })}
        imageSource={imageSource}
        layout={layout}
      />
      {hasCompactArtwork ? (
        <SpriteImage
          alt={alt}
          asset={COMPACT_RUSSIAN_CARDS_LAYOUT.assets[unit]}
          className={clsx(classes.image, classes.mobileArtwork, className)}
          imageSource={COMPACT_RUSSIAN_CARDS_IMAGE}
          layout={COMPACT_RUSSIAN_CARDS_LAYOUT}
        />
      ) : null}
    </>
  );
}
