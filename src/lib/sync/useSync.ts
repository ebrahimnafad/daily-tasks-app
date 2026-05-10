import { useState, useEffect, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, CheckedMap, SubCheckedMap, SyncStatus } from '@/types';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import {
  type ShiftConfig,
  type ShiftType,
  computeShift,
  getMostRecentFriday,
  DEFAULT_EPOCH_KEY,
  LEGACY_TIME_TO_BLOCK,
  DEFAULT_SHIFTS,
} from '@/features/tasks/data/scheduleConfig';

export const todayISO = (): string => new Date().toISOString().split('T')[0];

interface DailyState {
  checked: CheckedMap;
  subChecked: SubCheckedMap;
}

// ── Task migration — handle old tasks without shifts/timeBlock ────────────
const migrateTasks = (tasks: Task[]): Task[] =>
  tasks.map((t) => ({
    ...t,
    shifts: t.shifts ?? ['morning', 'evening'],
    timeBlock: t.timeBlock ?? (t.time ? (LEGACY_TIME_TO_BLOCK[t.time] ?? 'anytime') : 'anytime'),
  }));

// ── Fetchers ──────────────────────────────────────────────────────────────
interface TasksResponse {
  tasks: Task[];
  updatedAt: string | null;
}

interface DailyResponse {
  checked: CheckedMap;
  subChecked: SubCheckedMap;
  updatedAt: string | null;
}

interface ScheduleResponse {
  schedule: ShiftConfig[];
  updatedAt: string | null;
}

const fetchTasks = async (): Promise<{ tasks: Task[]; timestamp: number }> => {
  try {
    const res = await fetch('/api/db?resource=tasks', { cache: 'no-store' });
    if (!res.ok) throw new Error('Network error');
    const data = (await res.json()) as TasksResponse;
    const timestamp = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
    if (data.tasks) {
      const migrated = migrateTasks(data.tasks);
      lsSet('mhm_tasks', migrated);
      lsSet('mhm_tasks_timestamp', timestamp);
      return { tasks: migrated, timestamp };
    }
  } catch (err) {
    console.error('Fetch tasks failed, using local fallback:', err);
  }
  const localTasks = migrateTasks(lsGet<Task[]>('mhm_tasks', []));
  return { tasks: localTasks, timestamp: lsGet<number>('mhm_tasks_timestamp', 0) };
};

const fetchDaily = async (): Promise<{ daily: DailyState; timestamp: number }> => {
  const today = todayISO();
  try {
    const res = await fetch(`/api/db?resource=daily&date=${today}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Network error');
    const data = (await res.json()) as DailyResponse;
    const timestamp = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
    if (data.checked || data.subChecked) {
      const checked = data.checked ?? {};
      const subChecked = data.subChecked ?? {};
      lsSet('mhm_checked', checked);
      lsSet('mhm_sub_checked', subChecked);
      lsSet('mhm_date', today);
      lsSet('mhm_daily_timestamp', timestamp);
      return { daily: { checked, subChecked }, timestamp };
    }
  } catch (err) {
    console.error('Fetch daily failed, using local fallback:', err);
  }
  const savedDate = lsGet<string | null>('mhm_date', null);
  if (savedDate === today) {
    return {
      daily: {
        checked: lsGet<CheckedMap>('mhm_checked', {}),
        subChecked: lsGet<SubCheckedMap>('mhm_sub_checked', {}),
      },
      timestamp: lsGet<number>('mhm_daily_timestamp', 0),
    };
  }
  return { daily: { checked: {}, subChecked: {} }, timestamp: 0 };
};

const fetchSchedule = async (): Promise<{ schedule: ShiftConfig[]; timestamp: number }> => {
  try {
    const res = await fetch('/api/db?resource=schedule', { cache: 'no-store' });
    if (!res.ok) throw new Error('Network error');
    const data = (await res.json()) as ScheduleResponse;
    const timestamp = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
    if (data.schedule && Array.isArray(data.schedule)) {
      lsSet('mhm_schedule', data.schedule);
      lsSet('mhm_schedule_timestamp', timestamp);
      return { schedule: data.schedule, timestamp };
    }
  } catch (err) {
    console.error('Fetch schedule failed, using local fallback:', err);
  }
  return {
    schedule: lsGet<ShiftConfig[]>('mhm_schedule', DEFAULT_SHIFTS),
    timestamp: lsGet<number>('mhm_schedule_timestamp', 0),
  };
};

// ── Hook ──────────────────────────────────────────────────────────────────
export interface UseSyncReturn {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  checked: CheckedMap;
  setChecked: Dispatch<SetStateAction<CheckedMap>>;
  subChecked: SubCheckedMap;
  setSubChecked: Dispatch<SetStateAction<SubCheckedMap>>;
  schedule: ShiftConfig[];
  setSchedule: Dispatch<SetStateAction<ShiftConfig[]>>;
  shift: ShiftType;
  /** Override the auto-computed shift (updates epoch so the change persists) */
  setShift: (v: ShiftType) => void;
  syncStatus: SyncStatus;
}

export default function useSync(
  initialTasks: Task[],
  onNewDay?: () => void,
  onQuota?: () => void
): UseSyncReturn {
  const queryClient = useQueryClient();

  // ── Online / Offline detection ────────────────────────────────────────
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  // Track mutation errors separately — reset when a mutation succeeds
  const [hasError, setHasError] = useState(false);
  // Guard: don't trigger refetch on the very first online event at mount
  const didMountRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setHasError(false); // clear transient errors on reconnect
      // Re-fetch both queries to sync any missed writes
      if (didMountRef.current) {
        void queryClient.invalidateQueries({ queryKey: ['tasks'] });
        void queryClient.invalidateQueries({ queryKey: ['schedule'] });
        void queryClient.invalidateQueries({ queryKey: ['daily', todayISO()] });
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    didMountRef.current = true;

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient]);

  // ── Auto Shift from epoch ─────────────────────────────────────────────
  /**
   * Epoch = ISO date of a Friday that started an EVENING week.
   * If never stored, we default to the most recent Friday as evening-start.
   */
  const [shiftEpoch, setShiftEpoch] = useState<string>(() => {
    const stored = lsGet<string | null>(DEFAULT_EPOCH_KEY, null);
    if (stored) return stored;
    const defaultEpoch = getMostRecentFriday();
    lsSet(DEFAULT_EPOCH_KEY, defaultEpoch);
    return defaultEpoch;
  });

  // ── Queries ───────────────────────────────────────────────────────────
  const { data: scheduleResp, isFetching: fetchingSchedule } = useQuery<{
    schedule: ShiftConfig[];
    timestamp: number;
  }>({
    queryKey: ['schedule'],
    queryFn: fetchSchedule,
    initialData: () => ({
      schedule: lsGet<ShiftConfig[]>('mhm_schedule', DEFAULT_SHIFTS),
      timestamp: 0,
    }),
    enabled: isOnline,
    retry: isOnline ? 3 : false,
  });
  const schedule = scheduleResp?.schedule ?? DEFAULT_SHIFTS;

  const [shift, setShiftState] = useState<ShiftType>(() => computeShift(shiftEpoch, schedule));

  // Combined: shift recompute + midnight auto-reset
  useEffect(() => {
    const tick = () => {
      setShiftState(computeShift(shiftEpoch, schedule));
      const today = todayISO();
      const storedDate = lsGet<string | null>('mhm_date', null);
      if (storedDate && storedDate !== today) {
        queryClient.setQueryData(['daily', today], { checked: {}, subChecked: {} });
        lsSet('mhm_checked', {}, onQuota);
        lsSet('mhm_sub_checked', {}, onQuota);
        lsSet('mhm_date', today, onQuota);
        onNewDay?.();
      }
    };
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [shiftEpoch, schedule, onNewDay, onQuota, queryClient]);

  /**
   * Manual override: user toggles shift → we adjust the epoch so the
   * computed shift matches what the user chose for THIS week.
   */
  const setShift = useCallback(
    (v: ShiftType) => {
      // Find the current week's Friday
      const thisFriday = getMostRecentFriday();

      // Determine index difference between target shift and current epoch assumption (which aligns with shifts[0]).
      // For simplicity in a dynamic system, if they pick a different shift,
      // we offset the epoch back by N weeks where N is the index of the chosen shift in the schedule array.
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

  const { data: tasksResp, isFetching: fetchingTasks } = useQuery<{
    tasks: Task[];
    timestamp: number;
  }>({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    initialData: () => {
      const local = lsGet<Task[]>('mhm_tasks', []);
      const localMigrated = local.length > 0 ? migrateTasks(local) : initialTasks;
      return { tasks: localMigrated, timestamp: lsGet<number>('mhm_tasks_timestamp', 0) };
    },
    enabled: isOnline,
    retry: isOnline ? 3 : false,
  });
  const tasks = tasksResp?.tasks ?? initialTasks;

  const { data: dailyResp, isFetching: fetchingDaily } = useQuery<{
    daily: DailyState;
    timestamp: number;
  }>({
    queryKey: ['daily', todayISO()],
    queryFn: fetchDaily,
    initialData: () => {
      const savedDate = lsGet<string | null>('mhm_date', null);
      if (savedDate === todayISO()) {
        return {
          daily: {
            checked: lsGet<CheckedMap>('mhm_checked', {}),
            subChecked: lsGet<SubCheckedMap>('mhm_sub_checked', {}),
          },
          timestamp: 0,
        };
      }
      return { daily: { checked: {}, subChecked: {} }, timestamp: 0 };
    },
    enabled: isOnline,
    retry: isOnline ? 3 : false,
  });

  const { checked, subChecked } = dailyResp?.daily ?? { checked: {}, subChecked: {} };

  // ── Mutations ─────────────────────────────────────────────────────────
  const { mutate: updateTasksMut } = useMutation<void, Error, Task[]>({
    mutationFn: async (newTasks) => {
      const res = await fetch('/api/db?resource=tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: newTasks }),
      });
      if (!res.ok) throw new Error('API error');
    },
    onMutate: async (newTasks) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const prevTasks = queryClient.getQueryData<{ tasks: Task[]; timestamp: number }>(['tasks']);
      queryClient.setQueryData(['tasks'], { tasks: newTasks, timestamp: Date.now() });
      lsSet('mhm_tasks', newTasks, onQuota);
      return { prevTasks };
    },
    onSuccess: () => setHasError(false),
    onError: (_err, _newTasks, context) => {
      setHasError(true);
      const ctx = context as { prevTasks?: { tasks: Task[]; timestamp: number } } | undefined;
      if (ctx?.prevTasks) {
        queryClient.setQueryData(['tasks'], ctx.prevTasks);
        lsSet('mhm_tasks', ctx.prevTasks.tasks, onQuota);
      }
    },
  });

  const { mutate: updateScheduleMut } = useMutation<void, Error, ShiftConfig[]>({
    mutationFn: async (newSchedule) => {
      const res = await fetch('/api/db?resource=schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: newSchedule }),
      });
      if (!res.ok) throw new Error('API error');
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
    onError: (_err, _newSchedule, context) => {
      setHasError(true);
      const ctx = context as
        | { prevSchedule?: { schedule: ShiftConfig[]; timestamp: number } }
        | undefined;
      if (ctx?.prevSchedule) {
        queryClient.setQueryData(['schedule'], ctx.prevSchedule);
        lsSet('mhm_schedule', ctx.prevSchedule.schedule, onQuota);
      }
    },
  });

  const { mutate: updateDailyMut } = useMutation<void, Error, DailyState>({
    mutationFn: async ({ checked: c, subChecked: sc }) => {
      const today = todayISO();
      await fetch('/api/db?resource=daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, checked: c, subChecked: sc }),
      });
    },
    onMutate: async ({ checked: c, subChecked: sc }) => {
      const today = todayISO();
      await queryClient.cancelQueries({ queryKey: ['daily', today] });
      const prevDaily = queryClient.getQueryData<{ daily: DailyState; timestamp: number }>([
        'daily',
        today,
      ]);
      queryClient.setQueryData(['daily', today], {
        daily: { checked: c, subChecked: sc },
        timestamp: Date.now(),
      });
      lsSet('mhm_checked', c, onQuota);
      lsSet('mhm_sub_checked', sc, onQuota);
      lsSet('mhm_date', today, onQuota);
      return { prevDaily };
    },
    onSuccess: () => setHasError(false),
    onError: (_err, _vars, context) => {
      setHasError(true);
      const ctx = context as { prevDaily?: { daily: DailyState; timestamp: number } } | undefined;
      if (ctx?.prevDaily) {
        queryClient.setQueryData(['daily', todayISO()], ctx.prevDaily);
      }
    },
  });

  // ── Setters ───────────────────────────────────────────────────────────
  const setTasks = useCallback<Dispatch<SetStateAction<Task[]>>>(
    (updater) => {
      const current =
        queryClient.getQueryData<{ tasks: Task[]; timestamp: number }>(['tasks'])?.tasks ??
        initialTasks;
      const next = typeof updater === 'function' ? updater(current) : updater;
      updateTasksMut(next);
    },
    [queryClient, updateTasksMut, initialTasks]
  );

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

  const setChecked = useCallback<Dispatch<SetStateAction<CheckedMap>>>(
    (updater) => {
      const cur = queryClient.getQueryData<{ daily: DailyState; timestamp: number }>([
        'daily',
        todayISO(),
      ])?.daily ?? {
        checked: {},
        subChecked: {},
      };
      const next = typeof updater === 'function' ? updater(cur.checked) : updater;
      updateDailyMut({ checked: next, subChecked: cur.subChecked });
    },
    [queryClient, updateDailyMut]
  );

  const setSubChecked = useCallback<Dispatch<SetStateAction<SubCheckedMap>>>(
    (updater) => {
      const cur = queryClient.getQueryData<{ daily: DailyState; timestamp: number }>([
        'daily',
        todayISO(),
      ])?.daily ?? {
        checked: {},
        subChecked: {},
      };
      const next = typeof updater === 'function' ? updater(cur.subChecked) : updater;
      updateDailyMut({ checked: cur.checked, subChecked: next });
    },
    [queryClient, updateDailyMut]
  );

  // ── Derived sync status ───────────────────────────────────────────────
  const syncStatus: SyncStatus = !isOnline
    ? 'offline'
    : hasError
      ? 'error'
      : fetchingTasks || fetchingDaily || fetchingSchedule
        ? 'syncing'
        : 'synced';

  return {
    tasks,
    setTasks,
    checked,
    setChecked,
    subChecked,
    setSubChecked,
    schedule,
    setSchedule,
    shift,
    setShift,
    syncStatus,
  };
}
