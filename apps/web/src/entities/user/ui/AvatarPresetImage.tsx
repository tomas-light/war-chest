import type { AvatarPresetId } from '@war-chest/api-contracts';
import clsx from 'clsx';
import type { ReactEventHandler } from 'react';
import SPRITE_LAYOUT from '../assets/avatarPresets.json';
import AVATAR_PRESETS_IMAGE from '../assets/avatarPresets.png';
import classes from './AvatarPresetImage.module.scss';

interface Props {
  className?: string;
  onError?: ReactEventHandler<HTMLImageElement>;
  presetId: AvatarPresetId;
}

export function AvatarPresetImage(props: Props) {
  const { className, onError, presetId } = props;
  const presetIndex = SPRITE_LAYOUT.presetIds.indexOf(presetId);
  const column = presetIndex % SPRITE_LAYOUT.columns;
  const row = Math.floor(presetIndex / SPRITE_LAYOUT.columns);

  return (
    <span aria-hidden="true" className={clsx(classes.image, className)}>
      <img
        alt=""
        className={classes.sprite}
        draggable={false}
        onError={onError}
        src={AVATAR_PRESETS_IMAGE}
        style={{
          height: `${SPRITE_LAYOUT.rows * 100}%`,
          left: `${-column * 100}%`,
          top: `${-row * 100}%`,
          width: `${SPRITE_LAYOUT.columns * 100}%`,
        }}
      />
    </span>
  );
}
