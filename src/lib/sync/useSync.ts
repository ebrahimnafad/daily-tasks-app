import { useState, useEffect, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Task, CheckedMap, SubCheckedMap, SyncStatus, DailySnapshot } from '@/types';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import {
  type ShiftConfig,
  type ShiftType,
  DAY_START_HOUR_KEY,
} from '@/features/tasks/data/scheduleConfig';
import { localDateISO } from '@/lib/date/localDate';
import { runBlockMigrationV2, isMigrationDone } from '@/lib/migrate/blockMigrationV2';
import { flushSnapshotQueue, flushPending, hasStaleItems } from './syncQueue';
import { useTaskSync } from './useTaskSync';
import { useScheduleSync } from './useScheduleSync';
import { useDailySync, type DailyState } from './useDailySync';
import { useMidnightReset } from './useMidnightReset';

/** @deprecated use getLogicalDateISO(dayStartHour) instead */
export const todayISO = (): string => localDateISO();

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
  saveSnapshot: (data: DailySnapshot) => Promise<void>;
}

export default function useSync(
  initialTasks: Task[],
  onNewDay?: () => void,
  onQuota?: () => void,
  onAutoSnapshotNeeded?: (
    date: string,
    fallbackChecked?: CheckedMap,
    fallbackSubChecked?: SubCheckedMap
  ) => void,
  /** Non-blocking replacement for alert() — show sync errors as toasts. */
  onSyncError?: (message: string, type: 'offline' | 'error' | 'warn') => void
): UseSyncReturn {
  const queryClient = useQueryClient();

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

  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [hasError, setHasError] = useState(false);
  const didMountRef = useRef(false);

  const onSyncErrorRef = useRef(onSyncError);
  useEffect(() => {
    onSyncErrorRef.current = onSyncError;
  });

  const notify = useCallback((msg: string, type: 'offline' | 'error' | 'warn' = 'error') => {
    onSyncErrorRef.current?.(msg, type);
  }, []);

  const { tasksResp, tasks, setTasks, fetchingTasks, updateTasksMut, updateTasksMutAsync } =
    useTaskSync({
      initialTasks,
      isOnline,
      onQuota,
      notify,
      setHasError,
    });

  const {
    scheduleResp,
    schedule,
    setSchedule,
    shiftEpoch,
    shift,
    setShiftState,
    setShift,
    fetchingSchedule,
    updateScheduleMut,
    updateScheduleMutAsync,
  } = useScheduleSync({
    isOnline,
    onQuota,
    notify,
    setHasError,
  });

  const {
    checked,
    setChecked,
    subChecked,
    setSubChecked,
    skipped,
    setSkipped,
    fetchingDaily,
    updateDailyMutAsync,
    saveSnapshot,
  } = useDailySync({
    dayStartHour,
    isOnline,
    onQuota,
    notify,
    setHasError,
  });

  useMidnightReset({
    dayStartHour,
    shiftEpoch,
    schedule,
    onNewDay,
    onQuota,
    onAutoSnapshotNeeded,
    setShiftState,
    updateTasksMut,
  });

  /* eslint-disable */
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setHasError(false);
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
  }, [queryClient, notify, updateTasksMutAsync, updateDailyMutAsync, updateScheduleMutAsync]);
  /* eslint-enable */

  // ── One-time block ID migration (v1 → v2 canonical IDs) ─────────────────
  useEffect(() => {
    if (isMigrationDone()) return;
    if (!tasksResp || !scheduleResp) return;
    if (tasksResp.timestamp === 0 && scheduleResp.timestamp === 0) return;

    const {
      tasks: migratedTasks,
      schedule: migratedSchedule,
      changed,
    } = runBlockMigrationV2(tasks, schedule);

    if (changed) {
      updateTasksMut(migratedTasks);
      updateScheduleMut(migratedSchedule);
    }
  }, [tasksResp, scheduleResp]); // eslint-disable-line react-hooks/exhaustive-deps

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
