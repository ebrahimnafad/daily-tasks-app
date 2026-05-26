import { useMemo } from 'react';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { TaskContext } from '@/features/tasks/context/TaskContext';
import type {
  Task,
  CheckedMap,
  SubCheckedMap,
  DailySnapshot,
  NotifPerm,
  TaskManagerReturn,
} from '@/types';
import type { ShiftConfig } from '@/features/tasks/data/scheduleConfig';

export interface TaskProviderProps {
  // From useTaskManager — owns derived task state and actions
  tm: TaskManagerReturn;

  // From useSync — checked/skipped state setters
  setChecked: Dispatch<SetStateAction<CheckedMap>>;
  setSubChecked: Dispatch<SetStateAction<SubCheckedMap>>;
  setSkipped: Dispatch<SetStateAction<CheckedMap>>;

  // From useSync — schedule
  schedule: ShiftConfig[];
  setSchedule: Dispatch<SetStateAction<ShiftConfig[]>>;

  // From useSync — raw task list
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;

  // From useNotifications
  notifPerm: NotifPerm;
  requestNotifPerm: () => Promise<void>;

  // From useSync — logical day boundary
  dayStartHour: number;
  setDayStartHour: (hour: number) => void;

  // From useSync — snapshot persistence
  saveSnapshot: (data: DailySnapshot) => Promise<void>;

  // OKR integration
  availableKeyResults?: Array<{ id: string; title: string; objectiveTitle: string }>;

  children: ReactNode;
}

/**
 * Owns the TaskContext value memo and Provider.
 * Extracted from App.tsx so the tasks feature module fully controls its own
 * context shape and memo logic.
 *
 * `prayersDone` and `prayerTotal` are derived from `tm` internally — they are
 * not separate props because they are always equal to `tm.prayersDone` and
 * `tm.prayerTotal`. This avoids a redundant prop surface while keeping the
 * context value shape identical to `TaskContextValue`.
 */
export function TaskProvider({
  tm,
  setChecked,
  setSubChecked,
  setSkipped,
  schedule,
  setSchedule,
  tasks,
  setTasks,
  notifPerm,
  requestNotifPerm,
  dayStartHour,
  setDayStartHour,
  saveSnapshot,
  availableKeyResults,
  children,
}: TaskProviderProps) {
  const value = useMemo(
    () => ({
      tm,
      setChecked,
      setSubChecked,
      setSkipped,
      scheduleConfig: schedule,
      setScheduleConfig: setSchedule,
      tasks,
      setTasks,
      // Derived from tm — not props, to avoid redundant call-site destructuring.
      prayersDone: tm.prayersDone,
      prayerTotal: tm.prayerTotal,
      notifPerm,
      requestNotifPerm,
      dayStartHour,
      setDayStartHour,
      saveSnapshot,
      availableKeyResults,
    }),
    [
      tm,
      setChecked,
      setSubChecked,
      setSkipped,
      schedule,
      setSchedule,
      tasks,
      setTasks,
      notifPerm,
      requestNotifPerm,
      dayStartHour,
      setDayStartHour,
      saveSnapshot,
      availableKeyResults,
    ]
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}
