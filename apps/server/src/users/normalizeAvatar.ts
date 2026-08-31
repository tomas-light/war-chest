import { createHash } from 'node:crypto';
import sharp from 'sharp';

const AVATAR_SIZE_PX = 256;
const MAXIMUM_AVATAR_DIMENSION_PX = 4096;
const MAXIMUM_AVATAR_PIXELS =
  MAXIMUM_AVATAR_DIMENSION_PX * MAXIMUM_AVATAR_DIMENSION_PX;

export interface NormalizedAvatar {
  content: Buffer;
  contentHash: string;
  contentType: 'image/webp';
}

export async function normalizeAvatar(
  source: Buffer
): Promise<NormalizedAvatar> {
  const image = sharp(source, {
    failOn: 'error',
    limitInputPixels: MAXIMUM_AVATAR_PIXELS,
  });
  const metadata = await image.metadata();

  if (
    !isSupportedFormat(metadata.format) ||
    metadata.width === undefined ||
    metadata.height === undefined ||
    metadata.width > MAXIMUM_AVATAR_DIMENSION_PX ||
    metadata.height > MAXIMUM_AVATAR_DIMENSION_PX
  ) {
    throw new Error(
      'Avatar must be a JPEG, PNG, or WebP image up to 4096x4096.'
    );
  }

  const content = await image
    .rotate()
    .resize(AVATAR_SIZE_PX, AVATAR_SIZE_PX, {
      fit: 'cover',
      position: 'attention',
    })
    .webp({ quality: 86 })
    .toBuffer();

  return {
    content,
    contentHash: createHash('sha256').update(content).digest('base64url'),
    contentType: 'image/webp',
  };
}

function isSupportedFormat(format: string | undefined): boolean {
  return format === 'jpeg' || format === 'png' || format === 'webp';
}
