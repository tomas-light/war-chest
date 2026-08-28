interface Props {
  className?: string;
}

export function WarChestLogo(props: Props) {
  const { className } = props;

  return (
    <img
      alt=""
      aria-hidden="true"
      className={className}
      draggable={false}
      height="512"
      src="/brand/war-chest-logo-512.png"
      width="512"
    />
  );
}
