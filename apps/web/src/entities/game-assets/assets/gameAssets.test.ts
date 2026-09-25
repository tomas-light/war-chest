import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { UNIT_IDS } from '../model/gameAssetTypes';
import GAME_ASSETS_LAYOUT from './gameAssets.json';
import ENGLISH_CARDS_LAYOUT from './unitCards.en.json';
import RUSSIAN_CARDS_LAYOUT from './unitCards.ru.json';
import COMPACT_ENGLISH_CARDS_LAYOUT from './unitCardsCompact.en.json';
import COMPACT_RUSSIAN_CARDS_LAYOUT from './unitCardsCompact.ru.json';
import UNIT_PORTRAITS_LAYOUT from './unitPortraits.json';

describe('game sprite manifests', () => {
  test('contains one portrait for every supported unit', () => {
    expect(Object.keys(UNIT_PORTRAITS_LAYOUT.assets)).toEqual(UNIT_IDS);
  });

  test('contains the same complete unit set in each localized card sprite', () => {
    expect(Object.keys(ENGLISH_CARDS_LAYOUT.assets)).toEqual(UNIT_IDS);
    expect(Object.keys(RUSSIAN_CARDS_LAYOUT.assets)).toEqual(UNIT_IDS);
    expect(Object.keys(COMPACT_ENGLISH_CARDS_LAYOUT.assets)).toEqual(UNIT_IDS);
    expect(Object.keys(COMPACT_RUSSIAN_CARDS_LAYOUT.assets)).toEqual(UNIT_IDS);
  });

  test('contains every unit token in every supported color', () => {
    const expectedTokenKeys = ['brass', 'cyan', 'red'].flatMap((color) =>
      UNIT_IDS.map((unitId) => `unitToken.${color}.${unitId}`)
    );
    const actualTokenKeys = Object.keys(GAME_ASSETS_LAYOUT.assets).filter(
      (assetKey) => assetKey.startsWith('unitToken.')
    );

    expect(actualTokenKeys).toEqual(expectedTokenKeys);
  });

  test('contains only base ore and independently composable game assets', () => {
    const expectedTokenKeys = ['brass', 'cyan', 'red'].flatMap((color) =>
      UNIT_IDS.map((unitId) => `unitToken.${color}.${unitId}`)
    );

    expect(Object.keys(GAME_ASSETS_LAYOUT.assets)).toEqual([
      ...expectedTokenKeys,
      'initiative',
      'tokenBack',
      'tokenBag',
      'heartIntact',
      'heartBroken',
      'fortification',
      'fortificationBroken',
      'oreNeutral',
      'oreCyan',
      'oreRed',
    ]);
  });

  test('stores portraits at twice their 112 pixel maximum rendered size', () => {
    for (const asset of Object.values(UNIT_PORTRAITS_LAYOUT.assets)) {
      expect(asset).toMatchObject({ height: 224, width: 224 });
    }
  });

  test('stores cards at twice their 200 pixel maximum rendered width', () => {
    for (const layout of [ENGLISH_CARDS_LAYOUT, RUSSIAN_CARDS_LAYOUT]) {
      for (const asset of Object.values(layout.assets)) {
        expect(asset).toMatchObject({ height: 534, width: 400 });
      }
    }
  });

  test('stores compact cards at twice their 150 pixel source width', () => {
    for (const layout of [
      COMPACT_ENGLISH_CARDS_LAYOUT,
      COMPACT_RUSSIAN_CARDS_LAYOUT,
    ]) {
      for (const asset of Object.values(layout.assets)) {
        expect(asset).toMatchObject({ height: 400, width: 300 });
      }
    }
  });

  test('stores board pieces at twice their 140 pixel maximum rendered size', () => {
    const boardAssetKeys = Object.keys(GAME_ASSETS_LAYOUT.assets).filter(
      (assetKey) =>
        assetKey.startsWith('unitToken.') ||
        assetKey.startsWith('fortification') ||
        assetKey.startsWith('ore')
    ) as (keyof typeof GAME_ASSETS_LAYOUT.assets)[];

    for (const assetKey of boardAssetKeys) {
      expect(GAME_ASSETS_LAYOUT.assets[assetKey]).toMatchObject({
        height: 280,
        width: 280,
      });
    }
  });

  test('stores small markers at twice their maximum rendered sizes', () => {
    expect(GAME_ASSETS_LAYOUT.assets.initiative).toMatchObject({
      height: 128,
      width: 128,
    });
    expect(GAME_ASSETS_LAYOUT.assets.tokenBack).toMatchObject({
      height: 128,
      width: 128,
    });
    expect(GAME_ASSETS_LAYOUT.assets.tokenBag).toMatchObject({
      height: 144,
      width: 144,
    });
    expect(GAME_ASSETS_LAYOUT.assets.heartIntact).toMatchObject({
      height: 24,
      width: 26,
    });
    expect(GAME_ASSETS_LAYOUT.assets.heartBroken).toMatchObject({
      height: 24,
      width: 26,
    });
  });

  test('keeps each manifest entry inside its sprite bounds', () => {
    const layouts = [
      GAME_ASSETS_LAYOUT,
      ENGLISH_CARDS_LAYOUT,
      RUSSIAN_CARDS_LAYOUT,
      COMPACT_ENGLISH_CARDS_LAYOUT,
      COMPACT_RUSSIAN_CARDS_LAYOUT,
      UNIT_PORTRAITS_LAYOUT,
    ];

    for (const layout of layouts) {
      for (const asset of Object.values(layout.assets)) {
        expect(asset.x + asset.width).toBeLessThanOrEqual(layout.width);
        expect(asset.y + asset.height).toBeLessThanOrEqual(layout.height);
      }
    }
  });
});

describe('game sprite images', () => {
  test.each([
    ['gameAssets', GAME_ASSETS_LAYOUT],
    ['unitCards.en', ENGLISH_CARDS_LAYOUT],
    ['unitCards.ru', RUSSIAN_CARDS_LAYOUT],
    ['unitCardsCompact.en', COMPACT_ENGLISH_CARDS_LAYOUT],
    ['unitCardsCompact.ru', COMPACT_RUSSIAN_CARDS_LAYOUT],
    ['unitPortraits', UNIT_PORTRAITS_LAYOUT],
  ])(
    'matches the generated %s manifest dimensions',
    async (fileName, layout) => {
      const bytes = await readFile(
        new URL(`./${fileName}.webp`, import.meta.url)
      );
      const metadata = await sharp(bytes).metadata();

      expect(metadata.format).toBe('webp');
      expect(metadata.hasAlpha).toBe(true);
      expect(metadata.width).toBe(layout.width);
      expect(metadata.height).toBe(layout.height);
    }
  );

  test.each([
    ['unitCards.en', ENGLISH_CARDS_LAYOUT],
    ['unitCards.ru', RUSSIAN_CARDS_LAYOUT],
    ['unitCardsCompact.en', COMPACT_ENGLISH_CARDS_LAYOUT],
    ['unitCardsCompact.ru', COMPACT_RUSSIAN_CARDS_LAYOUT],
  ])(
    'stores artwork without the brass frame and divider in %s',
    async (fileName, layout) => {
      const bytes = await readFile(
        new URL(`./${fileName}.webp`, import.meta.url)
      );
      const { data, info } = await sharp(bytes)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      for (const asset of Object.values(layout.assets)) {
        const centerX = asset.x + Math.floor(asset.width / 2);
        const centerY = asset.y + Math.floor(asset.height / 2);
        const dividerY = asset.y + (asset.width === 400 ? 80 : 60);
        const dividerX = asset.x + Math.floor(asset.width * 0.75);

        expect(getRed(centerX, asset.y + 1)).toBeLessThan(120);
        expect(getRed(asset.x + 1, centerY)).toBeLessThan(120);
        expect(getRed(dividerX, dividerY)).toBeLessThan(120);
        expect(getAlpha(centerX, centerY)).toBe(255);
      }

      function getRed(x: number, y: number) {
        return data[(y * info.width + x) * info.channels];
      }

      function getAlpha(x: number, y: number) {
        return data[(y * info.width + x) * info.channels + 3];
      }
    }
  );

  test.each([
    ['gameAssets', GAME_ASSETS_LAYOUT],
    ['unitPortraits', UNIT_PORTRAITS_LAYOUT],
  ])(
    'keeps transparent corners around every asset in %s',
    async (fileName, layout) => {
      const bytes = await readFile(
        new URL(`./${fileName}.webp`, import.meta.url)
      );
      const { data, info } = await sharp(bytes)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      for (const asset of Object.values(layout.assets)) {
        const cornerAlphaValues = [
          getAlpha(asset.x, asset.y),
          getAlpha(asset.x + asset.width - 1, asset.y),
          getAlpha(asset.x, asset.y + asset.height - 1),
          getAlpha(asset.x + asset.width - 1, asset.y + asset.height - 1),
        ];

        expect(cornerAlphaValues).toEqual([0, 0, 0, 0]);
      }

      function getAlpha(x: number, y: number) {
        return data[(y * info.width + x) * info.channels + 3];
      }
    }
  );
});
