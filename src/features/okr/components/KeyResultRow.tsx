import { useRef, useEffect, useState } from 'react';
import type { OkrKeyResult, OkrCheckIn } from '../hooks/useOkrManager';

interface KeyResultRowProps {
  kr: OkrKeyResult;
  checkIns: OkrCheckIn[];
  onRecordProgress: (kr: OkrKeyResult) => void;
  onEdit: (kr: OkrKeyResult) => void;
  onDelete: (id: string) => void;
}

export default function KeyResultRow({
  kr,
  onRecordProgress,
  onEdit,
  onDelete,
}: KeyResultRowProps) {
  const current = Number(kr.currentValue);
  const target = Number(kr.targetValue);
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const isComplete = kr.type === 'binary' ? current >= 1 : pct >= 100;

  const fillRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Animate progress bar on mount
  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    el.style.width = '0%';
    requestAnimationFrame(() => {
      el.style.transition = 'width 0.4s ease';
      el.style.width = `${pct}%`;
    });
  }, [pct]);

  const unitLabel = () => {
    if (kr.unit === 'percent') return '%';
    if (kr.unit === 'currency') return 'ر.س';
    if (kr.unit === 'custom') return kr.customUnit ?? '';
    return '';
  };

  return (
    <div className="okr-kr-row" aria-label={kr.title}>
      {/* Title + badges */}
      <div className="okr-kr-row__info">
        <span className="okr-kr-row__title">{kr.title}</span>
        {kr.linkedTaskId && (
          <span className="okr-badge okr-badge--linked" title="مرتبط بمهمة يومية">
            🔗 مرتبط بمهمة
          </span>
        )}
      </div>

      {/* Progress */}
      {kr.type === 'binary' ? (
        // Binary: checkmark toggle
        <div className="okr-kr-row__binary">
          <button
            className={`task-checkbox ${isComplete ? 'on' : ''}`}
            style={{
              color: isComplete ? 'var(--gold)' : 'rgba(var(--gold-rgb),0.3)',
              borderColor: isComplete ? 'var(--gold)' : 'rgba(var(--gold-rgb),0.3)',
            }}
            onClick={() => !isComplete && onRecordProgress(kr)}
            aria-pressed={isComplete}
            aria-label={isComplete ? 'مُنجز' : 'تسجيل الإنجاز'}
          >
            {isComplete && '✓'}
          </button>
          <span className="okr-kr-row__pct">{isComplete ? '100%' : '0%'}</span>
        </div>
      ) : (
        // Numeric: progress bar
        <div className="okr-kr-row__progress">
          <div className="okr-progress-bar">
            <div ref={fillRef} className="okr-progress-bar__fill" style={{ width: '0%' }} />
          </div>
          <span className="okr-kr-row__pct">
            {current}
            {unitLabel()} / {target}
            {unitLabel()} · {pct}%
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="okr-kr-row__actions">
        {!isComplete && (
          <button
            className="fin-btn-sm"
            onClick={() => onRecordProgress(kr)}
            aria-label="تسجيل تقدم"
          >
            سجّل تقدم
          </button>
        )}

        {/* Overflow menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="icon-btn"
            style={{ background: 'transparent', border: 'none', opacity: 0.55, fontSize: '18px' }}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="خيارات"
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div className="okr-overflow-menu">
                <button
                  className="okr-overflow-menu__item"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(kr);
                  }}
                >
                  ✏️ تعديل
                </button>
                <button
                  className="okr-overflow-menu__item okr-overflow-menu__item--danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(kr.id);
                  }}
                >
                  🗑️ حذف
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
