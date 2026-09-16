import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
import swapSidesIcon from './swapSidesIcon.svg';
import classes from './SwapPositionsButton.module.scss';

interface Props extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  touchTarget?: 'control' | 'mobile';
}

export function SwapPositionsButton(props: Props) {
  const {
    className,
    touchTarget = 'control',
    type = 'button',
    ...buttonProps
  } = props;

  return (
    <button
      {...buttonProps}
      className={clsx(classes.button, className)}
      data-touch-target={touchTarget}
      type={type}
    >
      <span className={classes.control}>
        <img alt="" className={classes.icon} src={swapSidesIcon} />
      </span>
    </button>
  );
}
