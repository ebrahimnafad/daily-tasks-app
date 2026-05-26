import { useState } from 'react';
import type { OkrKeyResult } from '../hooks/useOkrManager';

interface CheckInModalProps {
  kr: OkrKeyResult | null;
  onClose: () => void;
  onSubmit: (value: number, note?: string) => void;
}

export default function CheckInModal({ kr, onClose, onSubmit }: CheckInModalProps) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  if (!kr) return null;

  const current = Number(kr.currentValue);
  const target = Number(kr.targetValue);
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const isBinary = kr.type === 'binary';
  const willExceed = !isBinary && Number(value) > 0 && current + Number(value) > target;

  const handleBinaryToggle = () => {
    onSubmit(1, undefined);
    onClose();
  };

  const handleSubmit = () => {
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      setError('أدخل قيمة أكبر من صفر');
      return;
    }
    onSubmit(num, note.trim() || undefined);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="تسجيل تقدم"
    >
      <div className="modal-box fin-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="fin-modal__title">تسجيل تقدم</h2>

        {/* KR summary */}
        <div className="okr-checkin-summary">
          <p className="okr-checkin-summary__title">{kr.title}</p>
          <div className="okr-progress-bar" style={{ marginBottom: 'var(--space-sm)' }}>
            <div
              className="okr-progress-bar__fill"
              style={{ width: `${pct}%`, transition: 'none' }}
            />
          </div>
          <p className="okr-checkin-summary__meta">
            {isBinary
              ? current >= 1
                ? 'مُنجز ✓'
                : 'غير مُنجز'
              : `${current} / ${target} · ${pct}%`}
          </p>
        </div>

        {isBinary ? (
          /* Binary: single toggle */
          <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
            {current >= 1 ? (
              <p style={{ color: 'var(--gold)', fontWeight: 700 }}>تم الإنجاز بالفعل ✓</p>
            ) : (
              <button
                className="fin-btn-primary"
                style={{ width: '100%' }}
                onClick={handleBinaryToggle}
              >
                تم الإنجاز ✓
              </button>
            )}
          </div>
        ) : (
          /* Numeric */
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="ci-value">
                القيمة المضافة
              </label>
              <input
                id="ci-value"
                type="number"
                min="0.01"
                step="any"
                className="fin-input"
                placeholder="مثال: 3"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError('');
                }}
                autoFocus
              />
              {error && (
                <p style={{ color: '#d97e6a', fontSize: 'var(--font-sm)', marginTop: '4px' }}>
                  {error}
                </p>
              )}
              {willExceed && (
                <p className="fin-calc-hint" style={{ marginTop: 'var(--space-sm)' }}>
                  ⚠️ هذا سيتجاوز الهدف المحدد — يمكنك المتابعة على أي حال
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="ci-note">
                ملاحظة (اختياري)
              </label>
              <textarea
                id="ci-note"
                className="fin-input"
                rows={2}
                placeholder="أضف ملاحظة..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ resize: 'vertical', minHeight: '60px' }}
              />
            </div>
          </>
        )}

        {!isBinary && (
          <div className="fin-modal__actions">
            <button className="fin-btn-primary" style={{ flex: 1 }} onClick={handleSubmit}>
              حفظ
            </button>
            <button className="fin-btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              إلغاء
            </button>
          </div>
        )}

        {isBinary && (
          <button className="btn-cancel" onClick={onClose}>
            إلغاء
          </button>
        )}
      </div>
    </div>
  );
}
