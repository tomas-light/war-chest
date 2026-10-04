import {
  type GameView,
  type GameViewEventData,
  restoreView,
} from '@war-chest/game-engine';

export function restoreHistoricalView(
  events: readonly GameViewEventData[],
  sequence: number
): GameView {
  const history = events.filter((event) => event.sequence <= sequence);

  if (
    history.length !== sequence ||
    history.some((event, index) => event.sequence !== index + 1)
  ) {
    throw new Error('The game history contains a sequence gap.');
  }

  const view = restoreView(history);

  if (view === null) {
    throw new Error('The requested game state is unavailable.');
  }

  return view;
}
