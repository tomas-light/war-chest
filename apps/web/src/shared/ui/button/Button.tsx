import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';
import classes from './Button.module.scss';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button(props: Props) {
  const {
    className,
    type = 'button',
    variant = 'primary',
    ...buttonProps
  } = props;

  return (
    <button
      {...buttonProps}
      className={clsx(classes.button, className)}
      data-variant={variant}
      type={type}
    />
  );
}
