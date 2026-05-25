import { useState, useCallback, useEffect } from 'react';
import { LS_KEYS } from '@/lib/storage/keys';
import type { Dispatch, SetStateAction } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { authFetch } from '@/features/auth/authFetch';
import {
  type ShiftConfig,
  type ShiftType,
  computeShift,
  getMostRecentFriday,
  DEFAULT_EPOCH_KEY,
  DEFAULT_SHIFTS,
} from '@/features/tasks/data/scheduleConfig';
import { enqueuePending, isNetworkError } from './syncQueue';

export interface ScheduleResponse {
  schedule: ShiftConfig[];
  dayStartHour?: number;
  offExceptions?: string[];
  workExceptions?: string[];
  vacationDays?: string[];
  vacationBalance?: number;
  updatedAt: string | null;
}

export const fetchSchedule = async (): Promise<{
  schedule: ShiftConfig[];
  dayStartHour: number;
  offExceptions: string[];
  workExceptions: string[];
  vacationDays: string[];
  vacationBalance: number;
  timestamp: number;
  needsDayStartHourMigration: boolean;
}> => {
  try {
    const res = await authFetch('/api/schedule', { cache: 'no-store' });
    if (!res.ok) throw new Error('Network error');
    const data = (await res.json()) as ScheduleResponse;
    const timestamp = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;

    const schedule =
      data.schedule && Array.isArray(data.schedule) && data.schedule.length > 0
        ? data.schedule
        : DEFAULT_SHIFTS;
    const offExceptions = data.offExceptions || [];
    const workExceptions = data.workExceptions || [];
    const vacationDays = data.vacationDays || [];
    const vacationBalance = data.vacationBalance !== undefined ? data.vacationBalance : 30;

    const localDayStartHour = lsGet<number>(LS_KEYS.DAY_START_HOUR, 0);
    const serverDayStartHour = data.dayStartHour ?? 0;
    let dayStartHour = serverDayStartHour;
    let needsDayStartHourMigration = false;

    if (serverDayStartHour === 0 && localDayStartHour > 0) {
      // Local value exists but server is 0 (likely first time load after update)
      dayStartHour = localDayStartHour;
      needsDayStartHourMigration = true;
    }

    lsSet(LS_KEYS.SCHEDULE, schedule);
    lsSet(LS_KEYS.DAY_START_HOUR, dayStartHour);
    lsSet(LS_KEYS.OFF_EXCEPTIONS, offExceptions);
    lsSet(LS_KEYS.WORK_EXCEPTIONS, workExceptions);
    lsSet(LS_KEYS.VACATION_DAYS, vacationDays);
    lsSet(LS_KEYS.VACATION_BALANCE, vacationBalance);
    lsSet(LS_KEYS.SCHEDULE_TIMESTAMP, timestamp);

    return {
      schedule,
      dayStartHour,
      offExceptions,
      workExceptions,
      vacationDays,
      vacationBalance,
      timestamp,
      needsDayStartHourMigration,
    };
  } catch (err) {
    console.error('Fetch schedule failed, using local fallback:', err);
  }
  return {
    schedule: lsGet<ShiftConfig[]>(LS_KEYS.SCHEDULE, DEFAULT_SHIFTS),
    dayStartHour: lsGet<number>(LS_KEYS.DAY_START_HOUR, 0),
    offExceptions: lsGet<string[]>(LS_KEYS.OFF_EXCEPTIONS, []),
    workExceptions: lsGet<string[]>(LS_KEYS.WORK_EXCEPTIONS, []),
    vacationDays: lsGet<string[]>(LS_KEYS.VACATION_DAYS, []),
    vacationBalance: lsGet<number>(LS_KEYS.VACATION_BALANCE, 30),
    timestamp: lsGet<number>(LS_KEYS.SCHEDULE_TIMESTAMP, 0),
    needsDayStartHourMigration: false,
  };
};

export interface UseScheduleSyncProps {
  isOnline: boolean;
  onQuota?: () => void;
  notify: (msg: string, type: 'offline' | 'error' | 'warn') => void;
  setHasError: (val: boolean) => void;
}

export function useScheduleSync({ isOnline, onQuota, notify, setHasError }: UseScheduleSyncProps) {
  const queryClient = useQueryClient();

  const [shiftEpoch, setShiftEpoch] = useState<string>(() => {
    const stored = lsGet<string | null>(DEFAULT_EPOCH_KEY, null);
    if (stored) return stored;
    const defaultEpoch = getMostRecentFriday();
    lsSet(DEFAULT_EPOCH_KEY, defaultEpoch);
    return defaultEpoch;
  });

  interface ScheduleQueryData {
    schedule: ShiftConfig[];
    dayStartHour: number;
    offExceptions: string[];
    workExceptions: string[];
    vacationDays: string[];
    vacationBalance: number;
    timestamp: number;
    needsDayStartHourMigration: boolean;
  }

  const { data: scheduleResp, isFetching: fetchingSchedule } = useQuery<ScheduleQueryData>({
    queryKey: ['schedule'],
    queryFn: fetchSchedule,
    initialData: () => ({
      schedule: lsGet<ShiftConfig[]>(LS_KEYS.SCHEDULE, DEFAULT_SHIFTS),
      dayStartHour: lsGet<number>(LS_KEYS.DAY_START_HOUR, 0),
      offExceptions: lsGet<string[]>(LS_KEYS.OFF_EXCEPTIONS, []),
      workExceptions: lsGet<string[]>(LS_KEYS.WORK_EXCEPTIONS, []),
      vacationDays: lsGet<string[]>(LS_KEYS.VACATION_DAYS, []),
      vacationBalance: lsGet<number>(LS_KEYS.VACATION_BALANCE, 30),
      timestamp: 0,
      needsDayStartHourMigration: false,
    }),
    initialDataUpdatedAt: 0,
    enabled: isOnline,
    retry: isOnline ? 3 : false,
  });

  const schedule = scheduleResp?.schedule ?? DEFAULT_SHIFTS;
  const dayStartHour = scheduleResp?.dayStartHour ?? 0;

  const [shift, setShiftState] = useState<ShiftType>(() => computeShift(shiftEpoch, schedule));

  const { mutate: updateScheduleMut, mutateAsync: updateScheduleMutAsync } = useMutation<
    void,
    Error,
    ShiftConfig[]
  >({
    mutationFn: async (newSchedule) => {
      const res = await authFetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: newSchedule }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Schedule Sync API error ${res.status}: ${text}`);
      }
    },
    onMutate: async (newSchedule) => {
      await queryClient.cancelQueries({ queryKey: ['schedule'] });
      const prevSchedule = queryClient.getQueryData<ScheduleQueryData>(['schedule']);
      queryClient.setQueryData<ScheduleQueryData>(['schedule'], (old) => {
        if (!old) return old;
        return { ...old, schedule: newSchedule, timestamp: Date.now() };
      });
      lsSet(LS_KEYS.SCHEDULE, newSchedule, onQuota);
      return { prevSchedule };
    },
    onSuccess: () => setHasError(false),
    onError: async (err, variables) => {
      const isOfflineStatus = !navigator.onLine || isNetworkError(err);
      if (isOfflineStatus) {
        enqueuePending('schedule', variables);
        notify('أنت غير متصل — تم حفظ الجدول محلياً وسيُزامَن عند اتصالك', 'offline');
        return;
      }
      console.error('Schedule sync error:', err);
      notify(`خطأ في مزامنة الجدول: ${err.message}`, 'error');
      setHasError(true);
      await queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });

  const { mutate: updateDayStartHourMut } = useMutation<void, Error, number>({
    mutationFn: async (newHour) => {
      const res = await authFetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayStartHour: newHour }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Schedule Sync API error ${res.status}: ${text}`);
      }
    },
    onMutate: async (newHour) => {
      await queryClient.cancelQueries({ queryKey: ['schedule'] });
      queryClient.setQueryData<ScheduleQueryData>(['schedule'], (old) => {
        if (!old) return old;
        return { ...old, dayStartHour: newHour, timestamp: Date.now() };
      });
      lsSet(LS_KEYS.DAY_START_HOUR, newHour, onQuota);
    },
    onSuccess: () => setHasError(false),
    onError: async (err) => {
      const isOfflineStatus = !navigator.onLine || isNetworkError(err);
      if (isOfflineStatus) {
        // Enqueueing single fields is tricky with the current queue format (which expects full payload),
        // but dayStartHour changes are rare enough that we can just let it fail gracefully or user can try later.
        notify('أنت غير متصل — تعذر مزامنة وقت بداية اليوم', 'warn');
        return;
      }
      console.error('DayStartHour sync error:', err);
      notify(`خطأ في مزامنة وقت بداية اليوم: ${err.message}`, 'error');
      setHasError(true);
      await queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });

  // Handle migration on first load if the local storage was migrated to server
  useEffect(() => {
    if (scheduleResp?.needsDayStartHourMigration) {
      updateDayStartHourMut(scheduleResp.dayStartHour);
    }
  }, [scheduleResp?.needsDayStartHourMigration, scheduleResp?.dayStartHour, updateDayStartHourMut]);

  const setSchedule = useCallback<Dispatch<SetStateAction<ShiftConfig[]>>>(
    (updater) => {
      const current =
        queryClient.getQueryData<{ schedule: ShiftConfig[]; timestamp: number }>(['schedule'])
          ?.schedule ?? DEFAULT_SHIFTS;
      const next = typeof updater === 'function' ? updater(current) : updater;
      updateScheduleMut(next);
    },
    [queryClient, updateScheduleMut]
  );

  const setShift = useCallback(
    (v: ShiftType) => {
      const thisFriday = getMostRecentFriday();
      const shiftIndex = schedule.findIndex((s) => s.id === v);
      const N = shiftIndex >= 0 ? shiftIndex : 0;
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const fridayDate = new Date(thisFriday + 'T00:00:00');
      const newEpoch = new Date(fridayDate.getTime() - N * oneWeekMs).toISOString().split('T')[0];

      setShiftEpoch(newEpoch);
      setShiftState(v);
      lsSet(DEFAULT_EPOCH_KEY, newEpoch, onQuota);
    },
    [onQuota, schedule]
  );

  return {
    scheduleResp,
    schedule,
    dayStartHour,
    setSchedule,
    shiftEpoch,
    setShiftEpoch,
    shift,
    setShiftState,
    setShift,
    fetchingSchedule,
    updateScheduleMut,
    updateScheduleMutAsync,
    updateDayStartHourMut,
  };
}
