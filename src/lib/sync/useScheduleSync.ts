import { useState, useCallback } from 'react';
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
  offExceptions?: string[];
  workExceptions?: string[];
  vacationDays?: string[];
  vacationBalance?: number;
  updatedAt: string | null;
}

export const fetchSchedule = async (): Promise<{
  schedule: ShiftConfig[];
  offExceptions: string[];
  workExceptions: string[];
  vacationDays: string[];
  vacationBalance: number;
  timestamp: number;
}> => {
  try {
    const res = await authFetch('/api/schedule', { cache: 'no-store' });
    if (!res.ok) throw new Error('Network error');
    const data = (await res.json()) as ScheduleResponse;
    const timestamp = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;

    const schedule = data.schedule && Array.isArray(data.schedule) ? data.schedule : DEFAULT_SHIFTS;
    const offExceptions = data.offExceptions || [];
    const workExceptions = data.workExceptions || [];
    const vacationDays = data.vacationDays || [];
    const vacationBalance = data.vacationBalance !== undefined ? data.vacationBalance : 30;

    lsSet('mhm_schedule', schedule);
    lsSet('mhm_off_exceptions', offExceptions);
    lsSet('mhm_work_exceptions', workExceptions);
    lsSet('mhm_vacation_days', vacationDays);
    lsSet('mhm_vacation_balance', vacationBalance);
    lsSet('mhm_schedule_timestamp', timestamp);

    return { schedule, offExceptions, workExceptions, vacationDays, vacationBalance, timestamp };
  } catch (err) {
    console.error('Fetch schedule failed, using local fallback:', err);
  }
  return {
    schedule: lsGet<ShiftConfig[]>('mhm_schedule', DEFAULT_SHIFTS),
    offExceptions: lsGet<string[]>('mhm_off_exceptions', []),
    workExceptions: lsGet<string[]>('mhm_work_exceptions', []),
    vacationDays: lsGet<string[]>('mhm_vacation_days', []),
    vacationBalance: lsGet<number>('mhm_vacation_balance', 30),
    timestamp: lsGet<number>('mhm_schedule_timestamp', 0),
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

  const { data: scheduleResp, isFetching: fetchingSchedule } = useQuery<{
    schedule: ShiftConfig[];
    offExceptions: string[];
    workExceptions: string[];
    vacationDays: string[];
    vacationBalance: number;
    timestamp: number;
  }>({
    queryKey: ['schedule'],
    queryFn: fetchSchedule,
    initialData: () => ({
      schedule: lsGet<ShiftConfig[]>('mhm_schedule', DEFAULT_SHIFTS),
      offExceptions: lsGet<string[]>('mhm_off_exceptions', []),
      workExceptions: lsGet<string[]>('mhm_work_exceptions', []),
      vacationDays: lsGet<string[]>('mhm_vacation_days', []),
      vacationBalance: lsGet<number>('mhm_vacation_balance', 30),
      timestamp: 0,
    }),
    initialDataUpdatedAt: 0,
    enabled: isOnline,
    retry: isOnline ? 3 : false,
  });

  const schedule = scheduleResp?.schedule ?? DEFAULT_SHIFTS;

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
      const prevSchedule = queryClient.getQueryData<{ schedule: ShiftConfig[]; timestamp: number }>(
        ['schedule']
      );
      queryClient.setQueryData(['schedule'], { schedule: newSchedule, timestamp: Date.now() });
      lsSet('mhm_schedule', newSchedule, onQuota);
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
    setSchedule,
    shiftEpoch,
    setShiftEpoch,
    shift,
    setShiftState,
    setShift,
    fetchingSchedule,
    updateScheduleMut,
    updateScheduleMutAsync,
  };
}
