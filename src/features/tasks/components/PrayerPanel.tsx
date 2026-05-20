import { useState, useRef } from 'react';
import { useAccessibleClick } from '@/shared/hooks';
import { Tick } from '@/shared/components';
import type { Subtask, SubCheckedMap } from '@/types';

interface PrayerPanelProps {
  subtasks: Subtask[];
  subChecked: SubCheckedMap;
  onToggleSub: (subId: string | number) => void;
  /** Called when user adds a new optional prayer by name */
  onAddOptional?: (text: string) => void;
  /** Called when user deletes an optional prayer chip */
  onDeleteOptional?: (subId: string | number) => void;
}

function PrayerChip({
  subtask,
  done,
  isOptional,
  onToggle,
  onDelete,
}: {
  subtask: Subtask;
  done: boolean;
  isOptional: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  const handleKeyDown = useAccessibleClick();

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <div
        role="checkbox"
        aria-checked={done}
        aria-label={subtask.text}
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => handleKeyDown(e, onToggle)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          cursor: 'pointer',
          background: done
            ? isOptional
              ? 'rgba(var(--gold-rgb),.08)'
              : 'rgba(var(--gold-rgb),.12)'
            : 'rgba(255,255,255,.03)',
          border: `1px solid ${
            done
              ? isOptional
                ? 'rgba(var(--gold-rgb),.22)'
                : 'rgba(var(--gold-rgb),.38)'
              : 'rgba(var(--gold-rgb),.1)'
          }`,
          borderRadius: 'var(--radius-pill)',
          padding: onDelete ? '5px 26px 5px 9px' : '5px 12px 5px 9px',
          transition: 'all .2s',
          minWidth: '80px',
          opacity: isOptional ? 0.85 : 1,
        }}
      >
        {isOptional ? (
          <span
            style={{
              fontSize: '14px',
              color: done ? 'var(--gold)' : 'rgba(var(--gold-rgb),.4)',
              lineHeight: 1,
              transition: 'color .2s',
            }}
            aria-hidden="true"
          >
            {done ? '★' : '☆'}
          </span>
        ) : (
          <div className={`task-checkbox--small ${done ? 'on' : ''}`} aria-hidden="true">
            {done && <Tick size={10} />}
          </div>
        )}
        <span
          style={{
            fontSize: 'var(--font-base)',
            color: done
              ? isOptional
                ? 'rgba(var(--gold-rgb),.8)'
                : 'var(--gold)'
              : 'rgba(var(--gold-rgb),.68)',
            fontWeight: done ? 700 : 400,
            textDecoration: done ? 'line-through' : 'none',
            transition: 'all .2s',
          }}
        >
          {subtask.text}
        </span>
      </div>

      {/* Delete button — only on optional chips when edit mode is on */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`حذف ${subtask.text}`}
          style={{
            position: 'absolute',
            top: '50%',
            insetInlineEnd: '6px',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(var(--gold-rgb),.4)',
            fontSize: '11px',
            lineHeight: 1,
            padding: '2px',
            transition: 'color .15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(220,80,80,.9)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(var(--gold-rgb),.4)')}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function PrayerPanel({
  subtasks,
  subChecked,
  onToggleSub,
  onAddOptional,
  onDeleteOptional,
}: PrayerPanelProps) {
  const required = subtasks.filter((s) => !s.isOptional);
  const optional = subtasks.filter((s) => s.isOptional);

  const [editMode, setEditMode] = useState(false);
  const [newText, setNewText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const text = newText.trim();
    if (!text || !onAddOptional) return;
    onAddOptional(text);
    setNewText('');
    inputRef.current?.focus();
  };

  return (
    <div className="expand-panel">
      {/* ── Fard prayers ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          justifyContent: 'center',
        }}
      >
        {required.map((s) => (
          <PrayerChip
            key={s.id}
            subtask={s}
            done={!!subChecked[s.id]}
            isOptional={false}
            onToggle={() => onToggleSub(s.id)}
          />
        ))}
      </div>

      {/* ── Optional (sunnah) section ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: '10px 0 6px',
        }}
      >
        <div style={{ flex: 1, height: '1px', background: 'rgba(var(--gold-rgb),.12)' }} />
        <span
          style={{ fontSize: '0.72em', color: 'rgba(var(--gold-rgb),.45)', whiteSpace: 'nowrap' }}
        >
          ☆ نوافل
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(var(--gold-rgb),.12)' }} />

        {/* Edit toggle — only shown when callbacks are provided */}
        {onAddOptional && onDeleteOptional && (
          <button
            onClick={() => setEditMode((v) => !v)}
            title={editMode ? 'إخفاء التعديل' : 'تعديل النوافل'}
            style={{
              background: editMode ? 'rgba(var(--gold-rgb),.15)' : 'none',
              border: `1px solid ${editMode ? 'rgba(var(--gold-rgb),.35)' : 'rgba(var(--gold-rgb),.18)'}`,
              borderRadius: '50%',
              width: '22px',
              height: '22px',
              cursor: 'pointer',
              color: 'rgba(var(--gold-rgb),.6)',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all .2s',
            }}
          >
            ✏️
          </button>
        )}
      </div>

      {/* Optional chips */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          justifyContent: 'center',
        }}
      >
        {optional.length === 0 && !editMode && (
          <span style={{ fontSize: '0.78em', color: 'rgba(var(--gold-rgb),.3)' }}>
            لا توجد نوافل — اضغط ✏️ لإضافة
          </span>
        )}
        {optional.map((s) => (
          <PrayerChip
            key={s.id}
            subtask={s}
            done={!!subChecked[s.id]}
            isOptional={true}
            onToggle={() => onToggleSub(s.id)}
            onDelete={editMode && onDeleteOptional ? () => onDeleteOptional(s.id) : undefined}
          />
        ))}
      </div>

      {/* ── Add new optional prayer input (edit mode only) ── */}
      {editMode && onAddOptional && (
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginTop: '10px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <input
            ref={inputRef}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="اسم النافلة…"
            dir="rtl"
            style={{
              flex: '0 1 180px',
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(var(--gold-rgb),.2)',
              borderRadius: 'var(--radius-pill)',
              padding: '5px 12px',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-sm)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAdd}
            disabled={!newText.trim()}
            style={{
              background: newText.trim() ? 'rgba(var(--gold-rgb),.18)' : 'rgba(255,255,255,.03)',
              border: '1px solid rgba(var(--gold-rgb),.25)',
              borderRadius: 'var(--radius-pill)',
              padding: '5px 14px',
              cursor: newText.trim() ? 'pointer' : 'default',
              color: 'var(--gold)',
              fontSize: 'var(--font-sm)',
              transition: 'all .2s',
            }}
          >
            + إضافة
          </button>
        </div>
      )}
    </div>
  );
}
