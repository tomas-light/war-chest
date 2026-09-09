import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { AVATAR_PRESETS } from '../../../../packages/api-contracts/src/types.ts';

const COLUMNS = 4;
const CELL_SIZE = 192;
const OUTPUT_DIRECTORY = new URL(
  '../../src/entities/user/assets/',
  import.meta.url
);

await buildAvatarSprite();

async function buildAvatarSprite() {
  const [, , sourceDirectory] = process.argv;

  if (sourceDirectory === undefined) {
    throw new Error(
      'Pass the directory containing the Figma PNG exports named <presetId>.png.'
    );
  }

  const rows = Math.ceil(AVATAR_PRESETS.length / COLUMNS);
  const images = await Promise.all(
    AVATAR_PRESETS.map(async (presetId, index) => {
      const source = sharp(resolve(sourceDirectory, `${presetId}.png`));
      const metadata = await source.metadata();

      if (
        metadata.format !== 'png' ||
        !metadata.hasAlpha ||
        metadata.width !== 256 ||
        metadata.height !== 256
      ) {
        throw new Error(
          `${presetId}: expected a transparent 256×256 PNG from Figma.`
        );
      }

      const input = await source.resize(CELL_SIZE, CELL_SIZE).png().toBuffer();
      return {
        input,
        left: (index % COLUMNS) * CELL_SIZE,
        top: Math.floor(index / COLUMNS) * CELL_SIZE,
      };
    })
  );

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const sourceImage = await sharp({
    create: {
      width: COLUMNS * CELL_SIZE,
      height: rows * CELL_SIZE,
      channels: 4,
      background: 'transparent',
    },
  })
    .composite(images)
    .png()
    .toBuffer();
  const alpha = await sharp(sourceImage)
    .extractChannel('alpha')
    .raw()
    .toBuffer();
  const quantizedImage = await sharp(sourceImage)
    .png({ palette: true, colours: 256, effort: 10, dither: 0 })
    .toBuffer();
  const { data, info } = await sharp(quantizedImage)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let pixelIndex = 0; pixelIndex < alpha.length; pixelIndex += 1) {
    data[pixelIndex * 4 + 3] = alpha[pixelIndex];
  }
  const result = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ palette: false, compressionLevel: 9 })
    .toFile(fileURLToPath(new URL('avatarPresets.png', OUTPUT_DIRECTORY)));

  await writeFile(
    new URL('avatarPresets.json', OUTPUT_DIRECTORY),
    `${JSON.stringify({ cellSize: CELL_SIZE, columns: COLUMNS, rows, presetIds: AVATAR_PRESETS }, null, 2)}\n`
  );

  process.stdout.write(
    `✅ Built ${AVATAR_PRESETS.length} avatars: ${result.width}×${result.height}, ${result.size} bytes.\n`
  );
}
