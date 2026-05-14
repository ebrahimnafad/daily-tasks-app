import { useMemo } from 'react';
import {
  DEFAULT_SHIFTS,
  getCurrentBlockId,
  isWorkday,
  type ShiftType,
  type ShiftConfig,
} from '@/features/tasks/data/scheduleConfig';
import type { Task, CheckedMap, SubCheckedMap, TaskSubCheckedMap } from '@/types';
import { localDateISO } from '@/lib/date/localDate';

const todayISO = (): string => localDateISO();

export interface TaskDerivedStateReturn {
  shiftTasks: Task[];
  prayerTask: Task | undefined;
  prayersDone: number;
  prayerTotal: number;
  otherTasks: Task[];
  countDone: number;
  totalOther: number;
  progress: number;
  currentBlockId: string | null;
  tasksByBlock: {
    block: { id: string; label: string; icon: string; startHour: number; endHour: number };
    tasks: Task[];
    isCurrent: boolean;
  }[];
  taskSubCheckedMap: TaskSubCheckedMap;
}

export function useTaskDerivedState(
  tasks: Task[],
  shift: ShiftType,
  scheduleConfig: ShiftConfig[] = DEFAULT_SHIFTS,
  checked: CheckedMap,
  subChecked: SubCheckedMap,
  skipped: CheckedMap
): TaskDerivedStateReturn {
  const derived = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hourDecimal = now.getHours() + now.getMinutes() / 60;
    const workday = isWorkday(shift, scheduleConfig, dayOfWeek);
    const blockId = getCurrentBlockId(shift, scheduleConfig, hourDecimal, dayOfWeek);
    const shiftConfig = scheduleConfig.find((s) => s.id === shift) || scheduleConfig[0];

    // Filter tasks applicable to current shift + day
    const shiftFiltered = tasks.filter((t) => {
      const taskShifts = t.shifts ?? ['morning', 'evening'];
      if (!taskShifts.includes(shift)) return false;
      const rec = t.recurrence ?? 'يومي';
      if (rec === 'أيام العمل' && !workday) return false;
      if (rec === 'عطل' && workday) return false;
      if (rec === 'موعد محدد' && t.date) {
        if (t.date !== todayISO()) return false;
      }
      return true;
    });

    const pt = shiftFiltered.find((t) => t.isPrayerTask);
    const pd = pt ? pt.subtasks.filter((s) => subChecked[s.id]).length : 0;
    const pTotal = pt ? pt.subtasks.length : 0;
    const others = shiftFiltered.filter((t) => !t.isPrayerTask);
    const done = others.filter((t) =>
      t.subtasks.length > 0 ? t.subtasks.every((s) => subChecked[s.id]) : checked[t.id]
    ).length;
    const total = others.length - others.filter((t) => skipped[t.id]).length;
    const activeProgTotal = pTotal + total;
    const prog = activeProgTotal === 0 ? 0 : Math.round(((pd + done) / activeProgTotal) * 100);

    // Group by time block (ordered by active blocks definition)
    const activeBlocks = shiftConfig.dayOverrides?.[dayOfWeek] || shiftConfig.blocks;
    const byBlock = activeBlocks.map((block) => {
      const blockTasks = others.filter((t) => (t.timeBlock ?? 'anytime') === block.id);
      blockTasks.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
      return { block, tasks: blockTasks, isCurrent: block.id === blockId };
    });

    // Catch-all: tasks with 'anytime' or unrecognized timeBlock
    const assignedIds = new Set(byBlock.flatMap((e) => e.tasks.map((t) => t.id)));
    const unassigned = others.filter((t) => !assignedIds.has(t.id));

    // Track all block IDs already rendered (active blocks for this shift/day)
    const renderedBlockIds = new Set(byBlock.map((e) => e.block.id));

    // Restore missing blocks from other shifts so tasks don't get dumped into "Others".
    // A block is truly "missing" only if it is not already rendered in byBlock.
    const knownMissingBlocks = new Map<string, (typeof activeBlocks)[0]>();
    scheduleConfig.forEach((s) => {
      // Check both base blocks and any day overrides for this shift
      const overrideBlocks = Object.values(s.dayOverrides ?? {})
        .flat()
        .filter((b): b is (typeof activeBlocks)[0] => b !== undefined);
      const allShiftBlocks = [...s.blocks, ...overrideBlocks];
      allShiftBlocks.forEach((b) => {
        if (!renderedBlockIds.has(b.id)) {
          knownMissingBlocks.set(b.id, b);
        }
      });
    });

    const strictlyUnassigned: typeof others = [];
    const missingBlockGroups = new Map<string, typeof others>();

    unassigned.forEach((t) => {
      const tb = t.timeBlock ?? 'anytime';
      if (knownMissingBlocks.has(tb)) {
        if (!missingBlockGroups.has(tb)) missingBlockGroups.set(tb, []);
        missingBlockGroups.get(tb)!.push(t);
      } else {
        strictlyUnassigned.push(t);
      }
    });

    missingBlockGroups.forEach((groupTasks, blockId) => {
      const block = knownMissingBlocks.get(blockId)!;
      groupTasks.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
      byBlock.push({ block, tasks: groupTasks, isCurrent: false });
    });

    if (strictlyUnassigned.length > 0) {
      strictlyUnassigned.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
      byBlock.push({
        block: { id: 'anytime', label: 'مهام أخرى', icon: '📌', startHour: 0, endHour: 24 },
        tasks: strictlyUnassigned,
        isCurrent: false,
      });
    }

    // Current block rises to the top
    byBlock.sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));

    // Prayer task gets its own virtual block
    const prayerBlockEntry = pt
      ? [
          {
            block: { id: 'prayer', label: 'الصلوات الخمس', icon: '🕌', startHour: 0, endHour: 24 },
            tasks: [pt],
            isCurrent: false,
          },
        ]
      : [];

    return {
      shiftTasks: shiftFiltered,
      prayerTask: pt,
      prayersDone: pd,
      prayerTotal: pTotal,
      otherTasks: others,
      countDone: done,
      totalOther: total,
      progress: prog,
      currentBlockId: blockId,
      tasksByBlock: [...prayerBlockEntry, ...byBlock],
    };
  }, [tasks, shift, scheduleConfig, checked, subChecked, skipped]);

  const taskSubCheckedMap = useMemo<TaskSubCheckedMap>(() => {
    const map: TaskSubCheckedMap = {};
    tasks.forEach((task) => {
      const ts: Record<string | number, boolean> = {};
      task.subtasks.forEach((s) => {
        ts[s.id] = !!subChecked[s.id];
      });
      map[task.id] = ts;
    });
    return map;
  }, [tasks, subChecked]);

  return { ...derived, taskSubCheckedMap };
}
