import { z } from 'zod';
import runtimeFeatureFlags from '../feature-flags.json' with { type: 'json' };

export type RuntimeFeatureFlags = Readonly<typeof runtimeFeatureFlags>;

type RuntimeFeatureFlagName = keyof RuntimeFeatureFlags;
type RuntimeFeatureFlagsSchemaShape = {
  [Name in RuntimeFeatureFlagName]: z.ZodBoolean;
};

export const DEFAULT_RUNTIME_FEATURE_FLAGS: RuntimeFeatureFlags =
  runtimeFeatureFlags;

const RUNTIME_FEATURE_FLAG_NAMES = Object.keys(
  DEFAULT_RUNTIME_FEATURE_FLAGS
) as RuntimeFeatureFlagName[];
const RUNTIME_FEATURE_FLAGS_SCHEMA_SHAPE = Object.fromEntries(
  RUNTIME_FEATURE_FLAG_NAMES.map((name) => [name, z.boolean()])
) as RuntimeFeatureFlagsSchemaShape;

export const runtimeFeatureFlagsSchema: z.ZodType<RuntimeFeatureFlags> = z
  .object(RUNTIME_FEATURE_FLAGS_SCHEMA_SHAPE)
  .strict();
