// ── CalendarDayCell ───────────────────────────────────────────────────────────
// Extracted from CalendarPage.tsx (F-2 decomposition).
// Owns: per-cell background/border computation, shift tint, heatmap, holiday
// indicator, battery bar, task/finance dots, and vacation icon.

import type { Task } from '@/types';
import type { SnapshotSummary } from '@/types';
import { HOLIDAY_COLOR } from '../holidays';
import type { DayShiftType } from '../constants';
import type { FinanceEvent, HolidayEntry, FinCycleMapEvent } from '../types';

// ── Battery indicator ─────────────────────────────────────────────────────────
function BatteryBar({ progress }: { progress: number }) {
  const filled = Math.round((progress / 100) * 5);
  const color = progress >= 80 ? '#9bc87a' : progress >= 50 ? '#e6a855' : '#d97e6a';
  return (
    <div className="cal-battery" aria-label={`إنجاز ${progress}%`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`cal-battery__seg ${i < filled ? 'cal-battery__seg--on' : ''}`}
          style={i < filled ? { background: color } : {}}
        />
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface CalendarDayCellProps {
  day: number;
  dateStr: string;
  today: string;
  isSelected: boolean;
  shiftType: DayShiftType;
  holiday: HolidayEntry | null;
  finEvents: FinCycleMapEvent[] | undefined;
  snapSummary: SnapshotSummary | undefined;
  dayTasks: Task[];
  dayFinance: FinanceEvent[];
  hasNotes: boolean;
  isVacationDay: boolean;
  maxExpenseAmount: number;
  isCycleStart?: boolean;
  isCycleEnd?: boolean;
  onSelect: (dateStr: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CalendarDayCell({
  day,
  dateStr,
  today,
  isSelected,
  shiftType,
  holiday,
  finEvents,
  snapSummary,
  dayTasks,
  dayFinance,
  hasNotes,
  isVacationDay,
  maxExpenseAmount,
  isCycleStart = false,
  isCycleEnd = false,
  onSelect,
}: CalendarDayCellProps) {
  const isToday = dateStr === today;

  // ── Heatmap ──────────────────────────────────────────────────────────────
  const dayTotalExpense = dayFinance.reduce((sum, e) => sum + (e.amount || 0), 0);
  const intensity = maxExpenseAmount > 0 ? dayTotalExpense / maxExpenseAmount : 0;
  const heatmapOpacity = Math.max(0.08, intensity * 0.75);
  const hasExpenses = dayFinance.length > 0;

  // ── Cell background (shift tint + heatmap) ───────────────────────────────
  let cellBg: string | undefined;
  if (isToday) {
    cellBg = undefined; // CSS class handles today
  } else if (shiftType === 'off') {
    cellBg =
      'repeating-linear-gradient(-45deg,rgba(100,116,139,0.07) 0px,rgba(100,116,139,0.07) 4px,transparent 4px,transparent 9px)';
  } else if (hasExpenses && shiftType === 'morning') {
    cellBg = `rgba(251,191,36,${Math.max(0.07, heatmapOpacity * 0.9)})`;
  } else if (hasExpenses && shiftType === 'evening') {
    cellBg = `rgba(139,92,246,${Math.max(0.09, heatmapOpacity * 0.6)})`;
  } else if (hasExpenses) {
    cellBg = `rgba(var(--gold-rgb),${heatmapOpacity})`;
  } else if (shiftType === 'morning') {
    cellBg = 'rgba(251,191,36,0.07)';
  } else if (shiftType === 'evening') {
    cellBg = 'rgba(139,92,246,0.09)';
  }

  // ── Border stripes ────────────────────────────────────────────────────────
  const cellBorderTop =
    shiftType === 'morning'
      ? '3px solid rgba(251,191,36,0.75)'
      : shiftType === 'evening'
        ? '3px solid rgba(167,139,250,0.72)'
        : '2px dashed rgba(100,116,139,0.45)';

  const cellBorderBottom = holiday ? `2px solid ${HOLIDAY_COLOR[holiday.type]}` : undefined;
  const cellBorderRight = finEvents?.[0] ? `3px solid ${finEvents[0].borderColor}` : undefined;

  // ── Day number colour ─────────────────────────────────────────────────────
  const dayNumColor =
    shiftType === 'morning'
      ? 'rgba(251,191,36,0.92)'
      : shiftType === 'evening'
        ? 'rgba(167,139,250,0.92)'
        : 'rgba(var(--gold-rgb),0.35)';

  return (
    <div
      onClick={() => onSelect(dateStr)}
      style={{
        cursor: 'pointer',
        background: cellBg,
        borderTop: cellBorderTop,
        borderBottom: cellBorderBottom,
        borderRight: cellBorderRight,
        boxShadow: isSelected ? 'inset 0 0 0 2px var(--gold)' : undefined,
        opacity: shiftType === 'off' ? 0.72 : 1,
      }}
      className={[
        'cal-cell',
        isToday ? 'cal-cell--today' : '',
        shiftType === 'morning' ? 'cal-cell--morning' : '',
        shiftType === 'evening' ? 'cal-cell--evening' : '',
        shiftType === 'off' ? 'cal-cell--off' : '',
        dayTasks.length > 0 || hasExpenses ? 'cal-cell--has-tasks' : '',
        snapSummary ? 'cal-cell--has-snapshot' : '',
        isCycleStart ? 'okr-cycle-start' : '',
        isCycleEnd ? 'okr-cycle-end' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Day number */}
      <span className="cal-day-num" style={{ color: dayNumColor }}>
        {day}
      </span>

      {/* Notes dot — top-right */}
      {hasNotes && (
        <span style={{ position: 'absolute', top: 4, right: 4, fontSize: '10px' }}>📝</span>
      )}

      {/* Vacation icon — top-left */}
      {isVacationDay && (
        <span className="cal-cell-vacation" title="إجازة سنوية">
          🌴
        </span>
      )}

      {/* Holiday icon — bottom-left */}
      {holiday && (
        <span className="cal-cell-holiday" title={holiday.name}>
          {holiday.icon}
        </span>
      )}

      {/* Financial cycle icon — bottom-right */}
      {finEvents && finEvents.length > 0 && (
        <span className="cal-cell-fin" title={finEvents.map((e) => e.label).join(' · ')}>
          {finEvents[0].icon}
        </span>
      )}

      {/* Battery bar for past days with snapshots */}
      {snapSummary && dateStr < today && <BatteryBar progress={snapSummary.progress} />}

      {/* Task / finance dots */}
      <div className="cal-tasks">
        {dayFinance.slice(0, 2).map((fe) => (
          <div
            key={fe.id}
            className="cal-task-dot"
            style={{ backgroundColor: 'var(--danger)' }}
            title={fe.title}
          >
            💰
          </div>
        ))}
        {dayTasks.slice(0, Math.max(0, 3 - dayFinance.length)).map((task) => (
          <div
            key={task.id}
            className="cal-task-dot"
            style={{ backgroundColor: task.color }}
            title={task.title}
          />
        ))}
        {dayTasks.length + dayFinance.length > 3 && (
          <span className="cal-more">+{dayTasks.length + dayFinance.length - 3}</span>
        )}
      </div>
    </div>
  );
}
