import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useQueryClient, UseMutateFunction } from '@tanstack/react-query';
import type { Task, CheckedMap, SubCheckedMap } from '@/types';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import { authFetch } from '@/features/auth/authFetch';
import {
  type ShiftConfig,
  type ShiftType,
  computeShift,
  getLogicalDateISO,
} from '@/features/tasks/data/scheduleConfig';
import { enqueueSnapshot, LAST_MANUAL_SNAPSHOT_KEY, MANUAL_SNAPSHOT_GRACE_MS } from './syncQueue';
import type { DailyState } from './useDailySync';

export interface UseMidnightResetProps {
  dayStartHour: number;
  shiftEpoch: string;
  schedule: ShiftConfig[];
  onNewDay?: () => void;
  onQuota?: () => void;
  onAutoSnapshotNeeded?: (
    date: string,
    fallbackChecked?: CheckedMap,
    fallbackSubChecked?: SubCheckedMap
  ) => void;
  setShiftState: Dispatch<SetStateAction<ShiftType>>;
  updateTasksMut: UseMutateFunction<{ tasks?: Task[] }, Error, Task[], unknown>;
}

export function useMidnightReset({
  dayStartHour,
  shiftEpoch,
  schedule,
  onNewDay,
  onQuota,
  onAutoSnapshotNeeded,
  setShiftState,
  updateTasksMut,
}: UseMidnightResetProps) {
  const queryClient = useQueryClient();
  const autoSnapshotRef = useRef<() => void>(() => undefined);
  const updateTasksMutRef = useRef<(tasks: Task[]) => void>(() => void 0);

  useEffect(() => {
    updateTasksMutRef.current = updateTasksMut;
  }, [updateTasksMut]);

  useEffect(() => {
    autoSnapshotRef.current = () => {
      const storedDate = lsGet<string | null>('mhm_date', null);
      if (!storedDate) return;

      const lastManual = lsGet<number>(LAST_MANUAL_SNAPSHOT_KEY, 0);
      if (Date.now() - lastManual < MANUAL_SNAPSHOT_GRACE_MS) return;

      const currentTasks =
        queryClient.getQueryData<{ tasks: Task[]; timestamp: number }>(['tasks'])?.tasks ?? [];
      const daily = queryClient.getQueryData<{ daily: DailyState; timestamp: number }>([
        'daily',
        storedDate,
      ])?.daily ?? { checked: {}, subChecked: {}, skipped: {} };

      const hasActivity =
        Object.keys(daily.checked).length > 0 || Object.keys(daily.skipped).length > 0;
      if (!hasActivity) return;

      const prayerTask = currentTasks.find((t) => t.isPrayerTask);
      const reqSubs = prayerTask ? prayerTask.subtasks.filter((s) => !s.isOptional) : [];
      const optSubs = prayerTask ? prayerTask.subtasks.filter((s) => s.isOptional) : [];
      const prayersDone = reqSubs.filter((s) => daily.subChecked?.[s.id]).length;
      const prayerTotal = reqSubs.length;
      const prayerOptionalDone = optSubs.filter((s) => daily.subChecked?.[s.id]).length;

      // Notice: Auto-snapshot progress currently only represents non-prayer tasks
      // (consistent with previous behavior)
      const nonPrayer = currentTasks.filter((t) => !t.isPrayerTask);
      const totalOtherAuto = nonPrayer.length;
      const countDoneAuto = nonPrayer.filter((t) => {
        if (t.subtasks && t.subtasks.length > 0)
          return t.subtasks.every((s) => daily.subChecked?.[s.id]);
        return !!daily.checked[t.id];
      }).length;
      const progressAuto =
        totalOtherAuto > 0 ? Math.round((countDoneAuto / totalOtherAuto) * 100) : 0;

      void authFetch('/api/snapshots', {
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
            prayersDone,
            prayerTotal,
            prayerOptionalDone,
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
              prayersDone,
              prayerTotal,
              prayerOptionalDone,
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
            prayersDone,
            prayerTotal,
            prayerOptionalDone,
          })
        );
    };
  });

  useEffect(() => {
    const tick = () => {
      setShiftState(computeShift(shiftEpoch, schedule));
      const today = getLogicalDateISO(dayStartHour);
      const storedDate = lsGet<string | null>('mhm_date', null);
      if (storedDate && storedDate !== today) {
        // Get state BEFORE clearing it, so we can pass it to the snapshot backup
        const currentChecked = lsGet<Record<string, boolean>>('mhm_checked', {});
        const currentSubChecked = lsGet<Record<string, boolean>>('mhm_sub_checked', {});

        if (onAutoSnapshotNeeded) {
          onAutoSnapshotNeeded(storedDate, currentChecked, currentSubChecked);
        } else {
          autoSnapshotRef.current();
        }

        const currentTasks =
          queryClient.getQueryData<{ tasks: Task[]; timestamp: number }>(['tasks'])?.tasks ?? [];

        let hasOnceTaskChanges = false;
        const newTasks = currentTasks
          .map((t) => {
            if (t.recurrence !== 'مرة واحدة') return t;

            if (!t.subtasks || t.subtasks.length === 0) {
              const isDone = !!currentChecked[t.id];
              if (isDone) {
                hasOnceTaskChanges = true;
                return null;
              }
              return t;
            } else {
              const remainingSubtasks = t.subtasks.filter((s) => !currentSubChecked[s.id]);

              if (remainingSubtasks.length === 0) {
                hasOnceTaskChanges = true;
                return null;
              } else if (remainingSubtasks.length < t.subtasks.length) {
                hasOnceTaskChanges = true;
                return { ...t, subtasks: remainingSubtasks };
              }
              return t;
            }
          })
          .filter(Boolean) as Task[];

        if (hasOnceTaskChanges) {
          queryClient.setQueryData(['tasks'], { tasks: newTasks, timestamp: Date.now() });
          lsSet('mhm_tasks', newTasks, onQuota);
          updateTasksMutRef.current(newTasks);
        }

        queryClient.setQueryData(['daily', today], { checked: {}, subChecked: {}, skipped: {} });
        lsSet('mhm_checked', {}, onQuota);
        lsSet('mhm_sub_checked', {}, onQuota);
        lsSet('mhm_skipped', {}, onQuota);
        lsSet('mhm_date', today, onQuota);
        onNewDay?.();
      }
    };

    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [
    shiftEpoch,
    schedule,
    dayStartHour,
    onNewDay,
    onQuota,
    queryClient,
    onAutoSnapshotNeeded,
    setShiftState,
  ]);
}
