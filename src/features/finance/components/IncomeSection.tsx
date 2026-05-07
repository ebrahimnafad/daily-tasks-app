import { useState, useCallback } from 'react';
import type { Income, FinanceSettings } from '../types';
import { INCOME_ICONS, FREQUENCY_OPTIONS } from '../constants';
import { formatAmount, calcTotalMonthlyIncome } from '../utils';

interface IncomeSectionProps {
  income: Income[];
  setIncome: (v: Income[] | ((prev: Income[]) => Income[])) => void;
  settings: FinanceSettings;
}

export default function IncomeSection({ income, setIncome, settings }: IncomeSectionProps) {
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; id?: string } | null>(null);
  const [form, setForm] = useState({
    icon: '💼',
    title: '',
    type: 'fixed',
    amount: '',
    frequency: 'monthly',
    notes: '',
  });

  const totalMonthly = calcTotalMonthlyIncome(income);

  const openAdd = useCallback(() => {
    setForm({ icon: '💼', title: '', type: 'fixed', amount: '', frequency: 'monthly', notes: '' });
    setModal({ mode: 'add' });
  }, []);

  const openEdit = useCallback((item: Income) => {
    setForm({
      icon: item.icon || '💼',
      title: item.title,
      type: item.type || 'fixed',
      amount: String(item.amount || ''),
      frequency: item.frequency || 'monthly',
      notes: item.notes || '',
    });
    setModal({ mode: 'edit', id: item.id });
  }, []);

  const [saving, setSaving] = useState(false);

  const save = useCallback(() => {
    if (!form.title.trim() || !form.amount || saving) return;
    setSaving(true);
    const data: Income = {
      id: modal?.mode === 'add' ? crypto.randomUUID() : modal!.id!,
      icon: form.icon,
      title: form.title.trim(),
      type: form.type as Income['type'],
      amount: Number(form.amount),
      frequency: form.frequency as Income['frequency'],
      notes: form.notes,
      isActive: true,
    };
    if (modal?.mode === 'add') {
      setIncome((prev) => [...prev, data]);
    } else {
      setIncome((prev) => prev.map((s) => (s.id === modal?.id ? data : s)));
    }
    setModal(null);
    setSaving(false);
  }, [form, modal, setIncome, saving]);

  const remove = useCallback(
    (id: string) => {
      if (!window.confirm('حذف مصدر الدخل؟')) return;
      setIncome((prev) => prev.filter((s) => s.id !== id));
    },
    [setIncome]
  );

  const freqLabel = (f: string) => FREQUENCY_OPTIONS.find((x) => x.value === f)?.label || f;

  return (
    <section className="fin-section" aria-label="مصادر الدخل">
      <div className="fin-section__header">
        <h3 className="fin-section__title">💵 مصادر الدخل</h3>
        <span className="fin-section__total">{formatAmount(totalMonthly, settings)}/شهر</span>
      </div>

      {income.length === 0 && <div className="fin-empty">لم تضف مصادر دخل بعد</div>}

      {income.map((item) => (
        <div key={item.id} className="fin-income-card">
          <div className="fin-income-card__main">
            <span className="fin-income-card__icon">{item.icon || '💼'}</span>
            <div className="fin-income-card__info">
              <div className="fin-income-card__title">{item.title}</div>
              <div className="fin-income-card__meta">
                {item.type === 'fixed' ? 'ثابت' : 'متغير'} · {freqLabel(item.frequency)}
              </div>
            </div>
            <span className="fin-income-card__amount">{formatAmount(item.amount, settings)}</span>
          </div>
          <div className="fin-income-card__actions">
            <button className="fin-btn-sm" onClick={() => openEdit(item)} aria-label="تعديل">
              ✏️
            </button>
            <button className="fin-btn-sm" onClick={() => remove(item.id)} aria-label="حذف">
              🗑️
            </button>
          </div>
        </div>
      ))}

      <button className="fin-add-btn" onClick={openAdd}>
        ＋ إضافة مصدر دخل
      </button>

      {modal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box fin-modal">
            <h3 className="fin-modal__title">
              {modal.mode === 'add' ? 'إضافة مصدر دخل' : 'تعديل مصدر دخل'}
            </h3>

            <div className="fin-modal__icons">
              {INCOME_ICONS.map((ic) => (
                <button
                  key={ic}
                  className={`fin-icon-btn ${form.icon === ic ? 'fin-icon-btn--active' : ''}`}
                  onClick={() => setForm((p) => ({ ...p, icon: ic }))}
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
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="مثل: الراتب الأساسي"
              />
            </label>

            <label className="fin-label">
              النوع
              <select
                className="fin-input"
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option value="fixed">ثابت</option>
                <option value="variable">متغير (حوافز، عمولات)</option>
              </select>
            </label>

            <label className="fin-label">
              {form.type === 'variable' ? 'المبلغ التقديري' : 'المبلغ'} (ر.س)
              <input
                className="fin-input"
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </label>

            <label className="fin-label">
              التكرار
              <select
                className="fin-input"
                value={form.frequency}
                onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}
              >
                {FREQUENCY_OPTIONS.filter(
                  (f) => f.value !== 'weekly' && f.value !== 'one-time'
                ).map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="fin-label">
              ملاحظات
              <input
                className="fin-input"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="اختياري"
              />
            </label>

            <div className="fin-modal__actions">
              <button className="fin-btn-primary" onClick={save}>
                💾 حفظ
              </button>
              <button className="fin-btn-secondary" onClick={() => setModal(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
