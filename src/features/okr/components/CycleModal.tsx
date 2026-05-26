import React, { useState } from 'react';
import type { OkrCycle } from '../hooks/useOkrManager';

interface CycleModalProps {
  cycle?: OkrCycle;
  sourceCycleId?: string; // Passed when duplicating
  cycles: OkrCycle[];
  onClose: () => void;
  onSubmit: (data: { title: string; startDate: string; endDate: string }) => void;
  currentQuarterDates: () => { startDate: string; endDate: string };
}

export default function CycleModal({
  cycle,
  sourceCycleId,
  cycles,
  onClose,
  onSubmit,
  currentQuarterDates,
}: CycleModalProps) {
  const isDuplicating = !!sourceCycleId;
  const isEditing = !!cycle && !isDuplicating;

  const initialQ = currentQuarterDates();
  const [title, setTitle] = useState(cycle ? cycle.title : '');
  const [startDate, setStartDate] = useState(cycle ? cycle.startDate : initialQ.startDate);
  const [endDate, setEndDate] = useState(cycle ? cycle.endDate : initialQ.endDate);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 2) {
      setError('العنوان مطلوب (حرفين على الأقل)');
      return;
    }

    if (endDate <= startDate) {
      setError('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
      return;
    }

    // Overlap check
    const overlaps = cycles.some(
      (c) =>
        c.id !== (isEditing ? cycle.id : undefined) &&
        !c.deletedAt &&
        c.status !== 'archived' &&
        startDate <= c.endDate &&
        endDate >= c.startDate
    );

    if (overlaps) {
      setError('التواريخ تتداخل مع دورة موجودة');
      return;
    }

    onSubmit({ title: title.trim(), startDate, endDate });
  };

  const modalTitle = isEditing ? 'تعديل الدورة' : 'دورة جديدة';
  const submitLabel = isEditing ? 'حفظ التعديلات' : isDuplicating ? 'تكرار الدورة' : 'إنشاء الدورة';

  return (
    <div className="fin-modal-overlay" onClick={onClose}>
      <div className="fin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fin-modal__header">
          <h3>{modalTitle}</h3>
          <button className="fin-modal__close" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="fin-modal__body">
          {error && (
            <div
              className="fin-modal__error"
              style={{ color: 'var(--expense)', marginBottom: '1rem', fontSize: '0.9rem' }}
            >
              {error}
            </div>
          )}

          <div className="fin-form-group">
            <label htmlFor="cycle-title">عنوان الدورة</label>
            <input
              id="cycle-title"
              type="text"
              className="fin-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: الربع الأول 2024"
              autoFocus
            />
          </div>

          <div className="fin-form-group">
            <label htmlFor="cycle-start-date">تاريخ البداية</label>
            <input
              id="cycle-start-date"
              type="date"
              className="okr-date-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="fin-form-group">
            <label htmlFor="cycle-end-date">تاريخ النهاية</label>
            <input
              id="cycle-end-date"
              type="date"
              className="okr-date-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="fin-modal__actions">
            <button type="button" className="fin-btn-secondary" onClick={onClose}>
              إلغاء
            </button>
            <button type="submit" className="fin-btn-primary">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
