import { useMemo, useState, useEffect, useCallback } from 'react';
import type { Task } from '@/types';
import type { SnapshotSummary, DailySnapshot } from '@/types';
import type { Expense, Transaction } from '@/features/finance/types';
import { KEYS } from '@/features/finance/hooks/useFinanceSync';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { useTaskContext } from '@/features/tasks/context/TaskContext';
import { TaskCard } from '@/features/tasks/components/TaskCard/index.js';
import { authFetch } from '@/features/auth/authFetch';
import useNotesSync from './useNotesSync';
import useNoteSearch from './useNoteSearch';
import NotesPanel from './NotesPanel';
import HistoryPanel from './HistoryPanel';
import SyncStatusBar from './SyncStatusBar';
import ConflictDialog from './ConflictDialog';
import { localDateISO } from '@/lib/date/localDate';
import {
  computeShift,
  getMostRecentFriday,
  DEFAULT_EPOCH_KEY,
  DEFAULT_SHIFTS,
} from '@/features/tasks/data/scheduleConfig';
import type { ShiftConfig } from '@/features/tasks/data/scheduleConfig';
import { HOLIDAY_COLOR, LS_HOLIDAY_OFFSETS, addDays, HOLIDAY_GROUPS } from './holidays';
import { useHolidayData } from './useHolidayData';
import {
  defaultFinConfig,
  LS_FIN_CYCLE_CONFIG,
  computeFinCycleEvents,
  buildFinCycleMap,
} from './financialCycles';
import type { FinCycleConfig } from './financialCycles';

interface FinanceEvent {
  id: string;
  title: string;
  icon: string;
  amount: number;
  isPaid: boolean;
  type: 'due' | 'paid';
}

interface CalendarPageProps {
  tasks: Task[];
  // M-5: Lifted to AppContent so state survives tab switches
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
}

const DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

// Shift type for a calendar day: 'morning' | 'evening' | 'off'
type DayShiftType = 'morning' | 'evening' | 'off';

export default function CalendarPage({
  tasks,
  currentDate,
  setCurrentDate,
  selectedDate,
  setSelectedDate,
}: CalendarPageProps) {
  const { tm } = useTaskContext();
  const today = localDateISO();

  // ── Schedule shift config (reactive to storage changes from other tabs) ──
  const LS_SCHEDULE_KEY = 'mhm_schedule';
  const [schedule, setSchedule] = useState<ShiftConfig[]>(() =>
    lsGet<ShiftConfig[]>(LS_SCHEDULE_KEY, DEFAULT_SHIFTS)
  );
  const [shiftEpoch, setShiftEpoch] = useState<string>(() =>
    lsGet<string>(DEFAULT_EPOCH_KEY, getMostRecentFriday())
  );

  // ── Off-day exceptions (per-date overrides: off → work) ────────────────
  const LS_OFF_EXCEPTIONS_KEY = 'mhm_off_exceptions';
  const [offExceptions, setOffExceptions] = useState<string[]>(() =>
    lsGet<string[]>(LS_OFF_EXCEPTIONS_KEY, [])
  );

  const toggleOffException = useCallback((dateStr: string) => {
    setOffExceptions((prev) => {
      const next = prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr];
      lsSet(LS_OFF_EXCEPTIONS_KEY, next);
      return next;
    });
  }, []);

  /** Classify a calendar date as morning-shift, evening-shift, or off-day.
   *  Off-day exceptions (user-set) override the normal off classification. */
  const getDayShiftType = useCallback(
    (dateStr: string): DayShiftType => {
      const date = new Date(dateStr + 'T12:00:00');
      const shiftId = computeShift(shiftEpoch, schedule, date);
      const shift = schedule.find((s) => s.id === shiftId);
      const dow = date.getDay();
      if (shift?.offDays.includes(dow)) {
        // User has marked this specific date as a work-day exception
        if (offExceptions.includes(dateStr)) return shiftId as DayShiftType;
        return 'off';
      }
      return shiftId as DayShiftType;
    },
    [schedule, shiftEpoch, offExceptions]
  );

  // ── Holiday offsets (user-confirmed moon-sighting adjustments) ────
  const [holidayOffsets, setHolidayOffsets] = useState<Record<string, number>>(() =>
    lsGet<Record<string, number>>(LS_HOLIDAY_OFFSETS, {})
  );

  const adjustHoliday = useCallback((groupId: string, delta: number | 'reset') => {
    setHolidayOffsets((prev) => {
      const current = prev[groupId] ?? 0;
      const next = delta === 'reset' ? 0 : current + delta;
      const updated = { ...prev, [groupId]: next };
      lsSet(LS_HOLIDAY_OFFSETS, updated);
      return updated;
    });
  }, []);

  // ── Holiday data (AlAdhan API + static fallback) ───────────────────
  const { holidayMap, eidFitrDates } = useHolidayData(holidayOffsets);

  // ── Financial cycle config + pulse strip ──────────────────────────
  const [finConfig, setFinConfig] = useState<FinCycleConfig>(() =>
    lsGet<FinCycleConfig>(LS_FIN_CYCLE_CONFIG, defaultFinConfig())
  );
  const [showFinSettings, setShowFinSettings] = useState(false);

  const saveFinConfig = useCallback((patch: Partial<FinCycleConfig>) => {
    setFinConfig((prev) => {
      const next = { ...prev, ...patch };
      lsSet(LS_FIN_CYCLE_CONFIG, next);
      return next;
    });
  }, []);

  /** Upcoming events within 60 days — for the Pulse Strip */
  const upcomingFinEvents = useMemo(
    () => computeFinCycleEvents(finConfig, eidFitrDates, today, 60),
    [finConfig, eidFitrDates, today]
  );

  // ── Snapshot summaries (for battery indicator) ──────────────────────
  const LS_SNAP_SUMMARIES_KEY = 'mhm_snap_summaries';
  const [snapSummaries, setSnapSummaries] = useState<Record<string, SnapshotSummary>>(
    // Seed from localStorage so battery indicators appear instantly on first paint.
    // Will be overwritten by the fresh network response in the background.
    () => lsGet<Record<string, SnapshotSummary>>(LS_SNAP_SUMMARIES_KEY, {})
  );
  const [selectedSnapshot, setSelectedSnapshot] = useState<DailySnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  // M-7: Extracted so storage listener and manual button can both call it
  const LS_LAST_SNAP_KEY = 'mhm_last_manual_snapshot_at';

  const refreshSnapSummaries = useCallback(() => {
    authFetch('/api/snapshots', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { summaries?: SnapshotSummary[] }) => {
        if (!Array.isArray(data.summaries)) return;
        const map: Record<string, SnapshotSummary> = {};
        data.summaries.forEach((s) => {
          map[s.date] = s;
        });
        // Persist for next page load so indicators render instantly
        lsSet(LS_SNAP_SUMMARIES_KEY, map);
        setSnapSummaries(map);
      })
      .catch(() => {
        /* offline — silent */
      });
  }, []);

  // Initial load
  useEffect(() => {
    refreshSnapSummaries();
  }, [refreshSnapSummaries]);

  // M-7: Re-fetch when the tasks tab saves a new snapshot
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_LAST_SNAP_KEY) refreshSnapSummaries();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshSnapSummaries]);

  const fetchSnapshot = useCallback(
    async (date: string) => {
      if (date >= today) {
        setSelectedSnapshot(null);
        return;
      }
      const summary = snapSummaries[date];
      if (!summary) {
        setSelectedSnapshot(null);
        return;
      }
      setLoadingSnapshot(true);
      try {
        const r = await authFetch(`/api/snapshots?date=${date}`, { cache: 'no-store' });
        const data = (await r.json()) as { snapshot: DailySnapshot | null };
        setSelectedSnapshot(data.snapshot ?? null);
      } catch {
        setSelectedSnapshot(null);
      } finally {
        setLoadingSnapshot(false);
      }
    },
    [today, snapSummaries]
  );

  // ── Battery helper ─────────────────────────────────────────────────
  const BatteryBar = ({ progress }: { progress: number }) => {
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
  };

  // ── Notes sync ──────────────────────────────────────────────────────
  const {
    notes,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
    syncStatus,
    syncError,
    retrySync,
    conflictState,
    resolveKeepLocal,
    resolveUseServer,
  } = useNotesSync();

  // ── Search ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const searchResults = useNoteSearch(notes, searchQuery);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  /** Date → FinCycleEvent[] map for visible month — cell right-border.
   * L-11: Window aligned to 60 days from today (same as upcomingFinEvents)
   * so Pulse Strip events always have matching cell markers. */
  const finCycleMap = useMemo(
    () =>
      buildFinCycleMap(
        computeFinCycleEvents(
          finConfig,
          eidFitrDates,
          today, // L-11: anchor from today, not 1st of viewed month
          60 // L-11: aligned with upcomingFinEvents window
        )
      ),
    [finConfig, eidFitrDates, today]
  );

  const [expenses, setExpenses] = useState<Expense[]>(() => lsGet(KEYS.expenses, []));
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    lsGet(KEYS.transactions, [])
  );

  // M-4: Refresh schedule / expenses / transactions when another tab writes to localStorage
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_SCHEDULE_KEY) {
        setSchedule(lsGet<ShiftConfig[]>(LS_SCHEDULE_KEY, DEFAULT_SHIFTS));
      }
      if (e.key === DEFAULT_EPOCH_KEY) {
        setShiftEpoch(lsGet<string>(DEFAULT_EPOCH_KEY, getMostRecentFriday()));
      }
      if (e.key === KEYS.expenses) {
        setExpenses(lsGet<Expense[]>(KEYS.expenses, []));
      }
      if (e.key === KEYS.transactions) {
        setTransactions(lsGet<Transaction[]>(KEYS.transactions, []));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const financeEventsByDate = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const map: Record<string, FinanceEvent[]> = {};
    const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;

    // Only Due Expenses
    expenses.forEach((e) => {
      if (!e.isActive) return;
      let isDueThisMonth = false;
      let dueDay = e.dueDay || 1;

      if (e.frequency === 'monthly' || e.frequency === 'weekly') {
        isDueThisMonth = true;
      } else if (e.frequency === 'annual' && e.seasonMonth) {
        if (e.seasonMonth === m + 1) isDueThisMonth = true;
      } else if (e.frequency === 'semi-annual' && e.seasonMonth) {
        if (e.seasonMonth === m + 1 || ((e.seasonMonth + 6) % 12 || 12) === m + 1) {
          isDueThisMonth = true;
        }
      } else if (e.frequency === 'quarterly' && e.quarterMonth) {
        const currentQuarterMonth = (m % 3) + 1;
        if (currentQuarterMonth === e.quarterMonth) {
          isDueThisMonth = true;
        }
      } else if (e.frequency === 'one-time' && e.endDate) {
        if (e.endDate.startsWith(monthStr)) {
          isDueThisMonth = true;
          dueDay = parseInt(e.endDate.split('-')[2], 10);
        }
      }

      if (isDueThisMonth) {
        const paid = transactions.some(
          (t) => t.expenseId === e.id && t.date.startsWith(monthStr) && t.status === 'paid'
        );
        if (!paid) {
          const dateStr = `${monthStr}-${String(dueDay).padStart(2, '0')}`;
          if (!map[dateStr]) map[dateStr] = [];
          map[dateStr].push({
            id: e.id,
            title: e.title,
            icon: e.icon,
            amount: e.amount,
            isPaid: false,
            type: 'due',
          });
        }
      }
    });

    return map;
  }, [expenses, transactions, currentDate]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const days = new Date(y, m + 1, 0).getDate();

    for (let day = 1; day <= days; day++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Only include tasks explicitly scheduled for this specific date
      const applicableTasks = tasks.filter((t) => {
        return t.recurrence === 'موعد محدد' && t.date === dateStr;
      });

      if (applicableTasks.length > 0) {
        map[dateStr] = applicableTasks;
      }
    }
    return map;
  }, [tasks, currentDate]);

  // Notes grouped by date for indicator dots
  const notesByDate = useMemo(() => {
    const map: Record<string, typeof notes> = {};
    notes.forEach((n) => {
      if (!map[n.date]) map[n.date] = [];
      map[n.date].push(n);
    });
    return map;
  }, [notes]);

  // Calculate max expense amount in the current month to scale the heatmap opacity
  const maxExpenseAmount = useMemo(() => {
    let max = 0;
    Object.values(financeEventsByDate).forEach((events) => {
      const dayTotal = events.reduce((sum, e) => sum + (e.amount || 0), 0);
      if (dayTotal > max) max = dayTotal;
    });
    return max;
  }, [financeEventsByDate]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    const d = localDateISO(now);
    setSelectedDate(d);
    setSelectedSnapshot(null);
  };

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    void fetchSnapshot(dateStr);
  };

  const selectedDateTasks = tasksByDate[selectedDate] || [];
  const selectedDateFinance = financeEventsByDate[selectedDate] || [];
  const selectedDateNotes = notesByDate[selectedDate] ?? [];

  // ── Off-day warnings for the viewed month ───────────────────────────
  // Inline the shift-type logic to avoid a useCallback dependency (React Compiler rule).
  const offDayWarnings = useMemo(() => {
    const warnings: { type: string; message: string }[] = [];
    const days = new Date(year, month + 1, 0).getDate();
    let offCount = 0;
    let hasLateOffDay = false;
    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const date = new Date(dateStr + 'T12:00:00');
      const shiftId = computeShift(shiftEpoch, schedule, date);
      const shift = schedule.find((s) => s.id === shiftId);
      const isStructurallyOff = !!shift?.offDays.includes(date.getDay());
      const isException = offExceptions.includes(dateStr);
      if (isStructurallyOff && !isException) {
        offCount++;
        if (d >= 26) hasLateOffDay = true;
      }
    }
    if (offCount > 4)
      warnings.push({
        type: 'excess',
        message: `يوجد ${offCount} أيام إجازة هذا الشهر (يتجاوز الحد المعتاد 4)`,
      });
    if (hasLateOffDay)
      warnings.push({
        type: 'late',
        message: 'يوجد يوم إجازة بعد اليوم 26 — قد يؤثر على إغلاق الحصة الشهرية',
      });
    return warnings;
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [year, month, shiftEpoch, schedule, offExceptions]);

  // True if the selected date is a structural off-day (before exception override)
  const selectedDateIsStructurallyOff = useMemo(() => {
    const date = new Date(selectedDate + 'T12:00:00');
    const shiftId = computeShift(shiftEpoch, schedule, date);
    const shift = schedule.find((s) => s.id === shiftId);
    return !!shift?.offDays.includes(date.getDay());
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [selectedDate, shiftEpoch, schedule]);
  const selectedDateIsException = offExceptions.includes(selectedDate);

  return (
    <div className="cal-view">
      {/* Header */}
      <div className="cal-header">
        <button className="cal-nav" onClick={goToPrevMonth}>
          ◀
        </button>
        <div className="cal-title">
          <span>{MONTHS[month]}</span>
          <span style={{ fontWeight: 400 }}>{year}</span>
        </div>
        <button className="cal-nav" onClick={goToNextMonth}>
          ▶
        </button>
      </div>

      <button className="cal-today-btn" onClick={goToToday}>
        اليوم
      </button>

      {/* Search bar */}
      <div className="cal-search-bar">
        <span className="cal-search-icon">🔍</span>
        <input
          type="text"
          className="cal-search-input"
          placeholder="ابحث في الملاحظات..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          dir="auto"
        />
        {searchQuery && (
          <button className="cal-search-clear" onClick={() => setSearchQuery('')}>
            ✕
          </button>
        )}
      </div>

      {/* Search results (shown instead of calendar when searching) */}
      {searchQuery ? (
        <div className="cal-search-results">
          {searchResults.length === 0 ? (
            <p className="cal-empty">لا توجد نتائج للبحث</p>
          ) : (
            searchResults.map((note) => (
              <div
                key={note.id}
                className="cal-search-result-item"
                onClick={() => {
                  setSelectedDate(note.date);
                  setSearchQuery('');
                  // Navigate to the month of this note
                  const d = new Date(note.date + 'T00:00:00');
                  setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
                }}
              >
                <span className="cal-search-result-date">
                  {new Date(note.date + 'T00:00:00').toLocaleDateString('ar-SA', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {note.pinned && ' 📌'}
                </span>
                <span className="cal-search-result-snippet">
                  {note.text.slice(0, 120)}
                  {note.text.length > 120 ? '...' : ''}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Days header */}
          <div className="cal-days-header">
            {DAYS.map((day) => (
              <div key={day} className="cal-day-name">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="cal-grid">
            {/* Empty cells for first day offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="cal-cell cal-cell--empty" />
            ))}

            {/* Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const dayTasks = tasksByDate[dateStr] || [];
              const dayFinance = financeEventsByDate[dateStr] || [];
              const hasNotes = (notesByDate[dateStr]?.length ?? 0) > 0;

              // Heatmap calculations
              const dayTotalExpense = dayFinance.reduce((sum, e) => sum + (e.amount || 0), 0);
              const intensity = maxExpenseAmount > 0 ? dayTotalExpense / maxExpenseAmount : 0;
              const heatmapOpacity = Math.max(0.08, intensity * 0.75); // scales from 0.08 (baseline) up to 0.75 max
              const hasExpenses = dayFinance.length > 0;

              const shiftType = getDayShiftType(dateStr);
              const holiday = holidayMap[dateStr] ?? null;

              // ── Compute cell background (shift tint + heatmap blended) ──
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

              // ── Top border stripe per shift ──
              const cellBorderTop =
                shiftType === 'morning'
                  ? '3px solid rgba(251,191,36,0.75)'
                  : shiftType === 'evening'
                    ? '3px solid rgba(167,139,250,0.72)'
                    : '2px dashed rgba(100,116,139,0.45)';

              // ── Bottom border for holiday ──
              const cellBorderBottom = holiday
                ? `2px solid ${HOLIDAY_COLOR[holiday.type]}`
                : undefined;

              // ── Right border for financial cycle events ──
              const finEvents = finCycleMap[dateStr];
              const cellBorderRight = finEvents?.[0]
                ? `3px solid ${finEvents[0].borderColor}`
                : undefined;

              return (
                <div
                  key={day}
                  onClick={() => handleSelectDate(dateStr)}
                  style={{
                    cursor: 'pointer',
                    background: cellBg,
                    borderTop: cellBorderTop,
                    borderBottom: cellBorderBottom,
                    borderRight: cellBorderRight,
                    boxShadow: isSelected ? 'inset 0 0 0 2px var(--gold)' : undefined,
                    opacity: shiftType === 'off' ? 0.72 : 1,
                  }}
                  className={`cal-cell ${isToday ? 'cal-cell--today' : ''} ${
                    shiftType === 'morning' ? 'cal-cell--morning' : ''
                  } ${shiftType === 'evening' ? 'cal-cell--evening' : ''} ${
                    shiftType === 'off' ? 'cal-cell--off' : ''
                  } ${dayTasks.length > 0 || hasExpenses ? 'cal-cell--has-tasks' : ''} ${
                    snapSummaries[dateStr] ? 'cal-cell--has-snapshot' : ''
                  }`}
                >
                  <span
                    className="cal-day-num"
                    style={{
                      color:
                        shiftType === 'morning'
                          ? 'rgba(251,191,36,0.92)'
                          : shiftType === 'evening'
                            ? 'rgba(167,139,250,0.92)'
                            : 'rgba(var(--gold-rgb),0.35)',
                    }}
                  >
                    {day}
                  </span>
                  {hasNotes && (
                    <span style={{ position: 'absolute', top: 4, right: 4, fontSize: '10px' }}>
                      📝
                    </span>
                  )}
                  {/* Holiday icon bottom-left */}
                  {holiday && (
                    <span className="cal-cell-holiday" title={holiday.name}>
                      {holiday.icon}
                    </span>
                  )}
                  {/* Financial event icon — bottom-right corner */}
                  {finEvents && finEvents.length > 0 && (
                    <span
                      className="cal-cell-fin"
                      title={finEvents.map((e) => e.label).join(' · ')}
                    >
                      {finEvents[0].icon}
                    </span>
                  )}
                  {/* Battery indicator for past days with snapshots */}
                  {snapSummaries[dateStr] && dateStr < today && (
                    <BatteryBar progress={snapSummaries[dateStr].progress} />
                  )}
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
            })}
          </div>

          {/* ── Shift legend ── */}
          <div className="cal-shift-legend">
            <span className="cal-shift-legend__item cal-shift-legend__item--morning">☀️ صباحي</span>
            <span className="cal-shift-legend__item cal-shift-legend__item--evening">🌙 مسائي</span>
            <span className="cal-shift-legend__item cal-shift-legend__item--off">🏖️ إجازة</span>
            <button
              className="cal-fin-settings-btn"
              onClick={() => setShowFinSettings((v) => !v)}
              title="إعدادات نبضة المال"
            >
              {showFinSettings ? '×' : '⚙️'}
            </button>
          </div>

          {/* ── Off-day warnings for this month ── */}
          {offDayWarnings.length > 0 && (
            <div className="cal-offday-warnings">
              {offDayWarnings.map((w) => (
                <div key={w.type} className={`cal-offday-warning cal-offday-warning--${w.type}`}>
                  <span className="cal-offday-warning__icon">
                    {w.type === 'excess' ? '⚠️' : '📅⚠️'}
                  </span>
                  <span className="cal-offday-warning__text">{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Financial settings panel ── */}
          {showFinSettings && (
            <div className="cal-fin-settings">
              <h4 className="cal-fin-settings__title">⚙️ إعدادات نبضة المال</h4>
              {(
                [
                  { key: 'govSalaryEnabled', label: '🏙️ رواتب القطاع الحكومي (27 ميلادي)' },
                  { key: 'gosiSalaryEnabled', label: '👴 معاشات GOSI (1 ميلادي)' },
                  { key: 'quotaCloseEnabled', label: '📊 إغلاق الحصة المبيعاتية (آخر الشهر)' },
                  { key: 'eidBonusEnabled', label: '🎁 موسم مكافأة العيد' },
                ] as const
              ).map(({ key, label }) => (
                <label key={key} className="cal-fin-settings__row">
                  <input
                    type="checkbox"
                    checked={finConfig[key]}
                    onChange={(e) => saveFinConfig({ [key]: e.target.checked })}
                  />
                  <span>{label}</span>
                </label>
              ))}
              <label className="cal-fin-settings__row">
                <span>🎁 أيام قبل العيد</span>
                <input
                  type="number"
                  min={7}
                  max={30}
                  value={finConfig.eidBonusDaysBefore}
                  onChange={(e) =>
                    saveFinConfig({
                      eidBonusDaysBefore: Math.max(7, Math.min(30, +e.target.value)),
                    })
                  }
                  className="cal-fin-settings__num"
                />
                <span>يوم</span>
              </label>
            </div>
          )}

          {/* ── نبضة المال — Financial Pulse Strip ── */}
          {upcomingFinEvents.length > 0 && (
            <div className="cal-fin-pulse">
              {upcomingFinEvents.slice(0, 6).map((ev, idx) => {
                const diffDays = Math.round(
                  (new Date(ev.date + 'T00:00:00').getTime() -
                    new Date(today + 'T00:00:00').getTime()) /
                    86_400_000
                );
                const isToday = diffDays === 0;
                return (
                  <div
                    key={`${ev.type}-${ev.date}-${idx}`}
                    className="cal-fin-card"
                    style={{ '--fin-color': ev.color } as React.CSSProperties}
                    onClick={() => {
                      const d = new Date(ev.date + 'T00:00:00');
                      setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
                      handleSelectDate(ev.date);
                    }}
                    title={ev.bannerText}
                  >
                    <span className="cal-fin-card__icon">{ev.icon}</span>
                    <span className="cal-fin-card__label">{ev.label}</span>
                    <span className="cal-fin-card__countdown">
                      {isToday ? '🟢 اليوم' : `${diffDays} يوم`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected day tasks */}
          <div className="cal-selected-tasks">
            <h3 className="cal-selected-title">
              المهام والاستحقاقات لـ{' '}
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ar-SA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h3>
            {/* ── Off-day exception toggle ── */}
            {selectedDateIsStructurallyOff && (
              <div className="cal-exception-row">
                <span className="cal-exception-row__label">
                  {selectedDateIsException
                    ? '✅ معتمد كيوم عمل (استثناء)'
                    : '🏖️ هذا اليوم إجازة وفق جدولك'}
                </span>
                <button
                  className={`cal-exception-btn ${selectedDateIsException ? 'cal-exception-btn--active' : ''}`}
                  onClick={() => toggleOffException(selectedDate)}
                >
                  {selectedDateIsException ? 'إلغاء الاستثناء' : 'اعتبره يوم عمل'}
                </button>
              </div>
            )}

            {/* Financial cycle context banner */}
            {(finCycleMap[selectedDate] ?? []).map((ev) => (
              <div
                key={ev.type}
                className="cal-fin-banner"
                style={{ '--fin-color': ev.color } as React.CSSProperties}
              >
                <span className="cal-fin-banner__icon">{ev.icon}</span>
                <span className="cal-fin-banner__text">{ev.bannerText}</span>
              </div>
            ))}

            {/* Holiday banner with adjustment controls */}
            {holidayMap[selectedDate] &&
              (() => {
                const h = holidayMap[selectedDate];
                const offset = holidayOffsets[h.groupId] ?? 0;
                const confirmed = !h.approximate || offset !== 0;
                const group = HOLIDAY_GROUPS.find((g) => g.id === h.groupId);
                const baseDate = group?.baseDates[h.dayIndex] ?? h.date;
                const confirmedDate = addDays(baseDate, offset);
                return (
                  <div
                    className="cal-holiday-banner"
                    style={{ borderColor: HOLIDAY_COLOR[h.type], color: HOLIDAY_COLOR[h.type] }}
                  >
                    <div className="cal-holiday-banner__row">
                      <span className="cal-holiday-banner__icon">{h.icon}</span>
                      <span className="cal-holiday-banner__name">{h.name}</span>
                      {h.approximate && !confirmed && (
                        <span className="cal-holiday-banner__approx">تقريبي</span>
                      )}
                      {confirmed && h.approximate && (
                        <span className="cal-holiday-banner__confirmed">✓ مؤكد</span>
                      )}
                    </div>
                    {h.approximate && h.dayIndex === 0 && (
                      <div className="cal-holiday-adj">
                        <span className="cal-holiday-adj__label">
                          {confirmed
                            ? `الموعد المؤكد: ${new Date(confirmedDate + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' })}`
                            : 'تأكيد الموعد بعد إعلان رؤية الهلال:'}
                        </span>
                        <div className="cal-holiday-adj__controls">
                          <button
                            className="cal-holiday-adj__btn"
                            onClick={() => adjustHoliday(h.groupId, -1)}
                            title="يوم قبل"
                          >
                            ◀
                          </button>
                          <span className="cal-holiday-adj__offset">
                            {offset === 0 ? '±٠' : offset > 0 ? `+${offset}` : `${offset}`}
                          </span>
                          <button
                            className="cal-holiday-adj__btn"
                            onClick={() => adjustHoliday(h.groupId, +1)}
                            title="يوم بعد"
                          >
                            ▶
                          </button>
                          {offset !== 0 && (
                            <button
                              className="cal-holiday-adj__btn cal-holiday-adj__btn--reset"
                              onClick={() => adjustHoliday(h.groupId, 'reset')}
                              title="إعادة ضبط"
                            >
                              ↩
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

            {selectedDateTasks.length === 0 && selectedDateFinance.length === 0 ? (
              <p className="cal-empty">لا توجد مهام أو استحقاقات في هذا اليوم</p>
            ) : (
              <div className="cal-date-tasks" style={{ marginTop: '16px' }}>
                {selectedDateFinance.map((fe) => (
                  <div
                    key={fe.id}
                    className="cal-task-item"
                    style={{
                      borderRight: `3px solid var(--danger)`,
                      paddingRight: '8px',
                    }}
                  >
                    <span>{fe.icon}</span>
                    <span
                      style={{
                        color: 'var(--danger)',
                        flex: 1,
                      }}
                    >
                      {fe.title} ({(fe.amount || 0).toLocaleString('ar-SA')} ر.س)
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>⏳ مستحق</span>
                  </div>
                ))}
                {selectedDateTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isChecked={!!tm.checked[task.id]}
                    taskSubChecked={tm.taskSubCheckedMap[task.id]}
                  />
                ))}
              </div>
            )}

            {/* Upgraded Notes Panel */}
            <NotesPanel
              date={selectedDate}
              notes={selectedDateNotes}
              onAdd={addNote}
              onUpdate={updateNote}
              onDelete={deleteNote}
              onTogglePin={togglePin}
            />

            <HistoryPanel
              selectedDate={selectedDate}
              today={today}
              snapSummaries={snapSummaries}
              selectedSnapshot={selectedSnapshot}
              loadingSnapshot={loadingSnapshot}
              onRefresh={refreshSnapSummaries}
            />

            <SyncStatusBar syncStatus={syncStatus} syncError={syncError} onRetry={retrySync} />
          </div>
        </>
      )}
      <ConflictDialog
        visible={!!conflictState}
        onKeepLocal={resolveKeepLocal}
        onUseServer={resolveUseServer}
      />
    </div>
  );
}
