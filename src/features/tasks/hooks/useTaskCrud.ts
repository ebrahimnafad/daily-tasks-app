import { useState, useRef, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction, MouseEvent } from 'react';
import { CATEGORIES } from '@/features/tasks/components/TaskModal';
import { parseTaskFormSafe } from '@/validation/schemas';
import {
  DEFAULT_SHIFTS,
  getCurrentBlockId,
  type ShiftType,
  type ShiftConfig,
} from '@/features/tasks/data/scheduleConfig';
import { localDateISO } from '@/lib/date/localDate';
import type { Task, TaskForm, CheckedMap, SubCheckedMap, ModalState } from '@/types';

export const EMPTY_FORM: TaskForm = {
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

export interface TaskCrudReturn {
  modal: ModalState | null;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
  form: TaskForm;
  setForm: Dispatch<SetStateAction<TaskForm>>;
  deleteConfirm: number | null;
  setDeleteConfirm: Dispatch<SetStateAction<number | null>>;
  openAdd: () => void;
  openEdit: (task: Task, e: MouseEvent) => void;
  setFormField: <K extends keyof TaskForm>(f: K, v: TaskForm[K]) => void;
  saveTask: () => void;
  deleteTask: (id: number) => void;
  togglePinTask: (id: number) => void;
  toggleSkipTask: (id: number) => void;
}

export function useTaskCrud(
  tasks: Task[],
  setTasks: Dispatch<SetStateAction<Task[]>>,
  setChecked: Dispatch<SetStateAction<CheckedMap>>,
  setSubChecked: Dispatch<SetStateAction<SubCheckedMap>>,
  setSkipped: Dispatch<SetStateAction<CheckedMap>>,
  shift: ShiftType,
  scheduleConfig: ShiftConfig[] = DEFAULT_SHIFTS
): TaskCrudReturn {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  // Guard against double-tap: blocks re-entrant saveTask calls that fire before
  // React re-renders and closes the modal. Reset by useEffect when modal → null.
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (!modal) isSavingRef.current = false;
  }, [modal]);

  const openAdd = useCallback(() => {
    const now = new Date();
    const currentBlockId = getCurrentBlockId(
      shift,
      scheduleConfig,
      now.getHours() + now.getMinutes() / 60,
      now.getDay()
    );
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
    } else if (f === 'shifts') {
      // Changing the shift invalidates the current timeBlock (it may not exist in the new
      // shift's active blocks). Reset to 'anytime' so the dropdown shows a valid selection
      // and the user explicitly picks the correct block from the updated options.
      setForm((p) => ({ ...p, shifts: v as string[], timeBlock: 'anytime' }));
    } else {
      setForm((p) => ({ ...p, [f]: v }));
    }
  }, []);

  const saveTask = useCallback(() => {
    if (!modal) return;
    // Block a second call that arrives before the modal closes (rapid double-tap).
    // The ref stays true until the modal-closed useEffect resets it.
    if (isSavingRef.current) return;
    isSavingRef.current = true;
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
      // Weekly and monthly tasks require an anchor date for the recurrence filter.
      // If the user didn't set one, default to today so the task appears correctly.
      date:
        form.date ||
        (form.recurrence === 'شهري' || form.recurrence === 'أسبوعي' ? localDateISO() : undefined),
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
      // Remove skip state so the orphaned entry doesn't inflate progress tomorrow
      setSkipped((p) => {
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
    [tasks, setTasks, setChecked, setSubChecked, setSkipped]
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

  return {
    modal,
    setModal,
    form,
    setForm,
    deleteConfirm,
    setDeleteConfirm,
    openAdd,
    openEdit,
    setFormField,
    saveTask,
    deleteTask,
    togglePinTask,
    toggleSkipTask,
  };
}
