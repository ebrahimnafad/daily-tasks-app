import { useMemo } from "react";

/**
 * FinanceCard — بطاقة التزام مالي واحد
 */
export default function FinanceCard({ obligation, payments, onEdit, onDelete, onRegisterPayment, onViewPayments }) {
  const paidPayments = useMemo(
    () => payments.filter(p => p.obligationId === obligation.id && p.status === "paid"),
    [payments, obligation.id]
  );
  const totalPaid = paidPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const paidCount = paidPayments.length;

  const isInstallment = obligation.type === "installment" && obligation.totalAmount > 0;
  const remaining = isInstallment ? obligation.totalAmount - totalPaid : 0;
  const progressPct = isInstallment ? Math.min(100, Math.round((totalPaid / obligation.totalAmount) * 100)) : 0;

  // حساب الموعد القادم
  const nextDue = useMemo(() => {
    const now = new Date();
    const day = obligation.dueDay || 1;
    let d = new Date(now.getFullYear(), now.getMonth(), day);
    if (d <= now) {
      if (obligation.frequency === "monthly") d.setMonth(d.getMonth() + 1);
      else if (obligation.frequency === "quarterly") d.setMonth(d.getMonth() + 3);
      else if (obligation.frequency === "semi-annual") d.setMonth(d.getMonth() + 6);
      else if (obligation.frequency === "annual") d.setFullYear(d.getFullYear() + 1);
      else d.setMonth(d.getMonth() + 1);
    }
    const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    return { date: d, daysLeft: diff };
  }, [obligation]);

  const isOverdue = nextDue.daysLeft < 0;
  const isSeasonal = obligation.type === "seasonal";

  const freqLabels = { monthly: "شهري", quarterly: "ربع سنوي", "semi-annual": "نصف سنوي", annual: "سنوي", "one-time": "مرة واحدة" };
  const catColors = { "عقار": "#c87a4e", "تعليم": "#6e9fcf", "أسرة": "#9bc87a", "خدمات": "#bda782", "موسمي": "#dca7a5", "أخرى": "#aaaaaa" };

  return (
    <div className={`fin-card ${isOverdue ? "fin-card--overdue" : ""} ${!obligation.isActive ? "fin-card--disabled" : ""}`}
         style={{ "--card-accent": catColors[obligation.category] || "#aaaaaa" }}>
      {/* Header */}
      <div className="fin-card__header">
        <div className="fin-card__title-row">
          <span className="fin-card__icon">{obligation.icon}</span>
          <div>
            <div className="fin-card__title">{obligation.title}</div>
            <div className="fin-card__meta">
              {obligation.category} · {freqLabels[obligation.frequency] || obligation.frequency}
              {isSeasonal && " · موسمي"}
            </div>
          </div>
        </div>
        <div className="fin-card__actions">
          <button className="fin-btn-sm" onClick={() => onEdit(obligation)} aria-label="تعديل">✏️</button>
          <button className="fin-btn-sm" onClick={() => onDelete(obligation.id)} aria-label="حذف">🗑️</button>
        </div>
      </div>

      {/* المبلغ والموعد */}
      <div className="fin-card__amount">
        {obligation.isVariable && "≈ "}{(obligation.amount || 0).toLocaleString("ar-SA")} ر.س
        {obligation.isVariable && <span className="fin-card__tag">متغير</span>}
      </div>

      {isSeasonal && obligation.monthlySetAside > 0 && (
        <div className="fin-card__seasonal">
          اقتطاع شهري: {obligation.monthlySetAside.toLocaleString("ar-SA")} ر.س
        </div>
      )}

      {!isSeasonal && obligation.isActive !== false && (
        <div className="fin-card__due">
          {isOverdue
            ? <span style={{ color: "#d97e6a" }}>⚠️ متأخر {Math.abs(nextDue.daysLeft)} يوم</span>
            : <>القادم: {nextDue.date.toLocaleDateString("ar-SA")} (بعد {nextDue.daysLeft} يوم)</>
          }
        </div>
      )}

      {/* شريط التقدم — أقساط فقط */}
      {isInstallment && (
        <div className="fin-card__progress">
          <div className="pbar"><div className="pfill" style={{ width: `${progressPct}%`, background: "var(--card-accent)" }} /></div>
          <div className="fin-card__progress-text">
            <span>{paidCount}/{obligation.totalInstallments || "?"} قسط ({progressPct}٪)</span>
            <span>المدفوع: {totalPaid.toLocaleString("ar-SA")} · المتبقي: {remaining.toLocaleString("ar-SA")}</span>
          </div>
        </div>
      )}

      {/* آخر دفع — للدوري */}
      {!isInstallment && paidPayments.length > 0 && (
        <div className="fin-card__last-paid">
          آخر دفع: {paidPayments[paidPayments.length - 1]?.date}
        </div>
      )}

      {/* أزرار */}
      <div className="fin-card__footer">
        <button className="fin-btn-outline" onClick={() => onViewPayments(obligation.id)}>
          📎 الإيصالات ({paidCount})
        </button>
        {obligation.isActive !== false && (
          <button className="fin-btn-primary fin-btn-sm" onClick={() => onRegisterPayment(obligation)}>
            ✅ تسجيل دفع
          </button>
        )}
      </div>
    </div>
  );
}
