import { useState, useCallback } from 'react';
import type { Transaction, TransactionDrawerState, FinanceSettings } from '../types';
import { localDateISO } from '@/lib/date/localDate';
import './TransactionDrawer.css';

interface TransactionDrawerProps {
  state: TransactionDrawerState;
  transactions: Transaction[];
  settings: FinanceSettings;
  onSave: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function TransactionDrawer({
  state,
  transactions,
  settings,
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
    date: localDateISO(),
    notes: '',
    useForeignCurrency: false,
    originalAmount: '',
    currencySymbol: settings.secondaryCurrencySymbol || '',
    exchangeRate: settings.exchangeRate ? String(settings.exchangeRate) : '',
  });

  // form state update helper
  const handleFormChange = (updates: Partial<typeof form>) => {
    setForm((prev) => {
      const next = { ...prev, ...updates };
      if (next.useForeignCurrency) {
        const orig = Number(next.originalAmount);
        const rate = Number(next.exchangeRate);
        if (!isNaN(orig) && orig > 0 && !isNaN(rate) && rate > 0) {
          next.amount = String(Math.round((orig / rate) * 100) / 100);
        }
      }
      return next;
    });
  };

  // تعديل فاتورة قائمة
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    date: '',
    notes: '',
    useForeignCurrency: false,
    originalAmount: '',
    currencySymbol: '',
    exchangeRate: '',
  });

  // editForm state update helper
  const handleEditFormChange = (updates: Partial<typeof editForm>) => {
    setEditForm((prev) => {
      const next = { ...prev, ...updates };
      if (next.useForeignCurrency) {
        const orig = Number(next.originalAmount);
        const rate = Number(next.exchangeRate);
        if (!isNaN(orig) && orig > 0 && !isNaN(rate) && rate > 0) {
          next.amount = String(Math.round((orig / rate) * 100) / 100);
        }
      }
      return next;
    });
  };

  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditForm({
      amount: String(tx.amount),
      date: tx.date,
      notes: tx.notes || '',
      useForeignCurrency: !!tx.originalAmount,
      originalAmount: tx.originalAmount ? String(tx.originalAmount) : '',
      currencySymbol: tx.currencySymbol || settings.secondaryCurrencySymbol || '',
      exchangeRate: tx.exchangeRate
        ? String(tx.exchangeRate)
        : settings.exchangeRate
          ? String(settings.exchangeRate)
          : '',
    });
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
        originalAmount: editForm.useForeignCurrency
          ? Number(editForm.originalAmount) || undefined
          : undefined,
        currencySymbol: editForm.useForeignCurrency
          ? editForm.currencySymbol || undefined
          : undefined,
        exchangeRate: editForm.useForeignCurrency
          ? Number(editForm.exchangeRate) || undefined
          : undefined,
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
      originalAmount: form.useForeignCurrency
        ? Number(form.originalAmount) || undefined
        : undefined,
      currencySymbol: form.useForeignCurrency ? form.currencySymbol || undefined : undefined,
      exchangeRate: form.useForeignCurrency ? Number(form.exchangeRate) || undefined : undefined,
    });
    onClose();
  }, [form, isCategoryMode, targetId, targetCategoryId, onSave, onClose, saving]);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={state.mode === 'register' ? 'تسجيل دفعة' : 'سجل المعاملات'}
    >
      <div className="modal-box fin-drawer">
        <button className="fin-drawer__close" onClick={onClose} aria-label="إغلاق">
          ✕
        </button>

        {state.mode === 'register' || state.mode === 'register-category' ? (
          <>
            <h3 className="fin-drawer__title">
              {isCategoryMode ? '📝' : '✅'} {isCategoryMode ? 'تسجيل فاتورة' : 'تسجيل دفعة'} —{' '}
              {targetIcon} {targetTitle}
            </h3>

            <label
              className="fin-label"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}
            >
              <input
                type="checkbox"
                checked={form.useForeignCurrency}
                onChange={(e) => handleFormChange({ useForeignCurrency: e.target.checked })}
              />
              استخدام عملة مختلفة؟
            </label>

            {form.useForeignCurrency && (
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                <label className="fin-label" style={{ flex: 1, minWidth: '100px' }}>
                  المبلغ (أجنبي)
                  <input
                    className="fin-input"
                    type="number"
                    min="0"
                    value={form.originalAmount}
                    onChange={(e) => handleFormChange({ originalAmount: e.target.value })}
                  />
                </label>
                <label className="fin-label" style={{ flex: 1, minWidth: '80px' }}>
                  رمز العملة
                  <input
                    className="fin-input"
                    value={form.currencySymbol}
                    onChange={(e) => handleFormChange({ currencySymbol: e.target.value })}
                    placeholder="مثال: ج.م"
                  />
                </label>
                <label className="fin-label" style={{ flex: 2, minWidth: '150px' }}>
                  سعر الصرف (1 {settings.currencySymbol} = ؟)
                  <input
                    className="fin-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.exchangeRate}
                    onChange={(e) => handleFormChange({ exchangeRate: e.target.value })}
                  />
                </label>
              </div>
            )}

            <label className="fin-label">
              المبلغ ({settings.currencySymbol})
              <input
                className="fin-input"
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => handleFormChange({ amount: e.target.value })}
                readOnly={form.useForeignCurrency}
                style={{ background: form.useForeignCurrency ? 'var(--bg-card)' : undefined }}
              />
            </label>

            <label className="fin-label">
              التاريخ
              <input
                className="fin-input"
                type="date"
                value={form.date}
                onChange={(e) => handleFormChange({ date: e.target.value })}
              />
            </label>

            <label className="fin-label">
              ملاحظة
              <input
                className="fin-input"
                value={form.notes}
                onChange={(e) => handleFormChange({ notes: e.target.value })}
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
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-xs)',
                          }}
                        >
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-xs)',
                              fontSize: '0.85em',
                              color: 'var(--text-color)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={editForm.useForeignCurrency}
                              onChange={(e) =>
                                handleEditFormChange({ useForeignCurrency: e.target.checked })
                              }
                            />
                            عملة مختلفة
                          </label>

                          {editForm.useForeignCurrency && (
                            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                              <input
                                className="fin-input"
                                type="number"
                                min="0"
                                value={editForm.originalAmount}
                                onChange={(e) =>
                                  handleEditFormChange({ originalAmount: e.target.value })
                                }
                                placeholder="المبلغ أجنبي"
                                style={{ flex: 1, padding: '4px 6px' }}
                              />
                              <input
                                className="fin-input"
                                value={editForm.currencySymbol}
                                onChange={(e) =>
                                  handleEditFormChange({ currencySymbol: e.target.value })
                                }
                                placeholder="الرمز"
                                style={{ flex: 0.8, padding: '4px 6px' }}
                              />
                              <input
                                className="fin-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={editForm.exchangeRate}
                                onChange={(e) =>
                                  handleEditFormChange({ exchangeRate: e.target.value })
                                }
                                placeholder="السعر"
                                style={{ flex: 1, padding: '4px 6px' }}
                              />
                            </div>
                          )}

                          <input
                            className="fin-input"
                            type="number"
                            min="0"
                            value={editForm.amount}
                            onChange={(e) => handleEditFormChange({ amount: e.target.value })}
                            placeholder={`المبلغ (${settings.currencySymbol})`}
                            readOnly={editForm.useForeignCurrency}
                            style={{
                              background: editForm.useForeignCurrency
                                ? 'var(--bg-card)'
                                : undefined,
                            }}
                          />
                        </div>
                        <input
                          className="fin-input"
                          type="date"
                          value={editForm.date}
                          onChange={(e) => handleEditFormChange({ date: e.target.value })}
                          aria-label="تاريخ الفاتورة"
                          style={{ flex: 1 }}
                        />
                      </div>
                      <input
                        className="fin-input"
                        value={editForm.notes}
                        onChange={(e) => handleEditFormChange({ notes: e.target.value })}
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
                            {(tx.amount || 0).toLocaleString('ar-SA')} {settings.currencySymbol}
                            {tx.originalAmount && tx.currencySymbol && (
                              <span style={{ fontSize: '0.8em', opacity: 0.7, marginRight: '6px' }}>
                                ({tx.originalAmount.toLocaleString('ar-SA')} {tx.currencySymbol})
                              </span>
                            )}
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
