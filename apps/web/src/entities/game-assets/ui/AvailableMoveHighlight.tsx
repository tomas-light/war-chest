import clsx from 'clsx';
import AVAILABLE_MOVE_COMPACT from '../assets/availableMoveCompact.svg';
import AVAILABLE_MOVE_LARGE from '../assets/availableMoveLarge.svg';
import classes from './AvailableMoveHighlight.module.scss';

interface Props {
  className?: string;
  size?: 'compact' | 'large';
}

export function AvailableMoveHighlight(props: Props) {
  const { className, size = 'large' } = props;
  const source =
    size === 'compact' ? AVAILABLE_MOVE_COMPACT : AVAILABLE_MOVE_LARGE;

  return (
    <img
      alt=""
      aria-hidden="true"
      className={clsx(classes.image, className)}
      src={source}
    />
  );
}
