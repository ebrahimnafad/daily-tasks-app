import { useState, useCallback } from 'react';
import type { Expense, ExpenseModalState } from '../types';
import { EXPENSE_ICONS, FREQUENCY_OPTIONS, TYPE_OPTIONS } from '../constants';

interface ExpenseModalProps {
  modal: ExpenseModalState;
  onSave: (data: Partial<Expense>, mode: 'add' | 'edit', id?: string) => void;
  onClose: () => void;
}

const EMPTY = {
  icon: '📋',
  title: '',
  type: 'fixed',
  frequency: 'monthly',
  dueDay: '1',
  amount: '',
  totalAmount: '',
  totalInstallments: '',
  endDate: '',
  seasonMonth: '',
  monthlySetAside: '',
  notes: '',
};

export default function ExpenseModal({ modal, onSave, onClose }: ExpenseModalProps) {
  const [form, setForm] = useState(() => {
    if (modal.mode === 'edit' && modal.data) {
      const d = modal.data;
      return {
        icon: d.icon || '📋',
        title: d.title || '',
        type: d.type || 'fixed',
        frequency: d.frequency || 'monthly',
        dueDay: String(d.dueDay || 1),
        amount: String(d.amount || ''),
        totalAmount: String(d.totalAmount || ''),
        totalInstallments: String(d.totalInstallments || ''),
        endDate: d.endDate || '',
        seasonMonth: String(d.seasonMonth || ''),
        monthlySetAside: String(d.monthlySetAside || ''),
        notes: d.notes || '',
      };
    }
    return { ...EMPTY };
  });

  const f = (field: string, val: string | boolean) => setForm((p) => ({ ...p, [field]: val }));

  const [saving, setSaving] = useState(false);

  // هل هذا النوع يحتاج يوم استحقاق؟
  const needsDueDay = form.type === 'fixed' || form.type === 'installment';

  const save = useCallback(() => {
    if (!form.title?.trim() || !form.amount || saving) return;
    setSaving(true);
    const data: Partial<Expense> = {
      icon: form.icon,
      title: form.title.trim(),
      categoryId: modal.categoryId,
      type: form.type as Expense['type'],
      frequency: form.frequency as Expense['frequency'],
      amount: Number(form.amount) || 0,
      isActive: true,
      notes: form.notes,
    };
    // يوم الاستحقاق فقط للثابت والأقساط
    if (form.type === 'fixed' || form.type === 'installment') {
      data.dueDay = Number(form.dueDay) || 1;
    }
    if (form.type === 'installment') {
      data.totalAmount = Number(form.totalAmount) || 0;
      data.totalInstallments = Number(form.totalInstallments) || 0;
      data.endDate = form.endDate || undefined;
    }
    if (form.type === 'seasonal') {
      data.seasonMonth = Number(form.seasonMonth) || undefined;
      data.monthlySetAside = Number(form.monthlySetAside) || 0;
    }
    onSave(data, modal.mode, modal.data?.id);
  }, [form, modal, onSave, saving]);

  return (
    <div
      className="cov"
      role="dialog"
      aria-modal="true"
      aria-label={modal.mode === 'add' ? 'إضافة بند' : 'تعديل بند'}
    >
      <div className="cbox fin-modal fin-modal--lg">
        <h3 className="fin-modal__title">
          {modal.mode === 'add' ? 'إضافة بند مصروف' : 'تعديل بند'}
        </h3>

        <div className="fin-modal__scroll">
          <div className="fin-modal__icons">
            {EXPENSE_ICONS.map((ic) => (
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
            العنوان
            <input
              className="fin-input"
              value={form.title}
              onChange={(e) => f('title', e.target.value)}
              placeholder="مثل: إيجار الشقة"
            />
          </label>

          <div className="fin-row">
            <label className="fin-label" style={{ flex: 1 }}>
              النوع
              <select
                className="fin-input"
                value={form.type}
                onChange={(e) => f('type', e.target.value)}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fin-label" style={{ flex: 1 }}>
              التكرار
              <select
                className="fin-input"
                value={form.frequency}
                onChange={(e) => f('frequency', e.target.value)}
              >
                {FREQUENCY_OPTIONS.map((fr) => (
                  <option key={fr.value} value={fr.value}>
                    {fr.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="fin-row">
            <label className="fin-label" style={{ flex: 1 }}>
              {form.type === 'variable' ? 'الميزانية التقديرية' : 'المبلغ'} (ر.س)
              <input
                className="fin-input"
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => f('amount', e.target.value)}
                placeholder={form.type === 'variable' ? 'الحد الأقصى الشهري' : ''}
              />
            </label>
            {needsDueDay && (
              <label className="fin-label" style={{ flex: 1 }}>
                يوم الاستحقاق
                <input
                  className="fin-input"
                  type="number"
                  min="1"
                  max="28"
                  value={form.dueDay}
                  onChange={(e) => f('dueDay', e.target.value)}
                />
              </label>
            )}
          </div>

          {form.type === 'variable' && (
            <div className="fin-calc-hint" style={{ marginTop: 'var(--space-xs)' }}>
              💡 هذا البند يُسجَّل كفواتير مباشرة — لا يحتاج يوم استحقاق
            </div>
          )}

          {form.type === 'installment' && (
            <>
              <div className="fin-row">
                <label className="fin-label" style={{ flex: 1 }}>
                  المبلغ الإجمالي
                  <input
                    className="fin-input"
                    type="number"
                    min="0"
                    value={form.totalAmount}
                    onChange={(e) => f('totalAmount', e.target.value)}
                  />
                </label>
                <label className="fin-label" style={{ flex: 1 }}>
                  عدد الأقساط
                  <input
                    className="fin-input"
                    type="number"
                    min="1"
                    value={form.totalInstallments}
                    onChange={(e) => f('totalInstallments', e.target.value)}
                  />
                </label>
              </div>
              <label className="fin-label">
                تاريخ الانتهاء
                <input
                  className="fin-input"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => f('endDate', e.target.value)}
                />
              </label>
            </>
          )}

          {form.type === 'seasonal' && (
            <>
              <div className="fin-row">
                <label className="fin-label" style={{ flex: 1 }}>
                  شهر الاستحقاق
                  <select
                    className="fin-input"
                    value={form.seasonMonth}
                    onChange={(e) => f('seasonMonth', e.target.value)}
                  >
                    <option value="">— اختر الشهر —</option>
                    {[
                      'يناير',
                      'فبراير',
                      'مارس',
                      'أبريل',
                      'مايو',
                      'يونيو',
                      'يوليو',
                      'أغسطس',
                      'سبتمبر',
                      'أكتوبر',
                      'نوفمبر',
                      'ديسمبر',
                    ].map((name, i) => (
                      <option key={i + 1} value={String(i + 1)}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fin-label" style={{ flex: 1 }}>
                  اقتطاع شهري (ر.س)
                  <input
                    className="fin-input"
                    type="number"
                    min="0"
                    value={
                      form.monthlySetAside ||
                      (Number(form.amount) ? String(Math.ceil(Number(form.amount) / 12)) : '')
                    }
                    onChange={(e) => f('monthlySetAside', e.target.value)}
                    placeholder={
                      Number(form.amount) ? `≈ ${Math.ceil(Number(form.amount) / 12)}` : ''
                    }
                  />
                </label>
              </div>
              {form.seasonMonth && Number(form.amount) > 0 && (
                <div className="fin-calc-hint" style={{ marginTop: 'var(--space-xs)' }}>
                  💡 {Number(form.amount).toLocaleString('ar-SA')} ر.س مستحق في{' '}
                  {
                    [
                      'يناير',
                      'فبراير',
                      'مارس',
                      'أبريل',
                      'مايو',
                      'يونيو',
                      'يوليو',
                      'أغسطس',
                      'سبتمبر',
                      'أكتوبر',
                      'نوفمبر',
                      'ديسمبر',
                    ][Number(form.seasonMonth) - 1]
                  }
                  {' — '}اقتطاع ≈ {Math.ceil(Number(form.amount) / 12).toLocaleString('ar-SA')}{' '}
                  ر.س/شهر
                </div>
              )}
            </>
          )}

          <label className="fin-label">
            ملاحظات
            <textarea
              className="fin-input fin-textarea"
              value={form.notes}
              onChange={(e) => f('notes', e.target.value)}
              placeholder="اختياري"
            />
          </label>
        </div>

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
