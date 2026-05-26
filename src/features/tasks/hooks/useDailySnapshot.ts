import { useRef, useCallback, useLayoutEffect } from 'react';
import { LS_KEYS } from '@/lib/storage/keys';
import { getLogicalDateISO } from '@/features/tasks/data/scheduleConfig';
import type { ShiftType, ShiftConfig } from '@/features/tasks/data/scheduleConfig';
import type { Task, CheckedMap, SubCheckedMap, DailySnapshot, TaskManagerReturn } from '@/types';
import { lsGet } from '@/lib/storage/localStorage';

// localStorage keys — shared convention with useTaskDerivedState.ts.
// workExceptions and vacationDays are not threaded through React state at the
// App level; useScheduleSync writes them to localStorage and both
// useTaskDerivedState and this hook read them from there. This matches the
// established codebase convention for these two values.
// TODO: Surface these through useSync's return if a full data-flow cleanup is
//       ever undertaken, so they can be passed as typed deps instead.
const LS_WORK_EXCEPTIONS_KEY = LS_KEYS.WORK_EXCEPTIONS;
const LS_VACATION_DAYS_KEY = LS_KEYS.VACATION_DAYS;

export interface DailySnapshotDeps {
  dayStartHour: number;
  checked: CheckedMap;
  subChecked: SubCheckedMap;
  skipped: CheckedMap;
  schedule: ShiftConfig[];
  shift: ShiftType;
  tasks: Task[];
  tm: TaskManagerReturn;
  saveSnapshot: (data: DailySnapshot) => Promise<void>;
  okrSummary?: DailySnapshot['okrSummary'];
}

/**
 * Extracted from App.tsx — encapsulates the auto-snapshot logic that was
 * previously implemented as an inline useLayoutEffect + useRef + useCallback.
 *
 * ## Stale closure strategy
 * `stableAutoSnapshot` is exposed with an empty useCallback dependency array so
 * that its reference never changes between renders. This is intentional: useSync
 * captures it once and relies on reference stability. Stale closure risk is
 * eliminated by storing all deps in a `useRef` that is updated on every render
 * via a `useLayoutEffect` with no dependency array. The effect always runs
 * synchronously before paint, so by the time any snapshot is triggered (e.g.
 * at midnight) the ref holds the latest values.
 *
 * ## Strict Mode / double-fire
 * React 18/19 Strict Mode intentionally mounts → unmounts → remounts in
 * development, causing useLayoutEffect to fire twice. Since the effect only
 * mutates a ref (no subscriptions, no external side effects), the double-fire
 * is harmless — the second run simply overwrites the ref with the same values.
 *
 * ## Past-date snapshot calculation
 * When `date` is different from today's logical date (e.g. the midnight tick
 * fires at 4 AM to snapshot May 20), the hook re-filters tasks using the
 * target date's day-of-week and workday status. This avoids snapshotting with
 * today's filtered task list, which could omit 'مرة واحدة' tasks that were
 * already removed at midnight.
 */
export function useDailySnapshot(deps: DailySnapshotDeps): {
  snapshotImpl: (
    date?: string,
    fallbackChecked?: CheckedMap,
    fallbackSubChecked?: SubCheckedMap,
    okrSummaryOverride?: DailySnapshot['okrSummary']
  ) => void;
} {
  // ── Always-fresh ref — updated every render before paint ────────────────────
  // STALE CLOSURE NOTE: Do NOT read deps directly inside snapshotImpl.
  // Always read from depsRef.current so the callback sees the latest values
  // regardless of when it is invoked.
  const depsRef = useRef<DailySnapshotDeps>(deps);

  // No dependency array — intentional. We want the ref to always hold the
  // freshest render values, identical to the original pattern in App.tsx.
  useLayoutEffect(() => {
    depsRef.current = deps;
  });

  const snapshotImpl = useCallback(
    (
      date?: string,
      fallbackChecked?: CheckedMap,
      fallbackSubChecked?: SubCheckedMap,
      okrSummaryOverride?: DailySnapshot['okrSummary']
    ): void => {
      const {
        dayStartHour,
        checked,
        subChecked,
        skipped,
        schedule,
        shift,
        tasks,
        tm,
        saveSnapshot,
        okrSummary,
      } = depsRef.current;

      const targetDate = date || getLogicalDateISO(dayStartHour);
      const logicalToday = getLogicalDateISO(dayStartHour);

      const resolvedChecked = fallbackChecked ?? checked;
      const resolvedSubChecked = fallbackSubChecked ?? subChecked;

      // Default: use the derived values already computed by useTaskManager
      // (same data the user sees on screen — no redundant recomputation needed).
      let snapshotCountDone = tm.countDone;
      let snapshotTotalOther = tm.totalOther;
      let snapshotProgress = tm.progress;
      let snapshotTasks = tm.otherTasks;
      let snapshotPrayersDone = tm.prayersDone;
      let snapshotPrayerTotal = tm.prayerTotal;
      let snapshotPrayerOptionalDone = tm.prayerOptionalDone;

      // ── Past-date branch ───────────────────────────────────────────────────
      // When snapshotting a past date (e.g. 4 AM May 21 taking May 20 snapshot),
      // we must recalculate countDone/totalOther based on that day's actual tasks,
      // not today's filtered visibility. Otherwise, if May 20 had only 'مرة واحدة'
      // tasks (deleted at midnight), the snapshot would show 0% progress despite
      // tasks being done.
      if (targetDate !== logicalToday) {
        const targetDateObj = new Date(targetDate + 'T12:00:00');
        const dayOfWeek = targetDateObj.getDay();

        // CONVENTION: read from localStorage — same pattern as useTaskDerivedState.
        // See module-level comment for rationale.
        const workExceptions = lsGet<string[]>(LS_WORK_EXCEPTIONS_KEY, []);
        const vacationDays = lsGet<string[]>(LS_VACATION_DAYS_KEY, []);

        const isExceptionalOffDay =
          workExceptions.includes(targetDate) || vacationDays.includes(targetDate);
        const workday = isExceptionalOffDay
          ? false
          : (schedule.find((s) => s.id === shift)?.offDays || []).includes(dayOfWeek) === false;

        const allTasksForDate = tasks.filter((t) => {
          const taskShifts = t.shifts ?? ['morning', 'evening'];
          if (!taskShifts.includes(shift)) return false;

          // Exclude tasks created logically AFTER the snapshot target date.
          // createdAt is present on Task as an optional field.
          const createdStr = t.createdAt;
          if (createdStr) {
            const logicalCreated = getLogicalDateISO(dayStartHour, new Date(createdStr));
            if (logicalCreated > targetDate) return false;
          }

          const rec = t.recurrence ?? 'يومي';
          if (rec === 'أيام العمل' && !workday) return false;
          if (rec === 'موعد محدد') {
            if (!t.date || t.date !== targetDate) return false;
          }
          if (rec === 'شهري') {
            if (!t.date) return true;
            const anchor = new Date(t.date + 'T12:00:00');
            return anchor.getDate() === targetDateObj.getDate();
          }
          if (rec === 'أسبوعي') {
            if (!t.date) return true;
            const anchor = new Date(t.date + 'T12:00:00');
            return anchor.getDay() === targetDateObj.getDay();
          }
          return true;
        });

        snapshotTasks = allTasksForDate.filter((t) => !t.isPrayerTask);

        const skippedOther = snapshotTasks.filter((t) => skipped[t.id]);
        snapshotTotalOther = snapshotTasks.length - skippedOther.length;

        snapshotCountDone = snapshotTasks.filter((t) => {
          if (t.subtasks && t.subtasks.length > 0) {
            const required = t.subtasks.filter((s) => !s.isOptional);
            if (required.length === 0) {
              return t.subtasks.every((s) => resolvedSubChecked[s.id]);
            }
            return required.every((s) => resolvedSubChecked[s.id]);
          }
          return resolvedChecked[t.id];
        }).length;

        const pt = allTasksForDate.find((t) => t.isPrayerTask);
        const reqSubs = pt ? pt.subtasks.filter((s) => !s.isOptional) : [];
        const optSubs = pt ? pt.subtasks.filter((s) => s.isOptional) : [];
        snapshotPrayerTotal = reqSubs.length;
        snapshotPrayersDone = reqSubs.filter((s) => resolvedSubChecked[s.id]).length;
        snapshotPrayerOptionalDone = optSubs.filter((s) => resolvedSubChecked[s.id]).length;

        snapshotProgress =
          snapshotTotalOther > 0
            ? Math.round(
                ((snapshotCountDone + snapshotPrayersDone) /
                  (snapshotTotalOther + snapshotPrayerTotal)) *
                  100
              )
            : snapshotPrayerTotal > 0
              ? Math.round((snapshotPrayersDone / snapshotPrayerTotal) * 100)
              : 0;
      }

      void saveSnapshot({
        date: targetDate,
        tasks: snapshotTasks,
        checked: { ...resolvedChecked, ...resolvedSubChecked },
        skipped,
        progress: snapshotProgress,
        countDone: snapshotCountDone,
        totalOther: snapshotTotalOther,
        prayersDone: snapshotPrayersDone,
        prayerTotal: snapshotPrayerTotal,
        prayerOptionalDone: snapshotPrayerOptionalDone,
        okrSummary: okrSummaryOverride !== undefined ? okrSummaryOverride : okrSummary,
      });
    },
    [] // ⚠️  STABILITY CONTRACT: empty dep array keeps snapshotImpl permanently stable.
    // App.tsx relies on this — it assigns snapshotFnRef.current = snapshotImpl in the
    // render body and the shim (stableAutoSnapshot) forwards to it. If you need to add
    // deps here, update the STABILITY CONTRACT comment in App.tsx accordingly.
  );

  return { snapshotImpl };
}
