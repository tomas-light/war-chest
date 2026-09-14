import clsx from 'clsx';
import classes from './GameSetupOption.module.scss';

interface Props {
  description: string;
  disabled?: boolean;
  inputType?: 'checkbox' | 'radio';
  isSelected: boolean;
  label: string;
  name: string;
  onSelect(this: void): void;
  stateLabel: string;
}

export function GameSetupOption(props: Props) {
  const {
    description,
    disabled = false,
    inputType = 'radio',
    isSelected,
    label,
    name,
    onSelect,
    stateLabel,
  } = props;

  return (
    <label
      className={clsx(classes.option, {
        [classes.disabled]: disabled,
        [classes.selected]: isSelected,
      })}
    >
      <input
        checked={isSelected}
        disabled={disabled}
        name={name}
        onChange={onSelect}
        type={inputType}
      />
      <span className={classes.state}>{stateLabel}</span>
      <strong>{label}</strong>
      <span className={classes.description}>{description}</span>
    </label>
  );
}
