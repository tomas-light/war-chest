import classes from './LoadingIndicator.module.scss';

interface Props {
  label: string;
}

export function LoadingIndicator(props: Props) {
  const { label } = props;

  return (
    <div aria-live="polite" className={classes.indicator} role="status">
      <span aria-hidden="true" className={classes.mechanism}>
        <span className={classes.core} />
      </span>
      <span className={classes.label}>{label}</span>
    </div>
  );
}
