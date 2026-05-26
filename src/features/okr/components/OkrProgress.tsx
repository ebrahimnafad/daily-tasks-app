import { useEffect, useRef } from 'react';

interface OkrProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

export default function OkrProgress({
  progress,
  size = 80,
  strokeWidth = 6,
  label,
  sublabel,
}: OkrProgressProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;
    // Animate from 0 to target on mount
    fill.style.strokeDashoffset = String(circumference);
    requestAnimationFrame(() => {
      fill.style.transition = 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)';
      fill.style.strokeDashoffset = String(circumference - (clampedProgress / 100) * circumference);
    });
  }, [clampedProgress, circumference]);

  const cx = size / 2;
  const cy = size / 2;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ display: 'block', transform: 'rotate(-90deg)' }}
        aria-label={`${clampedProgress}%`}
        role="img"
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={`rgba(var(--gold-rgb), 0.12)`}
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <circle
          ref={fillRef}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
        {/* Center text — counter-rotate so text reads normally */}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          transform={`rotate(90 ${cx} ${cy})`}
          fill="var(--text-gold)"
          fontFamily="'Amiri',serif"
          fontWeight="700"
          fontSize={size < 64 ? size * 0.22 : size * 0.2}
        >
          {clampedProgress}%
        </text>
      </svg>
      {label && (
        <span
          style={{
            fontSize: 'var(--font-sm)',
            color: 'var(--text-gold)',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {label}
        </span>
      )}
      {sublabel && (
        <span
          className="okr-progress__sublabel"
          style={{
            fontSize: 'var(--font-sm)',
            color: 'rgba(var(--gold-rgb), 0.5)',
            textAlign: 'center',
          }}
        >
          {sublabel}
        </span>
      )}
    </div>
  );
}
