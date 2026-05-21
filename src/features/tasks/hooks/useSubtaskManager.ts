import { useState, useCallback } from 'react';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { Task, Subtask, SubCheckedMap } from '@/types';

const uid = (): string => crypto.randomUUID();

export interface SubtaskManagerReturn {
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
  addSubItem: (taskId: string, inputRef: RefObject<HTMLInputElement | null>) => void;
  deleteSubItem: (taskId: string, subId: string | number) => void;
  startEditSub: (sub: Subtask) => void;
  saveEditSub: (taskId: string) => void;
  cancelEditSub: () => void;
}

export function useSubtaskManager(
  setTasks: Dispatch<SetStateAction<Task[]>>,
  setSubChecked: Dispatch<SetStateAction<SubCheckedMap>>
): SubtaskManagerReturn {
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [newItemAlertTime, setNewItemAlertTime] = useState<Record<string, string>>({});
  const [editingSubId, setEditingSubId] = useState<string | number | null>(null);
  const [editingSubText, setEditingSubText] = useState('');
  const [editingSubAlertTime, setEditingSubAlertTime] = useState('');

  const addSubItem = useCallback(
    (taskId: string, inputRef: RefObject<HTMLInputElement | null>) => {
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
    (taskId: string, subId: string | number) => {
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
    (taskId: string) => {
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

  return {
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
    addSubItem,
    deleteSubItem,
    startEditSub,
    saveEditSub,
    cancelEditSub,
  };
}
