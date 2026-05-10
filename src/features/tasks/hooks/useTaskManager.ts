import { useState, useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction, RefObject, MouseEvent } from 'react';
import { CATEGORIES } from '@/features/tasks';
import { sendProgressToSheets } from '@/api/googleSheets';
import { parseTaskFormSafe } from '@/validation/schemas';
import {
  DEFAULT_SHIFTS,
  getCurrentBlockId,
  isWorkday,
  type ShiftType,
  type ShiftConfig,
} from '@/features/tasks/data/scheduleConfig';

const todayISO = (): string => new Date().toISOString().split('T')[0];

import type {
  Task,
  Subtask,
  TaskForm,
  CheckedMap,
  SubCheckedMap,
  TaskSubCheckedMap,
  ModalState,
  TaskManagerReturn,
} from '@/types';

const EMPTY_FORM: TaskForm = {
  icon: '📋',
  title: '',
  category: 'أخرى',
  color: '#aaaaaa',
  shifts: ['morning', 'evening'],
  timeBlock: 'anytime',
  isWarning: false,
  recurrence: 'يومي',
  date: '',
  alertTime: '',
  blockers: [''],
  helpers: [''],
};

const uid = (): string => crypto.randomUUID();

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
  scheduleConfig: ShiftConfig[] = DEFAULT_SHIFTS
): TaskManagerReturn {
  const [newItemText, setNewItemText] = useState<Record<number, string>>({});
  const [newItemAlertTime, setNewItemAlertTime] = useState<Record<number, string>>({});
  const [editingSubId, setEditingSubId] = useState<string | number | null>(null);
  const [editingSubText, setEditingSubText] = useState('');
  const [editingSubAlertTime, setEditingSubAlertTime] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // ── Subtask CRUD ──────────────────────────────────────────────────────────
  const addSubItem = useCallback(
    (taskId: number, inputRef: RefObject<HTMLInputElement | null>) => {
      const text = (newItemText[taskId] ?? '').trim();
      const alertTime = newItemAlertTime[taskId] ?? '';
      if (!text) return;
      setTasks((p) =>
        p.map((t) =>
          t.id === taskId ? { ...t, subtasks: [...t.subtasks, { id: uid(), text, alertTime }] } : t
        )
      );
      setNewItemText((p) => ({ ...p, [taskId]: '' }));
      setNewItemAlertTime((p) => ({ ...p, [taskId]: '' }));
      setTimeout(() => inputRef?.current?.focus(), 0);
    },
    [newItemText, newItemAlertTime, setTasks]
  );

  const deleteSubItem = useCallback(
    (taskId: number, subId: string | number) => {
      setTasks((p) =>
        p.map((t) =>
          t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subId) } : t
        )
      );
      setSubChecked((p) => {
        const n = { ...p };
        delete n[subId];
        return n;
      });
    },
    [setTasks, setSubChecked]
  );

  const startEditSub = useCallback((sub: Subtask) => {
    setEditingSubId(sub.id);
    setEditingSubText(sub.text);
    setEditingSubAlertTime(sub.alertTime ?? '');
  }, []);

  const saveEditSub = useCallback(
    (taskId: number) => {
      const text = editingSubText.trim();
      const alertTime = editingSubAlertTime;
      if (text)
        setTasks((p) =>
          p.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((s) =>
                    s.id === editingSubId ? { ...s, text, alertTime } : s
                  ),
                }
              : t
          )
        );
      setEditingSubId(null);
    },
    [editingSubText, editingSubAlertTime, editingSubId, setTasks]
  );

  const cancelEditSub = useCallback(() => setEditingSubId(null), []);

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  const openAdd = useCallback(() => {
    const now = new Date();
    const currentBlockId = getCurrentBlockId(
      shift,
      scheduleConfig,
      now.getHours() + now.getMinutes() / 60,
      now.getDay()
    );
    // Don't pre-select optional (walking) or rest (sleep) blocks — user should choose explicitly
    const shiftConfig = scheduleConfig.find((s) => s.id === shift);
    const activeBlocks = shiftConfig?.dayOverrides?.[now.getDay()] || shiftConfig?.blocks || [];
    const currentBlock = activeBlocks.find((b) => b.id === currentBlockId);
    const defaultBlock =
      currentBlock && !currentBlock.isOptional && !currentBlock.isRest ? currentBlockId : 'anytime';
    setForm({
      ...EMPTY_FORM,
      shifts: [shift],
      timeBlock: defaultBlock ?? 'anytime',
    });
    setModal({ mode: 'add' });
  }, [shift, scheduleConfig]);

  const openEdit = useCallback((task: Task, e: MouseEvent) => {
    e.stopPropagation();
    setForm({
      icon: task.icon,
      title: task.title,
      category: task.category,
      color: task.color,
      shifts: task.shifts ?? ['morning', 'evening'],
      timeBlock: task.timeBlock ?? 'anytime',
      isWarning: task.isWarning || false,
      recurrence: task.recurrence || 'يومي',
      date: task.date ?? '',
      alertTime: task.alertTime || '',
      blockers: task.brief?.blockers?.length ? [...task.brief.blockers] : [''],
      helpers: task.brief?.helpers?.length ? [...task.brief.helpers] : [''],
    });
    setModal({ mode: 'edit', taskId: task.id });
  }, []);

  const setFormField = useCallback(<K extends keyof TaskForm>(f: K, v: TaskForm[K]) => {
    if (f === 'category') {
      const c = CATEGORIES.find((x) => x.label === v);
      setForm((p) => ({ ...p, category: v as string, color: c ? c.color : '#aaaaaa' }));
    } else {
      setForm((p) => ({ ...p, [f]: v }));
    }
  }, []);

  const saveTask = useCallback(() => {
    if (!modal) return;
    const validation = parseTaskFormSafe(form);
    if (!validation.success) {
      alert(`خطأ في البيانات:\n${validation.errors.join('\n')}`);
      return;
    }
    const color = form.color.startsWith('#')
      ? form.color
      : form.color.startsWith('var(')
        ? form.color
        : '#aaaaaa';
    const patch = {
      icon: form.icon,
      title: form.title.trim(),
      category: form.category,
      color,
      shifts: (form.shifts.length > 0
        ? form.shifts
        : (['morning', 'evening'] as ShiftType[])) as ShiftType[],
      timeBlock: form.timeBlock || 'anytime',
      isWarning: form.isWarning,
      recurrence: form.recurrence,
      date: form.date || undefined,
      alertTime: form.alertTime || '',
      brief: {
        blockers: form.blockers.filter((b) => b.trim()),
        helpers: form.helpers.filter((h) => h.trim()),
      },
    };
    if (modal.mode === 'add') {
      const newId = Date.now();
      setTasks((p) => [...p, { id: newId, isPrayerTask: false, subtasks: [], ...patch }]);
    } else {
      setTasks((p) =>
        p.map((t) =>
          t.id === (modal as { mode: string; taskId: number }).taskId ? { ...t, ...patch } : t
        )
      );
    }
    setModal(null);
  }, [form, modal, setTasks]);

  const deleteTask = useCallback(
    (id: number) => {
      const task = tasks.find((t) => t.id === id);
      setTasks((p) => p.filter((t) => t.id !== id));
      setChecked((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      if (task?.subtasks?.length) {
        setSubChecked((p) => {
          const n = { ...p };
          task.subtasks.forEach((s) => delete n[s.id]);
          return n;
        });
      }
      setDeleteConfirm(null);
    },
    [tasks, setTasks, setChecked, setSubChecked]
  );

  const togglePinTask = useCallback(
    (id: number) => {
      setTasks((p) => p.map((t) => (t.id === id ? { ...t, isPinned: !t.isPinned } : t)));
    },
    [setTasks]
  );

  const toggleSkipTask = useCallback(
    (id: number) => {
      setSkipped((p) => {
        const n = { ...p };
        if (n[id]) delete n[id];
        else n[id] = true;
        return n;
      });
    },
    [setSkipped]
  );

  // ── Shift-aware Derived State ─────────────────────────────────────────────
  const {
    shiftTasks,
    prayerTask,
    prayersDone,
    prayerTotal,
    otherTasks,
    countDone,
    totalOther,
    progress,
    currentBlockId,
    tasksByBlock,
  } = useMemo(() => {
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
      // Handle specific date tasks
      if (rec === 'موعد محدد' && t.date) {
        const today = todayISO();
        if (t.date !== today) return false;
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
      // Sort pinned tasks to the top
      blockTasks.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
      return {
        block,
        tasks: blockTasks,
        isCurrent: block.id === blockId,
      };
    });

    // Catch-all: tasks with 'anytime' or unrecognized timeBlock always appear
    const assignedIds = new Set(byBlock.flatMap((e) => e.tasks.map((t) => t.id)));
    const unassigned = others.filter((t) => !assignedIds.has(t.id));
    if (unassigned.length > 0) {
      unassigned.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
      byBlock.push({
        block: { id: 'anytime', label: 'مهام أخرى', icon: '📌', startHour: 0, endHour: 24 },
        tasks: unassigned,
        isCurrent: false,
      });
    }

    // Sort to show current block first for better focus
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

  // ── Google Sheets Export ──────────────────────────────────────────────────
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

  // ── Shift-aware Reset New Day ─────────────────────────────────────────────
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
  }, [tasks, shift, scheduleConfig, setChecked, setSubChecked]);

  // ── taskSubCheckedMap ─────────────────────────────────────────────────────
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

  return {
    tasks,
    checked,
    subChecked,
    setTasks,
    setChecked,
    setSubChecked,
    skipped,
    setSkipped,
    newItemText,
    setNewItemText,
    newItemAlertTime,
    setNewItemAlertTime,
    editingSubId,
    setEditingSubId,
    editingSubText,
    setEditingSubText,
    editingSubAlertTime,
    setEditingSubAlertTime,
    modal,
    setModal,
    form,
    setForm,
    deleteConfirm,
    setDeleteConfirm,
    addSubItem,
    deleteSubItem,
    startEditSub,
    saveEditSub,
    cancelEditSub,
    openAdd,
    openEdit,
    setFormField,
    saveTask,
    deleteTask,
    togglePinTask,
    toggleSkipTask,
    sendToSheets,
    resetNewDay,
    prayerTask,
    prayersDone,
    prayerTotal,
    otherTasks,
    countDone,
    totalOther,
    progress,
    taskSubCheckedMap,
    // New shift-aware exports
    shiftTasks,
    currentBlockId,
    tasksByBlock,
  };
}
