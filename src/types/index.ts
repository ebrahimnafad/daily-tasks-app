import type { Dispatch, SetStateAction, RefObject, MouseEvent } from 'react';
import type { TimeBlock, ShiftConfig } from '@/features/tasks/data/scheduleConfig';

// ── Primitive domain types ────────────────────────────────────────────────

export interface Subtask {
  id: string | number;
  text: string;
  alertTime?: string;
}

export interface Brief {
  blockers: string[];
  helpers: string[];
}

export interface Task {
  id: number;
  icon: string;
  title: string;
  category: string;
  color: string;
  /** Which shift(s) this task belongs to */
  shifts: string[];
  /** Time block ID from scheduleConfig.ts (e.g. 'work-early', 'family') */
  timeBlock: string;
  isWarning: boolean;
  recurrence: string;
  /** Specific date for one-time tasks (YYYY-MM-DD) */
  date?: string;
  alertTime?: string;
  isPrayerTask: boolean;
  isPinned?: boolean;
  subtasks: Subtask[];
  brief: Brief;
  /** Legacy field — kept for migration only, do not use */
  time?: string;
}

export interface Category {
  label: string;
  color: string;
  icon?: string;
}

// ── Form state ────────────────────────────────────────────────────────────

export interface TaskForm {
  icon: string;
  title: string;
  category: string;
  color: string;
  shifts: string[];
  timeBlock: string;
  isWarning: boolean;
  recurrence: string;
  date: string;
  alertTime: string;
  blockers: string[];
  helpers: string[];
}

// ── Checked maps ──────────────────────────────────────────────────────────

export type CheckedMap = Record<number, boolean>;
export type SubCheckedMap = Record<string | number, boolean>;
export type TaskSubCheckedMap = Record<number, Record<string | number, boolean>>;

// ── Modal ─────────────────────────────────────────────────────────────────

export type ModalState = { mode: 'add' } | { mode: 'edit'; taskId: number };

// ── Sync / notification ───────────────────────────────────────────────────

export type SyncStatus = 'syncing' | 'synced' | 'offline' | 'error';
export type NotifPerm = 'default' | 'granted' | 'denied';

// ── useTaskManager return ─────────────────────────────────────────────────

export interface TaskManagerReturn {
  // Raw state
  tasks: Task[];
  checked: CheckedMap;
  subChecked: SubCheckedMap;
  skipped: CheckedMap;
  setTasks: Dispatch<SetStateAction<Task[]>>;
  setChecked: Dispatch<SetStateAction<CheckedMap>>;
  setSubChecked: Dispatch<SetStateAction<SubCheckedMap>>;
  setSkipped: Dispatch<SetStateAction<CheckedMap>>;

  // Sub-item editing
  newItemText: Record<number, string>;
  setNewItemText: Dispatch<SetStateAction<Record<number, string>>>;
  newItemAlertTime: Record<number, string>;
  setNewItemAlertTime: Dispatch<SetStateAction<Record<number, string>>>;
  editingSubId: string | number | null;
  setEditingSubId: Dispatch<SetStateAction<string | number | null>>;
  editingSubText: string;
  setEditingSubText: Dispatch<SetStateAction<string>>;
  editingSubAlertTime: string;
  setEditingSubAlertTime: Dispatch<SetStateAction<string>>;

  // Modal
  modal: ModalState | null;
  setModal: Dispatch<SetStateAction<ModalState | null>>;
  form: TaskForm;
  setForm: Dispatch<SetStateAction<TaskForm>>;
  deleteConfirm: number | null;
  setDeleteConfirm: Dispatch<SetStateAction<number | null>>;

  // Subtask CRUD
  addSubItem: (taskId: number, inputRef: RefObject<HTMLInputElement | null>) => void;
  deleteSubItem: (taskId: number, subId: string | number) => void;
  startEditSub: (sub: Subtask) => void;
  saveEditSub: (taskId: number) => void;
  cancelEditSub: () => void;

  // Task CRUD
  openAdd: () => void;
  openEdit: (task: Task, e: MouseEvent) => void;
  setFormField: <K extends keyof TaskForm>(f: K, v: TaskForm[K]) => void;
  saveTask: () => void;
  deleteTask: (id: number) => void;
  togglePinTask: (id: number) => void;
  toggleSkipTask: (id: number) => void;

  // Actions
  sendToSheets: () => Promise<void>;
  resetNewDay: () => void;

  // Derived state
  prayerTask: Task | undefined;
  prayersDone: number;
  prayerTotal: number;
  otherTasks: Task[];
  countDone: number;
  totalOther: number;
  progress: number;
  taskSubCheckedMap: TaskSubCheckedMap;

  // Shift-aware derived state
  /** Tasks filtered to the current shift + day */
  shiftTasks: Task[];
  /** ID of the currently active time block, or null */
  currentBlockId: string | null;
  /** Tasks grouped by time block, ordered by shift config */
  tasksByBlock: {
    block: TimeBlock & { id: string };
    tasks: Task[];
    isCurrent: boolean;
  }[];
}

// ── TaskContext value ──────────────────────────────────────────────────────

export interface TaskContextValue {
  tm: TaskManagerReturn;
  setChecked: Dispatch<SetStateAction<CheckedMap>>;
  setSubChecked: Dispatch<SetStateAction<SubCheckedMap>>;
  setSkipped: Dispatch<SetStateAction<CheckedMap>>;
  scheduleConfig: ShiftConfig[];
  setScheduleConfig: Dispatch<SetStateAction<ShiftConfig[]>>;
  prayersDone: number;
  prayerTotal: number;
  notifPerm: NotifPerm;
  requestNotifPerm: () => Promise<void>;
}

// ── useSync return ────────────────────────────────────────────────────────

export interface UseSyncReturn {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  checked: CheckedMap;
  setChecked: Dispatch<SetStateAction<CheckedMap>>;
  subChecked: SubCheckedMap;
  setSubChecked: Dispatch<SetStateAction<SubCheckedMap>>;
  skipped: CheckedMap;
  setSkipped: Dispatch<SetStateAction<CheckedMap>>;
  shift: string;
  setShift: Dispatch<SetStateAction<string>>;
  syncStatus: SyncStatus;
}

// ── Google Sheets payload ─────────────────────────────────────────────────

export interface SheetsPayload {
  date: string;
  progress: number;
  prayersDone: number;
  prayerTotal: number;
  tasksDone: number;
  tasksTotal: number;
}
