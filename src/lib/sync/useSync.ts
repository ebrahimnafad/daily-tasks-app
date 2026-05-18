import { useState, useEffect, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, CheckedMap, SubCheckedMap, SyncStatus, DailySnapshot } from '@/types';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { authFetch } from '@/features/auth/authFetch';
import {
  type ShiftConfig,
  type ShiftType,
  computeShift,
  getMostRecentFriday,
  DEFAULT_EPOCH_KEY,
  LEGACY_TIME_TO_BLOCK,
  DEFAULT_SHIFTS,
  getLogicalDateISO,
  DAY_START_HOUR_KEY,
} from '@/features/tasks/data/scheduleConfig';
import { localDateISO } from '@/lib/date/localDate';
import { runBlockMigrationV2, isMigrationDone } from '@/lib/migrate/blockMigrationV2';

/** @deprecated use getLogicalDateISO(dayStartHour) instead */
export const todayISO = (): string => localDateISO();

// ── Snapshot offline retry queue ────────────────────────────────────────────
const SNAPSHOT_QUEUE_KEY = 'mhm_snapshot_queue';
/** localStorage key — epoch ms of the last SUCCESSFUL manual saveSnapshot call.
 *  Read by the auto-snapshot path to prevent a stale tab from overwriting a
 *  correct manual snapshot (two-tab race guard). Shared across tabs via localStorage. */
const LAST_MANUAL_SNAPSHOT_KEY = 'mhm_last_manual_snapshot_at';
/** Grace window: if a manual snapshot was saved within this many ms, skip auto. */
const MANUAL_SNAPSHOT_GRACE_MS = 5 * 60 * 1000; // 5 minutes

/** Persist a failed snapshot to the local retry queue (dedup by date). */
const enqueueSnapshot = (snap: DailySnapshot): void => {
  const queue = lsGet<DailySnapshot[]>(SNAPSHOT_QUEUE_KEY, []);
  lsSet(SNAPSHOT_QUEUE_KEY, [...queue.filter((s) => s.date !== snap.date), snap]);
};

/**
 * Flush any locally-queued snapshots that failed to POST while offline.
 * Called when the browser regains connectivity. Each snapshot is retried once;
 * persistent failures stay in the queue for the next online event.
 */
const flushSnapshotQueue = async (): Promise<void> => {
  const queue = lsGet<DailySnapshot[]>(SNAPSHOT_QUEUE_KEY, []);
  if (queue.length === 0) return;
  const remaining: DailySnapshot[] = [];
  for (const snap of queue) {
    try {
      const res = await authFetch('/api/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: snap.date, snapshot: snap }),
      });
      if (!res.ok) remaining.push(snap); // server error — keep for next retry
    } catch {
      remaining.push(snap); // network error — keep for next retry
    }
  }
  lsSet(SNAPSHOT_QUEUE_KEY, remaining);
};

// ── Pending Sync offline queue (Phase 3) ────────────────────────────────────
const PENDING_SYNC_KEY = 'mhm_pending_sync';

type PendingItem = {
  type: 'tasks' | 'daily' | 'schedule';
  payload: unknown;
  queuedAt: number;
};

function enqueuePending(type: PendingItem['type'], payload: unknown): void {
  const queue: PendingItem[] = lsGet<PendingItem[]>(PENDING_SYNC_KEY, []);
  const filtered = queue.filter((q) => q.type !== type);
  filtered.push({ type, payload, queuedAt: Date.now() });
  lsSet(PENDING_SYNC_KEY, filtered);
}

function flushPending(): PendingItem[] {
  const queue: PendingItem[] = lsGet<PendingItem[]>(PENDING_SYNC_KEY, []);
  lsSet(PENDING_SYNC_KEY, null);
  return queue;
}

function hasStaleItems(queue: PendingItem[]): boolean {
  const ONE_HOUR = 60 * 60 * 1000;
  return queue.some((q) => Date.now() - q.queuedAt > ONE_HOUR);
}

function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    (err.message.includes('fetch') ||
      err.message.includes('network') ||
      err.message.includes('Failed to fetch'))
  );
}

interface DailyState {
  checked: CheckedMap;
  subChecked: SubCheckedMap;
  skipped: CheckedMap;
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
  skipped?: CheckedMap;
  updatedAt: string | null;
}

interface ScheduleResponse {
  schedule: ShiftConfig[];
  updatedAt: string | null;
}

const fetchTasks = async (): Promise<{ tasks: Task[]; timestamp: number }> => {
  try {
    const res = await authFetch('/api/tasks', { cache: 'no-store' });
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

const fetchDaily = async (
  dayStartHour: number
): Promise<{ daily: DailyState; timestamp: number }> => {
  const today = getLogicalDateISO(dayStartHour);
  try {
    const res = await authFetch(`/api/daily?date=${today}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Network error');
    const data = (await res.json()) as DailyResponse;
    const timestamp = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
    if (data.checked || data.subChecked || data.skipped) {
      const checked = data.checked ?? {};
      const subChecked = data.subChecked ?? {};
      const skipped = data.skipped ?? {};
      lsSet('mhm_checked', checked);
      lsSet('mhm_sub_checked', subChecked);
      lsSet('mhm_skipped', skipped);
      lsSet('mhm_date', today);
      lsSet('mhm_daily_timestamp', timestamp);
      return { daily: { checked, subChecked, skipped }, timestamp };
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
        skipped: lsGet<CheckedMap>('mhm_skipped', {}),
      },
      timestamp: lsGet<number>('mhm_daily_timestamp', 0),
    };
  }
  return { daily: { checked: {}, subChecked: {}, skipped: {} }, timestamp: 0 };
};

const fetchSchedule = async (): Promise<{ schedule: ShiftConfig[]; timestamp: number }> => {
  try {
    const res = await authFetch('/api/schedule', { cache: 'no-store' });
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
  skipped: CheckedMap;
  setSkipped: Dispatch<SetStateAction<CheckedMap>>;
  schedule: ShiftConfig[];
  setSchedule: Dispatch<SetStateAction<ShiftConfig[]>>;
  shift: ShiftType;
  /** Override the auto-computed shift (updates epoch so the change persists) */
  setShift: (v: ShiftType) => void;
  syncStatus: SyncStatus;
  /** Hour (0-23) at which a new day logically starts (default 0 = midnight) */
  dayStartHour: number;
  setDayStartHour: (hour: number) => void;
  saveSnapshot: (data: import('@/types').DailySnapshot) => Promise<void>;
}

export default function useSync(
  initialTasks: Task[],
  onNewDay?: () => void,
  onQuota?: () => void,
  /** Optional callback called just before the daily state is cleared at midnight. */
  onAutoSnapshotNeeded?: () => void,
  /** Non-blocking replacement for alert() — show sync errors as toasts. */
  onSyncError?: (message: string, type: 'offline' | 'error' | 'warn') => void
): UseSyncReturn {
  // ── Day-start hour setting ────────────────────────────────────────
  const [dayStartHour, setDayStartHourState] = useState<number>(() =>
    lsGet<number>(DAY_START_HOUR_KEY, 0)
  );

  const setDayStartHour = useCallback(
    (hour: number) => {
      const clamped = Math.max(0, Math.min(23, Math.round(hour)));
      setDayStartHourState(clamped);
      lsSet(DAY_START_HOUR_KEY, clamped, onQuota);
    },
    [onQuota]
  );
  const queryClient = useQueryClient();

  // ── Online / Offline detection ────────────────────────────────────────
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  // Track mutation errors separately — reset when a mutation succeeds
  const [hasError, setHasError] = useState(false);
  // Guard: don't trigger refetch on the very first online event at mount
  const didMountRef = useRef(false);
  // Pending daily state — accumulates synchronous updates so sequential calls
  // within the same event handler (e.g. deleteTask → setChecked + setSubChecked)
  // always read each other's changes instead of stale query-cache data.
  const pendingDailyRef = useRef<DailyState | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable ref so onSyncError can be called inside effects without staleness
  const onSyncErrorRef = useRef(onSyncError);
  useEffect(() => {
    onSyncErrorRef.current = onSyncError;
  });
  // Stable ref so updateTasksMut can be called inside the midnight-tick effect
  // without requiring it to be declared before the effect (avoids hoisting lint error).
  const updateTasksMutRef = useRef<(tasks: Task[]) => void>(() => void 0);

  const notify = (msg: string, type: 'offline' | 'error' | 'warn' = 'error') =>
    onSyncErrorRef.current?.(msg, type);

  /* eslint-disable */
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setHasError(false); // clear transient errors on reconnect
      // Drain any snapshots that failed to POST while offline
      void flushSnapshotQueue();

      const queue = flushPending();
      if (queue.length > 0) {
        if (hasStaleItems(queue)) {
          notify('توجد تغييرات غير مزامنة منذ أكثر من ساعة — جارٍ المزامنة الآن', 'warn');
        }
        for (const item of queue) {
          if (item.type === 'tasks') {
            await updateTasksMutAsync(item.payload as Task[]).catch(console.error);
          } else if (item.type === 'daily') {
            await updateDailyMutAsync(item.payload as DailyState).catch(console.error);
          } else if (item.type === 'schedule') {
            await updateScheduleMutAsync(item.payload as ShiftConfig[]).catch(console.error);
          }
        }
      } else {
        // Re-fetch queries to sync any missed writes if queue is empty
        if (didMountRef.current) {
          void queryClient.invalidateQueries({ queryKey: ['tasks'] });
          void queryClient.invalidateQueries({ queryKey: ['schedule'] });
          void queryClient.invalidateQueries({ queryKey: ['daily', todayISO()] });
        }
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
  /* eslint-enable */

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

  // ── Auto-save snapshot at midnight (before clearing daily state) ─────
  // We use a ref so the interval always calls the latest version of the
  // callback without needing it in the dependency array.
  const autoSnapshotRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    autoSnapshotRef.current = () => {
      const storedDate = lsGet<string | null>('mhm_date', null);
      if (!storedDate) return;

      // Two-tab race guard: if a manual snapshot was saved recently (e.g. the user
      // clicked Reset in another tab), trust that data and skip the auto-snapshot
      // so a stale tab does not overwrite the correct shift-filtered snapshot.
      const lastManual = lsGet<number>(LAST_MANUAL_SNAPSHOT_KEY, 0);
      if (Date.now() - lastManual < MANUAL_SNAPSHOT_GRACE_MS) return;
      const currentTasks =
        queryClient.getQueryData<{ tasks: Task[]; timestamp: number }>(['tasks'])?.tasks ?? [];
      const daily = queryClient.getQueryData<{ daily: DailyState; timestamp: number }>([
        'daily',
        storedDate,
      ])?.daily ?? { checked: {}, subChecked: {}, skipped: {} };

      // Only auto-save if there's any activity
      const hasActivity =
        Object.keys(daily.checked).length > 0 || Object.keys(daily.skipped).length > 0;
      if (!hasActivity) return;

      const nonPrayer = currentTasks.filter((t) => t.recurrence !== 'صلاة');
      const totalOtherAuto = nonPrayer.length;
      const countDoneAuto = nonPrayer.filter((t) => {
        if (t.subtasks.length > 0) return t.subtasks.every((s) => daily.subChecked?.[s.id]);
        return !!daily.checked[t.id];
      }).length;
      const progressAuto =
        totalOtherAuto > 0 ? Math.round((countDoneAuto / totalOtherAuto) * 100) : 0;

      void authFetch('/api/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: storedDate,
          snapshot: {
            date: storedDate,
            tasks: nonPrayer,
            checked: daily.checked,
            skipped: daily.skipped,
            progress: progressAuto,
            countDone: countDoneAuto,
            totalOther: totalOtherAuto,
          },
        }),
      })
        .then((res) => {
          if (!res.ok)
            enqueueSnapshot({
              date: storedDate,
              tasks: nonPrayer,
              checked: daily.checked,
              skipped: daily.skipped,
              progress: progressAuto,
              countDone: countDoneAuto,
              totalOther: totalOtherAuto,
            });
        })
        .catch(() =>
          enqueueSnapshot({
            date: storedDate,
            tasks: nonPrayer,
            checked: daily.checked,
            skipped: daily.skipped,
            progress: progressAuto,
            countDone: countDoneAuto,
            totalOther: totalOtherAuto,
          })
        );
    };
  });

  // Combined: shift recompute + midnight auto-reset
  useEffect(() => {
    const tick = () => {
      setShiftState(computeShift(shiftEpoch, schedule));
      const today = getLogicalDateISO(dayStartHour);
      const storedDate = lsGet<string | null>('mhm_date', null);
      if (storedDate && storedDate !== today) {
        // Auto-save yesterday's snapshot before clearing.
        // Prefer the caller's shift-aware callback (correct data) when available;
        // fall back to the internal query-cache recomputation only as a last resort
        // since it counts all tasks instead of shift-filtered tasks.
        if (onAutoSnapshotNeeded) {
          onAutoSnapshotNeeded();
        } else {
          autoSnapshotRef.current();
        }
        // ── Auto-delete checked one-time tasks at midnight ─────────────
        // Runs AFTER the snapshot save so history is preserved,
        // BEFORE the daily state is cleared.
        const currentTasks =
          queryClient.getQueryData<{ tasks: Task[]; timestamp: number }>(['tasks'])?.tasks ?? [];
        const yesterdayDaily = queryClient.getQueryData<{
          daily: DailyState;
          timestamp: number;
        }>(['daily', storedDate])?.daily ?? { checked: {}, subChecked: {}, skipped: {} };

        const filteredTasks = currentTasks.filter(
          (t) => !(t.recurrence === 'مرة واحدة' && !!yesterdayDaily.checked[t.id])
        );
        if (filteredTasks.length < currentTasks.length) {
          queryClient.setQueryData(['tasks'], { tasks: filteredTasks, timestamp: Date.now() });
          lsSet('mhm_tasks', filteredTasks, onQuota);
          updateTasksMutRef.current(filteredTasks);
        }

        queryClient.setQueryData(['daily', today], { checked: {}, subChecked: {}, skipped: {} });
        lsSet('mhm_checked', {}, onQuota);
        lsSet('mhm_sub_checked', {}, onQuota);
        lsSet('mhm_skipped', {}, onQuota);
        lsSet('mhm_date', today, onQuota);
        onNewDay?.();
      }
    };
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [shiftEpoch, schedule, dayStartHour, onNewDay, onQuota, queryClient, onAutoSnapshotNeeded]);

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

  // (Migration effect moved below mutations to fix react-hooks/immutability lint)
  const { data: dailyResp, isFetching: fetchingDaily } = useQuery<{
    daily: DailyState;
    timestamp: number;
  }>({
    queryKey: ['daily', getLogicalDateISO(dayStartHour)],
    queryFn: () => fetchDaily(dayStartHour),
    initialData: () => {
      const savedDate = lsGet<string | null>('mhm_date', null);
      if (savedDate === getLogicalDateISO(dayStartHour)) {
        return {
          daily: {
            checked: lsGet<CheckedMap>('mhm_checked', {}),
            subChecked: lsGet<SubCheckedMap>('mhm_sub_checked', {}),
            skipped: lsGet<CheckedMap>('mhm_skipped', {}),
          },
          timestamp: 0,
        };
      }
      return { daily: { checked: {}, subChecked: {}, skipped: {} }, timestamp: 0 };
    },
    enabled: isOnline,
    retry: isOnline ? 3 : false,
  });

  const { checked, subChecked, skipped } = dailyResp?.daily ?? {
    checked: {},
    subChecked: {},
    skipped: {},
  };

  // ── Mutations ─────────────────────────────────────────────────────────
  const { mutate: updateTasksMut, mutateAsync: updateTasksMutAsync } = useMutation<
    { tasks?: Task[] },
    Error,
    Task[]
  >({
    mutationFn: async (newTasks) => {
      const res = await authFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: newTasks }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Tasks Sync API error ${res.status}: ${text}`);
      }
      return res.json();
    },
    onMutate: async (newTasks) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const prevTasks = queryClient.getQueryData<{ tasks: Task[]; timestamp: number }>(['tasks']);
      queryClient.setQueryData(['tasks'], { tasks: newTasks, timestamp: Date.now() });
      lsSet('mhm_tasks', newTasks, onQuota);
      return { prevTasks };
    },
    onSuccess: (response) => {
      if (response && response.tasks) {
        // Server is ground truth. Replace optimistic state entirely with DB-assigned IDs.
        queryClient.setQueryData(['tasks'], { tasks: response.tasks, timestamp: Date.now() });
        lsSet('mhm_tasks', response.tasks);
      }
      setHasError(false);
    },
    onError: async (err, variables) => {
      const isOffline = !navigator.onLine || isNetworkError(err);
      if (isOffline) {
        enqueuePending('tasks', variables);
        notify('أنت غير متصل — تم حفظ المهام محلياً وستُزامَن عند اتصالك', 'offline');
        return;
      }
      console.error('Tasks sync error:', err);
      notify(`خطأ في مزامنة المهام: ${err.message}`, 'error');
      setHasError(true);
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
  // Keep the midnight-tick ref in sync with the current mutate fn reference
  useEffect(() => {
    updateTasksMutRef.current = updateTasksMut;
  });

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
      const isOffline = !navigator.onLine || isNetworkError(err);
      if (isOffline) {
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

  const { mutate: updateDailyMut, mutateAsync: updateDailyMutAsync } = useMutation<
    void,
    Error,
    DailyState
  >({
    mutationFn: async ({ checked: c, subChecked: sc, skipped: sk }) => {
      const today = getLogicalDateISO(dayStartHour);
      const res = await authFetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, checked: c, subChecked: sc, skipped: sk }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Daily Sync API error ${res.status}: ${text}`);
      }
    },
    onMutate: async ({ checked: c, subChecked: sc, skipped: sk }) => {
      const today = getLogicalDateISO(dayStartHour);
      await queryClient.cancelQueries({ queryKey: ['daily', today] });
      const prevDaily = queryClient.getQueryData<{ daily: DailyState; timestamp: number }>([
        'daily',
        today,
      ]);
      queryClient.setQueryData(['daily', today], {
        daily: { checked: c, subChecked: sc, skipped: sk },
        timestamp: Date.now(),
      });
      lsSet('mhm_checked', c, onQuota);
      lsSet('mhm_sub_checked', sc, onQuota);
      lsSet('mhm_skipped', sk, onQuota);
      lsSet('mhm_date', today, onQuota);
      return { prevDaily };
    },
    onSuccess: () => setHasError(false),
    onError: async (err, variables) => {
      const isOffline = !navigator.onLine || isNetworkError(err);
      if (isOffline) {
        enqueuePending('daily', variables);
        notify('أنت غير متصل — تم حفظ الحالة اليومية محلياً وستُزامَن عند اتصالك', 'offline');
        return;
      }
      console.error('Daily sync error:', err);
      notify(`خطأ في مزامنة الحالة اليومية: ${err.message}`, 'error');
      setHasError(true);
      await queryClient.invalidateQueries({ queryKey: ['daily', getLogicalDateISO(dayStartHour)] });
    },
  });

  // ── One-time block ID migration (v1 → v2 canonical IDs) ─────────────────
  // Runs once, immediately after both tasks AND schedule are first loaded
  // from the server (not from localStorage initial data). Guards itself with
  // a localStorage flag — subsequent renders are instant no-ops.
  useEffect(() => {
    // Skip if already migrated or data not yet from server
    if (isMigrationDone()) return;
    if (!tasksResp || !scheduleResp) return;
    // Only run when we have actual server data (timestamp > 0 means server responded)
    if (tasksResp.timestamp === 0 && scheduleResp.timestamp === 0) return;

    const {
      tasks: migratedTasks,
      schedule: migratedSchedule,
      changed,
    } = runBlockMigrationV2(tasks, schedule);

    if (changed) {
      // Push migrated data to server
      updateTasksMut(migratedTasks);
      updateScheduleMut(migratedSchedule);
    }
  }, [tasksResp, scheduleResp]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Atomic daily setter ────────────────────────────────────────────────
  // Reads pendingDailyRef first so that multiple synchronous calls within the
  // same event handler always see each other's changes. A setTimeout(0) debounce
  // then flushes exactly ONE mutation after all synchronous updates complete.
  const setDaily = useCallback(
    (updater: ((prev: DailyState) => DailyState) | DailyState) => {
      const cached = queryClient.getQueryData<{ daily: DailyState; timestamp: number }>([
        'daily',
        getLogicalDateISO(dayStartHour),
      ])?.daily ?? { checked: {}, subChecked: {}, skipped: {} };
      const prev = pendingDailyRef.current ?? cached;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      pendingDailyRef.current = next;

      // Persist to localStorage immediately for offline resilience
      const today = getLogicalDateISO(dayStartHour);
      lsSet('mhm_checked', next.checked, onQuota);
      lsSet('mhm_sub_checked', next.subChecked, onQuota);
      lsSet('mhm_skipped', next.skipped, onQuota);
      lsSet('mhm_date', today, onQuota);

      // Coalesce all synchronous calls into a single mutation
      if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        const payload = pendingDailyRef.current;
        if (payload === null) return;
        pendingDailyRef.current = null;
        flushTimerRef.current = null;
        updateDailyMut(payload);
      }, 0);
    },
    [queryClient, dayStartHour, onQuota, updateDailyMut]
  );

  // Cancel any pending flush on unmount to avoid state updates on an unmounted hook
  useEffect(
    () => () => {
      if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
    },
    []
  );

  const setChecked = useCallback<Dispatch<SetStateAction<CheckedMap>>>(
    (updater) =>
      setDaily((prev) => ({
        ...prev,
        checked: typeof updater === 'function' ? updater(prev.checked) : updater,
      })),
    [setDaily]
  );

  const setSubChecked = useCallback<Dispatch<SetStateAction<SubCheckedMap>>>(
    (updater) =>
      setDaily((prev) => ({
        ...prev,
        subChecked: typeof updater === 'function' ? updater(prev.subChecked) : updater,
      })),
    [setDaily]
  );

  const setSkipped = useCallback<Dispatch<SetStateAction<CheckedMap>>>(
    (updater) =>
      setDaily((prev) => ({
        ...prev,
        skipped: typeof updater === 'function' ? updater(prev.skipped) : updater,
      })),
    [setDaily]
  );

  // ── Derived sync status ───────────────────────────────────────────────
  const syncStatus: SyncStatus = !isOnline
    ? 'offline'
    : hasError
      ? 'error'
      : fetchingTasks || fetchingDaily || fetchingSchedule
        ? 'syncing'
        : 'synced';

  const saveSnapshot = useCallback(async (data: DailySnapshot): Promise<void> => {
    try {
      const res = await authFetch('/api/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: data.date, snapshot: data }),
      });
      if (!res.ok) {
        console.warn('Snapshot save failed:', res.status, '— queuing for retry');
        enqueueSnapshot(data);
      } else {
        // Mark successful manual save so other tabs skip their auto-snapshot
        lsSet(LAST_MANUAL_SNAPSHOT_KEY, Date.now());
      }
    } catch (err) {
      console.warn('Snapshot save error — queuing for retry (offline?):', err);
      enqueueSnapshot(data);
    }
  }, []);

  return {
    tasks,
    setTasks,
    checked,
    setChecked,
    subChecked,
    setSubChecked,
    skipped,
    setSkipped,
    schedule,
    setSchedule,
    shift,
    setShift,
    syncStatus,
    dayStartHour,
    setDayStartHour,
    saveSnapshot,
  };
}
