import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSubtaskManager } from './useSubtaskManager';
import { useTaskCrud } from './useTaskCrud';
import { useTaskDerivedState } from './useTaskDerivedState';
import { sendProgressToSheets } from '@/api/googleSheets';
import {
  DEFAULT_SHIFTS,
  isWorkday,
  getLogicalDateISO,
  DAY_START_HOUR_KEY,
  type ShiftType,
  type ShiftConfig,
} from '@/features/tasks/data/scheduleConfig';
import type { Task, CheckedMap, SubCheckedMap, TaskManagerReturn } from '@/types';
import { lsGet } from '@/lib/storage/localStorage';

export default function useTaskManager(
  tasks: Task[],
  setTasks: Dispatch<SetStateAction<Task[]>>,
  checked: CheckedMap,
  setChecked: Dispatch<SetStateAction<CheckedMap>>,
  subChecked: SubCheckedMap,
  setSubChecked: Dispatch<SetStateAction<SubCheckedMap>>,
  skipped: CheckedMap,
  setSkipped: Dispatch<SetStateAction<CheckedMap>>,
  shift: ShiftType,
  scheduleConfig: ShiftConfig[] = DEFAULT_SHIFTS,
  saveSnapshot?: (data: import('@/types').DailySnapshot) => Promise<void>,
  /** Non-blocking notification callback — replaces native alert() */
  notify?: (message: string, type: 'offline' | 'error' | 'warn') => void
): TaskManagerReturn {
  // ── Sub-hook composition ───────────────────────────────────────────────────
  const subtasks = useSubtaskManager(setTasks, setSubChecked);

  const crud = useTaskCrud(
    tasks,
    setTasks,
    setChecked,
    setSubChecked,
    setSkipped,
    shift,
    scheduleConfig
  );

  const derived = useTaskDerivedState(tasks, shift, scheduleConfig, checked, subChecked, skipped);

  const { progress, prayersDone, prayerTotal, countDone, totalOther, otherTasks } = derived;

  // ── Google Sheets Export ───────────────────────────────────────────────────
  const sendToSheets = useCallback(async () => {
    try {
      await sendProgressToSheets({
        date: new Date().toLocaleDateString('en-GB'),
        progress,
        prayersDone,
        prayerTotal,
        tasksDone: countDone,
        tasksTotal: totalOther,
      });
      notify?.('✅ تم إرسال الطلب — تحقق من الـ Sheet مباشرة للتأكد.', 'warn');
    } catch {
      notify?.('❌ خطأ في الإرسال. تحقق من الرابط.', 'error');
    }
  }, [progress, prayersDone, prayerTotal, countDone, totalOther, notify]);

  // ── Shift-aware Reset New Day ──────────────────────────────────────────────
  const resetNewDay = useCallback(() => {
    if (!window.confirm('تصفير المهام لبدء يوم جديد؟')) return;
    // Compute the logical day-of-week: if dayStartHour > 0 and we are before that
    // hour, we are still on the previous calendar day (same as getLogicalDateISO).
    // Using raw new Date().getDay() would cause weekly tasks to reset one day early
    // when the user clicks reset in the pre-dayStartHour window (e.g. 1 AM on Friday
    // with dayStartHour=2 is logically still Thursday).
    const dayStartHour = lsGet<number>(DAY_START_HOUR_KEY, 0);
    const nowForDay = new Date();
    if (dayStartHour > 0 && nowForDay.getHours() < dayStartHour) {
      nowForDay.setDate(nowForDay.getDate() - 1);
    }
    const day = nowForDay.getDay();
    const workday = isWorkday(shift, scheduleConfig, day);
    const isStartOfWeek = day === 5; // Friday starts the new week

    const toReset = tasks.filter((t) => {
      const r = t.recurrence ?? 'يومي';
      return (
        r === 'يومي' || (r === 'أيام العمل' && workday) || (r === 'أسبوعي' && isStartOfWeek)
        // 'مرة واحدة' (once): handled separately below — completed ones are deleted,
        //   uncompleted ones are left untouched (still show up the next day).
        // 'شهري' (monthly): no reset — task only appears on its anchor day-of-month,
        //   so the checked state from last month is never visible.
      );
    });
    const ids = toReset.map((t) => t.id);

    // Save snapshot BEFORE clearing
    if (saveSnapshot) {
      const dayStartHour = lsGet<number>(DAY_START_HOUR_KEY, 0);
      const today = getLogicalDateISO(dayStartHour);
      void saveSnapshot({
        date: today,
        tasks: otherTasks,
        checked,
        skipped,
        progress,
        countDone,
        totalOther,
      });
    }

    setChecked((p) => {
      const n = { ...p };
      ids.forEach((id) => delete n[id]);
      return n;
    });
    setSubChecked((p) => {
      const n = { ...p };
      toReset.forEach((t) => t.subtasks.forEach((s) => delete n[s.id]));
      return n;
    });
    // Clear skip state for reset tasks — leftover skip entries would inflate
    // the progress denominator on the new day, making 100% unreachable
    setSkipped((p) => {
      const n = { ...p };
      ids.forEach((id) => delete n[id]);
      return n;
    });

    // Auto-delete ALL once-tasks on reset — a "مرة واحدة" task belongs to a
    // specific day. Once the day resets, it disappears whether done or not.
    // Previously only completed ones were deleted, leaving uncompleted tasks
    // reappearing as unchecked on the next day (bug).
    const onceIds = new Set(
      tasks.filter((t) => (t.recurrence ?? 'يومي') === 'مرة واحدة').map((t) => t.id)
    );
    if (onceIds.size > 0) {
      setTasks((prev) => prev.filter((t) => !onceIds.has(t.id)));
      // Also clean up their checked/skipped/subChecked entries
      setChecked((p) => {
        const n = { ...p };
        onceIds.forEach((id) => delete n[id]);
        return n;
      });
      setSkipped((p) => {
        const n = { ...p };
        onceIds.forEach((id) => delete n[id]);
        return n;
      });
    }
  }, [
    tasks,
    shift,
    scheduleConfig,
    setChecked,
    setSubChecked,
    setSkipped,
    saveSnapshot,
    otherTasks,
    checked,
    skipped,
    progress,
    countDone,
    totalOther,
  ]);

  // ── Assemble the full return matching TaskManagerReturn ────────────────────
  return {
    // Raw state (passed through)
    tasks,
    checked,
    subChecked,
    setTasks,
    setChecked,
    setSubChecked,
    skipped,
    setSkipped,

    // Subtask manager
    ...subtasks,

    // Task CRUD + modal
    ...crud,

    // Derived state
    ...derived,

    // Orchestrator-level actions
    sendToSheets,
    resetNewDay,
    saveSnapshot: saveSnapshot ?? (() => Promise.resolve()),
  };
}
