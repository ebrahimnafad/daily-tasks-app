import { useTaskCardContext } from './TaskCardContext';
import { PrayerPanel, SubtaskPanel } from '@/features/tasks';

export default function Subtasks() {
  const { task, isExpanded, isSubtaskOpen, taskSubChecked, setSubChecked, tm, inputRef } =
    useTaskCardContext();

  if (task.isPrayerTask && isExpanded) {
    return (
      <PrayerPanel
        subtasks={task.subtasks}
        subChecked={taskSubChecked}
        onToggleSub={(subId) => setSubChecked((p) => ({ ...p, [subId]: !p[subId] }))}
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
