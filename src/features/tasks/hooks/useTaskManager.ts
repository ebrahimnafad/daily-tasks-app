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
  saveSnapshot?: (data: import('@/types').DailySnapshot) => Promise<void>
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
      alert('تم إرسال الطلب ✅\nتحقق من الـ Sheet مباشرة للتأكد.');
    } catch {
      alert('خطأ في الإرسال. تحقق من الرابط.');
    }
  }, [progress, prayersDone, prayerTotal, countDone, totalOther]);

  // ── Shift-aware Reset New Day ──────────────────────────────────────────────
  const resetNewDay = useCallback(() => {
    if (!window.confirm('تصفير المهام لبدء يوم جديد؟')) return;
    const day = new Date().getDay();
    const workday = isWorkday(shift, scheduleConfig, day);
    const isStartOfWeek = day === 5; // Friday starts the new week

    const toReset = tasks.filter((t) => {
      const r = t.recurrence ?? 'يومي';
      return (
        r === 'يومي' ||
        (r === 'أيام العمل' && workday) ||
        (r === 'أسبوعي' && isStartOfWeek) ||
        r === 'مرة واحدة'
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
