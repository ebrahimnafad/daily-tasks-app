import { useAccessibleClick } from '@/shared/hooks';
import { Tick } from '@/shared/components';
import type { Task, Subtask, SubCheckedMap } from '@/types';
import type { RefObject } from 'react';

interface SubtaskPanelProps {
  task: Task;
  taskSubChecked: SubCheckedMap;
  newItemText: string;
  newItemAlertTime: string;
  editingSubId: string | number | null;
  editingSubText: string;
  editingSubAlertTime: string;
  onToggleSub: (subId: string | number) => void;
  onNewItemTextChange: (val: string) => void;
  onNewItemAlertTimeChange: (val: string) => void;
  onAddSubItem: () => void;
  onDeleteSubItem: (subId: string | number) => void;
  onStartEditSub: (sub: Subtask) => void;
  onSaveEditSub: () => void;
  onCancelEditSub: () => void;
  onEditingSubTextChange: (val: string) => void;
  onEditingSubAlertTimeChange: (val: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function SubtaskPanel({
  task,
  taskSubChecked,
  newItemText,
  newItemAlertTime,
  editingSubId,
  editingSubText,
  editingSubAlertTime,
  onToggleSub,
  onNewItemTextChange,
  onNewItemAlertTimeChange,
  onAddSubItem,
  onDeleteSubItem,
  onStartEditSub,
  onSaveEditSub,
  onCancelEditSub,
  onEditingSubTextChange,
  onEditingSubAlertTimeChange,
  inputRef,
}: SubtaskPanelProps) {
  const handleKeyDown = useAccessibleClick();
  const allSubsDone = task.subtasks.length > 0 && task.subtasks.every((s) => taskSubChecked[s.id]);

  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onAddSubItem();
  };

  return (
    <div className="expand-panel" role="list" aria-label={`قائمة مهام ${task.title} الفرعية`}>
      <div
        style={{
          fontSize: 'var(--font-sm)',
          fontWeight: 700,
          color: 'rgba(var(--gold-rgb),.55)',
          marginBottom: 'var(--space-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
        }}
      >
        📝 القائمة الفرعية
        {allSubsDone && task.subtasks.length > 0 && (
          <span style={{ color: '#9bc87a', fontSize: 'var(--font-sm)' }}>✓ اكتملت</span>
        )}
      </div>

      {task.subtasks.length === 0 && (
        <div
          style={{
            fontSize: 'var(--font-base)',
            color: 'rgba(var(--gold-rgb),.3)',
            marginBottom: 'var(--space-sm)',
            padding: '6px 0',
          }}
        >
          لا توجد عناصر بعد — أضف من الأسفل
        </div>
      )}

      {task.subtasks.map((s) => {
        const sdone = !!taskSubChecked[s.id];
        const isEditing = editingSubId === s.id;
        return (
          <div key={s.id} className="sub-row" role="listitem">
            <div
              role="checkbox"
              aria-checked={sdone}
              aria-label={s.text}
              tabIndex={0}
              className={`task-checkbox--small ${sdone ? 'on' : ''}`}
              onClick={() => onToggleSub(s.id)}
              onKeyDown={(e) => handleKeyDown(e, () => onToggleSub(s.id))}
            >
              {sdone && <Tick size={10} />}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    className="sub-edit-inp"
                    style={{ width: '100%' }}
                    value={editingSubText}
                    autoFocus
                    aria-label="تعديل العنصر"
                    onChange={(e) => onEditingSubTextChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSaveEditSub();
                      if (e.key === 'Escape') onCancelEditSub();
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                    <input
                      type="time"
                      className="sub-edit-inp"
                      style={{ width: 'auto', padding: '0 4px' }}
                      value={editingSubAlertTime}
                      aria-label="تعديل وقت التذكير"
                      onChange={(e) => onEditingSubAlertTimeChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onSaveEditSub();
                        if (e.key === 'Escape') onCancelEditSub();
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    className={`sub-text`}
                    onDoubleClick={() => onStartEditSub(s)}
                    title="اضغط مرتين لتعديل العنصر"
                    style={{
                      flex: 1,
                      textDecoration: sdone ? 'line-through' : 'none',
                      color: sdone ? 'rgba(var(--gold-rgb), 0.75)' : 'inherit',
                    }}
                  >
                    {s.text}
                  </span>
                  {s.alertTime && (
                    <span
                      style={{
                        fontSize: '0.8em',
                        color: 'var(--text-color)',
                        opacity: 0.7,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                      }}
                      title="تذكير"
                    >
                      ⏰ {s.alertTime}
                    </span>
                  )}
                </div>
              )}

              {!isEditing && (
                <div
                  className="sub-actions"
                  style={{
                    display: 'flex',
                    gap: 'var(--space-xs)',
                    opacity: 0,
                    transition: 'opacity .15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                >
                  <button
                    className="icon-btn icon-btn--edit"
                    aria-label={`تعديل ${s.text}`}
                    style={{
                      padding: 'var(--space-xs) var(--space-sm)',
                      fontSize: 'var(--font-sm)',
                    }}
                    onClick={() => onStartEditSub(s)}
                  >
                    ✏️
                  </button>
                  <button
                    className="icon-btn icon-btn--delete"
                    aria-label={`حذف ${s.text}`}
                    style={{
                      padding: 'var(--space-xs) var(--space-sm)',
                      fontSize: 'var(--font-sm)',
                    }}
                    onClick={() => onDeleteSubItem(s.id)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="add-sub-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          ref={inputRef}
          className="add-sub-inp"
          style={{ width: '100%' }}
          placeholder="أضف عنصر جديد للقائمة..."
          value={newItemText}
          aria-label="إضافة عنصر جديد للقائمة الفرعية"
          onChange={(e) => onNewItemTextChange(e.target.value)}
          onKeyDown={handleAddKeyDown}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
          <input
            type="time"
            className="add-sub-inp"
            style={{ width: 'auto', padding: '0 8px' }}
            value={newItemAlertTime}
            aria-label="وقت تذكير العنصر الجديد"
            onChange={(e) => onNewItemAlertTimeChange(e.target.value)}
            onKeyDown={handleAddKeyDown}
          />
          <button className="add-sub-btn" onClick={onAddSubItem}>
            + إضافة
          </button>
        </div>
      </div>
      <div
        style={{
          fontSize: 'var(--font-sm)',
          color: 'rgba(var(--gold-rgb),.3)',
          marginTop: 'var(--space-sm)',
        }}
      >
        اضغط مرتين على أي عنصر لتعديله
      </div>
    </div>
  );
}
