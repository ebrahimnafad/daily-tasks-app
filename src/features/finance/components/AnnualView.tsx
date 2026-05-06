import { useMemo } from 'react';
import TrendChart from './TrendChart';
import type {
  Income,
  ExpenseCategory,
  Expense,
  Transaction,
  Goal,
  FinanceSettings,
} from '../types';
import { calcMonthlySummary, formatAmount, formatMonthLabel } from '../utils';

interface AnnualViewProps {
  year: number;
  incomes: Income[];
  categories: ExpenseCategory[];
  expenses: Expense[];
  transactions: Transaction[];
  goals: Goal[];
  settings: FinanceSettings;
}

export default function AnnualView({
  year,
  incomes,
  categories,
  expenses,
  transactions,
  goals,
  settings,
}: AnnualViewProps) {
  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = `${year}-${String(i + 1).padStart(2, '0')}`;
      const summary = calcMonthlySummary(incomes, categories, expenses, transactions, goals, month);
      return {
        month,
        label: formatMonthLabel(month),
        shortLabel: new Date(`${month}-01`).toLocaleDateString('ar-SA', { month: 'short' }),
        income: summary.totalIncome,
        expense: summary.totalActual,
        budget: summary.totalBudget,
        remaining: summary.remaining,
      };
    });
  }, [year, incomes, categories, expenses, transactions, goals]);

  const annualTotals = useMemo(() => {
    return monthlyData.reduce(
      (acc, m) => ({
        income: acc.income + m.income,
        expense: acc.expense + m.expense,
        budget: acc.budget + m.budget,
      }),
      { income: 0, expense: 0, budget: 0 }
    );
  }, [monthlyData]);

  const trendData = monthlyData.map((m) => ({
    month: m.month,
    label: m.shortLabel,
    income: m.income,
    expense: m.expense,
  }));

  // Top 5 categories by annual spending
  const topCategories = useMemo(() => {
    const catTotals = categories.map((cat) => {
      const total = transactions
        .filter(
          (t) => t.categoryId === cat.id && t.date.startsWith(String(year)) && t.status === 'paid'
        )
        .reduce((s, t) => s + t.amount, 0);
      return { category: cat, total };
    });
    return catTotals
      .sort((a, b) => b.total - a.total)
      .filter((c) => c.total > 0)
      .slice(0, 5);
  }, [categories, transactions, year]);

  const maxCatTotal = topCategories.length > 0 ? topCategories[0].total : 1;

  // ── Annual Insights ────────────────────────────────────────────────
  const annualInsights = useMemo(() => {
    const list: { icon: string; text: string; type: string }[] = [];
    const fmt = (n: number) => formatAmount(n, settings);
    const activeMonths = monthlyData.filter((m) => m.expense > 0);

    if (activeMonths.length === 0) return list;

    // Best & worst months
    const best = activeMonths.reduce((a, b) => (a.remaining > b.remaining ? a : b));
    const worst = activeMonths.reduce((a, b) => (a.remaining < b.remaining ? a : b));
    if (activeMonths.length >= 2) {
      list.push({
        icon: '🏆',
        text: `أفضل شهر: ${best.shortLabel} — وفرت ${fmt(best.remaining)}`,
        type: 'success',
      });
      if (worst.remaining < best.remaining) {
        list.push({
          icon: '📉',
          text: `أكثر شهر إنفاقاً: ${worst.shortLabel} — صرفت ${fmt(worst.expense)}`,
          type: worst.remaining < 0 ? 'danger' : 'warning',
        });
      }
    }

    // Average monthly spending
    const avgSpend = annualTotals.expense / activeMonths.length;
    list.push({
      icon: '📊',
      text: `متوسط الإنفاق الشهري: ${fmt(Math.round(avgSpend))}`,
      type: 'info',
    });

    // Annual savings
    const annualSavings = annualTotals.income - annualTotals.expense;
    if (annualTotals.income > 0) {
      const savePct = Math.round((annualSavings / annualTotals.income) * 100);
      if (annualSavings > 0) {
        list.push({
          icon: '💰',
          text: `ادخرت ${fmt(annualSavings)} هذه السنة (${savePct}٪ من الدخل)`,
          type: 'success',
        });
      } else {
        list.push({
          icon: '⚠️',
          text: `أنفقت أكثر من دخلك بـ ${fmt(Math.abs(annualSavings))}`,
          type: 'danger',
        });
      }
    }

    // Category concentration
    if (topCategories.length >= 2) {
      const topPct = Math.round((topCategories[0].total / annualTotals.expense) * 100);
      if (topPct >= 40) {
        list.push({
          icon: '🎯',
          text: `${topCategories[0].category.icon} ${topCategories[0].category.name} يستحوذ على ${topPct}٪ من إنفاقك`,
          type: 'tip',
        });
      }
    }

    return list;
  }, [monthlyData, annualTotals, topCategories, settings]);

  const insightStyles: Record<string, { bg: string; border: string; color: string }> = {
    success: { bg: 'rgba(155,200,122,.06)', border: 'rgba(155,200,122,.2)', color: '#9bc87a' },
    warning: { bg: 'rgba(230,168,85,.06)', border: 'rgba(230,168,85,.2)', color: '#e6a855' },
    danger: { bg: 'rgba(217,126,106,.06)', border: 'rgba(217,126,106,.2)', color: '#d97e6a' },
    info: { bg: 'rgba(110,159,207,.06)', border: 'rgba(110,159,207,.2)', color: '#6e9fcf' },
    tip: {
      bg: 'rgba(var(--gold-rgb),.05)',
      border: 'rgba(var(--gold-rgb),.15)',
      color: 'var(--gold)',
    },
  };

  return (
    <div className="fin-annual">
      <h2 className="fin-annual__title">📅 الملخص السنوي — {year}</h2>

      {/* Annual totals */}
      <div className="fin-dashboard__grid" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="fin-dashboard__stat">
          <span className="fin-dashboard__stat-label">إجمالي الدخل</span>
          <span className="fin-dashboard__stat-value" style={{ color: '#9bc87a' }}>
            {formatAmount(annualTotals.income, settings)}
          </span>
        </div>
        <div className="fin-dashboard__stat">
          <span className="fin-dashboard__stat-label">إجمالي المصروف</span>
          <span className="fin-dashboard__stat-value" style={{ color: '#d97e6a' }}>
            {formatAmount(annualTotals.expense, settings)}
          </span>
        </div>
      </div>

      {/* Annual Insights */}
      {annualInsights.length > 0 && (
        <div className="fin-insights" style={{ marginBottom: 'var(--space-xl)' }}>
          <h3 className="fin-section__title">🧠 رؤى سنوية</h3>
          <div className="fin-insights__list">
            {annualInsights.map((ins, i) => {
              const s = insightStyles[ins.type] || insightStyles.info;
              return (
                <div
                  key={i}
                  className="fin-insight"
                  style={{ background: s.bg, borderColor: s.border }}
                >
                  <span className="fin-insight__icon">{ins.icon}</span>
                  <div className="fin-insight__content">
                    <div className="fin-insight__title" style={{ color: s.color }}>
                      {ins.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trend chart */}
      <div className="fin-annual__chart-section">
        <h3 className="fin-section__title">📈 الاتجاه الشهري</h3>
        <TrendChart data={trendData} />
      </div>

      {/* Monthly table */}
      <div className="fin-annual__table-section">
        <h3 className="fin-section__title">📋 تفصيل شهري</h3>
        <div className="fin-annual__table-wrap">
          <table className="fin-annual__table">
            <thead>
              <tr>
                <th>الشهر</th>
                <th>الدخل</th>
                <th>المصروف</th>
                <th>الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((m) => (
                <tr key={m.month}>
                  <td>{m.shortLabel}</td>
                  <td style={{ color: '#9bc87a' }}>
                    {m.income > 0 ? formatAmount(m.income, settings) : '—'}
                  </td>
                  <td style={{ color: '#d97e6a' }}>
                    {m.expense > 0 ? formatAmount(m.expense, settings) : '—'}
                  </td>
                  <td style={{ color: m.remaining >= 0 ? '#9bc87a' : '#d97e6a' }}>
                    {m.income > 0 || m.expense > 0 ? formatAmount(m.remaining, settings) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top categories */}
      {topCategories.length > 0 && (
        <div className="fin-annual__top-cats">
          <h3 className="fin-section__title">🔥 أكثر الأقسام إنفاقاً</h3>
          {topCategories.map(({ category, total }) => (
            <div key={category.id} className="fin-annual__cat-bar">
              <div className="fin-annual__cat-info">
                <span>
                  {category.icon} {category.name}
                </span>
                <span style={{ color: category.color }}>{formatAmount(total, settings)}</span>
              </div>
              <div className="fin-budget-bar__track">
                <div
                  className="fin-budget-bar__fill"
                  style={{
                    width: `${(total / maxCatTotal) * 100}%`,
                    background: category.color,
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
