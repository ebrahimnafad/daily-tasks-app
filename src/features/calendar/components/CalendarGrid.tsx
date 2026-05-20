// ── CalendarGrid ──────────────────────────────────────────────────────────────
// Extracted from CalendarPage.tsx (F-2 decomposition).
// Owns: days-of-week header, empty offset cells, and the grid of CalendarDayCell.

import type { Task } from '@/types';
import type { SnapshotSummary } from '@/types';
import { DAYS, type DayShiftType } from '../constants';
import type { FinanceEvent, HolidayEntry, FinCycleMapEvent } from '../types';
import CalendarDayCell from './CalendarDayCell';

interface CalendarGridProps {
  year: number;
  month: number;
  today: string;
  selectedDate: string;

  // Per-date data maps (only the keys present in the viewed month are populated)
  tasksByDate: Record<string, Task[]>;
  financeEventsByDate: Record<string, FinanceEvent[]>;
  notesByDate: Record<string, unknown[]>; // only .length is used for the dot
  holidayMap: Record<string, HolidayEntry | null>;
  finCycleMap: Record<string, FinCycleMapEvent[]>;
  snapSummaries: Record<string, SnapshotSummary>;
  vacationDays: string[];
  maxExpenseAmount: number;

  // Shift classifier for a given date string
  getDayShiftType: (dateStr: string) => DayShiftType;

  onSelectDate: (dateStr: string) => void;
}

export default function CalendarGrid({
  year,
  month,
  today,
  selectedDate,
  tasksByDate,
  financeEventsByDate,
  notesByDate,
  holidayMap,
  finCycleMap,
  snapSummaries,
  vacationDays,
  maxExpenseAmount,
  getDayShiftType,
  onSelectDate,
}: CalendarGridProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  return (
    <>
      {/* Days-of-week header row */}
      <div className="cal-days-header">
        {DAYS.map((day) => (
          <div key={day} className="cal-day-name">
            {day}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="cal-grid">
        {/* Leading empty cells to align day 1 with the correct column */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="cal-cell cal-cell--empty" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

          return (
            <CalendarDayCell
              key={day}
              day={day}
              dateStr={dateStr}
              today={today}
              isSelected={dateStr === selectedDate}
              shiftType={getDayShiftType(dateStr)}
              holiday={holidayMap[dateStr] ?? null}
              finEvents={finCycleMap[dateStr]}
              snapSummary={snapSummaries[dateStr]}
              dayTasks={tasksByDate[dateStr] ?? []}
              dayFinance={financeEventsByDate[dateStr] ?? []}
              hasNotes={(notesByDate[dateStr]?.length ?? 0) > 0}
              isVacationDay={vacationDays.includes(dateStr)}
              maxExpenseAmount={maxExpenseAmount}
              onSelect={onSelectDate}
            />
          );
        })}
      </div>
    </>
  );
}
