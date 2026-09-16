import { SwapPositionsButton } from './SwapPositionsButton';

export function Default() {
  return <SwapPositionsButton aria-label="Поменять игроков местами" />;
}

export function MobileTouchTarget() {
  return (
    <SwapPositionsButton
      aria-label="Показать другого игрока команды"
      touchTarget="mobile"
    />
  );
}

export function Disabled() {
  return <SwapPositionsButton aria-label="Поменять игроков местами" disabled />;
}
