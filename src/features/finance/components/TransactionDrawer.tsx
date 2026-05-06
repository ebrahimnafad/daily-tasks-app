import { useState, useCallback } from 'react';
import type { Transaction, TransactionDrawerState } from '../types';

interface TransactionDrawerProps {
  state: TransactionDrawerState;
  transactions: Transaction[];
  onSave: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function TransactionDrawer({
  state,
  transactions,
  onSave,
  onDelete,
  onClose,
}: TransactionDrawerProps) {
  const expense = state.expense;
  const isReceipt = state.expenseType === 'variable';
  const expenseTxs = transactions
    .filter((t) => t.expenseId === expense.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const [form, setForm] = useState({
    amount: isReceipt ? '' : String(expense.amount || ''),
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  const save = useCallback(() => {
    if (!form.amount || !form.date || saving) return;
    setSaving(true);
    onSave({
      id: crypto.randomUUID(),
      expenseId: expense.id,
      categoryId: expense.categoryId,
      amount: Number(form.amount),
      date: form.date,
      status: 'paid',
      notes: form.notes.trim() || undefined,
    });
    onClose();
  }, [form, expense, onSave, onClose, saving]);

  return (
    <div
      className="cov"
      role="dialog"
      aria-modal="true"
      aria-label={state.mode === 'register' ? 'تسجيل دفعة' : 'سجل المعاملات'}
    >
      <div className="cbox fin-drawer">
        <button className="fin-drawer__close" onClick={onClose} aria-label="إغلاق">
          ✕
        </button>

        {state.mode === 'register' ? (
          <>
            <h3 className="fin-drawer__title">
              {isReceipt ? '📝' : '✅'} {isReceipt ? 'تسجيل فاتورة' : 'تسجيل دفعة'} — {expense.icon}{' '}
              {expense.title}
            </h3>

            <label className="fin-label">
              المبلغ (ر.س)
              <input
                className="fin-input"
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </label>

            <label className="fin-label">
              التاريخ
              <input
                className="fin-input"
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </label>

            <label className="fin-label">
              ملاحظة
              <input
                className="fin-input"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="اختياري"
              />
            </label>

            <div className="fin-modal__actions">
              <button className="fin-btn-primary" onClick={save} disabled={saving}>
                {saving ? '⏳ جاري الحفظ...' : isReceipt ? '💾 حفظ الفاتورة' : '💾 حفظ الدفعة'}
              </button>
              <button className="fin-btn-secondary" onClick={onClose}>
                إلغاء
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="fin-drawer__title">
              📎 سجل المعاملات — {expense.icon} {expense.title}
            </h3>

            {expenseTxs.length === 0 ? (
              <div className="fin-empty">لا توجد معاملات مسجلة بعد</div>
            ) : (
              <div className="fin-drawer__list">
                {expenseTxs.map((tx) => (
                  <div key={tx.id} className="fin-drawer__item">
                    <div className="fin-drawer__item-main">
                      <span className="fin-drawer__item-status">✅</span>
                      <div>
                        <div className="fin-drawer__item-date">{tx.date}</div>
                        <div className="fin-drawer__item-amount">
                          {(tx.amount || 0).toLocaleString('ar-SA')} ر.س
                        </div>
                        {tx.notes && <div className="fin-drawer__item-notes">{tx.notes}</div>}
                      </div>
                    </div>
                    <button
                      className="fin-btn-sm"
                      onClick={() => {
                        if (window.confirm('حذف هذه المعاملة؟')) onDelete(tx.id);
                      }}
                      aria-label="حذف"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
