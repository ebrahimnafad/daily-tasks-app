import { useMemo } from 'react';

/**
 * FinanceChart — رسم دائري SVG (Donut Chart) للملخص الشهري
 */
export default function FinanceChart({ segments, size = 160, strokeWidth = 22 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const total = segments.reduce((s, seg) => s + seg.value, 0);

  const arcs = useMemo(() => {
    if (total === 0) return [];
    let offset = 0;
    return segments
      .filter((s) => s.value > 0)
      .map((seg) => {
        const pct = seg.value / total;
        const dash = circumference * pct;
        const gap = circumference - dash;
        const rotation = offset;
        offset += pct * 360;
        return { ...seg, dash, gap, rotation, pct };
      });
  }, [segments, total, circumference]);

  if (total === 0) {
    return (
      <div className="fin-chart" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
        <div style={{ color: 'rgba(var(--gold-rgb),.4)', fontSize: 'var(--font-base)' }}>
          لا توجد بيانات بعد
        </div>
      </div>
    );
  }

  return (
    <div
      className="fin-chart"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-lg)',
        justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* خلفية الدائرة */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(var(--gold-rgb),.1)"
          strokeWidth={strokeWidth}
        />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={circumference * 0.25}
            strokeLinecap="round"
            transform={`rotate(${arc.rotation} ${center} ${center})`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        ))}
        {/* النسبة المتبقية في المنتصف */}
        <text
          x={center}
          y={center - 6}
          textAnchor="middle"
          fill="var(--text-gold)"
          fontSize="18"
          fontWeight="700"
          fontFamily="'Amiri',serif"
        >
          {segments.find((s) => s.id === 'savings')?.value > 0
            ? `${Math.round((segments.find((s) => s.id === 'savings').value / total) * 100)}٪`
            : '0٪'}
        </text>
        <text
          x={center}
          y={center + 14}
          textAnchor="middle"
          fill="rgba(var(--gold-rgb),.5)"
          fontSize="10"
          fontFamily="'Amiri',serif"
        >
          ادخار
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {arcs.map((arc, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              fontSize: 'var(--font-sm)',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: arc.color,
                flexShrink: 0,
              }}
            />
            <span style={{ color: 'rgba(var(--gold-rgb),.7)' }}>{arc.label}</span>
            <span
              style={{ color: 'var(--text-gold)', fontWeight: 700, marginRight: 'var(--space-xs)' }}
            >
              {arc.value.toLocaleString('ar-SA')} ر.س
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
