import { describe, expect, test } from 'vitest';
import { getUserAvatarUrl } from './UserApi';

describe('user avatar URL', () => {
  test('does not request individual images for presets', () => {
    expect(
      getUserAvatarUrl({ avatarVersion: 'preset:clown', id: 'player' })
    ).toBeNull();
  });

  test('escapes the user and version in an uploaded avatar URL', () => {
    expect(
      getUserAvatarUrl({ avatarVersion: 'hash?&', id: 'player/one' })
    ).toBe('/api/users/player%2Fone/avatar?v=hash%3F%26');
  });

  test('keeps an uploaded fake avatar data URL', () => {
    expect(
      getUserAvatarUrl({
        avatarVersion: 'data:image/png;base64,aW1hZ2U=',
        id: 'player',
      })
    ).toBe('data:image/png;base64,aW1hZ2U=');
  });
});
