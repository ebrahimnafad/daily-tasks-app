import { useState, useRef } from 'react';
import type { CalendarNote } from './types';
import MarkdownNote from './MarkdownNote';

const MAX_CHARS = 2000;

interface NotesPanelProps {
  date: string;
  notes: CalendarNote[];
  onAdd: (date: string, text: string, tags?: string[]) => void;
  onUpdate: (id: string, data: Partial<Omit<CalendarNote, 'id'>>) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('');
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = input.trim().replace(/^#/, '');
      if (newTag && !tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInput('');
    }
  };
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        alignItems: 'center',
        padding: '4px 8px',
        background: 'var(--bg-lighter)',
        borderRadius: '6px',
      }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            background: 'rgba(var(--gold-rgb), 0.15)',
            color: 'var(--gold)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.8em',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          #{tag}
          <button
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: 0,
              fontSize: '1em',
            }}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? 'أضف تصنيف (اضغط Enter)' : 'تصنيف جديد...'}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text-color)',
          fontSize: '0.85em',
          flex: 1,
          minWidth: '100px',
        }}
      />
    </div>
  );
}

// ── Markdown toolbar helpers ──────────────────────────────────────────────
function wrap(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder: string
): string {
  const { selectionStart: s, selectionEnd: e, value } = textarea;
  const selected = value.slice(s, e) || placeholder;
  return value.slice(0, s) + before + selected + after + value.slice(e);
}

function insertLine(textarea: HTMLTextAreaElement, prefix: string): string {
  const { selectionStart: s, value } = textarea;
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  return value.slice(0, lineStart) + prefix + value.slice(lineStart);
}

// ── NoteCard ──────────────────────────────────────────────────────────────
interface NoteCardProps {
  note: CalendarNote;
  onUpdate: (id: string, data: Partial<Omit<CalendarNote, 'id'>>) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}

function NoteCard({ note, onUpdate, onDelete, onTogglePin }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [draftTags, setDraftTags] = useState<string[]>(note.tags || []);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const startEdit = () => {
    setDraft(note.text);
    setDraftTags(note.tags || []);
    setEditing(true);
    setTimeout(() => taRef.current?.focus(), 0);
  };

  const save = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(note.text);
      setDraftTags(note.tags || []);
      setEditing(false);
      return;
    }
    // Always save — the useEffect will re-sync if nothing actually changed
    onUpdate(note.id, { text: trimmed, tags: draftTags });
    setEditing(false);
  };

  const cancel = () => {
    setDraft(note.text);
    setDraftTags(note.tags || []);
    setEditing(false);
  };

  const applyBold = () => {
    if (!taRef.current) return;
    setDraft(wrap(taRef.current, '**', '**', 'نص غامق'));
  };
  const applyItalic = () => {
    if (!taRef.current) return;
    setDraft(wrap(taRef.current, '_', '_', 'نص مائل'));
  };
  const applyList = () => {
    if (!taRef.current) return;
    setDraft(insertLine(taRef.current, '- '));
  };
  const applyCode = () => {
    if (!taRef.current) return;
    setDraft(wrap(taRef.current, '`', '`', 'code'));
  };
  const applyTable = () => {
    const table = '\n| العمود 1 | العمود 2 |\n|----------|----------|\n| قيمة 1   | قيمة 2   |\n';
    setDraft((prev) => prev + table);
  };

  const formattedDate = new Date(note.updatedAt).toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const overLimit = draft.length > MAX_CHARS;

  return (
    <div className={`cal-note-card${note.pinned ? ' cal-note-card--pinned' : ''}`}>
      {/* Card top row */}
      <div className="cal-note-actions">
        <span className="cal-note-meta">{formattedDate}</span>
        {note.pinned && <span className="cal-note-pin-badge">📌 مثبتة</span>}
        <div style={{ display: 'flex', gap: '4px', marginRight: 'auto' }}>
          <button
            className="cal-note-btn"
            title={note.pinned ? 'إلغاء التثبيت' : 'تثبيت الملاحظة'}
            onClick={() => onTogglePin(note.id)}
          >
            {note.pinned ? '📌' : '📍'}
          </button>
          <button className="cal-note-btn" title="تعديل" onClick={startEdit}>
            ✏️
          </button>
          <button
            className="cal-note-btn cal-note-btn--delete"
            title="حذف"
            onClick={() => onDelete(note.id)}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Body */}
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Toolbar */}
          <div className="cal-note-toolbar">
            <button onClick={applyBold} title="غامق (Ctrl+B)">
              <strong>ب</strong>
            </button>
            <button onClick={applyItalic} title="مائل">
              <em>م</em>
            </button>
            <button onClick={applyList} title="قائمة">
              ☰
            </button>
            <button onClick={applyCode} title="كود">
              {'</>'}
            </button>
            <button onClick={applyTable} title="جدول">
              ⊞
            </button>
          </div>

          <textarea
            ref={taRef}
            className="cal-note-edit-area"
            value={draft}
            placeholder="اكتب ملاحظتك هنا... (يدعم Markdown)"
            aria-label="تعديل الملاحظة"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) save();
              if (e.key === 'Escape') cancel();
            }}
            rows={5}
            dir="auto"
          />

          <TagInput tags={draftTags} onChange={setDraftTags} />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span className={`cal-note-char-count${overLimit ? ' over' : ''}`}>
              {draft.length} / {MAX_CHARS}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="cal-note-action-btn" onClick={cancel}>
                إلغاء
              </button>
              <button
                className="cal-note-action-btn cal-note-action-btn--save"
                onClick={save}
                disabled={overLimit || !draft.trim()}
              >
                ✅ حفظ
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div onDoubleClick={startEdit} title="اضغط مرتين للتعديل">
          <MarkdownNote text={note.text} />
          {note.tags && note.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: 'rgba(var(--gold-rgb), 0.1)',
                    color: 'var(--gold)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.8em',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Note Form ─────────────────────────────────────────────────────────
interface AddNoteFormProps {
  date: string;
  onAdd: (date: string, text: string, tags?: string[]) => void;
  onClose: () => void;
}

function AddNoteForm({ date, onAdd, onClose }: AddNoteFormProps) {
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const overLimit = text.length > MAX_CHARS;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || overLimit) return;
    onAdd(date, trimmed, tags);
    setText('');
    setTags([]);
    onClose();
  };

  const applyBold = () => {
    if (!taRef.current) return;
    setText(wrap(taRef.current, '**', '**', 'نص غامق'));
  };
  const applyItalic = () => {
    if (!taRef.current) return;
    setText(wrap(taRef.current, '_', '_', 'نص مائل'));
  };
  const applyList = () => {
    if (!taRef.current) return;
    setText(insertLine(taRef.current, '- '));
  };
  const applyCode = () => {
    if (!taRef.current) return;
    setText(wrap(taRef.current, '`', '`', 'code'));
  };
  const applyTable = () => {
    const table = '\n| العمود 1 | العمود 2 |\n|----------|----------|\n| قيمة 1   | قيمة 2   |\n';
    setText((prev) => prev + table);
  };

  return (
    <div className="cal-note-card" style={{ borderColor: 'rgba(var(--gold-rgb), 0.4)' }}>
      <div className="cal-note-toolbar">
        <button onClick={applyBold} title="غامق">
          <strong>ب</strong>
        </button>
        <button onClick={applyItalic} title="مائل">
          <em>م</em>
        </button>
        <button onClick={applyList} title="قائمة">
          ☰
        </button>
        <button onClick={applyCode} title="كود">
          {'</>'}
        </button>
        <button onClick={applyTable} title="جدول">
          ⊞
        </button>
      </div>

      <textarea
        ref={taRef}
        className="cal-note-edit-area"
        placeholder="اكتب ملاحظتك هنا... (يدعم Markdown)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey) submit();
          if (e.key === 'Escape') onClose();
        }}
        rows={4}
        dir="auto"
        autoFocus
      />

      <TagInput tags={tags} onChange={setTags} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px',
        }}
      >
        <span className={`cal-note-char-count${overLimit ? ' over' : ''}`}>
          {text.length} / {MAX_CHARS}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="cal-note-action-btn" onClick={onClose}>
            إلغاء
          </button>
          <button
            className="cal-note-action-btn cal-note-action-btn--save"
            onClick={submit}
            disabled={overLimit || !text.trim()}
          >
            ✅ إضافة
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NotesPanel (main export) ──────────────────────────────────────────────
export default function NotesPanel({
  date,
  notes,
  onAdd,
  onUpdate,
  onDelete,
  onTogglePin,
}: NotesPanelProps) {
  const [adding, setAdding] = useState(false);

  // Sort: pinned first, then newest
  const sorted = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div className="cal-notes-panel">
      <div className="cal-notes-header">
        <span>📝 ملاحظات اليوم</span>
        {notes.length > 0 && <span className="cal-notes-count">{notes.length}</span>}
        <button
          className="cal-notes-add-btn"
          onClick={() => setAdding(true)}
          title="إضافة ملاحظة جديدة"
        >
          + إضافة
        </button>
      </div>

      {adding && <AddNoteForm date={date} onAdd={onAdd} onClose={() => setAdding(false)} />}

      {sorted.length === 0 && !adding && (
        <p className="cal-notes-empty">
          لا توجد ملاحظات لهذا اليوم — اضغط &quot;+ إضافة&quot; للبدء
        </p>
      )}

      {sorted.map((note) => (
        <NoteCard
          key={`${note.id}-${note.updatedAt}`}
          note={note}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onTogglePin={onTogglePin}
        />
      ))}
    </div>
  );
}
