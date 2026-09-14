import { readFile } from 'node:fs/promises';
import { AVATAR_PRESETS } from '@war-chest/api-contracts';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import SPRITE_LAYOUT from './avatarPresets.json';

describe('avatar sprite asset', () => {
  test('contains exactly one cell for every selectable preset', () => {
    expect(SPRITE_LAYOUT.presetIds).toEqual(AVATAR_PRESETS);
    expect(new Set(SPRITE_LAYOUT.presetIds).size).toBe(AVATAR_PRESETS.length);
  });

  test('provides a transparent image in every 192 px cell', async () => {
    const bytes = await readFile(
      new URL('./avatarPresets.png', import.meta.url)
    );
    const { data, info } = await sharp(bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(info.width).toBe(SPRITE_LAYOUT.columns * SPRITE_LAYOUT.cellSize);
    expect(info.height).toBe(SPRITE_LAYOUT.rows * SPRITE_LAYOUT.cellSize);
    expect(SPRITE_LAYOUT.cellSize).toBe(192);

    for (const [index, presetId] of SPRITE_LAYOUT.presetIds.entries()) {
      const left = (index % SPRITE_LAYOUT.columns) * SPRITE_LAYOUT.cellSize;
      const top =
        Math.floor(index / SPRITE_LAYOUT.columns) * SPRITE_LAYOUT.cellSize;
      const cornerAlpha = data[(top * info.width + left) * 4 + 3];
      const centerAlpha = data[((top + 96) * info.width + left + 96) * 4 + 3];

      expect(cornerAlpha, `${presetId}: transparent corner`).toBe(0);
      expect(centerAlpha, `${presetId}: visible portrait`).toBe(255);
    }
  });
});
