import clsx from 'clsx';
import type { CSSProperties } from 'react';
import classes from './SpriteImage.module.scss';

interface SpriteAssetLayout {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface SpriteLayout {
  height: number;
  width: number;
}

interface Props {
  alt: string;
  asset: SpriteAssetLayout;
  className?: string;
  imageSource: string;
  layout: SpriteLayout;
}

type ImageStyle = CSSProperties & {
  '--wc-sprite-aspect-ratio': string;
};

export function SpriteImage(props: Props) {
  const { alt, asset, className, imageSource, layout } = props;
  const style: ImageStyle = {
    '--wc-sprite-aspect-ratio': `${asset.width} / ${asset.height}`,
  };

  return (
    <span
      aria-hidden={alt === '' ? 'true' : undefined}
      aria-label={alt === '' ? undefined : alt}
      className={clsx(classes.image, className)}
      role={alt === '' ? undefined : 'img'}
      style={style}
    >
      <img
        alt=""
        className={classes.sprite}
        draggable={false}
        src={imageSource}
        style={{
          height: `${(layout.height / asset.height) * 100}%`,
          left: `${(-asset.x / asset.width) * 100}%`,
          top: `${(-asset.y / asset.height) * 100}%`,
          width: `${(layout.width / asset.width) * 100}%`,
        }}
      />
    </span>
  );
}
