import { useCallback } from 'react';
import { useTaskCardContext } from './TaskCardContext';
import { PrayerPanel, SubtaskPanel } from '@/features/tasks';

const uid = (): string => crypto.randomUUID();

export default function Subtasks() {
  const { task, isExpanded, isSubtaskOpen, taskSubChecked, setSubChecked, tm, inputRef } =
    useTaskCardContext();

  // Add a new sunnah subtask (isOptional: true) to the prayer task
  const handleAddOptional = useCallback(
    (text: string) => {
      tm.setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, subtasks: [...t.subtasks, { id: uid(), text, isOptional: true }] }
            : t
        )
      );
    },
    [tm, task.id]
  );

  // Delete an optional subtask from the prayer task
  const handleDeleteOptional = useCallback(
    (subId: string | number) => {
      tm.deleteSubItem(task.id, subId);
    },
    [tm, task.id]
  );

  if (task.isPrayerTask && isExpanded) {
    return (
      <PrayerPanel
        subtasks={task.subtasks}
        subChecked={taskSubChecked}
        onToggleSub={(subId) => setSubChecked((p) => ({ ...p, [subId]: !p[subId] }))}
        onAddOptional={handleAddOptional}
        onDeleteOptional={handleDeleteOptional}
      />
    );
  }

  if (!task.isPrayerTask && isSubtaskOpen) {
    const handleAddSubItem = () => {
      tm.addSubItem(task.id, inputRef);
    };

    return (
      <SubtaskPanel
        task={task}
        taskSubChecked={taskSubChecked}
        newItemText={tm.newItemText[task.id] ?? ''}
        newItemAlertTime={tm.newItemAlertTime[task.id] ?? ''}
        editingSubId={tm.editingSubId}
        editingSubText={tm.editingSubText}
        editingSubAlertTime={tm.editingSubAlertTime}
        onToggleSub={(subId) => setSubChecked((p) => ({ ...p, [subId]: !p[subId] }))}
        onNewItemTextChange={(v) => tm.setNewItemText((p) => ({ ...p, [task.id]: v }))}
        onNewItemAlertTimeChange={(v) => tm.setNewItemAlertTime((p) => ({ ...p, [task.id]: v }))}
        onAddSubItem={handleAddSubItem}
        onDeleteSubItem={(subId) => tm.deleteSubItem(task.id, subId)}
        onStartEditSub={tm.startEditSub}
        onSaveEditSub={() => tm.saveEditSub(task.id)}
        onCancelEditSub={tm.cancelEditSub}
        onEditingSubTextChange={tm.setEditingSubText}
        onEditingSubAlertTimeChange={tm.setEditingSubAlertTime}
        inputRef={inputRef}
      />
    );
  }

  return null;
}
