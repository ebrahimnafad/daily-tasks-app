import { useState, useCallback } from 'react';
import type { ExpenseCategory, CategoryModalState } from '../types';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';

interface CategoryModalProps {
  modal: CategoryModalState;
  onSave: (data: Partial<ExpenseCategory>, mode: 'add' | 'edit', id?: string) => void;
  onClose: () => void;
}

export default function CategoryModal({ modal, onSave, onClose }: CategoryModalProps) {
  const [form, setForm] = useState(() => {
    if (modal.mode === 'edit' && modal.data) {
      return {
        icon: modal.data.icon,
        name: modal.data.name,
        color: modal.data.color,
        monthlyBudget: String(modal.data.monthlyBudget || ''),
      };
    }
    return { icon: '📋', name: '', color: CATEGORY_COLORS[0], monthlyBudget: '' };
  });

  const f = (field: string, val: string) => setForm((p) => ({ ...p, [field]: val }));

  const [saving, setSaving] = useState(false);

  const save = useCallback(() => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    onSave(
      {
        icon: form.icon,
        name: form.name.trim(),
        color: form.color,
        monthlyBudget: Number(form.monthlyBudget) || 0,
        isCustom: true,
      },
      modal.mode,
      modal.data?.id
    );
  }, [form, modal, onSave, saving]);

  return (
    <div
      className="cov"
      role="dialog"
      aria-modal="true"
      aria-label={modal.mode === 'add' ? 'إضافة قسم' : 'تعديل قسم'}
    >
      <div className="cbox fin-modal">
        <h3 className="fin-modal__title">
          {modal.mode === 'add' ? 'إضافة قسم جديد' : 'تعديل القسم'}
        </h3>

        <div className="fin-modal__icons">
          {CATEGORY_ICONS.map((ic) => (
            <button
              key={ic}
              className={`fin-icon-btn ${form.icon === ic ? 'fin-icon-btn--active' : ''}`}
              onClick={() => f('icon', ic)}
            >
              {ic}
            </button>
          ))}
        </div>

        <label className="fin-label">
          اسم القسم
          <input
            className="fin-input"
            value={form.name}
            onChange={(e) => f('name', e.target.value)}
            placeholder="مثل: مصاريف السفر"
          />
        </label>

        <label className="fin-label">
          اللون
          <div className="fin-color-grid">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                className={`fin-color-btn ${form.color === c ? 'fin-color-btn--active' : ''}`}
                style={{ background: c }}
                onClick={() => f('color', c)}
                aria-label={c}
              />
            ))}
          </div>
        </label>

        <label className="fin-label">
          الميزانية الشهرية (ر.س) — اختياري
          <input
            className="fin-input"
            type="number"
            min="0"
            value={form.monthlyBudget}
            onChange={(e) => f('monthlyBudget', e.target.value)}
            placeholder="0 = تلقائي من البنود"
          />
        </label>

        <div className="fin-modal__actions">
          <button className="fin-btn-primary" onClick={save} disabled={saving}>
            {saving ? '⏳...' : '💾 حفظ'}
          </button>
          <button className="fin-btn-secondary" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
