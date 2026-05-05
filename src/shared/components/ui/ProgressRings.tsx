interface PrayerRingProps {
  done: number;
  total: number;
  color?: string;
}

export function PrayerRing({ done, total, color }: PrayerRingProps) {
  const pct = total > 0 ? done / total : 0;
  return (
    <div
      style={{
        width: 26,
        height: 26,
        flexShrink: 0,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label={`${done} من ${total} صلوات`}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        style={{ position: 'absolute' }}
        aria-hidden="true"
      >
        <circle
          cx="13"
          cy="13"
          r="11"
          fill="none"
          stroke="rgba(var(--gold-rgb),.2)"
          strokeWidth="2"
        />
        <circle
          cx="13"
          cy="13"
          r="11"
          fill="none"
          stroke={color ?? 'var(--gold)'}
          strokeWidth="2"
          strokeDasharray={`${pct * 69.1} 69.1`}
          strokeLinecap="round"
          transform="rotate(-90 13 13)"
          style={{ transition: 'stroke-dasharray .5s ease' }}
        />
      </svg>
      <span
        style={{
          fontSize: 'var(--font-sm)',
          color: 'var(--gold)',
          fontWeight: 700,
          position: 'relative',
        }}
      >
        {done}
      </span>
    </div>
  );
}

interface SubRingProps {
  done: number;
  total: number;
  color: string;
}

export function SubRing({ done, total, color }: SubRingProps) {
  const pct = total > 0 ? done / total : 0;
  return (
    <div
      style={{
        width: 26,
        height: 26,
        flexShrink: 0,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label={`${done} من ${total} عناصر`}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        style={{ position: 'absolute' }}
        aria-hidden="true"
      >
        <circle
          cx="13"
          cy="13"
          r="11"
          fill="none"
          stroke={`color-mix(in srgb, ${color} 19%, transparent)`}
          strokeWidth="2"
        />
        <circle
          cx="13"
          cy="13"
          r="11"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={`${pct * 69.1} 69.1`}
          strokeLinecap="round"
          transform="rotate(-90 13 13)"
          style={{ transition: 'stroke-dasharray .4s ease' }}
        />
      </svg>
      <span style={{ fontSize: 'var(--font-sm)', color, fontWeight: 700, position: 'relative' }}>
        {done}
      </span>
    </div>
  );
}
