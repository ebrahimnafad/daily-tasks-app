import { useMemo } from 'react';

interface DataPoint {
  month: string;
  label: string;
  income: number;
  expense: number;
}

interface TrendChartProps {
  data: DataPoint[];
  height?: number;
}

const WIDTH = 360;
const PADDING = { top: 20, right: 16, bottom: 36, left: 50 };

export default function TrendChart({ data, height = 200 }: TrendChartProps) {
  const chartW = WIDTH - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  const { maxVal, points } = useMemo(() => {
    if (data.length === 0) return { maxVal: 1, points: [] };

    const allVals = data.flatMap((d) => [d.income, d.expense]);
    const max = Math.max(...allVals, 1);
    // Round up to nice number
    const nice = Math.ceil(max / 1000) * 1000;

    const step = data.length > 1 ? chartW / (data.length - 1) : 0;
    const pts = data.map((d, i) => ({
      x: PADDING.left + i * step,
      yIncome: PADDING.top + chartH - (d.income / nice) * chartH,
      yExpense: PADDING.top + chartH - (d.expense / nice) * chartH,
      label: d.label,
      income: d.income,
      expense: d.expense,
    }));

    return { maxVal: nice, points: pts };
  }, [data, chartW, chartH]);

  if (data.length === 0) {
    return (
      <div className="fin-trend" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
        <div style={{ color: 'rgba(var(--gold-rgb),.4)', fontSize: 'var(--font-base)' }}>
          لا توجد بيانات سنوية بعد
        </div>
      </div>
    );
  }

  const incomePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.yIncome}`).join(' ');
  const expensePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.yExpense}`).join(' ');

  // Y-axis labels (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = (maxVal / 4) * i;
    const y = PADDING.top + chartH - (val / maxVal) * chartH;
    return { val, y };
  });

  return (
    <div className="fin-trend">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        aria-label="رسم بياني للاتجاه السنوي"
      >
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <g key={tick.val}>
            <line
              x1={PADDING.left}
              y1={tick.y}
              x2={WIDTH - PADDING.right}
              y2={tick.y}
              stroke="rgba(var(--gold-rgb),.08)"
              strokeDasharray="3,3"
            />
            <text
              x={PADDING.left - 6}
              y={tick.y + 3}
              textAnchor="end"
              fill="rgba(var(--gold-rgb),.35)"
              fontSize="8"
              fontFamily="'Amiri',serif"
            >
              {(tick.val / 1000).toFixed(0)}k
            </text>
          </g>
        ))}

        {/* Income line */}
        <path
          d={incomePath}
          fill="none"
          stroke="#9bc87a"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Expense line */}
        <path
          d={expensePath}
          fill="none"
          stroke="#d97e6a"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.yIncome} r="3" fill="#9bc87a" />
            <circle cx={p.x} cy={p.yExpense} r="3" fill="#d97e6a" />
            {/* Month label */}
            <text
              x={p.x}
              y={height - 8}
              textAnchor="middle"
              fill="rgba(var(--gold-rgb),.4)"
              fontSize="7"
              fontFamily="'Amiri',serif"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="fin-trend__legend">
        <span className="fin-trend__legend-item">
          <span className="fin-trend__dot" style={{ background: '#9bc87a' }} />
          الدخل
        </span>
        <span className="fin-trend__legend-item">
          <span className="fin-trend__dot" style={{ background: '#d97e6a' }} />
          المصروفات
        </span>
      </div>
    </div>
  );
}
