export const GAME_FORMATS = ['duel', 'team'] as const;
export const CARD_SELECTION_MODES = [
  'random',
  'draft',
  'eliminationDraft',
] as const;
export const GAME_EXPANSIONS = ['nobility', 'siege', 'nightfall'] as const;

export type GameFormat = (typeof GAME_FORMATS)[number];
export type CardSelectionMode = (typeof CARD_SELECTION_MODES)[number];
export type GameExpansion = (typeof GAME_EXPANSIONS)[number];

export type GamePreparationSettings = {
  cardSelectionMode: CardSelectionMode;
  expansions: readonly GameExpansion[];
};

export type GameSettings = GamePreparationSettings & {
  format: GameFormat;
};

export function createDefaultGameSettings(format: GameFormat): GameSettings {
  return {
    cardSelectionMode: 'random',
    expansions: [],
    format,
  };
}

export function createGameSettings(input: GameSettings): GameSettings {
  return {
    cardSelectionMode: input.cardSelectionMode,
    expansions: [...input.expansions],
    format: input.format,
  };
}

export function cloneGamePreparationSettings(
  settings: GamePreparationSettings
): GamePreparationSettings {
  return {
    cardSelectionMode: settings.cardSelectionMode,
    expansions: [...settings.expansions],
  };
}

export function cloneGameSettings(settings: GameSettings): GameSettings {
  return {
    ...settings,
    expansions: [...settings.expansions],
  };
}
