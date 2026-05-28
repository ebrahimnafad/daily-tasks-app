import { useMemo } from 'react';
import { LS_KEYS } from '@/lib/storage/keys';
import { lsGet } from '@/lib/storage/localStorage';
import type { DailySnapshot } from '@/types';
import { localDateISO } from '@/lib/date/localDate';

export default function ProductivityChart() {
  const chartData = useMemo(() => {
    // 1. Get snapshot summaries
    const summaries = lsGet<Record<string, DailySnapshot>>(LS_KEYS.SNAP_SUMMARIES, {});

    // 2. Generate last 30 days
    const today = new Date();
    const days: { date: string; progress: number; label: string }[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const iso = localDateISO(d);

      const snap = summaries[iso];
      const progress = snap?.progress ?? 0;

      days.push({
        date: iso,
        progress,
        label: d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
      });
    }

    return days;
  }, []);

  if (chartData.length === 0) return <div className="dash-empty">لا توجد بيانات كافية</div>;

  return (
    <div className="dash-chart-container">
      {chartData.map((day) => {
        // Calculate height percentage (min 2px so it's visible even at 0)
        const height = Math.max(2, day.progress);
        // Calculate opacity based on progress (0% = 0.2, 100% = 1.0)
        const opacity = 0.2 + (day.progress / 100) * 0.8;

        return (
          <div key={day.date} className="dash-chart-bar-wrap">
            <div
              className="dash-chart-bar"
              style={
                {
                  height: `${height}%`,
                  '--fill-opacity': opacity,
                  '--bar-height': `${height}%`,
                } as React.CSSProperties
              }
            />
            <div className="dash-chart-tooltip">
              {day.label} <br />
              {day.progress}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
