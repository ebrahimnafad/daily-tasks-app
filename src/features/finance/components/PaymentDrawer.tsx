import { useState, useCallback } from 'react';
import type { Obligation, Payment } from '../types';

interface PaymentDrawerProps {
  mode: 'register' | 'view';
  obligation: Obligation;
  payments: Payment[];
  onSavePayment: (payment: Payment) => void;
  onDeletePayment: (id: string | number) => void;
  onClose: () => void;
}

export default function PaymentDrawer({
  mode,
  obligation,
  payments,
  onSavePayment,
  onDeletePayment,
  onClose,
}: PaymentDrawerProps) {
  const oblPayments = payments
    .filter((p) => p.obligationId === obligation?.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const [form, setForm] = useState({
    amount: String(obligation?.amount || ''),
    date: new Date().toISOString().split('T')[0],
    receiptUrl: '',
    notes: '',
  });

  const save = useCallback(() => {
    if (!form.amount || !form.date) return;
    onSavePayment({
      id: crypto.randomUUID(),
      obligationId: obligation.id,
      amount: Number(form.amount),
      date: form.date,
      status: 'paid',
      notes: form.notes.trim(),
      receiptUrl: form.receiptUrl.trim(),
    } as Payment & { receiptUrl?: string }); // Add receiptUrl to type locally if needed or globally
    onClose();
  }, [form, obligation, onSavePayment, onClose]);

  if (!obligation) return null;

  return (
    <div
      className="cov"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'register' ? 'تسجيل دفعة' : 'سجل الدفعات'}
    >
      <div className="cbox fin-drawer">
        <button className="fin-drawer__close" onClick={onClose} aria-label="إغلاق">
          ✕
        </button>

        {mode === 'register' ? (
          <>
            <h3 className="fin-drawer__title">
              ✅ تسجيل دفعة — {(obligation as any).icon} {obligation.title}
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
              رابط الإيصال (Google Drive)
              <input
                className="fin-input"
                value={form.receiptUrl}
                onChange={(e) => setForm((p) => ({ ...p, receiptUrl: e.target.value }))}
                placeholder="https://drive.google.com/..."
                dir="ltr"
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
              <button className="fin-btn-primary" onClick={save}>
                💾 حفظ الدفعة
              </button>
              <button className="fin-btn-secondary" onClick={onClose}>
                إلغاء
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="fin-drawer__title">
              📎 سجل الدفعات — {(obligation as any).icon} {obligation.title}
            </h3>

            {oblPayments.length === 0 ? (
              <div className="fin-empty">لا توجد دفعات مسجلة بعد</div>
            ) : (
              <div className="fin-drawer__list">
                {oblPayments.map((p: any) => (
                  <div key={p.id} className="fin-drawer__item">
                    <div className="fin-drawer__item-main">
                      <span className="fin-drawer__item-status">
                        {p.status === 'paid' ? '✅' : p.status === 'late' ? '⚠️' : '⏭️'}
                      </span>
                      <div>
                        <div className="fin-drawer__item-date">{p.date}</div>
                        <div className="fin-drawer__item-amount">
                          {(p.amount || 0).toLocaleString('ar-SA')} ر.س
                        </div>
                        {p.notes && <div className="fin-drawer__item-notes">{p.notes}</div>}
                      </div>
                    </div>
                    <div className="fin-drawer__item-actions">
                      {p.receiptUrl && (
                        <a
                          href={p.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="fin-btn-sm"
                        >
                          📎
                        </a>
                      )}
                      <button
                        className="fin-btn-sm"
                        onClick={() => {
                          if (window.confirm('حذف هذه الدفعة؟')) onDeletePayment(p.id);
                        }}
                        aria-label="حذف"
                      >
                        🗑️
                      </button>
                    </div>
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
