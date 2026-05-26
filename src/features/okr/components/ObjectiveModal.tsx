import { useState } from 'react';
import type { OkrObjective } from '../hooks/useOkrManager';

const PRESET_ICONS = ['🎯', '📚', '💪', '🌱', '💡', '🏃', '✍️', '🧠', '❤️', '🎨', '💼', '🌟'];
const PRESET_COLORS = [
  '#c9a84c', // gold
  '#6e9fcf', // blue
  '#7cb87a', // green
  '#d97e6a', // coral
  '#b07fd4', // purple
  '#e8a05e', // orange
];

interface ObjectiveModalProps {
  objective?: OkrObjective;
  cycleId: string;
  onClose: () => void;
  onSubmit: (data: { title: string; icon: string; color: string }) => void;
}

export default function ObjectiveModal({ objective, onClose, onSubmit }: ObjectiveModalProps) {
  const isEdit = Boolean(objective);
  const [title, setTitle] = useState(objective?.title ?? '');
  const [icon, setIcon] = useState(objective?.icon ?? '🎯');
  const [color, setColor] = useState(objective?.color ?? PRESET_COLORS[0]);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (title.trim().length < 3) {
      setError('اسم الهدف يجب أن يكون 3 أحرف على الأقل');
      return;
    }
    onSubmit({ title: title.trim(), icon: icon ?? '🎯', color: color ?? PRESET_COLORS[0] });
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'تعديل الهدف' : 'هدف جديد'}
    >
      <div className="modal-box fin-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="fin-modal__title">{isEdit ? 'تعديل الهدف' : 'هدف جديد'}</h2>

        {/* Icon picker */}
        <div className="form-group">
          <label className="form-label">الأيقونة</label>
          <div className="fin-modal__icons">
            {PRESET_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                className={`fin-icon-btn ${ic === icon ? 'fin-icon-btn--active' : ''}`}
                onClick={() => setIcon(ic)}
                aria-pressed={ic === icon}
                aria-label={ic}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="form-group">
          <label className="form-label" htmlFor="obj-title">
            اسم الهدف
          </label>
          <input
            id="obj-title"
            type="text"
            className="fin-input"
            placeholder="مثال: تطوير مهاراتي المهنية"
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

        {/* Color swatches */}
        <div className="form-group">
          <label className="form-label">اللون</label>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="okr-color-swatch"
                style={{
                  background: c,
                  border: c === color ? `3px solid var(--text-gold)` : '3px solid transparent',
                  boxShadow: c === color ? `0 0 0 2px ${c}55` : 'none',
                }}
                onClick={() => setColor(c)}
                aria-pressed={c === color}
                aria-label={`لون ${c}`}
              />
            ))}
          </div>
        </div>

        <button className="btn-save" onClick={handleSubmit}>
          حفظ الهدف
        </button>
        <button className="btn-cancel" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
