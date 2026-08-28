import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import type { Database } from '@war-chest/database';
import { userAvatars } from '@war-chest/database';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import type { AuthConfig } from './config/index.js';
import type { ProviderIdentity } from './providers/types.js';

const MAXIMUM_REDIRECTS = 3;
const MAXIMUM_AVATAR_INPUT_PIXELS = 512 * 512;
// "1048576" matches; "-1", "1.5", and "1 MB" do not.
const CONTENT_LENGTH_PATTERN = /^\d+$/;
const SUPPORTED_CONTENT_TYPES_SET = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const SUPPORTED_SHARP_FORMATS_SET = new Set(['jpeg', 'png', 'webp']);
const BLOCKED_ADDRESSES = createBlockedAddresses();

export interface StoredAvatar {
  content: Buffer;
  contentHash: string;
  contentType: string;
}

interface NormalizedAvatar {
  content: Buffer;
  contentHash: string;
  contentType: 'image/webp';
}

interface UpdateProviderAvatarInput {
  avatarUrl: string | undefined;
  config: AuthConfig;
  database: Database;
  existingAvatarHash: null | string;
  provider: ProviderIdentity['provider'];
  userId: string;
}

interface AvatarRefreshFailureInput {
  error: unknown;
  input: UpdateProviderAvatarInput;
  stage: 'download_and_normalize' | 'storage';
}

interface SafeErrorDetails {
  causeCode: null | string;
  code: null | string;
  message: string;
  name: string;
}

export async function updateProviderAvatar(
  input: UpdateProviderAvatarInput
): Promise<string | null> {
  if (input.avatarUrl === undefined) {
    logAvatarRefreshSkipped(input);
    return null;
  }

  // Avatar refresh is best-effort and must never prevent a successful login.
  let avatar: NormalizedAvatar;

  try {
    avatar = await downloadAndNormalizeAvatar(input.avatarUrl, input.config);
  } catch (error) {
    logAvatarRefreshFailure({
      error,
      input,
      stage: 'download_and_normalize',
    });
    return null;
  }

  if (avatar.contentHash === input.existingAvatarHash) {
    return avatar.contentHash;
  }

  try {
    await input.database
      .insert(userAvatars)
      .values({
        content: avatar.content,
        contentHash: avatar.contentHash,
        contentType: avatar.contentType,
        userId: input.userId,
      })
      .onConflictDoUpdate({
        set: {
          content: avatar.content,
          contentHash: avatar.contentHash,
          contentType: avatar.contentType,
          updatedAt: new Date(),
        },
        target: userAvatars.userId,
      });

    return avatar.contentHash;
  } catch (error) {
    logAvatarRefreshFailure({ error, input, stage: 'storage' });
    return null;
  }
}

function logAvatarRefreshSkipped(input: UpdateProviderAvatarInput): void {
  // eslint-disable-next-line no-console
  console.warn('Avatar refresh skipped: provider returned no avatar URL.', {
    provider: input.provider,
    userId: input.userId,
  });
}

function logAvatarRefreshFailure(input: AvatarRefreshFailureInput): void {
  // eslint-disable-next-line no-console
  console.error('Avatar refresh failed.', {
    error: createSafeErrorDetails(input.error),
    provider: input.input.provider,
    stage: input.stage,
    userId: input.input.userId,
  });
}

function createSafeErrorDetails(error: unknown): SafeErrorDetails {
  if (!(error instanceof Error)) {
    return {
      causeCode: null,
      code: null,
      message: 'Unknown non-Error value',
      name: 'UnknownError',
    };
  }

  return {
    causeCode: getErrorCode(error.cause),
    code: getErrorCode(error),
    message: error.message,
    name: error.name,
  };
}

function getErrorCode(value: unknown): null | string {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('code' in value) ||
    typeof value.code !== 'string'
  ) {
    return null;
  }

  return value.code;
}

export async function findAvatar(
  database: Database,
  userId: string
): Promise<StoredAvatar | null> {
  const [avatar] = await database
    .select({
      content: userAvatars.content,
      contentHash: userAvatars.contentHash,
      contentType: userAvatars.contentType,
    })
    .from(userAvatars)
    .where(eq(userAvatars.userId, userId))
    .limit(1);

  return avatar ?? null;
}

async function downloadAndNormalizeAvatar(
  avatarUrl: string,
  config: AuthConfig
): Promise<NormalizedAvatar> {
  const source = await downloadAvatar(new URL(avatarUrl), config);
  const metadata = await sharp(source).metadata();

  if (
    metadata.format === undefined ||
    !SUPPORTED_SHARP_FORMATS_SET.has(metadata.format)
  ) {
    throw new Error('Unsupported avatar image format');
  }

  const content = await sharp(source, {
    limitInputPixels: MAXIMUM_AVATAR_INPUT_PIXELS,
  })
    .rotate()
    .resize(config.AUTH_AVATAR_SIZE_PX, config.AUTH_AVATAR_SIZE_PX, {
      fit: 'cover',
      position: 'attention',
    })
    .webp()
    .toBuffer();

  return {
    content,
    contentHash: createHash('sha256').update(content).digest('base64url'),
    contentType: 'image/webp',
  };
}

async function downloadAvatar(
  initialUrl: URL,
  config: AuthConfig
): Promise<Buffer> {
  let currentUrl = initialUrl;

  for (
    let redirectCount = 0;
    redirectCount <= MAXIMUM_REDIRECTS;
    redirectCount += 1
  ) {
    await assertPublicHttpsUrl(currentUrl);

    const response = await fetch(currentUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(config.AUTH_AVATAR_FETCH_TIMEOUT_MS),
    });

    if (isRedirectResponse(response)) {
      const location = response.headers.get('location');

      if (location === null || redirectCount === MAXIMUM_REDIRECTS) {
        throw new Error('Avatar redirect is invalid');
      }

      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (!response.ok || response.body === null) {
      throw new Error(`Avatar request returned HTTP ${response.status}`);
    }

    assertSupportedContentType(response);
    assertContentLength(response, config.AUTH_AVATAR_MAX_SOURCE_BYTES);

    return readLimitedBody(response.body, config.AUTH_AVATAR_MAX_SOURCE_BYTES);
  }

  throw new Error('Avatar redirect limit exceeded');
}

async function assertPublicHttpsUrl(url: URL): Promise<void> {
  if (
    url.protocol !== 'https:' ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throw new Error('Avatar URL must be a public HTTPS URL');
  }

  const addresses =
    isIP(url.hostname) === 0
      ? await lookup(url.hostname, { all: true, verbatim: true })
      : [{ address: url.hostname, family: isIP(url.hostname) }];

  if (
    addresses.length === 0 ||
    addresses.some(({ address, family }) =>
      BLOCKED_ADDRESSES.check(address, family === 6 ? 'ipv6' : 'ipv4')
    )
  ) {
    throw new Error('Avatar URL resolves to a non-public address');
  }
}

function isRedirectResponse(response: Response): boolean {
  return [301, 302, 303, 307, 308].includes(response.status);
}

function assertSupportedContentType(response: Response): void {
  // "image/jpeg; charset=binary" → "image/jpeg".
  const contentType = response.headers
    .get('content-type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase();

  if (
    contentType === undefined ||
    !SUPPORTED_CONTENT_TYPES_SET.has(contentType)
  ) {
    throw new Error('Avatar response has an unsupported content type');
  }
}

function assertContentLength(response: Response, maximumBytes: number): void {
  const contentLength = response.headers.get('content-length');

  if (
    contentLength !== null &&
    (!CONTENT_LENGTH_PATTERN.test(contentLength) ||
      Number(contentLength) > maximumBytes)
  ) {
    throw new Error('Avatar response is too large');
  }
}

async function readLimitedBody(
  body: ReadableStream<Uint8Array>,
  maximumBytes: number
): Promise<Buffer> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const result = await reader.read();

    if (result.done) {
      return Buffer.concat(chunks, totalBytes);
    }

    totalBytes += result.value.byteLength;

    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new Error('Avatar response is too large');
    }

    chunks.push(result.value);
  }
}

function createBlockedAddresses(): BlockList {
  const blockList = new BlockList();

  blockList.addSubnet('0.0.0.0', 8, 'ipv4');
  blockList.addSubnet('10.0.0.0', 8, 'ipv4');
  blockList.addSubnet('100.64.0.0', 10, 'ipv4');
  blockList.addSubnet('127.0.0.0', 8, 'ipv4');
  blockList.addSubnet('169.254.0.0', 16, 'ipv4');
  blockList.addSubnet('172.16.0.0', 12, 'ipv4');
  blockList.addSubnet('192.0.0.0', 24, 'ipv4');
  blockList.addSubnet('192.0.2.0', 24, 'ipv4');
  blockList.addSubnet('192.168.0.0', 16, 'ipv4');
  blockList.addSubnet('198.18.0.0', 15, 'ipv4');
  blockList.addSubnet('198.51.100.0', 24, 'ipv4');
  blockList.addSubnet('203.0.113.0', 24, 'ipv4');
  blockList.addSubnet('224.0.0.0', 4, 'ipv4');
  blockList.addSubnet('240.0.0.0', 4, 'ipv4');
  blockList.addAddress('::', 'ipv6');
  blockList.addAddress('::1', 'ipv6');
  // BlockList applies the IPv4 rules above to IPv4-mapped IPv6 addresses too.
  // Blocking the complete ::ffff:0:0/96 subnet would also block public IPv4.
  blockList.addSubnet('fc00::', 7, 'ipv6');
  blockList.addSubnet('fe80::', 10, 'ipv6');
  blockList.addSubnet('ff00::', 8, 'ipv6');
  blockList.addSubnet('2001:db8::', 32, 'ipv6');

  return blockList;
}
