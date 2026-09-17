import clsx from 'clsx';
import ENGLISH_CARDS_LAYOUT from '../assets/unitCards.en.json';
import ENGLISH_CARDS_IMAGE from '../assets/unitCards.en.webp';
import RUSSIAN_CARDS_LAYOUT from '../assets/unitCards.ru.json';
import RUSSIAN_CARDS_IMAGE from '../assets/unitCards.ru.webp';
import COMPACT_ENGLISH_CARDS_LAYOUT from '../assets/unitCardsCompact.en.json';
import COMPACT_ENGLISH_CARDS_IMAGE from '../assets/unitCardsCompact.en.webp';
import COMPACT_RUSSIAN_CARDS_LAYOUT from '../assets/unitCardsCompact.ru.json';
import COMPACT_RUSSIAN_CARDS_IMAGE from '../assets/unitCardsCompact.ru.webp';
import type { UnitCardLanguage, UnitId } from '../model/gameAssetTypes';
import { SpriteImage } from './SpriteImage';
import classes from './VerticalUnitCardArtwork.module.scss';

interface Props {
  alt?: string;
  className?: string;
  language: UnitCardLanguage;
  size?: 'compact' | 'large' | 'regular' | 'responsive';
  unit: UnitId;
}

export function VerticalUnitCardArtwork(props: Props) {
  const { alt = '', className, language, size = 'regular', unit } = props;

  const layout =
    language === 'ru' ? RUSSIAN_CARDS_LAYOUT : ENGLISH_CARDS_LAYOUT;
  const imageSource =
    language === 'ru' ? RUSSIAN_CARDS_IMAGE : ENGLISH_CARDS_IMAGE;
  const compactLayout =
    language === 'ru'
      ? COMPACT_RUSSIAN_CARDS_LAYOUT
      : COMPACT_ENGLISH_CARDS_LAYOUT;
  const compactImageSource =
    language === 'ru'
      ? COMPACT_RUSSIAN_CARDS_IMAGE
      : COMPACT_ENGLISH_CARDS_IMAGE;
  const hasCompactArtwork = size === 'responsive';

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
          asset={compactLayout.assets[unit]}
          className={clsx(classes.image, classes.mobileArtwork, className)}
          imageSource={compactImageSource}
          layout={compactLayout}
        />
      ) : null}
    </>
  );
}
