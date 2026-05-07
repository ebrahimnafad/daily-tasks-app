import { useState, useEffect, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, CheckedMap, SubCheckedMap, SyncStatus } from '@/types';
import {
  type ShiftType,
  computeShift,
  getMostRecentFriday,
  DEFAULT_EPOCH_KEY,
  LEGACY_TIME_TO_BLOCK,
} from '@/features/tasks/data/scheduleConfig';

export const todayISO = (): string => new Date().toISOString().split('T')[0];

interface DailyState {
  checked: CheckedMap;
  subChecked: SubCheckedMap;
}

// ── localStorage helpers ──────────────────────────────────────────────────
function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key: string, value: unknown, onQuota?: () => void): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Surface quota exceeded errors to the UI
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      onQuota?.();
    }
  }
}

// ── Task migration — handle old tasks without shifts/timeBlock ────────────
const migrateTasks = (tasks: Task[]): Task[] =>
  tasks.map((t) => ({
    ...t,
    shifts: t.shifts ?? (['morning', 'evening'] as ShiftType[]),
    timeBlock: t.timeBlock ?? (t.time ? (LEGACY_TIME_TO_BLOCK[t.time] ?? 'anytime') : 'anytime'),
  }));

// ── Fetchers ──────────────────────────────────────────────────────────────
const fetchTasks = async (): Promise<Task[]> => {
  const res = await fetch('/api/db?resource=tasks');
  if (!res.ok) throw new Error('Network error');
  const data = (await res.json()) as { tasks?: Task[] };
  if (data.tasks) {
    const migrated = migrateTasks(data.tasks);
    lsSet('mhm_tasks', migrated);
    return migrated;
  }
  return migrateTasks(lsGet<Task[]>('mhm_tasks', []));
};

const fetchDaily = async (): Promise<DailyState> => {
  const today = todayISO();
  const res = await fetch(`/api/db?resource=daily&date=${today}`);
  if (!res.ok) throw new Error('Network error');
  const data = (await res.json()) as Partial<DailyState>;
  if (data.checked || data.subChecked) {
    const checked = data.checked ?? {};
    const subChecked = data.subChecked ?? {};
    lsSet('mhm_checked', checked);
    lsSet('mhm_sub_checked', subChecked);
    lsSet('mhm_date', today);
    return { checked, subChecked };
  }
  const savedDate = lsGet<string | null>('mhm_date', null);
  if (savedDate === today) {
    return {
      checked: lsGet<CheckedMap>('mhm_checked', {}),
      subChecked: lsGet<SubCheckedMap>('mhm_sub_checked', {}),
    };
  }
  return { checked: {}, subChecked: {} };
};

// ── Hook ──────────────────────────────────────────────────────────────────
export interface UseSyncReturn {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  checked: CheckedMap;
  setChecked: Dispatch<SetStateAction<CheckedMap>>;
  subChecked: SubCheckedMap;
  setSubChecked: Dispatch<SetStateAction<SubCheckedMap>>;
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

  const [shift, setShiftState] = useState<ShiftType>(() => computeShift(shiftEpoch));

  // Re-compute shift every minute (catches the Friday transition at midnight)
  useEffect(() => {
    const tick = () => setShiftState(computeShift(shiftEpoch));
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [shiftEpoch]);

  /**
   * Manual override: user toggles shift → we adjust the epoch so the
   * computed shift matches what the user chose for THIS week.
   */
  const setShift = useCallback(
    (v: ShiftType) => {
      // Find the current week's Friday
      const thisFriday = getMostRecentFriday();
      // If user wants 'evening', set epoch = this Friday (even weeks = evening)
      // If user wants 'morning', set epoch = one week ago (odd weeks = morning)
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const fridayDate = new Date(thisFriday + 'T00:00:00');
      const newEpoch =
        v === 'evening'
          ? thisFriday
          : new Date(fridayDate.getTime() - oneWeekMs).toISOString().split('T')[0];
      setShiftEpoch(newEpoch);
      setShiftState(v);
      lsSet(DEFAULT_EPOCH_KEY, newEpoch, onQuota);
    },
    [onQuota]
  );

  // ── Queries ───────────────────────────────────────────────────────────
  const { data: tasks = initialTasks, isFetching: fetchingTasks } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    initialData: () => lsGet<Task[]>('mhm_tasks', initialTasks),
    // Don't refetch while offline — avoids failed network requests piling up
    enabled: isOnline,
    retry: isOnline ? 3 : false,
  });

  const { data: daily = { checked: {}, subChecked: {} }, isFetching: fetchingDaily } =
    useQuery<DailyState>({
      queryKey: ['daily', todayISO()],
      queryFn: fetchDaily,
      initialData: () => {
        const savedDate = lsGet<string | null>('mhm_date', null);
        if (savedDate === todayISO()) {
          return {
            checked: lsGet<CheckedMap>('mhm_checked', {}),
            subChecked: lsGet<SubCheckedMap>('mhm_sub_checked', {}),
          };
        }
        return { checked: {}, subChecked: {} };
      },
      enabled: isOnline,
      retry: isOnline ? 3 : false,
    });

  const { checked, subChecked } = daily;

  // ── Mutations ─────────────────────────────────────────────────────────
  const { mutate: updateTasksMut } = useMutation<void, Error, Task[]>({
    mutationFn: async (newTasks) => {
      await fetch('/api/db?resource=tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: newTasks }),
      });
    },
    onMutate: async (newTasks) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const prevTasks = queryClient.getQueryData<Task[]>(['tasks']);
      queryClient.setQueryData(['tasks'], newTasks);
      lsSet('mhm_tasks', newTasks, onQuota);
      return { prevTasks };
    },
    onSuccess: () => setHasError(false),
    onError: (_err, _newTasks, context) => {
      setHasError(true);
      const ctx = context as { prevTasks?: Task[] } | undefined;
      if (ctx?.prevTasks) {
        queryClient.setQueryData(['tasks'], ctx.prevTasks);
        lsSet('mhm_tasks', ctx.prevTasks, onQuota);
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
      const prevDaily = queryClient.getQueryData<DailyState>(['daily', today]);
      queryClient.setQueryData(['daily', today], { checked: c, subChecked: sc });
      lsSet('mhm_checked', c, onQuota);
      lsSet('mhm_sub_checked', sc, onQuota);
      lsSet('mhm_date', today, onQuota);
      return { prevDaily };
    },
    onSuccess: () => setHasError(false),
    onError: (_err, _vars, context) => {
      setHasError(true);
      const ctx = context as { prevDaily?: DailyState } | undefined;
      if (ctx?.prevDaily) {
        queryClient.setQueryData(['daily', todayISO()], ctx.prevDaily);
      }
    },
  });

  // ── Setters ───────────────────────────────────────────────────────────
  const setTasks = useCallback<Dispatch<SetStateAction<Task[]>>>(
    (updater) => {
      const current = queryClient.getQueryData<Task[]>(['tasks']) ?? initialTasks;
      const next = typeof updater === 'function' ? updater(current) : updater;
      updateTasksMut(next);
    },
    [queryClient, updateTasksMut, initialTasks]
  );

  const setChecked = useCallback<Dispatch<SetStateAction<CheckedMap>>>(
    (updater) => {
      const cur = queryClient.getQueryData<DailyState>(['daily', todayISO()]) ?? {
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
      const cur = queryClient.getQueryData<DailyState>(['daily', todayISO()]) ?? {
        checked: {},
        subChecked: {},
      };
      const next = typeof updater === 'function' ? updater(cur.subChecked) : updater;
      updateDailyMut({ checked: cur.checked, subChecked: next });
    },
    [queryClient, updateDailyMut]
  );

  // ── Midnight auto-reset ───────────────────────────────────────────────
  useEffect(() => {
    const checkDate = () => {
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
    const t = setInterval(checkDate, 60_000);
    return () => clearInterval(t);
  }, [onNewDay, onQuota, queryClient]);

  // ── Derived sync status ───────────────────────────────────────────────
  const syncStatus: SyncStatus = !isOnline
    ? 'offline'
    : hasError
      ? 'error'
      : fetchingTasks || fetchingDaily
        ? 'syncing'
        : 'synced';

  return {
    tasks,
    setTasks,
    checked,
    setChecked,
    subChecked,
    setSubChecked,
    shift,
    setShift,
    syncStatus,
  };
}
