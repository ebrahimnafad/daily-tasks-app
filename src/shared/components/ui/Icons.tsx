interface TickProps {
  size?: number;
}

export function Tick({ size = 13 }: TickProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M2 7L5.5 10.5L11 3.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
