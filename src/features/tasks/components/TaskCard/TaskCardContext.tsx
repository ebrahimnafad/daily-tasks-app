import { createContext, useContext } from 'react';
import type { RefObject } from 'react';
import type { Task, TaskManagerReturn, CheckedMap, SubCheckedMap } from '@/types';

export interface TaskCardContextValue {
  task: Task;
  isChecked: boolean;
  taskSubChecked: Record<string | number, boolean>;
  isExpanded: boolean;
  isBriefOpen: boolean;
  isSubtaskOpen: boolean;
  onToggleExpanded: () => void;
  onToggleBrief: () => void;
  onToggleSubtask: () => void;
  hasSubs: boolean;
  subsDone: number;
  done: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  tm: TaskManagerReturn;
  prayersDone: number;
  prayerTotal: number;
  setChecked: React.Dispatch<React.SetStateAction<CheckedMap>>;
  setSubChecked: React.Dispatch<React.SetStateAction<SubCheckedMap>>;
}

export const TaskCardContext = createContext<TaskCardContextValue | null>(null);

export const useTaskCardContext = (): TaskCardContextValue => {
  const context = useContext(TaskCardContext);
  if (!context) {
    throw new Error('useTaskCardContext must be used within a TaskCardContainer');
  }
  return context;
};
