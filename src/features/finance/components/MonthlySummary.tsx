import { useMemo } from 'react';
import { FinanceChart } from '@/features/finance';
import type { Income, Obligation, Payment, Goal } from '../types';

interface MonthlySummaryProps {
  income: Income[];
  obligations: Obligation[];
  payments: Payment[];
  goals: Goal[];
  viewMonth: string; // YYYY-MM
  onChangeMonth: (month: string) => void;
}

export default function MonthlySummary({
  income,
  obligations,
  payments,
  goals,
  viewMonth,
  onChangeMonth,
}: MonthlySummaryProps) {
  const monthDate = new Date(viewMonth + '-01');
  const monthLabel = monthDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' });

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

  const totalIncome = useMemo(() => {
    return income
      .filter((s) => s.isActive !== false)
      .reduce((sum, s) => {
        const amt = s.amount || 0;
        if (s.frequency === 'monthly') return sum + amt;
        if (s.frequency === 'quarterly') return sum + amt / 3;
        if (s.frequency === 'semi-annual') return sum + amt / 6;
        if (s.frequency === 'annual') return sum + amt / 12;
        return sum;
      }, 0);
  }, [income]);

  const { monthlyObligations, totalRequired } = useMemo(() => {
    const month = monthDate.getMonth() + 1;
    const items: (Obligation & { dueAmount: number; isSeasonal?: boolean })[] = [];
    let total = 0;

    obligations
      .filter((o) => o.isActive !== false)
      .forEach((o) => {
        let isDue = false;
        const amt = o.amount || 0;
        const anyO = o as any;

        if (o.frequency === 'monthly') isDue = true;
        else if (o.frequency === 'quarterly') isDue = month % 3 === (anyO.startMonth || 1) % 3;
        else if (o.frequency === 'semi-annual') isDue = month % 6 === (anyO.startMonth || 1) % 6;
        else if (o.frequency === 'annual') isDue = month === (anyO.startMonth || 1);
        else if (anyO.type === 'seasonal') isDue = false;

        if (anyO.type === 'seasonal' && anyO.monthlySetAside > 0) {
          items.push({ ...o, dueAmount: anyO.monthlySetAside, isSeasonal: true });
          total += anyO.monthlySetAside;
          return;
        }

        if (isDue) {
          items.push({ ...o, dueAmount: amt });
          total += amt;
        }
      });

    return { monthlyObligations: items, totalRequired: total };
  }, [obligations, viewMonth]);

  const totalPaid = useMemo(() => {
    const ym = viewMonth;
    return payments
      .filter((p) => p.date?.startsWith(ym) && p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments, viewMonth]);

  const totalGoalDeductions = useMemo(() => {
    return goals
      .filter((g: any) => g.isActive !== false)
      .reduce((sum, g: any) => sum + (g.monthlyTarget || 0), 0);
  }, [goals]);

  const totalExpenses = totalRequired + totalGoalDeductions;
  const savings = Math.max(0, totalIncome - totalExpenses);
  const remaining = totalRequired - totalPaid;

  const chartSegments = [
    { id: 'obligations', label: 'التزامات', value: totalRequired, color: '#d97e6a' },
    { id: 'goals', label: 'أهداف', value: totalGoalDeductions, color: '#6e9fcf' },
    { id: 'savings', label: 'ادخار', value: savings, color: '#9bc87a' },
  ];

  return (
    <section className="fin-summary" aria-label="ملخص الشهر المالي">
      <div className="fin-summary__header">
        <button
          className="fin-summary__nav"
          onClick={() => onChangeMonth(nextMonth)}
          aria-label="الشهر التالي"
        >
          ◄
        </button>
        <h2 className="fin-summary__title">📊 {monthLabel}</h2>
        <button
          className="fin-summary__nav"
          onClick={() => onChangeMonth(prevMonth)}
          aria-label="الشهر السابق"
        >
          ►
        </button>
      </div>

      <FinanceChart segments={chartSegments} />

      <div className="fin-summary__grid">
        <div className="fin-summary__stat">
          <span className="fin-summary__stat-label">الدخل</span>
          <span className="fin-summary__stat-value" style={{ color: '#9bc87a' }}>
            {totalIncome.toLocaleString('ar-SA')} ر.س
          </span>
        </div>
        <div className="fin-summary__stat">
          <span className="fin-summary__stat-label">المطلوب</span>
          <span className="fin-summary__stat-value" style={{ color: '#d97e6a' }}>
            {totalRequired.toLocaleString('ar-SA')} ر.س
          </span>
        </div>
        <div className="fin-summary__stat">
          <span className="fin-summary__stat-label">المدفوع</span>
          <span className="fin-summary__stat-value" style={{ color: 'var(--gold)' }}>
            {totalPaid.toLocaleString('ar-SA')} ر.س
          </span>
        </div>
        <div className="fin-summary__stat">
          <span className="fin-summary__stat-label">المتبقي</span>
          <span
            className="fin-summary__stat-value"
            style={{ color: remaining > 0 ? '#d97e6a' : '#9bc87a' }}
          >
            {remaining.toLocaleString('ar-SA')} ر.س
          </span>
        </div>
      </div>

      {monthlyObligations.length > 0 && (
        <div className="fin-summary__breakdown">
          <div
            style={{
              fontSize: 'var(--font-sm)',
              color: 'rgba(var(--gold-rgb),.5)',
              marginBottom: 'var(--space-sm)',
            }}
          >
            ── التفصيل ──
          </div>
          {monthlyObligations.map((o) => {
            const isPaid = payments.some(
              (p) => p.obligationId === o.id && p.date?.startsWith(viewMonth) && p.status === 'paid'
            );
            return (
              <div key={o.id} className="fin-summary__item">
                <span>
                  {isPaid ? '✅' : '⏳'} {(o as any).icon || '📋'} {o.title}
                </span>
                <span>{o.dueAmount.toLocaleString('ar-SA')} ر.س</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
