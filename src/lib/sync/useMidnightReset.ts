import { useEffect, useRef } from 'react';
import { LS_KEYS, QUERY_KEYS } from '@/lib/storage/keys';
import type { Dispatch, SetStateAction } from 'react';
import { useQueryClient, UseMutateFunction } from '@tanstack/react-query';
import type { Task } from '@/types';
import { lsGet, lsSet } from '@/lib/storage/localStorage';
import {
  type ShiftConfig,
  type ShiftType,
  computeShift,
  getLogicalDateISO,
  DEFAULT_SHIFTS,
} from '@/features/tasks/data/scheduleConfig';

export interface UseMidnightResetProps {
  dayStartHour: number;
  shiftEpoch: string;
  onNewDay?: () => void;
  onQuota?: () => void;
  setShiftState: Dispatch<SetStateAction<ShiftType>>;
  updateTasksMut: UseMutateFunction<{ tasks?: Task[] }, Error, Task[], unknown>;
}

export function useMidnightReset({
  dayStartHour,
  shiftEpoch,
  onNewDay,
  onQuota,
  setShiftState,
  updateTasksMut,
}: UseMidnightResetProps) {
  const queryClient = useQueryClient();
  const updateTasksMutRef = useRef<(tasks: Task[]) => void>(() => void 0);

  useEffect(() => {
    updateTasksMutRef.current = updateTasksMut;
  }, [updateTasksMut]);

  useEffect(() => {
    const tick = () => {
      const scheduleResp = queryClient.getQueryData<{ schedule: ShiftConfig[]; timestamp: number }>(
        [QUERY_KEYS.SCHEDULE]
      );
      const currentSchedule = scheduleResp?.schedule ?? DEFAULT_SHIFTS;
      setShiftState(computeShift(shiftEpoch, currentSchedule));
      const today = getLogicalDateISO(dayStartHour);
      const storedDate = lsGet<string | null>(LS_KEYS.DATE, null);
      if (storedDate && storedDate !== today) {
        const performReset = () => {
          // Double check inside the lock/fallback just in case another tab beat us to it
          const checkDate = lsGet<string | null>(LS_KEYS.DATE, null);
          if (checkDate === today) return;

          // Get state BEFORE clearing it, so we can pass it to the snapshot backup
          const currentChecked = lsGet<Record<string, boolean>>(LS_KEYS.CHECKED, {});
          const currentSubChecked = lsGet<Record<string, boolean>>(LS_KEYS.SUB_CHECKED, {});

          const event = new CustomEvent('mhm_midnight', {
            detail: {
              date: checkDate,
              checked: currentChecked,
              subChecked: currentSubChecked,
            },
          });
          window.dispatchEvent(event);

          const currentTasks =
            queryClient.getQueryData<{ tasks: Task[]; timestamp: number }>([QUERY_KEYS.TASKS])
              ?.tasks ?? [];

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
            queryClient.setQueryData([QUERY_KEYS.TASKS], {
              tasks: newTasks,
              timestamp: Date.now(),
            });
            lsSet(LS_KEYS.TASKS, newTasks, onQuota);
            updateTasksMutRef.current(newTasks);
          }

          queryClient.setQueryData([QUERY_KEYS.DAILY, today], {
            checked: {},
            subChecked: {},
            skipped: {},
          });
          lsSet(LS_KEYS.CHECKED, {}, onQuota);
          lsSet(LS_KEYS.SUB_CHECKED, {}, onQuota);
          lsSet(LS_KEYS.SKIPPED, {}, onQuota);
          lsSet(LS_KEYS.DATE, today, onQuota);
          onNewDay?.();
        };

        if (typeof navigator !== 'undefined' && navigator.locks) {
          void navigator.locks.request(
            'mhm_midnight_reset',
            { ifAvailable: true },
            async (lock) => {
              if (lock) performReset();
            }
          );
        } else {
          performReset();
        }
      }
    };

    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [shiftEpoch, dayStartHour, onNewDay, onQuota, queryClient, setShiftState]);
}
