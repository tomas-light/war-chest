import { describe, expect, test } from 'vitest';
import {
  DEFAULT_RUNTIME_FEATURE_FLAGS,
  runtimeFeatureFlagsSchema,
} from '../src/index.js';

describe('runtime feature flags contract', () => {
  test('accepts the canonical feature flags JSON', () => {
    expect(
      runtimeFeatureFlagsSchema.safeParse(DEFAULT_RUNTIME_FEATURE_FLAGS).success
    ).toBe(true);
  });

  test('rejects a missing feature flag', () => {
    const { gameHistory: omittedGameHistoryFlag, ...incompleteFeatureFlags } =
      DEFAULT_RUNTIME_FEATURE_FLAGS;

    expect(omittedGameHistoryFlag).toBe(true);
    expect(
      runtimeFeatureFlagsSchema.safeParse(incompleteFeatureFlags).success
    ).toBe(false);
  });

  test('rejects an unknown feature flag', () => {
    const featureFlags = {
      ...DEFAULT_RUNTIME_FEATURE_FLAGS,
      unknownFeature: true,
    };

    expect(runtimeFeatureFlagsSchema.safeParse(featureFlags).success).toBe(
      false
    );
  });
});
