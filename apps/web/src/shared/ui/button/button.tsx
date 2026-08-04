import type { ButtonHTMLAttributes } from 'react';
import classes from './Button.module.scss';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, type = 'button', ...props }: ButtonProps) {
  const buttonClassName =
    className === undefined ? classes.button : `${classes.button} ${className}`;

  return <button {...props} className={buttonClassName} type={type} />;
}
