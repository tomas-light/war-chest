import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const UNIT_IDS = [
  'archer',
  'berserker',
  'cavalry',
  'crossbowman',
  'ensign',
  'footman',
  'knight',
  'lancer',
  'lightCavalry',
  'marshal',
  'mercenary',
  'pikeman',
  'royalGuard',
  'scout',
  'swordsman',
  'warriorPriest',
];
const TOKEN_COLORS = ['brass', 'cyan', 'red'];
const MAX_SPRITE_WIDTH = 2048;
const SPRITE_PADDING = 2;
const ASSET_GAP = 4;
const OUTPUT_DIRECTORY = new URL(
  '../../src/entities/game-assets/assets/',
  import.meta.url
);

await buildGameAssetSprites();

async function buildGameAssetSprites() {
  const [, , sourceDirectory, scope] = process.argv;

  if (sourceDirectory === undefined) {
    throw new Error(
      'Pass the directory containing portraits, localized cards, tokens and common Figma exports.'
    );
  }

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  if (scope === '--compact-cards-only') {
    await buildSprite({
      entries: UNIT_IDS.map((unitId) => ({
        height: 400,
        key: unitId,
        sourcePath: resolve(
          sourceDirectory,
          'cards-compact-ru',
          `${unitId}.png`
        ),
        width: 300,
      })),
      fileName: 'unitCardsCompact.ru',
    });
    return;
  }

  if (scope !== '--cards-only') {
    await buildSprite({
      entries: UNIT_IDS.map((unitId) => ({
        height: 224,
        key: unitId,
        sourcePath: resolve(sourceDirectory, 'portraits', `${unitId}.png`),
        width: 224,
      })),
      fileName: 'unitPortraits',
    });
  }
  await buildSprite({
    entries: UNIT_IDS.map((unitId) => ({
      height: 534,
      key: unitId,
      sourcePath: resolve(sourceDirectory, 'cards-en', `${unitId}.png`),
      width: 400,
    })),
    fileName: 'unitCards.en',
  });
  await buildSprite({
    entries: UNIT_IDS.map((unitId) => ({
      height: 534,
      key: unitId,
      sourcePath: resolve(sourceDirectory, 'cards-ru', `${unitId}.png`),
      width: 400,
    })),
    fileName: 'unitCards.ru',
  });
  if (scope !== '--cards-only') {
    await buildSprite({
      entries: createGameplayEntries(sourceDirectory),
      fileName: 'gameAssets',
    });
  }
}

async function buildSprite(input) {
  const preparedEntries = await Promise.all(input.entries.map(prepareEntry));
  const layout = packEntries(preparedEntries);
  const image = await sharp({
    create: {
      background: 'transparent',
      channels: 4,
      height: layout.height,
      width: layout.width,
    },
  })
    .composite(
      layout.entries.map((entry) => ({
        input: entry.input,
        left: entry.x,
        top: entry.y,
      }))
    )
    .webp({ alphaQuality: 100, effort: 6, quality: 90, smartSubsample: true })
    .toFile(fileURLToPath(new URL(`${input.fileName}.webp`, OUTPUT_DIRECTORY)));
  const assets = Object.fromEntries(
    layout.entries.map((entry) => [
      entry.key,
      {
        height: entry.height,
        width: entry.width,
        x: entry.x,
        y: entry.y,
      },
    ])
  );

  await writeFile(
    new URL(`${input.fileName}.json`, OUTPUT_DIRECTORY),
    `${JSON.stringify({ assets, height: layout.height, width: layout.width }, null, 2)}\n`
  );
  process.stdout.write(
    `✅ Built ${input.fileName}: ${layout.entries.length} assets, ${image.width}×${image.height}, ${image.size} bytes.\n`
  );
}

async function prepareEntry(entry) {
  const metadata = await sharp(entry.sourcePath).metadata();

  if (metadata.format !== 'png' || !metadata.hasAlpha) {
    throw new Error(`${entry.key}: expected a PNG with an alpha channel.`);
  }

  const input = await sharp(entry.sourcePath)
    .resize(entry.width, entry.height, { fit: 'fill' })
    .ensureAlpha()
    .png()
    .toBuffer();
  const { channels } = await sharp(input).stats();
  const alphaChannel = channels[3];

  if (
    entry.requiresTransparency !== false &&
    (alphaChannel === undefined || alphaChannel.min !== 0)
  ) {
    throw new Error(`${entry.key}: expected transparent pixels from Figma.`);
  }

  return { ...entry, input };
}

function packEntries(entries) {
  const positionedEntries = [];
  let currentX = SPRITE_PADDING;
  let currentY = SPRITE_PADDING;
  let rowHeight = 0;
  let spriteWidth = 0;

  for (const entry of entries) {
    if (
      currentX > SPRITE_PADDING &&
      currentX + entry.width + SPRITE_PADDING > MAX_SPRITE_WIDTH
    ) {
      currentX = SPRITE_PADDING;
      currentY += rowHeight + ASSET_GAP;
      rowHeight = 0;
    }

    positionedEntries.push({ ...entry, x: currentX, y: currentY });
    currentX += entry.width + ASSET_GAP;
    rowHeight = Math.max(rowHeight, entry.height);
    spriteWidth = Math.max(spriteWidth, currentX - ASSET_GAP + SPRITE_PADDING);
  }

  return {
    entries: positionedEntries,
    height: currentY + rowHeight + SPRITE_PADDING,
    width: spriteWidth,
  };
}

function createGameplayEntries(sourceDirectory) {
  const tokenEntries = TOKEN_COLORS.flatMap((color) =>
    UNIT_IDS.map((unitId) => ({
      height: 280,
      key: `unitToken.${color}.${unitId}`,
      sourcePath: resolve(sourceDirectory, `tokens-${color}`, `${unitId}.png`),
      width: 280,
    }))
  );
  const commonAssets = [
    ['initiative', 128, 128],
    ['tokenBack', 128, 128],
    ['tokenBag', 144, 144],
    ['heartIntact', 26, 24],
    ['heartBroken', 26, 24],
    ['fortification', 280, 280],
    ['fortificationBroken', 280, 280],
    ['oreNeutral', 280, 280],
    ['oreCyan', 280, 280],
    ['oreRed', 280, 280],
  ].map(([key, width, height]) => ({
    height,
    key,
    sourcePath: resolve(sourceDirectory, 'common', `${key}.png`),
    width,
  }));

  return [...tokenEntries, ...commonAssets];
}
