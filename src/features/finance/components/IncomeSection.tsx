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
  const [expanded, setExpanded] = useState(true);
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

      {income.length > 0 && (
        <div
          className="fin-income-card"
          style={{
            flexDirection: 'column',
            gap: 'var(--space-sm)',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {/* Collapsible header — click to toggle */}
          <button
            className="fin-income-card__toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 'var(--space-lg)',
              fontFamily: 'inherit',
              textAlign: 'right',
            }}
          >
            <span className="fin-income-card__icon">💰</span>
            <div className="fin-income-card__info">
              <div className="fin-income-card__title">مصادر الدخل</div>
              <div className="fin-income-card__meta">{income.length} مصدر</div>
            </div>
            <span
              className="fin-income-card__amount"
              style={{ fontWeight: 700, color: 'var(--gold)', marginInlineStart: 'auto' }}
            >
              {formatAmount(totalMonthly, settings)}
            </span>
            <span
              style={{
                fontSize: '10px',
                color: 'rgba(var(--gold-rgb), 0.4)',
                transition: 'transform 0.25s',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                flexShrink: 0,
              }}
            >
              ▼
            </span>
          </button>

          {/* Collapsible body */}
          {expanded && (
            <div
              style={{
                borderTop: '1px solid rgba(var(--gold-rgb),0.1)',
                padding: '0 var(--space-lg) var(--space-md)',
                animation: 'slideDown 0.22s ease',
              }}
            >
              {income.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-xs) 0',
                    gap: 'var(--space-sm)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-sm)',
                      flex: 1,
                    }}
                  >
                    <span style={{ fontSize: 'var(--font-base)' }}>{item.icon || '💼'}</span>
                    <div>
                      <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-gold)' }}>
                        {item.title}
                      </div>
                      <div
                        style={{ fontSize: 'var(--font-xs)', color: 'rgba(var(--gold-rgb),0.5)' }}
                      >
                        {item.type === 'fixed' ? 'ثابت' : 'متغير'} · {freqLabel(item.frequency)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span style={{ fontSize: 'var(--font-sm)', color: 'var(--gold)' }}>
                      {formatAmount(item.amount, settings)}
                    </span>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button
                        className="fin-btn-sm"
                        onClick={() => openEdit(item)}
                        aria-label="تعديل"
                        style={{ padding: '2px 6px' }}
                      >
                        ✏️
                      </button>
                      <button
                        className="fin-btn-sm"
                        onClick={() => remove(item.id)}
                        aria-label="حذف"
                        style={{ padding: '2px 6px' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
