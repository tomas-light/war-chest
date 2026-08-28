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
  const buttonClassName =
    className === undefined ? classes.button : `${classes.button} ${className}`;

  return (
    <button
      {...buttonProps}
      className={buttonClassName}
      data-variant={variant}
      type={type}
    />
  );
}
