import { memo, useState, useRef } from 'react';
import { useTaskContext } from '@/features/tasks';
import { TaskCardContext } from './TaskCardContext';
import type { TaskCardContextValue } from './TaskCardContext';
import View from './View';
import type { Task } from '@/types';

interface TaskCardContainerProps {
  task: Task;
  isChecked: boolean;
  taskSubChecked: Record<string | number, boolean>;
}

function TaskCardContainer({ task, isChecked, taskSubChecked }: TaskCardContainerProps) {
  const { tm, prayersDone, prayerTotal, setChecked, setSubChecked } = useTaskContext();

  const [isExpanded, setIsExpanded] = useState(task.id === 1);
  const [isBriefOpen, setIsBriefOpen] = useState(false);
  const [isSubtaskOpen, setIsSubtaskOpen] = useState(task.id === 2);

  const onToggleExpanded = () => setIsExpanded((p) => !p);
  const onToggleBrief = () => setIsBriefOpen((p) => !p);
  const onToggleSubtask = () => setIsSubtaskOpen((p) => !p);

  const inputRef = useRef<HTMLInputElement>(null);

  const hasSubs = task.subtasks.length > 0;
  const subsDone = task.subtasks.filter((s) => taskSubChecked[s.id]).length;

  const done = task.isPrayerTask
    ? false
    : hasSubs
      ? task.subtasks.every((s) => taskSubChecked[s.id])
      : isChecked;

  const contextValue: TaskCardContextValue = {
    task,
    isChecked,
    taskSubChecked,
    isExpanded,
    isBriefOpen,
    isSubtaskOpen,
    onToggleExpanded,
    onToggleBrief,
    onToggleSubtask,
    hasSubs,
    subsDone,
    done,
    inputRef,
    tm,
    prayersDone,
    prayerTotal,
    setChecked,
    setSubChecked,
  };

  return (
    <TaskCardContext.Provider value={contextValue}>
      <View />
    </TaskCardContext.Provider>
  );
}

export default memo(TaskCardContainer);
