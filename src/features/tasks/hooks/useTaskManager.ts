import { useState, useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction, RefObject, MouseEvent } from 'react';
import { CATEGORIES } from '@/features/tasks';
import { sendProgressToSheets } from '@/api/googleSheets';
import {
  SHIFTS,
  getCurrentBlockId,
  isWorkday,
  type ShiftType,
} from '@/features/tasks/data/scheduleConfig';
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
  alertTime: '',
  blockers: ['', '', ''],
  helpers: ['', '', ''],
};

const uid = (): string => crypto.randomUUID();

export default function useTaskManager(
  tasks: Task[],
  setTasks: Dispatch<SetStateAction<Task[]>>,
  checked: CheckedMap,
  setChecked: Dispatch<SetStateAction<CheckedMap>>,
  subChecked: SubCheckedMap,
  setSubChecked: Dispatch<SetStateAction<SubCheckedMap>>,
  shift: ShiftType
): TaskManagerReturn {
  const [newItemText, setNewItemText] = useState<Record<number, string>>({});
  const [editingSubId, setEditingSubId] = useState<string | number | null>(null);
  const [editingSubText, setEditingSubText] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [nextId, setNextId] = useState(200);

  // ── Subtask CRUD ──────────────────────────────────────────────────────────
  const addSubItem = useCallback(
    (taskId: number, inputRef: RefObject<HTMLInputElement | null>) => {
      const text = (newItemText[taskId] ?? '').trim();
      if (!text) return;
      setTasks((p) =>
        p.map((t) =>
          t.id === taskId ? { ...t, subtasks: [...t.subtasks, { id: uid(), text }] } : t
        )
      );
      setNewItemText((p) => ({ ...p, [taskId]: '' }));
      setTimeout(() => inputRef?.current?.focus(), 0);
    },
    [newItemText, setTasks]
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
  }, []);

  const saveEditSub = useCallback(
    (taskId: number) => {
      const text = editingSubText.trim();
      if (text)
        setTasks((p) =>
          p.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((s) => (s.id === editingSubId ? { ...s, text } : s)),
                }
              : t
          )
        );
      setEditingSubId(null);
    },
    [editingSubText, editingSubId, setTasks]
  );

  const cancelEditSub = useCallback(() => setEditingSubId(null), []);

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  const openAdd = useCallback(() => {
    const now = new Date();
    const currentBlockId = getCurrentBlockId(shift, now.getHours() + now.getMinutes() / 60);
    // Don't pre-select optional (walking) or rest (sleep) blocks — user should choose explicitly
    const currentBlock = SHIFTS[shift].blocks.find((b) => b.id === currentBlockId);
    const defaultBlock =
      currentBlock && !currentBlock.isOptional && !currentBlock.isRest ? currentBlockId : 'anytime';
    setForm({
      ...EMPTY_FORM,
      shifts: [shift],
      timeBlock: defaultBlock ?? 'anytime',
    });
    setModal({ mode: 'add' });
  }, [shift]);

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
      alertTime: task.alertTime || '',
      blockers: [...(task.brief?.blockers ?? []), '', '', ''].slice(0, 3) as [
        string,
        string,
        string,
      ],
      helpers: [...(task.brief?.helpers ?? []), '', '', ''].slice(0, 3) as [string, string, string],
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
    if (!form.title.trim() || !modal) return;
    const catObj = CATEGORIES.find((c) => c.label === form.category);
    const color = catObj ? catObj.color : '#aaaaaa';
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
      alertTime: form.alertTime || '',
      brief: {
        blockers: form.blockers.filter((b) => b.trim()),
        helpers: form.helpers.filter((h) => h.trim()),
      },
    };
    if (modal.mode === 'add') {
      setTasks((p) => [...p, { id: nextId, isPrayerTask: false, subtasks: [], ...patch }]);
      setNextId((p) => p + 1);
    } else {
      setTasks((p) => p.map((t) => (t.id === modal.taskId ? { ...t, ...patch } : t)));
    }
    setModal(null);
  }, [form, modal, nextId, setTasks]);

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
    const workday = isWorkday(shift, dayOfWeek);
    const blockId = getCurrentBlockId(shift, hourDecimal);
    const shiftConfig = SHIFTS[shift];

    // Filter tasks applicable to current shift + day
    const shiftFiltered = tasks.filter((t) => {
      const taskShifts = t.shifts ?? ['morning', 'evening'];
      if (!taskShifts.includes(shift)) return false;
      const rec = t.recurrence ?? 'يومي';
      if (rec === 'أيام العمل' && !workday) return false;
      if (rec === 'عطل' && workday) return false;
      return true;
    });

    const pt = shiftFiltered.find((t) => t.isPrayerTask);
    const pd = pt ? pt.subtasks.filter((s) => subChecked[s.id]).length : 0;
    const pTotal = pt ? pt.subtasks.length : 0;
    const others = shiftFiltered.filter((t) => !t.isPrayerTask);
    const done = others.filter((t) =>
      t.subtasks.length > 0 ? t.subtasks.every((s) => subChecked[s.id]) : checked[t.id]
    ).length;
    const total = others.length;
    const prog = pTotal + total === 0 ? 0 : Math.round(((pd + done) / (pTotal + total)) * 100);

    // Group by time block (ordered by shiftConfig.blocks definition)
    const byBlock = shiftConfig.blocks
      .map((block) => ({
        block,
        tasks: others.filter((t) => (t.timeBlock ?? 'anytime') === block.id),
        isCurrent: block.id === blockId,
      }))
      .filter((entry) => entry.tasks.length > 0 || entry.isCurrent);

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
  }, [tasks, shift, checked, subChecked]);

  // ── Google Sheets Export ──────────────────────────────────────────────────
  const sendToSheets = useCallback(async () => {
    const url =
      localStorage.getItem('sheet_webhook_url') ||
      window.prompt('أدخل رابط Google Apps Script (Web App URL):');
    if (!url) return;
    localStorage.setItem('sheet_webhook_url', url);
    try {
      await sendProgressToSheets(url, {
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
    const workday = isWorkday(shift, day);
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
  }, [tasks, shift, setChecked, setSubChecked]);

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
    newItemText,
    setNewItemText,
    editingSubId,
    setEditingSubId,
    editingSubText,
    setEditingSubText,
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
