import { useMemo } from "react";
import FinanceChart from "./FinanceChart.jsx";

/**
 * MonthlySummary — ملخص الشهر المالي مع رسم بياني
 */
export default function MonthlySummary({ income, obligations, payments, goals, viewMonth, onChangeMonth }) {
  const monthDate = new Date(viewMonth + "-01");
  const monthLabel = monthDate.toLocaleDateString("ar-SA", { year: "numeric", month: "long" });

  const prevMonth = useMemo(() => {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  }, [viewMonth]);

  const nextMonth = useMemo(() => {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 7);
  }, [viewMonth]);

  // حساب إجمالي الدخل الشهري
  const totalIncome = useMemo(() => {
    return income.filter(s => s.isActive !== false).reduce((sum, s) => {
      const amt = s.amount || 0;
      if (s.frequency === "monthly") return sum + amt;
      if (s.frequency === "quarterly") return sum + amt / 3;
      if (s.frequency === "semi-annual") return sum + amt / 6;
      if (s.frequency === "annual") return sum + amt / 12;
      return sum;
    }, 0);
  }, [income]);

  // حساب الالتزامات المستحقة هذا الشهر
  const { monthlyObligations, totalRequired } = useMemo(() => {
    const month = monthDate.getMonth() + 1; // 1-12
    const items = [];
    let total = 0;

    obligations.filter(o => o.isActive !== false).forEach(o => {
      let isDue = false;
      const amt = o.amount || 0;

      if (o.frequency === "monthly") isDue = true;
      else if (o.frequency === "quarterly") isDue = month % 3 === ((o.startMonth || 1) % 3);
      else if (o.frequency === "semi-annual") isDue = month % 6 === ((o.startMonth || 1) % 6);
      else if (o.frequency === "annual") isDue = month === (o.startMonth || 1);
      else if (o.type === "seasonal") isDue = false; // الموسمي يُحسب كاقتطاع شهري

      // الاقتطاعات الشهرية (الموسمية)
      if (o.type === "seasonal" && o.monthlySetAside > 0) {
        items.push({ ...o, dueAmount: o.monthlySetAside, isSeasonal: true });
        total += o.monthlySetAside;
        return;
      }

      if (isDue) {
        items.push({ ...o, dueAmount: amt });
        total += amt;
      }
    });

    return { monthlyObligations: items, totalRequired: total };
  }, [obligations, viewMonth]);

  // حساب المدفوع هذا الشهر
  const totalPaid = useMemo(() => {
    const ym = viewMonth; // "YYYY-MM"
    return payments
      .filter(p => p.date?.startsWith(ym) && p.status === "paid")
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments, viewMonth]);

  // اقتطاعات الأهداف
  const totalGoalDeductions = useMemo(() => {
    return goals.filter(g => g.isActive !== false).reduce((sum, g) => sum + (g.monthlyTarget || 0), 0);
  }, [goals]);

  const totalExpenses = totalRequired + totalGoalDeductions;
  const savings = Math.max(0, totalIncome - totalExpenses);
  const remaining = totalRequired - totalPaid;

  const chartSegments = [
    { id: "obligations", label: "التزامات", value: totalRequired, color: "#d97e6a" },
    { id: "goals", label: "أهداف", value: totalGoalDeductions, color: "#6e9fcf" },
    { id: "savings", label: "ادخار", value: savings, color: "#9bc87a" },
  ];

  return (
    <section className="fin-summary" aria-label="ملخص الشهر المالي">
      {/* عنوان مع أسهم التنقل */}
      <div className="fin-summary__header">
        <button className="fin-summary__nav" onClick={() => onChangeMonth(nextMonth)} aria-label="الشهر التالي">◄</button>
        <h2 className="fin-summary__title">📊 {monthLabel}</h2>
        <button className="fin-summary__nav" onClick={() => onChangeMonth(prevMonth)} aria-label="الشهر السابق">►</button>
      </div>

      {/* الرسم البياني */}
      <FinanceChart segments={chartSegments} />

      {/* الأرقام */}
      <div className="fin-summary__grid">
        <div className="fin-summary__stat">
          <span className="fin-summary__stat-label">الدخل</span>
          <span className="fin-summary__stat-value" style={{ color: "#9bc87a" }}>
            {totalIncome.toLocaleString("ar-SA")} ر.س
          </span>
        </div>
        <div className="fin-summary__stat">
          <span className="fin-summary__stat-label">المطلوب</span>
          <span className="fin-summary__stat-value" style={{ color: "#d97e6a" }}>
            {totalRequired.toLocaleString("ar-SA")} ر.س
          </span>
        </div>
        <div className="fin-summary__stat">
          <span className="fin-summary__stat-label">المدفوع</span>
          <span className="fin-summary__stat-value" style={{ color: "var(--gold)" }}>
            {totalPaid.toLocaleString("ar-SA")} ر.س
          </span>
        </div>
        <div className="fin-summary__stat">
          <span className="fin-summary__stat-label">المتبقي</span>
          <span className="fin-summary__stat-value" style={{ color: remaining > 0 ? "#d97e6a" : "#9bc87a" }}>
            {remaining.toLocaleString("ar-SA")} ر.س
          </span>
        </div>
      </div>

      {/* تفصيل الشهر */}
      {monthlyObligations.length > 0 && (
        <div className="fin-summary__breakdown">
          <div style={{ fontSize: 12, color: "rgba(var(--gold-rgb),.5)", marginBottom: 6 }}>── التفصيل ──</div>
          {monthlyObligations.map(o => {
            const isPaid = payments.some(p => p.obligationId === o.id && p.date?.startsWith(viewMonth) && p.status === "paid");
            return (
              <div key={o.id} className="fin-summary__item">
                <span>{isPaid ? "✅" : "⏳"} {o.icon} {o.title}</span>
                <span>{o.dueAmount.toLocaleString("ar-SA")} ر.س</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
