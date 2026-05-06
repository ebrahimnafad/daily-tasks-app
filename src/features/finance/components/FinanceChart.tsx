import { useMemo } from 'react';

interface ChartSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface FinanceChartProps {
  /** Outer ring — budget allocation */
  segments: ChartSegment[];
  /** Inner ring — actual spending (optional) */
  actualSegments?: ChartSegment[];
  centerValue?: string;
  centerLabel?: string;
  size?: number;
}

export default function FinanceChart({
  segments,
  actualSegments,
  centerValue,
  centerLabel,
  size = 180,
}: FinanceChartProps) {
  const outerStroke = 18;
  const innerStroke = 12;
  const gap = 6;

  const outerRadius = (size - outerStroke) / 2;
  const innerRadius = outerRadius - outerStroke / 2 - gap - innerStroke / 2;
  const outerCirc = 2 * Math.PI * outerRadius;
  const innerCirc = 2 * Math.PI * innerRadius;
  const center = size / 2;

  function buildArcs(segs: ChartSegment[], circumference: number) {
    const total = segs.reduce((s, seg) => s + seg.value, 0);
    if (total === 0) return [];
    let accumulated = 0;
    return segs
      .filter((s) => s.value > 0)
      .map((seg) => {
        const pct = seg.value / total;
        const dash = circumference * pct;
        const dashOffset = circumference * 0.25 - accumulated;
        accumulated += dash;
        return { ...seg, dash, gap: circumference - dash, dashOffset, pct };
      });
  }

  const outerArcs = useMemo(() => buildArcs(segments, outerCirc), [segments, outerCirc]);
  const innerArcs = useMemo(
    () => (actualSegments ? buildArcs(actualSegments, innerCirc) : []),
    [actualSegments, innerCirc]
  );

  const hasData = outerArcs.length > 0;

  if (!hasData) {
    return (
      <div className="fin-chart" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
        <div style={{ color: 'rgba(var(--gold-rgb),.4)', fontSize: 'var(--font-base)' }}>
          لا توجد بيانات بعد
        </div>
      </div>
    );
  }

  return (
    <div className="fin-chart">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* Outer track */}
        <circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="none"
          stroke="rgba(255,255,255,.06)"
          strokeWidth={outerStroke}
        />
        {/* Inner track */}
        {actualSegments && (
          <circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="none"
            stroke="rgba(255,255,255,.04)"
            strokeWidth={innerStroke}
          />
        )}

        {/* Outer arcs — Budget */}
        {outerArcs.map((arc, i) => (
          <circle
            key={`o-${i}`}
            cx={center}
            cy={center}
            r={outerRadius}
            fill="none"
            stroke={arc.color}
            strokeWidth={outerStroke}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={arc.dashOffset}
            opacity={0.85}
            style={{ transition: 'all 0.6s ease' }}
          />
        ))}

        {/* Inner arcs — Actual */}
        {innerArcs.map((arc, i) => (
          <circle
            key={`i-${i}`}
            cx={center}
            cy={center}
            r={innerRadius}
            fill="none"
            stroke={arc.color}
            strokeWidth={innerStroke}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={arc.dashOffset}
            style={{ transition: 'all 0.6s ease' }}
          />
        ))}

        {/* Center text */}
        {centerValue && (
          <>
            <text
              x={center}
              y={center - 4}
              textAnchor="middle"
              fill="var(--text-gold)"
              fontSize="20"
              fontWeight="700"
              fontFamily="'Amiri', serif"
            >
              {centerValue}
            </text>
            {centerLabel && (
              <text
                x={center}
                y={center + 14}
                textAnchor="middle"
                fill="rgba(var(--gold-rgb),.45)"
                fontSize="10"
                fontFamily="'Amiri', serif"
              >
                {centerLabel}
              </text>
            )}
          </>
        )}
      </svg>

      {/* Legend */}
      <div className="fin-chart__legend">
        {actualSegments && (
          <div className="fin-chart__ring-labels">
            <span className="fin-chart__ring-label">◯ الخطة</span>
            <span className="fin-chart__ring-label">● الفعلي</span>
          </div>
        )}
        {outerArcs
          .filter((a) => a.id !== '_remaining')
          .slice(0, 5)
          .map((arc) => (
            <div key={arc.id} className="fin-chart__legend-item">
              <span className="fin-chart__legend-dot" style={{ background: arc.color }} />
              <span className="fin-chart__legend-label">{arc.label}</span>
            </div>
          ))}
        {outerArcs.length > 5 && (
          <div className="fin-chart__legend-item">
            <span
              className="fin-chart__legend-dot"
              style={{ background: 'rgba(var(--gold-rgb),.3)' }}
            />
            <span className="fin-chart__legend-label">+{outerArcs.length - 5} أقسام</span>
          </div>
        )}
      </div>
    </div>
  );
}
