import clsx from 'clsx';
import type { InputHTMLAttributes } from 'react';
import classes from './TextField.module.scss';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
}

export function TextField(props: Props) {
  const { className, id, label, ...inputProps } = props;

  return (
    <>
      <label className={classes.label} htmlFor={id}>
        {label}
      </label>
      <input
        {...inputProps}
        className={clsx(classes.input, className)}
        id={id}
      />
    </>
  );
}
