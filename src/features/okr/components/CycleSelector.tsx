import { useState } from 'react';
import type { OkrCycle } from '../hooks/useOkrManager';

interface CycleSelectorProps {
  cycles: OkrCycle[];
  activeCycle: OkrCycle | null;
  onSelect: (id: string) => void;
  onCreateCycle: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'نشطة',
  archived: 'مؤرشفة',
  draft: 'مسودة',
};

export default function CycleSelector({
  cycles,
  activeCycle,
  onSelect,
  onCreateCycle,
}: CycleSelectorProps) {
  const [open, setOpen] = useState(false);
  const visible = cycles.filter((c) => !c.deletedAt);

  const selected = activeCycle ?? visible[0] ?? null;

  if (visible.length === 0) {
    return (
      <div className="okr-cycle-empty">
        <span style={{ color: 'rgba(var(--gold-rgb),0.4)', fontSize: 'var(--font-sm)' }}>
          لا توجد دورات بعد
        </span>
        <button
          className="fin-btn-sm"
          style={{ marginRight: 'var(--space-sm)' }}
          onClick={onCreateCycle}
        >
          + دورة جديدة
        </button>
      </div>
    );
  }

  return (
    <div className="okr-cycle-selector" style={{ position: 'relative' }}>
      <button
        className="okr-cycle-selector__btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.title ?? 'اختر دورة'}</span>
        {selected && (
          <span
            className={`okr-badge ${selected.status === 'active' ? 'okr-badge--active' : 'okr-badge--muted'}`}
          >
            {STATUS_LABELS[selected.status]}
          </span>
        )}
        <span style={{ marginRight: 'auto', fontSize: '10px', opacity: 0.5 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="okr-cycle-selector__dropdown" role="listbox">
            {visible.map((c) => (
              <button
                key={c.id}
                role="option"
                aria-selected={c.id === selected?.id}
                className={`okr-cycle-selector__option ${c.id === selected?.id ? 'selected' : ''} ${c.status === 'archived' ? 'muted' : ''}`}
                onClick={() => {
                  onSelect(c.id);
                  setOpen(false);
                }}
              >
                <span className="okr-cycle-selector__option-title">{c.title}</span>
                <span
                  className={`okr-badge ${c.status === 'active' ? 'okr-badge--active' : 'okr-badge--muted'}`}
                >
                  {STATUS_LABELS[c.status]}
                </span>
              </button>
            ))}
            <button
              className="okr-cycle-selector__create"
              onClick={() => {
                setOpen(false);
                onCreateCycle();
              }}
            >
              ＋ دورة جديدة
            </button>
          </div>
        </>
      )}
    </div>
  );
}
