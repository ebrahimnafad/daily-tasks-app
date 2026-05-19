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

const DAYS = [
  'Ø£Ø­Ø¯',
  'Ø¥Ø«Ù†ÙŠÙ†',
  'Ø«Ù„Ø§Ø«Ø§Ø¡',
  'Ø£Ø±Ø¨Ø¹Ø§Ø¡',
  'Ø®Ù…ÙŠØ³',
  'Ø¬Ù…Ø¹Ø©',
  'Ø³Ø¨Øª',
];
const MONTHS = [
  'ÙŠÙ†Ø§ÙŠØ±',
  'ÙØ¨Ø±Ø§ÙŠØ±',
  'Ù…Ø§Ø±Ø³',
  'Ø£Ø¨Ø±ÙŠÙ„',
  'Ù…Ø§ÙŠÙˆ',
  'ÙŠÙˆÙ†ÙŠÙˆ',
  'ÙŠÙˆÙ„ÙŠÙˆ',
  'Ø£ØºØ³Ø·Ø³',
  'Ø³Ø¨ØªÙ…Ø¨Ø±',
  'Ø£ÙƒØªÙˆØ¨Ø±',
  'Ù†ÙˆÙÙ…Ø¨Ø±',
  'Ø¯ÙŠØ³Ù…Ø¨Ø±',
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

  // â”€â”€ Schedule shift config (reactive to storage changes from other tabs) â”€â”€
  const LS_SCHEDULE_KEY = 'mhm_schedule';
  const [schedule, setSchedule] = useState<ShiftConfig[]>(() =>
    lsGet<ShiftConfig[]>(LS_SCHEDULE_KEY, DEFAULT_SHIFTS)
  );
  const [shiftEpoch, setShiftEpoch] = useState<string>(() =>
    lsGet<string>(DEFAULT_EPOCH_KEY, getMostRecentFriday())
  );

  // â”€â”€ Off-day exceptions (per-date overrides: off â†’ work) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Work-day exceptions (per-date overrides: work â†’ off) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const LS_WORK_EXCEPTIONS_KEY = 'mhm_work_exceptions';
  const [workExceptions, setWorkExceptions] = useState<string[]>(() =>
    lsGet<string[]>(LS_WORK_EXCEPTIONS_KEY, [])
  );

  const toggleWorkException = useCallback((dateStr: string) => {
    setWorkExceptions((prev) => {
      const next = prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr];
      lsSet(LS_WORK_EXCEPTIONS_KEY, next);
      return next;
    });
  }, []);

  // â”€â”€ Annual vacation days (user-scheduled leave, separate from weekly offs) â”€â”€
  const LS_VACATION_DAYS_KEY = 'mhm_vacation_days';
  const LS_VACATION_BALANCE_KEY = 'mhm_vacation_balance';
  const [vacationDays, setVacationDays] = useState<string[]>(() =>
    lsGet<string[]>(LS_VACATION_DAYS_KEY, [])
  );
  const [vacationBalance, setVacationBalance] = useState<number>(() =>
    lsGet<number>(LS_VACATION_BALANCE_KEY, 30)
  );

  const toggleVacationDay = useCallback((dateStr: string) => {
    setVacationDays((prev) => {
      const next = prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr];
      lsSet(LS_VACATION_DAYS_KEY, next);
      return next;
    });
  }, []);

  const saveVacationBalance = useCallback((val: number) => {
    setVacationBalance(val);
    lsSet(LS_VACATION_BALANCE_KEY, val);
  }, []);

  // â”€â”€ Vacation range picker state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [showVacPicker, setShowVacPicker] = useState(false);
  const [vacRangeStart, setVacRangeStart] = useState('');
  const [vacRangeEnd, setVacRangeEnd] = useState('');
  const [vacSkipOffDays, setVacSkipOffDays] = useState(true);

  /** Classify a calendar date as morning-shift, evening-shift, or off-day.
   *  Priority: vacation > work-exception > schedule > off-exception */
  const getDayShiftType = useCallback(
    (dateStr: string): DayShiftType => {
      // Annual vacation day
      if (vacationDays.includes(dateStr)) return 'off';
      // Work-day marked as exceptional off
      if (workExceptions.includes(dateStr)) return 'off';
      const date = new Date(dateStr + 'T12:00:00');
      const shiftId = computeShift(shiftEpoch, schedule, date);
      const shift = schedule.find((s) => s.id === shiftId);
      const dow = date.getDay();
      if (shift?.offDays.includes(dow)) {
        // Off-day marked as exceptional work day
        if (offExceptions.includes(dateStr)) return shiftId as DayShiftType;
        return 'off';
      }
      return shiftId as DayShiftType;
    },
    [schedule, shiftEpoch, offExceptions, workExceptions, vacationDays]
  );

  // â”€â”€ Holiday offsets (user-confirmed moon-sighting adjustments) â”€â”€â”€â”€
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

  // â”€â”€ Holiday data (AlAdhan API + static fallback) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { holidayMap, eidFitrDates } = useHolidayData(holidayOffsets);

  // â”€â”€ Financial cycle config + pulse strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  /** Upcoming events within 60 days â€” for the Pulse Strip */
  const upcomingFinEvents = useMemo(
    () => computeFinCycleEvents(finConfig, eidFitrDates, today, 60),
    [finConfig, eidFitrDates, today]
  );

  // â”€â”€ Snapshot summaries (for battery indicator) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        /* offline â€” silent */
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

  // â”€â”€ Battery helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const BatteryBar = ({ progress }: { progress: number }) => {
    const filled = Math.round((progress / 100) * 5);
    const color = progress >= 80 ? '#9bc87a' : progress >= 50 ? '#e6a855' : '#d97e6a';
    return (
      <div className="cal-battery" aria-label={`Ø¥Ù†Ø¬Ø§Ø² ${progress}%`}>
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

  // â”€â”€ Notes sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [searchQuery, setSearchQuery] = useState('');
  const searchResults = useNoteSearch(notes, searchQuery);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  /** Date â†’ FinCycleEvent[] map for visible month â€” cell right-border.
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
        return t.recurrence === 'Ù…ÙˆØ¹Ø¯ Ù…Ø­Ø¯Ø¯' && t.date === dateStr;
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

  // â”€â”€ Off-day warnings for the viewed month â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Inline the shift-type logic to avoid a useCallback dependency (React Compiler rule).
  const offDayWarnings = useMemo(() => {
    const warnings: { type: string; message: string }[] = [];
    const days = new Date(year, month + 1, 0).getDate();
    let offCount = 0;
    let hasLateOffDay = false;
    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      // Work-day manually marked as off
      if (workExceptions.includes(dateStr)) {
        offCount++;
        if (d >= 26) hasLateOffDay = true;
        continue;
      }
      const date = new Date(dateStr + 'T12:00:00');
      const shiftId = computeShift(shiftEpoch, schedule, date);
      const shift = schedule.find((s) => s.id === shiftId);
      const isStructurallyOff = !!shift?.offDays.includes(date.getDay());
      const isOffException = offExceptions.includes(dateStr);
      if (isStructurallyOff && !isOffException) {
        offCount++;
        if (d >= 26) hasLateOffDay = true;
      }
    }
    if (offCount > 4)
      warnings.push({
        type: 'excess',
        message: `ÙŠÙˆØ¬Ø¯ ${offCount} Ø£ÙŠØ§Ù… Ø¥Ø¬Ø§Ø²Ø© Ù‡Ø°Ø§ Ø§Ù„Ø´Ù‡Ø± (ÙŠØªØ¬Ø§ÙˆØ² Ø§Ù„Ø­Ø¯ Ø§Ù„Ù…Ø¹ØªØ§Ø¯ 4)`,
      });
    if (hasLateOffDay)
      warnings.push({
        type: 'late',
        message:
          'ÙŠÙˆØ¬Ø¯ ÙŠÙˆÙ… Ø¥Ø¬Ø§Ø²Ø© Ø¨Ø¹Ø¯ Ø§Ù„ÙŠÙˆÙ… 26 â€” Ù‚Ø¯ ÙŠØ¤Ø«Ø± Ø¹Ù„Ù‰ Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„Ø­ØµØ© Ø§Ù„Ø´Ù‡Ø±ÙŠØ©',
      });
    return warnings;
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [year, month, shiftEpoch, schedule, offExceptions, workExceptions]);

  // â”€â”€ Preview of dates in the selected range (excluding already-tagged days) â”€â”€
  const vacRangePreview = useMemo(() => {
    if (!vacRangeStart || !vacRangeEnd || vacRangeEnd < vacRangeStart) return [];
    const dates: string[] = [];
    const d = new Date(vacRangeStart + 'T12:00:00');
    const end = new Date(vacRangeEnd + 'T12:00:00');
    while (d <= end) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!vacationDays.includes(dateStr)) {
        if (vacSkipOffDays) {
          // Inline shift check â€” same logic as getDayShiftType without vacation layer
          if (!workExceptions.includes(dateStr)) {
            const shiftId = computeShift(shiftEpoch, schedule, d);
            const shift = schedule.find((s) => s.id === shiftId);
            const isStructOff = !!shift?.offDays.includes(d.getDay());
            if (!isStructOff || offExceptions.includes(dateStr)) {
              dates.push(dateStr);
            }
          }
        } else {
          dates.push(dateStr);
        }
      }
      d.setDate(d.getDate() + 1);
    }
    return dates;
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [
    vacRangeStart,
    vacRangeEnd,
    vacSkipOffDays,
    vacationDays,
    workExceptions,
    offExceptions,
    schedule,
    shiftEpoch,
  ]);

  const applyVacationRange = useCallback(() => {
    if (vacRangePreview.length === 0) return;
    setVacationDays((prev) => {
      const set = new Set(prev);
      vacRangePreview.forEach((d) => set.add(d));
      const next = Array.from(set).sort();
      lsSet(LS_VACATION_DAYS_KEY, next);
      return next;
    });
    setShowVacPicker(false);
    setVacRangeStart('');
    setVacRangeEnd('');
  }, [vacRangePreview]);

  // True if the selected date is a structural off-day (before exception override)
  const selectedDateIsStructurallyOff = useMemo(() => {
    const date = new Date(selectedDate + 'T12:00:00');
    const shiftId = computeShift(shiftEpoch, schedule, date);
    const shift = schedule.find((s) => s.id === shiftId);
    return !!shift?.offDays.includes(date.getDay());
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [selectedDate, shiftEpoch, schedule]);
  const selectedDateIsException = offExceptions.includes(selectedDate);
  // True when a structurally normal work day has been manually marked as off
  const selectedDateIsWorkException = workExceptions.includes(selectedDate);
  // True when the selected date is tagged as an annual vacation day
  const selectedDateIsVacation = vacationDays.includes(selectedDate);

  // â”€â”€ Vacation balance for the viewed year â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const vacationStats = useMemo(() => {
    const yearStr = String(year);
    const used = vacationDays.filter((d) => d.startsWith(yearStr)).length;
    return { used, remaining: vacationBalance - used, overused: used > vacationBalance };
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [vacationDays, vacationBalance, year]);

  return (
    <div className="cal-view">
      {/* Header */}
      <div className="cal-header">
        <button className="cal-nav" onClick={goToPrevMonth}>
          â—€
        </button>
        <div className="cal-title">
          <span>{MONTHS[month]}</span>
          <span style={{ fontWeight: 400 }}>{year}</span>
        </div>
        <button className="cal-nav" onClick={goToNextMonth}>
          â–¶
        </button>
      </div>

      <button className="cal-today-btn" onClick={goToToday}>
        Ø§Ù„ÙŠÙˆÙ…
      </button>

      {/* Search bar */}
      <div className="cal-search-bar">
        <span className="cal-search-icon">ðŸ”</span>
        <input
          type="text"
          className="cal-search-input"
          placeholder="Ø§Ø¨Ø­Ø« ÙÙŠ Ø§Ù„Ù…Ù„Ø§Ø­Ø¸Ø§Øª..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          dir="auto"
        />
        {searchQuery && (
          <button className="cal-search-clear" onClick={() => setSearchQuery('')}>
            âœ•
          </button>
        )}
      </div>

      {/* Search results (shown instead of calendar when searching) */}
      {searchQuery ? (
        <div className="cal-search-results">
          {searchResults.length === 0 ? (
            <p className="cal-empty">Ù„Ø§ ØªÙˆØ¬Ø¯ Ù†ØªØ§Ø¦Ø¬ Ù„Ù„Ø¨Ø­Ø«</p>
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
                  {note.pinned && ' ðŸ“Œ'}
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
              const isVacationDay = vacationDays.includes(dateStr);

              // â”€â”€ Compute cell background (shift tint + heatmap blended) â”€â”€
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

              // â”€â”€ Top border stripe per shift â”€â”€
              const cellBorderTop =
                shiftType === 'morning'
                  ? '3px solid rgba(251,191,36,0.75)'
                  : shiftType === 'evening'
                    ? '3px solid rgba(167,139,250,0.72)'
                    : '2px dashed rgba(100,116,139,0.45)';

              // â”€â”€ Bottom border for holiday â”€â”€
              const cellBorderBottom = holiday
                ? `2px solid ${HOLIDAY_COLOR[holiday.type]}`
                : undefined;

              // â”€â”€ Right border for financial cycle events â”€â”€
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
                      ðŸ“
                    </span>
                  )}
                  {/* Vacation icon â€” top-left corner */}
                  {isVacationDay && (
                    <span className="cal-cell-vacation" title="Ø¥Ø¬Ø§Ø²Ø© Ø³Ù†ÙˆÙŠØ©">
                      ðŸŒ´
                    </span>
                  )}
                  {/* Holiday icon bottom-left */}
                  {holiday && (
                    <span className="cal-cell-holiday" title={holiday.name}>
                      {holiday.icon}
                    </span>
                  )}
                  {/* Financial event icon â€” bottom-right corner */}
                  {finEvents && finEvents.length > 0 && (
                    <span
                      className="cal-cell-fin"
                      title={finEvents.map((e) => e.label).join(' Â· ')}
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
                        ðŸ’°
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

          {/* â”€â”€ Shift legend â”€â”€ */}
          <div className="cal-shift-legend">
            <span className="cal-shift-legend__item cal-shift-legend__item--morning">
              â˜€ï¸ ØµØ¨Ø§Ø­ÙŠ
            </span>
            <span className="cal-shift-legend__item cal-shift-legend__item--evening">
              ðŸŒ™ Ù…Ø³Ø§Ø¦ÙŠ
            </span>
            <span className="cal-shift-legend__item cal-shift-legend__item--off">
              ðŸ–ï¸ Ø¥Ø¬Ø§Ø²Ø©
            </span>
            <button
              className="cal-fin-settings-btn"
              onClick={() => setShowFinSettings((v) => !v)}
              title="Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ù†Ø¨Ø¶Ø© Ø§Ù„Ù…Ø§Ù„"
            >
              {showFinSettings ? 'Ã—' : 'âš™ï¸'}
            </button>
          </div>

          {/* â”€â”€ Off-day warnings for this month â”€â”€ */}
          {offDayWarnings.length > 0 && (
            <div className="cal-offday-warnings">
              {offDayWarnings.map((w) => (
                <div key={w.type} className={`cal-offday-warning cal-offday-warning--${w.type}`}>
                  <span className="cal-offday-warning__icon">
                    {w.type === 'excess' ? 'âš ï¸' : 'ðŸ“…âš ï¸'}
                  </span>
                  <span className="cal-offday-warning__text">{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* â”€â”€ Annual vacation balance bar â”€â”€ */}
          <div className="cal-vacation-bar">
            <span className="cal-vacation-bar__label">
              ðŸŒ´ Ø§Ù„Ø¥Ø¬Ø§Ø²Ø© Ø§Ù„Ø³Ù†ÙˆÙŠØ© {year}
            </span>
            <div className="cal-vacation-bar__track">
              <div
                className={`cal-vacation-bar__fill ${
                  vacationStats.overused ? 'cal-vacation-bar__fill--over' : ''
                }`}
                style={{
                  width: `${Math.min(100, (vacationStats.used / vacationBalance) * 100)}%`,
                }}
              />
            </div>
            <span
              className={`cal-vacation-bar__count ${
                vacationStats.overused ? 'cal-vacation-bar__count--over' : ''
              }`}
            >
              {vacationStats.used} / {vacationBalance}
            </span>
            <button
              className={`cal-vacation-bar__range-btn ${showVacPicker ? 'cal-vacation-bar__range-btn--active' : ''}`}
              onClick={() => setShowVacPicker((v) => !v)}
              title="ØªØ­Ø¯ÙŠØ¯ Ø¥Ø¬Ø§Ø²Ø© Ø¨Ø§Ù„Ù†Ø·Ø§Ù‚"
            >
              {showVacPicker ? 'Ã—' : 'ðŸ“… Ù†Ø·Ø§Ù‚'}
            </button>
          </div>

          {/* â”€â”€ Vacation range picker panel â”€â”€ */}
          {showVacPicker && (
            <div className="cal-vac-picker">
              <div className="cal-vac-picker__row">
                <label className="cal-vac-picker__lbl">Ù…Ù†</label>
                <input
                  type="date"
                  className="cal-vac-picker__date"
                  value={vacRangeStart}
                  title="ØªØ§Ø±ÙŠØ® Ø¨Ø¯Ø§ÙŠØ© Ø§Ù„Ø¥Ø¬Ø§Ø²Ø©"
                  onChange={(e) => setVacRangeStart(e.target.value)}
                />
                <label className="cal-vac-picker__lbl">Ø¥Ù„Ù‰</label>
                <input
                  type="date"
                  className="cal-vac-picker__date"
                  value={vacRangeEnd}
                  min={vacRangeStart}
                  title="ØªØ§Ø±ÙŠØ® Ù†Ù‡Ø§ÙŠØ© Ø§Ù„Ø¥Ø¬Ø§Ø²Ø©"
                  onChange={(e) => setVacRangeEnd(e.target.value)}
                />
              </div>
              <label className="cal-vac-picker__check">
                <input
                  type="checkbox"
                  checked={vacSkipOffDays}
                  onChange={(e) => setVacSkipOffDays(e.target.checked)}
                />
                <span>
                  ØªØ¬Ø§Ù‡Ù„ Ø£ÙŠØ§Ù… Ø§Ù„Ø¥Ø¬Ø§Ø²Ø© Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹ÙŠØ© (Ù„Ø§ ØªØ®ØµÙ… Ù…Ù†
                  Ø§Ù„Ø±ØµÙŠØ¯)
                </span>
              </label>
              {vacRangePreview.length > 0 && (
                <div
                  className={`cal-vac-picker__preview ${
                    vacationStats.remaining - vacRangePreview.length < 0
                      ? 'cal-vac-picker__preview--over'
                      : ''
                  }`}
                >
                  ðŸŒ´ Ø³ÙŠÙØ­Ø¬Ø² {vacRangePreview.length} ÙŠÙˆÙ…Ø§Ù‹ â€” Ù…ØªØ¨Ù‚ÙŠ Ø¨Ø¹Ø¯Ù‡Ø§:{' '}
                  <strong>{vacationStats.remaining - vacRangePreview.length} ÙŠÙˆÙ…</strong>
                </div>
              )}
              {vacRangeStart &&
                vacRangeEnd &&
                vacRangeEnd >= vacRangeStart &&
                vacRangePreview.length === 0 && (
                  <div className="cal-vac-picker__preview">
                    Ù„Ø§ ØªÙˆØ¬Ø¯ Ø£ÙŠØ§Ù… Ø¬Ø¯ÙŠØ¯Ø© Ù„ØªØ­Ø¬ÙŠØ²Ù‡Ø§ ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„Ù†Ø·Ø§Ù‚
                  </div>
                )}
              <div className="cal-vac-picker__actions">
                <button
                  className="cal-vac-picker__apply"
                  onClick={applyVacationRange}
                  disabled={
                    vacRangePreview.length === 0 ||
                    vacationStats.remaining - vacRangePreview.length < 0
                  }
                >
                  ØªØ·Ø¨ÙŠÙ‚ âœ“
                </button>
                <button
                  className="cal-vac-picker__cancel"
                  onClick={() => {
                    setShowVacPicker(false);
                    setVacRangeStart('');
                    setVacRangeEnd('');
                  }}
                >
                  Ø¥Ù„ØºØ§Ø¡
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ Financial settings panel â”€â”€ */}
          {showFinSettings && (
            <div className="cal-fin-settings">
              <h4 className="cal-fin-settings__title">âš™ï¸ Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ù†Ø¨Ø¶Ø© Ø§Ù„Ù…Ø§Ù„</h4>
              {(
                [
                  {
                    key: 'govSalaryEnabled',
                    label: 'ðŸ™ï¸ Ø±ÙˆØ§ØªØ¨ Ø§Ù„Ù‚Ø·Ø§Ø¹ Ø§Ù„Ø­ÙƒÙˆÙ…ÙŠ (27 Ù…ÙŠÙ„Ø§Ø¯ÙŠ)',
                  },
                  { key: 'gosiSalaryEnabled', label: 'ðŸ‘´ Ù…Ø¹Ø§Ø´Ø§Øª GOSI (1 Ù…ÙŠÙ„Ø§Ø¯ÙŠ)' },
                  {
                    key: 'quotaCloseEnabled',
                    label: 'ðŸ“Š Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„Ø­ØµØ© Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§ØªÙŠØ© (Ø¢Ø®Ø± Ø§Ù„Ø´Ù‡Ø±)',
                  },
                  { key: 'eidBonusEnabled', label: 'ðŸŽ Ù…ÙˆØ³Ù… Ù…ÙƒØ§ÙØ£Ø© Ø§Ù„Ø¹ÙŠØ¯' },
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
                <span>ðŸŽ Ø£ÙŠØ§Ù… Ù‚Ø¨Ù„ Ø§Ù„Ø¹ÙŠØ¯</span>
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
                <span>ÙŠÙˆÙ…</span>
              </label>
              <label className="cal-fin-settings__row">
                <span>ðŸŒ´ Ø±ØµÙŠØ¯ Ø§Ù„Ø¥Ø¬Ø§Ø²Ø© Ø§Ù„Ø³Ù†ÙˆÙŠØ©</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={vacationBalance}
                  onChange={(e) => saveVacationBalance(Math.max(1, Math.min(60, +e.target.value)))}
                  className="cal-fin-settings__num"
                />
                <span>ÙŠÙˆÙ…/Ø³Ù†Ø©</span>
              </label>
            </div>
          )}

          {/* â”€â”€ Ù†Ø¨Ø¶Ø© Ø§Ù„Ù…Ø§Ù„ â€” Financial Pulse Strip â”€â”€ */}
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
                      {isToday ? 'ðŸŸ¢ Ø§Ù„ÙŠÙˆÙ…' : `${diffDays} ÙŠÙˆÙ…`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected day tasks */}
          <div className="cal-selected-tasks">
            <h3 className="cal-selected-title">
              Ø§Ù„Ù…Ù‡Ø§Ù… ÙˆØ§Ù„Ø§Ø³ØªØ­Ù‚Ø§Ù‚Ø§Øª Ù„Ù€{' '}
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ar-SA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h3>
            {/* â”€â”€ Off-day exception toggle (off â†’ work) â”€â”€ */}
            {selectedDateIsStructurallyOff && (
              <div className="cal-exception-row">
                <span className="cal-exception-row__label">
                  {selectedDateIsException
                    ? 'âœ… Ù…Ø¹ØªÙ…Ø¯ ÙƒÙŠÙˆÙ… Ø¹Ù…Ù„ (Ø§Ø³ØªØ«Ù†Ø§Ø¡)'
                    : 'ðŸ–ï¸ Ù‡Ø°Ø§ Ø§Ù„ÙŠÙˆÙ… Ø¥Ø¬Ø§Ø²Ø© ÙˆÙÙ‚ Ø¬Ø¯ÙˆÙ„Ùƒ'}
                </span>
                <button
                  className={`cal-exception-btn ${selectedDateIsException ? 'cal-exception-btn--active' : ''}`}
                  onClick={() => toggleOffException(selectedDate)}
                >
                  {selectedDateIsException
                    ? 'Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø§Ø³ØªØ«Ù†Ø§Ø¡'
                    : 'Ø§Ø¹ØªØ¨Ø±Ù‡ ÙŠÙˆÙ… Ø¹Ù…Ù„'}
                </button>
              </div>
            )}

            {/* â”€â”€ Work-day exception toggle (work â†’ off) â”€â”€ */}
            {!selectedDateIsStructurallyOff && (
              <div
                className={`cal-exception-row ${selectedDateIsWorkException ? 'cal-exception-row--off' : ''}`}
              >
                <span className="cal-exception-row__label">
                  {selectedDateIsWorkException
                    ? 'ðŸ–ï¸ Ù…Ø¹ØªÙ…Ø¯ ÙƒÙŠÙˆÙ… Ø¥Ø¬Ø§Ø²Ø© Ø§Ø³ØªØ«Ù†Ø§Ø¦ÙŠ'
                    : 'ðŸ’¼ Ù‡Ø°Ø§ Ø§Ù„ÙŠÙˆÙ… Ø¹Ù…Ù„ ÙˆÙÙ‚ Ø¬Ø¯ÙˆÙ„Ùƒ'}
                </span>
                <button
                  className={`cal-exception-btn ${selectedDateIsWorkException ? 'cal-exception-btn--off' : ''}`}
                  onClick={() => toggleWorkException(selectedDate)}
                >
                  {selectedDateIsWorkException
                    ? 'Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø§Ø³ØªØ«Ù†Ø§Ø¡'
                    : 'Ø§Ø¹ØªØ¨Ø±Ù‡ Ø¥Ø¬Ø§Ø²Ø© Ø§Ø³ØªØ«Ù†Ø§Ø¦ÙŠØ©'}
                </button>
              </div>
            )}

            {/* â”€â”€ Annual vacation toggle â”€â”€ */}
            <div
              className={`cal-exception-row ${
                selectedDateIsVacation ? 'cal-exception-row--vacation' : ''
              }`}
            >
              <span className="cal-exception-row__label">
                {selectedDateIsVacation
                  ? `ðŸŒ´ Ø¥Ø¬Ø§Ø²Ø© Ø³Ù†ÙˆÙŠØ© (Ù…ØªØ¨Ù‚ÙŠ: ${vacationStats.remaining} ÙŠÙˆÙ…)`
                  : `ðŸŒ´ Ø±ØµÙŠØ¯ Ø§Ù„Ø¥Ø¬Ø§Ø²Ø© Ø§Ù„Ø³Ù†ÙˆÙŠØ©: ${vacationStats.remaining} ÙŠÙˆÙ…`}
              </span>
              <button
                className={`cal-exception-btn ${
                  selectedDateIsVacation ? 'cal-exception-btn--vacation' : ''
                }`}
                onClick={() => toggleVacationDay(selectedDate)}
                disabled={!selectedDateIsVacation && vacationStats.remaining <= 0}
                title={
                  !selectedDateIsVacation && vacationStats.remaining <= 0
                    ? 'Ø§Ù†ØªÙ‡Ù‰ Ø±ØµÙŠØ¯ Ø¥Ø¬Ø§Ø²ØªÙƒ Ø§Ù„Ø³Ù†ÙˆÙŠØ©'
                    : undefined
                }
              >
                {selectedDateIsVacation
                  ? 'Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø¥Ø¬Ø§Ø²Ø©'
                  : 'Ø¥Ø¬Ø§Ø²Ø© Ø³Ù†ÙˆÙŠØ© ðŸŒ´'}
              </button>
            </div>

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
                        <span className="cal-holiday-banner__approx">ØªÙ‚Ø±ÙŠØ¨ÙŠ</span>
                      )}
                      {confirmed && h.approximate && (
                        <span className="cal-holiday-banner__confirmed">âœ“ Ù…Ø¤ÙƒØ¯</span>
                      )}
                    </div>
                    {h.approximate && h.dayIndex === 0 && (
                      <div className="cal-holiday-adj">
                        <span className="cal-holiday-adj__label">
                          {confirmed
                            ? `Ø§Ù„Ù…ÙˆØ¹Ø¯ Ø§Ù„Ù…Ø¤ÙƒØ¯: ${new Date(confirmedDate + 'T12:00:00').toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' })}`
                            : 'ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ù…ÙˆØ¹Ø¯ Ø¨Ø¹Ø¯ Ø¥Ø¹Ù„Ø§Ù† Ø±Ø¤ÙŠØ© Ø§Ù„Ù‡Ù„Ø§Ù„:'}
                        </span>
                        <div className="cal-holiday-adj__controls">
                          <button
                            className="cal-holiday-adj__btn"
                            onClick={() => adjustHoliday(h.groupId, -1)}
                            title="ÙŠÙˆÙ… Ù‚Ø¨Ù„"
                          >
                            â—€
                          </button>
                          <span className="cal-holiday-adj__offset">
                            {offset === 0 ? 'Â±Ù ' : offset > 0 ? `+${offset}` : `${offset}`}
                          </span>
                          <button
                            className="cal-holiday-adj__btn"
                            onClick={() => adjustHoliday(h.groupId, +1)}
                            title="ÙŠÙˆÙ… Ø¨Ø¹Ø¯"
                          >
                            â–¶
                          </button>
                          {offset !== 0 && (
                            <button
                              className="cal-holiday-adj__btn cal-holiday-adj__btn--reset"
                              onClick={() => adjustHoliday(h.groupId, 'reset')}
                              title="Ø¥Ø¹Ø§Ø¯Ø© Ø¶Ø¨Ø·"
                            >
                              â†©
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

            {selectedDateTasks.length === 0 && selectedDateFinance.length === 0 ? (
              <p className="cal-empty">
                Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ù‡Ø§Ù… Ø£Ùˆ Ø§Ø³ØªØ­Ù‚Ø§Ù‚Ø§Øª ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„ÙŠÙˆÙ…
              </p>
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
                      {fe.title} ({(fe.amount || 0).toLocaleString('ar-SA')} Ø±.Ø³)
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      â³ Ù…Ø³ØªØ­Ù‚
                    </span>
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
