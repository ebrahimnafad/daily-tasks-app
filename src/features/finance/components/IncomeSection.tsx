import { useState, useCallback } from 'react';
import type { Income } from '../types';

const INCOME_ICONS = ['💼', '💵', '🏦', '📈', '🎁', '💰', '🏢', '🛒'];
const FREQUENCIES = [
  { value: 'monthly', label: 'شهري' },
  { value: 'quarterly', label: 'ربع سنوي' },
  { value: 'semi-annual', label: 'نصف سنوي' },
  { value: 'annual', label: 'سنوي' },
];

interface IncomeSectionProps {
  income: Income[];
  setIncome: React.Dispatch<React.SetStateAction<Income[]>>;
}

interface IncomeModalState {
  mode: 'add' | 'edit';
  id?: string | number;
}

export default function IncomeSection({ income, setIncome }: IncomeSectionProps) {
  const [modal, setModal] = useState<IncomeModalState | null>(null);
  const [form, setForm] = useState({
    icon: '💼',
    title: '',
    type: 'fixed',
    amount: '',
    frequency: 'monthly',
    notes: '',
  });

  const totalMonthly = income
    .filter((s) => s.isActive !== false)
    .reduce((sum, s) => {
      const amt = s.amount || 0;
      if (s.frequency === 'monthly') return sum + amt;
      if (s.frequency === 'quarterly') return sum + amt / 3;
      if (s.frequency === 'semi-annual') return sum + amt / 6;
      if (s.frequency === 'annual') return sum + amt / 12;
      return sum;
    }, 0);

  const openAdd = useCallback(() => {
    setForm({ icon: '💼', title: '', type: 'fixed', amount: '', frequency: 'monthly', notes: '' });
    setModal({ mode: 'add' });
  }, []);

  const openEdit = useCallback((item: Income) => {
    setForm({
      icon: (item as any).icon || '💼',
      title: item.title,
      type: (item as any).type || 'fixed',
      amount: String(item.amount || ''),
      frequency: item.frequency || 'monthly',
      notes: (item as any).notes || '',
    });
    setModal({ mode: 'edit', id: item.id });
  }, []);

  const save = useCallback(() => {
    if (!form.title.trim() || !form.amount) return;
    const data: any = {
      icon: form.icon,
      title: form.title.trim(),
      type: form.type,
      amount: Number(form.amount),
      frequency: form.frequency,
      notes: form.notes,
      isActive: true,
    };
    if (modal?.mode === 'add') {
      setIncome((prev) => [...prev, { id: crypto.randomUUID(), ...data } as Income]);
    } else {
      setIncome((prev) => prev.map((s) => (s.id === modal?.id ? { ...s, ...data } : s)));
    }
    setModal(null);
  }, [form, modal, setIncome]);

  const remove = useCallback(
    (id: string | number) => {
      if (!window.confirm('حذف مصدر الدخل؟')) return;
      setIncome((prev) => prev.filter((s) => s.id !== id));
    },
    [setIncome]
  );

  return (
    <section className="fin-section" aria-label="مصادر الدخل">
      <div className="fin-section__header">
        <h3 className="fin-section__title">💵 مصادر الدخل</h3>
        <span className="fin-section__total">{totalMonthly.toLocaleString('ar-SA')} ر.س/شهر</span>
      </div>

      {income.length === 0 && <div className="fin-empty">لم تضف مصادر دخل بعد</div>}

      {income.map((item) => (
        <div key={item.id} className="fin-income-card">
          <div className="fin-income-card__main">
            <span className="fin-income-card__icon">{(item as any).icon || '💼'}</span>
            <div className="fin-income-card__info">
              <div className="fin-income-card__title">{item.title}</div>
              <div className="fin-income-card__meta">
                {(item as any).type === 'fixed' ? 'ثابت' : 'متغير'} ·{' '}
                {FREQUENCIES.find((f) => f.value === item.frequency)?.label || item.frequency}
                {(item as any).type === 'variable' && ' (تقريبي)'}
              </div>
            </div>
            <span className="fin-income-card__amount">
              {(item.amount || 0).toLocaleString('ar-SA')} ر.س
            </span>
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
        <div
          className="cov"
          role="dialog"
          aria-modal="true"
          aria-label={modal.mode === 'add' ? 'إضافة مصدر دخل' : 'تعديل مصدر دخل'}
        >
          <div className="cbox fin-modal">
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
                placeholder="0"
              />
            </label>

            <label className="fin-label">
              التكرار
              <select
                className="fin-input"
                value={form.frequency}
                onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}
              >
                {FREQUENCIES.map((f) => (
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
