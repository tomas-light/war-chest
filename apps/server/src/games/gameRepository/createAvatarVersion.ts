export function createAvatarVersion(
  avatarHash: string | null,
  avatarPresetId: string | null
): string | null {
  return (
    avatarHash ?? (avatarPresetId === null ? null : `preset:${avatarPresetId}`)
  );
}
