import type { Dispatch, SetStateAction, RefObject, MouseEvent } from 'react';
import type { TimeBlock, ShiftConfig } from '@/features/tasks/data/scheduleConfig';
import type { VALID_RECURRENCES } from '@/validation/schemas';

// ── Primitive domain types ────────────────────────────────────────────────

export interface Subtask {
  id: string | number;
  text: string;
  alertTime?: string;
  /** When true, this subtask is a recommended extra (e.g. Witr) and is excluded
   *  from the required-prayer ring denominator. */
  isOptional?: boolean;
}

export interface Brief {
  blockers: string[];
  helpers: string[];
}

export interface Task {
  id: string;
  icon: string;
  title: string;
  category: string;
  color: string;
  /** Which shift(s) this task belongs to */
  shifts: string[];
  /** Time block ID from scheduleConfig.ts (e.g. 'work-early', 'family') */
  timeBlock: string;
  isWarning: boolean;
  recurrence: (typeof VALID_RECURRENCES)[number];
  /** Specific date for one-time tasks (YYYY-MM-DD) */
  date?: string;
  alertTime?: string;
  isPrayerTask: boolean;
  isPinned?: boolean;
  subtasks: Subtask[];
  brief: Brief;
  /** Linked OKR Key Result ID for automatic check-ins */
  linkedKeyResultId?: string | null;
  /** Legacy field — kept for migration only, do not use */
  time?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Daily Snapshot ────────────────────────────────────────────────────────────────────────────────

export interface DailySnapshot {
  date: string;
  tasks: Task[];
  checked: CheckedMap;
  skipped: CheckedMap;
  progress: number;
  countDone: number;
  totalOther: number;
  prayersDone?: number;
  prayerTotal?: number;
  prayerOptionalDone?: number;
}

export interface SnapshotSummary {
  date: string;
  progress: number;
  countDone: number;
  totalOther: number;
  prayersDone?: number;
  prayerTotal?: number;
  prayerOptionalDone?: number;
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
  recurrence: (typeof VALID_RECURRENCES)[number];
  date: string;
  alertTime: string;
  blockers: string[];
  helpers: string[];
  linkedKeyResultId?: string | null;
}

// ── Checked maps ──────────────────────────────────────────────────────────

export type CheckedMap = Record<string, boolean>;
export type SubCheckedMap = Record<string, boolean>;
export type TaskSubCheckedMap = Record<string, Record<string, boolean>>;

// ── Modal ─────────────────────────────────────────────────────────────────

export type ModalState = { mode: 'add' } | { mode: 'edit'; taskId: string };

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
  newItemText: Record<string, string>;
  setNewItemText: Dispatch<SetStateAction<Record<string, string>>>;
  newItemAlertTime: Record<string, string>;
  setNewItemAlertTime: Dispatch<SetStateAction<Record<string, string>>>;
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
  deleteConfirm: string | null;
  setDeleteConfirm: Dispatch<SetStateAction<string | null>>;

  // Subtask CRUD
  addSubItem: (taskId: string, inputRef: RefObject<HTMLInputElement | null>) => void;
  deleteSubItem: (taskId: string, subId: string | number) => void;
  startEditSub: (sub: Subtask) => void;
  saveEditSub: (taskId: string) => void;
  cancelEditSub: () => void;

  // Task CRUD
  openAdd: () => void;
  openEdit: (task: Task, e: MouseEvent) => void;
  setFormField: <K extends keyof TaskForm>(f: K, v: TaskForm[K]) => void;
  saveTask: () => void;
  deleteTask: (id: string) => void;
  togglePinTask: (id: string) => void;
  toggleSkipTask: (id: string) => void;

  // Actions
  sendToSheets: () => Promise<void>;
  resetNewDay: () => void;
  /** Saves a daily snapshot before clearing. Called automatically inside resetNewDay. */
  saveSnapshot: (data: import('@/types').DailySnapshot) => Promise<void>;

  // Derived state
  prayerTask: Task | undefined;
  prayersDone: number;
  prayerTotal: number;
  /** Number of checked optional (sunnah) prayers — display only. */
  prayerOptionalDone: number;
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
  /** Raw task list — all tasks, not filtered by shift */
  tasks: Task[];
  /** Direct setter (sync to server) — use sparingly, prefer tm actions */
  setTasks: Dispatch<SetStateAction<Task[]>>;
  prayersDone: number;
  prayerTotal: number;
  notifPerm: NotifPerm;
  requestNotifPerm: () => Promise<void>;
  /** Hour (0-23) at which the logical day starts (default 0 = midnight) */
  dayStartHour: number;
  setDayStartHour: (hour: number) => void;
  /** Save a snapshot to the DB */
  saveSnapshot: (data: import('@/types').DailySnapshot) => Promise<void>;

  // OKR integration
  availableKeyResults?: Array<{ id: string; title: string; objectiveTitle: string }>;
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
