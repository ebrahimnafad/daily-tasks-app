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
  const isCategoryMode = 'category' in state;
  const targetId = 'category' in state ? state.category.id : state.expense.id;
  const targetIcon = 'category' in state ? state.category.icon : state.expense.icon;
  const targetTitle = 'category' in state ? state.category.name : state.expense.title;
  const targetCategoryId = 'category' in state ? state.category.id : state.expense.categoryId;

  const expenseTxs = transactions
    .filter((t) =>
      isCategoryMode ? t.categoryId === targetId && !t.expenseId : t.expenseId === targetId
    )
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // نموذج إضافة فاتورة جديدة
  const [form, setForm] = useState({
    amount: !('category' in state) && state.expense.amount ? String(state.expense.amount) : '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // تعديل فاتورة قائمة
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', date: '', notes: '' });

  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditForm({ amount: String(tx.amount), date: tx.date, notes: tx.notes || '' });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = useCallback(
    (tx: Transaction) => {
      if (!editForm.amount || !editForm.date) return;
      onDelete(tx.id); // نحذف القديم
      onSave({
        ...tx,
        id: crypto.randomUUID(),
        amount: Number(editForm.amount),
        date: editForm.date,
        notes: editForm.notes.trim() || undefined,
      });
      setEditingId(null);
    },
    [editForm, onDelete, onSave]
  );

  const [saving, setSaving] = useState(false);

  const save = useCallback(() => {
    if (!form.amount || !form.date || saving) return;
    setSaving(true);
    onSave({
      id: crypto.randomUUID(),
      expenseId: isCategoryMode ? undefined : targetId,
      categoryId: targetCategoryId,
      amount: Number(form.amount),
      date: form.date,
      status: 'paid',
      notes: form.notes.trim() || undefined,
    });
    onClose();
  }, [form, isCategoryMode, targetId, targetCategoryId, onSave, onClose, saving]);

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

        {state.mode === 'register' || state.mode === 'register-category' ? (
          <>
            <h3 className="fin-drawer__title">
              {isCategoryMode ? '📝' : '✅'} {isCategoryMode ? 'تسجيل فاتورة' : 'تسجيل دفعة'} —{' '}
              {targetIcon} {targetTitle}
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
                {saving ? '⏳ جاري الحفظ...' : isCategoryMode ? '💾 حفظ الفاتورة' : '💾 حفظ الدفعة'}
              </button>
              <button className="fin-btn-secondary" onClick={onClose}>
                إلغاء
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="fin-drawer__title">
              {state.mode === 'view-category' ? '📝' : '📎'} سجل الفواتير — {targetIcon}{' '}
              {targetTitle}
            </h3>

            {expenseTxs.length === 0 ? (
              <div className="fin-empty">لا توجد فواتير مسجلة بعد</div>
            ) : (
              <div className="fin-drawer__list">
                {expenseTxs.map((tx) =>
                  editingId === tx.id ? (
                    // نموذج تعديل مضمن
                    <div key={tx.id} className="fin-drawer__item fin-drawer__item--editing">
                      <div
                        className="fin-row"
                        style={{ gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }}
                      >
                        <input
                          className="fin-input"
                          type="number"
                          min="0"
                          value={editForm.amount}
                          onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                          placeholder="المبلغ"
                          style={{ flex: 1 }}
                        />
                        <input
                          className="fin-input"
                          type="date"
                          value={editForm.date}
                          onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
                          style={{ flex: 1 }}
                        />
                      </div>
                      <input
                        className="fin-input"
                        value={editForm.notes}
                        onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="ملاحظة (اختياري)"
                        style={{ marginBottom: 'var(--space-xs)' }}
                      />
                      <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                        <button className="fin-btn-primary fin-btn-sm" onClick={() => saveEdit(tx)}>
                          💾 حفظ
                        </button>
                        <button className="fin-btn-secondary fin-btn-sm" onClick={cancelEdit}>
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={tx.id} className="fin-drawer__item">
                      <div className="fin-drawer__item-main">
                        <span className="fin-drawer__item-status">📝</span>
                        <div>
                          <div className="fin-drawer__item-date">{tx.date}</div>
                          <div className="fin-drawer__item-amount">
                            {(tx.amount || 0).toLocaleString('ar-SA')} ر.س
                          </div>
                          {tx.notes && <div className="fin-drawer__item-notes">{tx.notes}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                        <button
                          className="fin-btn-sm"
                          onClick={() => startEdit(tx)}
                          aria-label="تعديل"
                        >
                          ✏️
                        </button>
                        <button
                          className="fin-btn-sm"
                          onClick={() => {
                            if (window.confirm('حذف هذه الفاتورة؟')) onDelete(tx.id);
                          }}
                          aria-label="حذف"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
