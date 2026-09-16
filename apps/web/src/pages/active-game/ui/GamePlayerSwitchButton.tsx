import type { ButtonHTMLAttributes } from 'react';
import { SwapPositionsButton } from '#/shared/ui/swap-positions-button';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

export function GamePlayerSwitchButton(props: Props) {
  return <SwapPositionsButton {...props} touchTarget="mobile" />;
}
