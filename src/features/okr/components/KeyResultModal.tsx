import { useState } from 'react';
import type { OkrKeyResult } from '../hooks/useOkrManager';

type KRType = 'numeric' | 'binary';
type KRUnit = 'count' | 'percent' | 'currency' | 'custom';

const UNIT_LABELS: Record<KRUnit, string> = {
  count: 'عدد',
  percent: 'نسبة %',
  currency: 'عملة (ر.س)',
  custom: 'مخصص',
};

interface KeyResultModalProps {
  keyResult?: OkrKeyResult;
  objectiveId: string;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    type: KRType;
    unit: KRUnit;
    customUnit?: string;
    targetValue: string;
    linkedTaskId?: string | null;
  }) => void;
}

export default function KeyResultModal({ keyResult, onClose, onSubmit }: KeyResultModalProps) {
  const isEdit = Boolean(keyResult);
  const [title, setTitle] = useState(keyResult?.title ?? '');
  const [type, setType] = useState<KRType>((keyResult?.type as KRType) ?? 'numeric');
  const [unit, setUnit] = useState<KRUnit>((keyResult?.unit as KRUnit) ?? 'count');
  const [customUnit, setCustomUnit] = useState(keyResult?.customUnit ?? '');
  const [targetValue, setTargetValue] = useState(keyResult?.targetValue ?? '10');
  const [linkedTaskId, setLinkedTaskId] = useState(keyResult?.linkedTaskId ?? '');
  const [error, setError] = useState('');

  const isNumeric = type === 'numeric';

  const handleSubmit = () => {
    if (title.trim().length < 1) {
      setError('اسم النتيجة مطلوب');
      return;
    }
    const tv = isNumeric ? targetValue : '1';
    if (isNumeric && (isNaN(Number(tv)) || Number(tv) <= 0)) {
      setError('القيمة المستهدفة يجب أن تكون أكبر من صفر');
      return;
    }
    onSubmit({
      title: title.trim(),
      type,
      unit: isNumeric ? unit : 'count',
      customUnit: unit === 'custom' ? customUnit.trim() || undefined : undefined,
      targetValue: tv,
      linkedTaskId: linkedTaskId.trim() || null,
    });
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'تعديل النتيجة' : 'نتيجة رئيسية جديدة'}
    >
      <div className="modal-box fin-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="fin-modal__title">{isEdit ? 'تعديل النتيجة' : 'نتيجة رئيسية جديدة'}</h2>

        {/* Title */}
        <div className="form-group">
          <label className="form-label" htmlFor="kr-title">
            اسم النتيجة
          </label>
          <input
            id="kr-title"
            type="text"
            className="fin-input"
            placeholder="مثال: إتمام 12 كتاباً"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError('');
            }}
            maxLength={200}
            autoFocus
          />
          {error && (
            <p style={{ color: '#d97e6a', fontSize: 'var(--font-sm)', marginTop: '4px' }}>
              {error}
            </p>
          )}
        </div>

        {/* Type toggle */}
        <div className="form-group">
          <label className="form-label">النوع</label>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            {(['numeric', 'binary'] as KRType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={type === t ? 'toggle-btn on' : 'toggle-btn'}
                onClick={() => setType(t)}
                aria-pressed={type === t}
              >
                {t === 'numeric' ? 'رقمي' : 'ثنائي (نعم/لا)'}
              </button>
            ))}
          </div>
        </div>

        {/* Unit + target — only for numeric */}
        {isNumeric && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="kr-unit">
                الوحدة
              </label>
              <select
                id="kr-unit"
                className="form-select"
                value={unit}
                onChange={(e) => setUnit(e.target.value as KRUnit)}
              >
                {(Object.keys(UNIT_LABELS) as KRUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>

            {unit === 'custom' && (
              <div className="form-group">
                <label className="form-label" htmlFor="kr-custom-unit">
                  اسم الوحدة المخصصة
                </label>
                <input
                  id="kr-custom-unit"
                  type="text"
                  className="fin-input"
                  placeholder="مثال: كيلومتر"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  maxLength={30}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="kr-target">
                القيمة المستهدفة
              </label>
              <input
                id="kr-target"
                type="number"
                min="0.01"
                step="any"
                className="fin-input"
                placeholder="مثال: 12"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </div>
          </>
        )}

        {/* Linked task ID (v1: manual entry) */}
        <div className="form-group">
          <label className="form-label" htmlFor="kr-linked-task">
            معرّف المهمة المرتبطة (اختياري)
          </label>
          <input
            id="kr-linked-task"
            type="text"
            className="fin-input"
            placeholder="UUID المهمة — منتقي المهام يأتي في الإصدار القادم"
            value={linkedTaskId ?? ''}
            onChange={(e) => setLinkedTaskId(e.target.value)}
          />
        </div>

        <button className="btn-save" onClick={handleSubmit}>
          حفظ النتيجة
        </button>
        <button className="btn-cancel" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
