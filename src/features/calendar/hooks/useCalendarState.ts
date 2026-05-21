// ── useCalendarState ──────────────────────────────────────────────────────────
// Extracted from CalendarPage.tsx (F-2 decomposition).
// Owns every piece of local state, derived computation, and event handler that
// CalendarPage previously managed inline.  CalendarPage is now a thin compositor
// that calls this hook and passes its return values to child components.

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSchedule } from '@/lib/sync/useScheduleSync';
import type { Task } from '@/types';
import type { SnapshotSummary, DailySnapshot } from '@/types';
import type { Expense, Transaction } from '@/features/finance/types';
import { KEYS } from '@/features/finance/hooks/useFinanceSync';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { authFetch } from '@/features/auth/authFetch';
import useNotesSync from '../useNotesSync';
import useNoteSearch from '../useNoteSearch';

import {
  computeShift,
  getMostRecentFriday,
  DEFAULT_EPOCH_KEY,
  DEFAULT_SHIFTS,
  DAY_START_HOUR_KEY,
  getLogicalDateISO,
} from '@/features/tasks/data/scheduleConfig';
import type { ShiftConfig } from '@/features/tasks/data/scheduleConfig';
import { LS_HOLIDAY_OFFSETS } from '../holidays';
import { useHolidayData } from '../useHolidayData';
import {
  defaultFinConfig,
  LS_FIN_CYCLE_CONFIG,
  computeFinCycleEvents,
  buildFinCycleMap,
} from '../financialCycles';
import type { FinCycleConfig } from '../financialCycles';
import type { DayShiftType } from '../constants';
import type { CalendarNote, FinanceEvent } from '../types';

// ─── Storage keys ─────────────────────────────────────────────────────────────
const LS_SCHEDULE_KEY = 'mhm_schedule';
const LS_OFF_EXCEPTIONS_KEY = 'mhm_off_exceptions';
const LS_WORK_EXCEPTIONS_KEY = 'mhm_work_exceptions';
const LS_VACATION_DAYS_KEY = 'mhm_vacation_days';
const LS_VACATION_BALANCE_KEY = 'mhm_vacation_balance';
const LS_SNAP_SUMMARIES_KEY = 'mhm_snap_summaries';
const LS_LAST_SNAP_KEY = 'mhm_last_manual_snapshot_at';

// ─── Hook input ───────────────────────────────────────────────────────────────
interface UseCalendarStateInput {
  tasks: Task[];
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useCalendarState({
  tasks,
  currentDate,
  setCurrentDate,
  selectedDate,
  setSelectedDate,
}: UseCalendarStateInput) {
  // ── Logical "today" (respects custom day-start hour) ──────────────────────
  const [today, setToday] = useState(() => {
    const dayStartHour = lsGet<number>(DAY_START_HOUR_KEY, 0);
    return getLogicalDateISO(dayStartHour);
  });

  useEffect(() => {
    const tick = () => {
      const dayStartHour = lsGet<number>(DAY_START_HOUR_KEY, 0);
      setToday(getLogicalDateISO(dayStartHour));
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Shift schedule ────────────────────────────────────────────────────────
  const [schedule, setSchedule] = useState<ShiftConfig[]>(() =>
    lsGet<ShiftConfig[]>(LS_SCHEDULE_KEY, DEFAULT_SHIFTS)
  );
  const [shiftEpoch, setShiftEpoch] = useState<string>(() =>
    lsGet<string>(DEFAULT_EPOCH_KEY, getMostRecentFriday())
  );

  // ── Off-day exceptions (off → work) ──────────────────────────────────────
  const [offExceptions, setOffExceptions] = useState<string[]>(() =>
    lsGet<string[]>(LS_OFF_EXCEPTIONS_KEY, [])
  );

  // ── Work-day exceptions (work → off) ─────────────────────────────────────
  const [workExceptions, setWorkExceptions] = useState<string[]>(() =>
    lsGet<string[]>(LS_WORK_EXCEPTIONS_KEY, [])
  );

  // ── Annual vacation days ──────────────────────────────────────────────────
  const [vacationDays, setVacationDays] = useState<string[]>(() =>
    lsGet<string[]>(LS_VACATION_DAYS_KEY, [])
  );
  const [vacationBalance, setVacationBalance] = useState<number>(() =>
    lsGet<number>(LS_VACATION_BALANCE_KEY, 30)
  );

  const queryClient = useQueryClient();
  const { data: scheduleData } = useQuery<{
    schedule: ShiftConfig[];
    offExceptions: string[];
    workExceptions: string[];
    vacationDays: string[];
    vacationBalance: number;
    timestamp: number;
  }>({
    queryKey: ['schedule'],
    queryFn: fetchSchedule,
  });

  useEffect(() => {
    if (scheduleData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSchedule(scheduleData.schedule);
      setOffExceptions(scheduleData.offExceptions);
      setWorkExceptions(scheduleData.workExceptions);
      setVacationDays(scheduleData.vacationDays);
      setVacationBalance(scheduleData.vacationBalance);
    }
  }, [scheduleData]);

  const syncCalendarSettings = useCallback(
    async (
      updatedOffEx: string[],
      updatedWorkEx: string[],
      updatedVacDays: string[],
      updatedBalance: number
    ) => {
      try {
        const res = await authFetch('/api/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schedule,
            offExceptions: updatedOffEx,
            workExceptions: updatedWorkEx,
            vacationDays: updatedVacDays,
            vacationBalance: updatedBalance,
          }),
        });
        if (res.ok) {
          void queryClient.invalidateQueries({ queryKey: ['schedule'] });
        } else {
          console.warn('Failed to sync calendar settings to server:', res.status);
        }
      } catch (err) {
        console.warn('Error syncing calendar settings:', err);
      }
    },
    [schedule, queryClient]
  );

  const toggleOffException = useCallback(
    (dateStr: string) => {
      setOffExceptions((prev) => {
        const next = prev.includes(dateStr)
          ? prev.filter((d) => d !== dateStr)
          : [...prev, dateStr];
        lsSet(LS_OFF_EXCEPTIONS_KEY, next);
        void syncCalendarSettings(next, workExceptions, vacationDays, vacationBalance);
        return next;
      });
    },
    [workExceptions, vacationDays, vacationBalance, syncCalendarSettings]
  );

  const toggleWorkException = useCallback(
    (dateStr: string) => {
      setWorkExceptions((prev) => {
        const next = prev.includes(dateStr)
          ? prev.filter((d) => d !== dateStr)
          : [...prev, dateStr];
        lsSet(LS_WORK_EXCEPTIONS_KEY, next);
        void syncCalendarSettings(offExceptions, next, vacationDays, vacationBalance);
        return next;
      });
    },
    [offExceptions, vacationDays, vacationBalance, syncCalendarSettings]
  );

  const toggleVacationDay = useCallback(
    (dateStr: string) => {
      setVacationDays((prev) => {
        const next = prev.includes(dateStr)
          ? prev.filter((d) => d !== dateStr)
          : [...prev, dateStr];
        lsSet(LS_VACATION_DAYS_KEY, next);
        void syncCalendarSettings(offExceptions, workExceptions, next, vacationBalance);
        return next;
      });
    },
    [offExceptions, workExceptions, vacationBalance, syncCalendarSettings]
  );

  const saveVacationBalance = useCallback(
    (val: number) => {
      setVacationBalance(val);
      lsSet(LS_VACATION_BALANCE_KEY, val);
      void syncCalendarSettings(offExceptions, workExceptions, vacationDays, val);
    },
    [offExceptions, workExceptions, vacationDays, syncCalendarSettings]
  );

  // ── Vacation range picker state ───────────────────────────────────────────
  const [showVacPicker, setShowVacPicker] = useState(false);
  const [vacRangeStart, setVacRangeStart] = useState('');
  const [vacRangeEnd, setVacRangeEnd] = useState('');
  const [vacSkipOffDays, setVacSkipOffDays] = useState(true);

  // ── Shift-type classifier ─────────────────────────────────────────────────
  const getDayShiftType = useCallback(
    (dateStr: string): DayShiftType => {
      if (vacationDays.includes(dateStr)) return 'off';
      if (workExceptions.includes(dateStr)) return 'off';
      const date = new Date(dateStr + 'T12:00:00');
      const shiftId = computeShift(shiftEpoch, schedule, date);
      const shift = schedule.find((s) => s.id === shiftId);
      const dow = date.getDay();
      if (shift?.offDays.includes(dow)) {
        if (offExceptions.includes(dateStr)) return shiftId as DayShiftType;
        return 'off';
      }
      return shiftId as DayShiftType;
    },
    [schedule, shiftEpoch, offExceptions, workExceptions, vacationDays]
  );

  // ── Holiday offsets ───────────────────────────────────────────────────────
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

  const { holidayMap, eidFitrDates } = useHolidayData(holidayOffsets);

  // ── Financial cycle config ────────────────────────────────────────────────
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

  const upcomingFinEvents = useMemo(
    () => computeFinCycleEvents(finConfig, eidFitrDates, today, 60),
    [finConfig, eidFitrDates, today]
  );

  // ── Snapshot summaries ────────────────────────────────────────────────────
  const [snapSummaries, setSnapSummaries] = useState<Record<string, SnapshotSummary>>(() =>
    lsGet<Record<string, SnapshotSummary>>(LS_SNAP_SUMMARIES_KEY, {})
  );
  const [selectedSnapshot, setSelectedSnapshot] = useState<DailySnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  const refreshSnapSummaries = useCallback(() => {
    authFetch('/api/snapshots', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { summaries?: SnapshotSummary[] }) => {
        if (!Array.isArray(data.summaries)) return;
        const map: Record<string, SnapshotSummary> = {};
        data.summaries.forEach((s) => {
          map[s.date] = s;
        });
        lsSet(LS_SNAP_SUMMARIES_KEY, map);
        setSnapSummaries(map);
      })
      .catch(() => {
        /* offline — silent */
      });
  }, []);

  useEffect(() => {
    refreshSnapSummaries();
  }, [refreshSnapSummaries]);

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
      if (!snapSummaries[date]) {
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

  // ── Notes sync ────────────────────────────────────────────────────────────
  const notesSync = useNotesSync();

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const searchResults = useNoteSearch(notesSync.notes, searchQuery);

  // ── Derived month values ──────────────────────────────────────────────────
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // ── Fin-cycle map (aligned to 60-day window from today) ──────────────────
  const finCycleMap = useMemo(
    () => buildFinCycleMap(computeFinCycleEvents(finConfig, eidFitrDates, today, 60)),
    [finConfig, eidFitrDates, today]
  );

  // ── Finance data (cross-tab reactive) ────────────────────────────────────
  const [expenses, setExpenses] = useState<Expense[]>(() => lsGet(KEYS.expenses, []));
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    lsGet(KEYS.transactions, [])
  );

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LS_SCHEDULE_KEY)
        setSchedule(lsGet<ShiftConfig[]>(LS_SCHEDULE_KEY, DEFAULT_SHIFTS));
      if (e.key === DEFAULT_EPOCH_KEY)
        setShiftEpoch(lsGet<string>(DEFAULT_EPOCH_KEY, getMostRecentFriday()));
      if (e.key === KEYS.expenses) setExpenses(lsGet<Expense[]>(KEYS.expenses, []));
      if (e.key === KEYS.transactions) setTransactions(lsGet<Transaction[]>(KEYS.transactions, []));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // ── Finance events by date ────────────────────────────────────────────────
  const financeEventsByDate = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const map: Record<string, FinanceEvent[]> = {};
    const monthStr = `${y}-${String(m + 1).padStart(2, '0')}`;

    expenses.forEach((e) => {
      if (!e.isActive) return;
      let isDueThisMonth = false;
      let dueDay = e.dueDay || 1;

      if (e.frequency === 'monthly' || e.frequency === 'weekly') {
        isDueThisMonth = true;
      } else if (e.frequency === 'annual' && e.seasonMonth) {
        if (e.seasonMonth === m + 1) isDueThisMonth = true;
      } else if (e.frequency === 'semi-annual' && e.seasonMonth) {
        if (e.seasonMonth === m + 1 || ((e.seasonMonth + 6) % 12 || 12) === m + 1)
          isDueThisMonth = true;
      } else if (e.frequency === 'quarterly' && e.quarterMonth) {
        if ((m % 3) + 1 === e.quarterMonth) isDueThisMonth = true;
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

  // ── Tasks by date ─────────────────────────────────────────────────────────
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const days = new Date(y, m + 1, 0).getDate();

    for (let day = 1; day <= days; day++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const applicable = tasks.filter((t) => t.recurrence === 'موعد محدد' && t.date === dateStr);
      if (applicable.length > 0) map[dateStr] = applicable;
    }
    return map;
  }, [tasks, currentDate]);

  // ── Notes by date ─────────────────────────────────────────────────────────
  const notesByDate = useMemo(() => {
    const map: Record<string, CalendarNote[]> = {};
    notesSync.notes.forEach((n) => {
      if (!map[n.date]) map[n.date] = [];
      map[n.date].push(n);
    });
    return map;
  }, [notesSync.notes]);

  // ── Heatmap max ───────────────────────────────────────────────────────────
  const maxExpenseAmount = useMemo(() => {
    let max = 0;
    Object.values(financeEventsByDate).forEach((events) => {
      const dayTotal = events.reduce((sum, e) => sum + (e.amount || 0), 0);
      if (dayTotal > max) max = dayTotal;
    });
    return max;
  }, [financeEventsByDate]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goToPrevMonth = useCallback(() => {
    setCurrentDate(new Date(year, month - 1, 1));
  }, [year, month, setCurrentDate]);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(new Date(year, month + 1, 1));
  }, [year, month, setCurrentDate]);

  const goToToday = useCallback(() => {
    const dayStartHour = lsGet<number>(DAY_START_HOUR_KEY, 0);
    const d = getLogicalDateISO(dayStartHour);
    setCurrentDate(new Date(d + 'T12:00:00'));
    setSelectedDate(d);
    setSelectedSnapshot(null);
  }, [setCurrentDate, setSelectedDate]);

  const handleSelectDate = useCallback(
    (dateStr: string) => {
      setSelectedDate(dateStr);
      void fetchSnapshot(dateStr);
    },
    [setSelectedDate, fetchSnapshot]
  );

  // ── Off-day warnings for viewed month ────────────────────────────────────
  const offDayWarnings = useMemo(() => {
    const warnings: { type: string; message: string }[] = [];
    const days = new Date(year, month + 1, 0).getDate();
    let offCount = 0;
    let hasLateOffDay = false;
    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
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
        message: `يوجد ${offCount} أيام إجازة هذا الشهر (يتجاوز الحد المعتاد 4)`,
      });
    if (hasLateOffDay)
      warnings.push({
        type: 'late',
        message: 'يوجد يوم إجازة بعد اليوم 26 — قد يؤثر على إغلاق الحصة الشهرية',
      });
    return warnings;
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [year, month, shiftEpoch, schedule, offExceptions, workExceptions]);

  // ── Selected-date derived flags ───────────────────────────────────────────
  const selectedDateIsStructurallyOff = useMemo(() => {
    const date = new Date(selectedDate + 'T12:00:00');
    const shiftId = computeShift(shiftEpoch, schedule, date);
    const shift = schedule.find((s) => s.id === shiftId);
    return !!shift?.offDays.includes(date.getDay());
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [selectedDate, shiftEpoch, schedule]);

  const selectedDateIsException = offExceptions.includes(selectedDate);
  const selectedDateIsWorkException = workExceptions.includes(selectedDate);
  const selectedDateIsVacation = vacationDays.includes(selectedDate);

  // ── Vacation stats for the viewed year ───────────────────────────────────
  const vacationStats = useMemo(() => {
    const yearStr = String(year);
    const used = vacationDays.filter((d) => d.startsWith(yearStr)).length;
    return { used, remaining: vacationBalance - used, overused: used > vacationBalance };
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [vacationDays, vacationBalance, year]);

  // ── Vacation range preview (new days to tag) ──────────────────────────────
  const vacRangePreview = useMemo(() => {
    if (!vacRangeStart || !vacRangeEnd || vacRangeEnd < vacRangeStart) return [];
    const dates: string[] = [];
    const d = new Date(vacRangeStart + 'T12:00:00');
    const end = new Date(vacRangeEnd + 'T12:00:00');
    while (d <= end) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!vacationDays.includes(dateStr)) {
        if (vacSkipOffDays) {
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

  // ── Vacation range (already-tagged days to un-tag) ────────────────────────
  const vacRangeTagged = useMemo(() => {
    if (!vacRangeStart || !vacRangeEnd || vacRangeEnd < vacRangeStart) return [];
    const dates: string[] = [];
    const d = new Date(vacRangeStart + 'T12:00:00');
    const end = new Date(vacRangeEnd + 'T12:00:00');
    while (d <= end) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (vacationDays.includes(dateStr)) dates.push(dateStr);
      d.setDate(d.getDate() + 1);
    }
    return dates;
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [vacRangeStart, vacRangeEnd, vacationDays]);

  const applyVacationRange = useCallback(() => {
    if (vacRangePreview.length === 0) return;
    setVacationDays((prev) => {
      const set = new Set(prev);
      vacRangePreview.forEach((d) => set.add(d));
      const next = Array.from(set).sort();
      lsSet(LS_VACATION_DAYS_KEY, next);
      void syncCalendarSettings(offExceptions, workExceptions, next, vacationBalance);
      return next;
    });
    setShowVacPicker(false);
    setVacRangeStart('');
    setVacRangeEnd('');
  }, [vacRangePreview, offExceptions, workExceptions, vacationBalance, syncCalendarSettings]);

  const removeVacationRange = useCallback(() => {
    if (vacRangeTagged.length === 0) return;
    setVacationDays((prev) => {
      const next = prev.filter((d) => !vacRangeTagged.includes(d));
      lsSet(LS_VACATION_DAYS_KEY, next);
      void syncCalendarSettings(offExceptions, workExceptions, next, vacationBalance);
      return next;
    });
    setShowVacPicker(false);
    setVacRangeStart('');
    setVacRangeEnd('');
  }, [vacRangeTagged, offExceptions, workExceptions, vacationBalance, syncCalendarSettings]);

  // ── Exposed values ────────────────────────────────────────────────────────
  return {
    // Dates
    today,
    year,
    month,

    // Navigation
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    handleSelectDate,

    // Shift / schedule
    getDayShiftType,

    // Off-day exceptions
    offExceptions,
    toggleOffException,
    workExceptions,
    toggleWorkException,

    // Vacation
    vacationDays,
    vacationBalance,
    vacationStats,
    toggleVacationDay,
    saveVacationBalance,
    showVacPicker,
    setShowVacPicker,
    vacRangeStart,
    setVacRangeStart,
    vacRangeEnd,
    setVacRangeEnd,
    vacSkipOffDays,
    setVacSkipOffDays,
    vacRangePreview,
    vacRangeTagged,
    applyVacationRange,
    removeVacationRange,

    // Holidays
    holidayMap,
    holidayOffsets,
    adjustHoliday,

    // Financial cycles
    finConfig,
    saveFinConfig,
    finCycleMap,
    upcomingFinEvents,
    showFinSettings,
    setShowFinSettings,

    // Data maps
    tasksByDate,
    financeEventsByDate,
    notesByDate,
    maxExpenseAmount,

    // Snapshots
    snapSummaries,
    selectedSnapshot,
    loadingSnapshot,

    // Selected-date flags
    selectedDateIsStructurallyOff,
    selectedDateIsException,
    selectedDateIsWorkException,
    selectedDateIsVacation,

    // Derived selected-date data
    selectedDateTasks: tasksByDate[selectedDate] ?? [],
    selectedDateFinance: financeEventsByDate[selectedDate] ?? [],
    selectedDateNotes: notesByDate[selectedDate] ?? [],

    // Warnings
    offDayWarnings,

    // Notes sync (spread so CalendarPage can destructure cleanly)
    ...notesSync,

    // Search
    searchQuery,
    setSearchQuery,
    searchResults,
  };
}
