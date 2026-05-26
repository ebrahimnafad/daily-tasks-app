import { useState } from 'react';
import type { OkrCycle } from '../hooks/useOkrManager';

interface CycleSelectorProps {
  cycles: OkrCycle[];
  activeCycle: OkrCycle | null;
  onSelect: (id: string) => void;
  onCreateCycle: () => void;
  onEditCycle: (cycle: OkrCycle) => void;
  onDeleteCycle: (id: string) => void;
  onReactivateCycle: (id: string) => void;
  onDuplicateCycle: (cycle: OkrCycle) => void;
  onArchiveCycle: (id: string) => void;
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
  onEditCycle,
  onDeleteCycle,
  onReactivateCycle,
  onDuplicateCycle,
  onArchiveCycle,
}: CycleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [menuOpenForId, setMenuOpenForId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const visible = cycles.filter((c) => !c.deletedAt);
  const hasActive = cycles.some((c) => c.status === 'active' && !c.deletedAt);

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
          <div className="okr-cycle-selector__dropdown">
            {visible.map((c) => (
              <div
                key={c.id}
                className={`okr-cycle-selector__option ${c.id === selected?.id ? 'selected' : ''} ${c.status === 'archived' ? 'muted' : ''}`}
                onClick={() => {
                  onSelect(c.id);
                  setOpen(false);
                }}
                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span className="okr-cycle-selector__option-title">{c.title}</span>
                </div>
                <span
                  className={`okr-badge ${c.status === 'active' ? 'okr-badge--active' : 'okr-badge--muted'}`}
                >
                  {STATUS_LABELS[c.status]}
                </span>

                {/* Context Menu Button */}
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px 8px',
                    marginLeft: '8px',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenForId(menuOpenForId === c.id ? null : c.id);
                    setDeleteConfirmId(null);
                  }}
                >
                  ⋮
                </button>

                {/* Context Menu Dropdown */}
                {menuOpenForId === c.id && (
                  <div
                    className="okr-cycle-context-menu"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: '8px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 100,
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: '150px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {deleteConfirmId === c.id ? (
                      <div
                        style={{
                          padding: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                          سيتم حذف الدورة وجميع أهدافها نهائياً. هل أنت متأكد؟
                        </p>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="fin-btn-sm"
                            style={{
                              background: 'var(--expense)',
                              color: 'white',
                              border: 'none',
                              flex: 1,
                            }}
                            onClick={() => {
                              onDeleteCycle(c.id);
                              setMenuOpenForId(null);
                              setDeleteConfirmId(null);
                              if (selected?.id === c.id) setOpen(false);
                            }}
                          >
                            تأكيد الحذف
                          </button>
                          <button
                            className="fin-btn-sm"
                            style={{ flex: 1 }}
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          className="fin-dropdown-item"
                          style={{
                            textAlign: 'right',
                            background: 'none',
                            border: 'none',
                            padding: '6px 12px',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setMenuOpenForId(null);
                            setOpen(false);
                            onEditCycle(c);
                          }}
                        >
                          تعديل
                        </button>
                        <button
                          className="fin-dropdown-item"
                          style={{
                            textAlign: 'right',
                            background: 'none',
                            border: 'none',
                            padding: '6px 12px',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setMenuOpenForId(null);
                            setOpen(false);
                            onDuplicateCycle(c);
                          }}
                        >
                          تكرار الدورة
                        </button>

                        {c.status === 'active' ? (
                          <button
                            className="fin-dropdown-item"
                            style={{
                              textAlign: 'right',
                              background: 'none',
                              border: 'none',
                              padding: '6px 12px',
                              fontSize: '0.9rem',
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              setMenuOpenForId(null);
                              onArchiveCycle(c.id);
                            }}
                          >
                            أرشفة
                          </button>
                        ) : (
                          <button
                            className="fin-dropdown-item"
                            style={{
                              textAlign: 'right',
                              background: 'none',
                              border: 'none',
                              padding: '6px 12px',
                              fontSize: '0.9rem',
                              cursor: hasActive ? 'not-allowed' : 'pointer',
                              opacity: hasActive ? 0.5 : 1,
                            }}
                            title={hasActive ? 'أرشف الدورة النشطة أولاً' : undefined}
                            onClick={() => {
                              if (hasActive) return;
                              setMenuOpenForId(null);
                              onReactivateCycle(c.id);
                            }}
                          >
                            إعادة تفعيل
                          </button>
                        )}

                        <button
                          className="fin-dropdown-item"
                          style={{
                            textAlign: 'right',
                            background: 'none',
                            border: 'none',
                            padding: '6px 12px',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            color: 'var(--expense)',
                          }}
                          onClick={() => setDeleteConfirmId(c.id)}
                        >
                          حذف
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
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

      {menuOpenForId && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpenForId(null);
            setDeleteConfirmId(null);
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
