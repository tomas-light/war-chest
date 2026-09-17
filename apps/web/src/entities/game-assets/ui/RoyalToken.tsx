import clsx from 'clsx';
import classes from './RoyalToken.module.scss';

interface Props {
  alt?: string;
  className?: string;
  size?: 'compact' | 'regular';
}

export function RoyalToken(props: Props) {
  const { alt = '', className, size = 'regular' } = props;
  let ariaLabel: string | undefined = undefined;
  let imageRole: 'img' | undefined = undefined;

  if (alt !== '') {
    ariaLabel = alt;
    imageRole = 'img';
  }

  return (
    <span
      aria-label={ariaLabel}
      className={clsx(classes.token, classes[size], className)}
      role={imageRole}
    >
      <span aria-hidden="true">♛</span>
    </span>
  );
}
