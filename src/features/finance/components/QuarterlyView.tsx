import { useMemo } from 'react';
import './QuarterlyView.css';

import type {
  Income,
  ExpenseCategory,
  Expense,
  Transaction,
  Goal,
  FinanceSettings,
} from '../types';
import {
  calcQuarterlySummary,
  formatQuarterLabel,
  formatAmount,
  BUDGET_STATUS_COLORS,
} from '../utils';

interface QuarterlyViewProps {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  incomes: Income[];
  categories: ExpenseCategory[];
  expenses: Expense[];
  transactions: Transaction[];
  goals: Goal[];
  settings: FinanceSettings;
  onPrevQuarter: () => void;
  onNextQuarter: () => void;
  onRegisterTx: (expense: Expense) => void;
}

export default function QuarterlyView({
  year,
  quarter,
  incomes,
  categories,
  expenses,
  transactions,
  goals,
  settings,
  onPrevQuarter,
  onNextQuarter,
  onRegisterTx,
}: QuarterlyViewProps) {
  const summary = useMemo(
    () => calcQuarterlySummary(incomes, categories, expenses, transactions, goals, year, quarter),
    [incomes, categories, expenses, transactions, goals, year, quarter]
  );

  const quarterLabel = formatQuarterLabel(year, quarter);

  // ── أقسام الإنفاق ربعياً ────────────────────────────────────────────────────
  const categoryTotals = useMemo(() => {
    const months = summary.monthlyBreakdown.map((m) => m.month);
    return categories
      .map((cat) => {
        const actual = transactions
          .filter(
            (t) =>
              t.categoryId === cat.id &&
              t.status === 'paid' &&
              months.some((m) => t.date.startsWith(m))
          )
          .reduce((s, t) => s + t.amount, 0);
        return { category: cat, actual };
      })
      .filter((c) => c.actual > 0)
      .sort((a, b) => b.actual - a.actual);
  }, [categories, transactions, summary.monthlyBreakdown]);

  const maxCatActual = categoryTotals.length > 0 ? categoryTotals[0].actual : 1;

  // ── رؤى ربعية ────────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const list: { icon: string; text: string; type: string }[] = [];
    const fmt = (n: number) => formatAmount(n, settings);
    const active = summary.monthlyBreakdown.filter((m) => m.expense > 0);

    if (active.length === 0) return list;

    // أفضل شهر
    const best = active.reduce((a, b) => (a.remaining > b.remaining ? a : b));
    const worst = active.reduce((a, b) => (a.remaining < b.remaining ? a : b));
    if (active.length >= 2) {
      list.push({
        icon: '🏆',
        text: `أفضل شهر: ${best.shortLabel} — وفرت ${fmt(best.remaining)}`,
        type: 'success',
      });
      if (worst.remaining < best.remaining) {
        list.push({
          icon: '📉',
          text: `أكثر إنفاقاً: ${worst.shortLabel} — صرفت ${fmt(worst.expense)}`,
          type: worst.remaining < 0 ? 'danger' : 'warning',
        });
      }
    }

    // متوسط الإنفاق الشهري
    const avgSpend = summary.totalActual / active.length;
    list.push({
      icon: '📊',
      text: `متوسط الإنفاق الشهري: ${fmt(Math.round(avgSpend))}`,
      type: 'info',
    });

    // معدل الادخار
    if (summary.totalIncome > 0) {
      const saved = summary.totalIncome - summary.totalActual - summary.totalGoalDeductions;
      if (saved > 0) {
        list.push({
          icon: '💰',
          text: `ادخرت ${fmt(saved)} هذا الربع (${summary.savingsRate}٪ من الدخل)`,
          type: 'success',
        });
      } else if (saved < 0) {
        list.push({
          icon: '⚠️',
          text: `أنفقت أكثر من دخلك بـ ${fmt(Math.abs(saved))} هذا الربع`,
          type: 'danger',
        });
      }
    }

    // القسم الأعلى
    if (categoryTotals.length >= 2 && summary.totalActual > 0) {
      const top = categoryTotals[0];
      const pct = Math.round((top.actual / summary.totalActual) * 100);
      if (pct >= 35) {
        list.push({
          icon: '🎯',
          text: `${top.category.icon} ${top.category.name} يستحوذ على ${pct}٪ من إنفاق الربع`,
          type: 'tip',
        });
      }
    }

    return list;
  }, [summary, categoryTotals, settings]);

  const insightStyles: Record<string, { bg: string; border: string; color: string }> = {
    success: { bg: 'rgba(155,200,122,.07)', border: 'rgba(155,200,122,.22)', color: '#9bc87a' },
    warning: { bg: 'rgba(230,168,85,.07)', border: 'rgba(230,168,85,.22)', color: '#e6a855' },
    danger: { bg: 'rgba(217,126,106,.07)', border: 'rgba(217,126,106,.22)', color: '#d97e6a' },
    info: { bg: 'rgba(110,159,207,.07)', border: 'rgba(110,159,207,.22)', color: '#6e9fcf' },
    tip: {
      bg: 'rgba(var(--gold-rgb),.06)',
      border: 'rgba(var(--gold-rgb),.18)',
      color: 'var(--gold)',
    },
  };

  const maxMonthlyExpense = Math.max(...summary.monthlyBreakdown.map((m) => m.income), 1);

  return (
    <div className="fin-quarterly">
      {/* ── رأس الربع ─────────────────────────────────────────────────────── */}
      <div className="fin-quarterly__header">
        <button className="fin-summary__nav" onClick={onNextQuarter} aria-label="الربع التالي">
          ◄
        </button>
        <h2 className="fin-quarterly__title">📆 {quarterLabel}</h2>
        <button className="fin-summary__nav" onClick={onPrevQuarter} aria-label="الربع السابق">
          ►
        </button>
      </div>

      {/* ── بطاقات KPI ───────────────────────────────────────────────────── */}
      <div className="fin-quarterly__kpis">
        <div className="fin-quarterly__kpi">
          <span className="fin-quarterly__kpi-icon">💰</span>
          <span className="fin-quarterly__kpi-label">إجمالي الدخل</span>
          <span className="fin-quarterly__kpi-value" style={{ color: '#9bc87a' }}>
            {formatAmount(summary.totalIncome, settings)}
          </span>
        </div>
        <div className="fin-quarterly__kpi">
          <span className="fin-quarterly__kpi-icon">💸</span>
          <span className="fin-quarterly__kpi-label">إجمالي المصروف</span>
          <span className="fin-quarterly__kpi-value" style={{ color: '#d97e6a' }}>
            {formatAmount(summary.totalActual, settings)}
          </span>
        </div>
        <div className="fin-quarterly__kpi">
          <span className="fin-quarterly__kpi-icon">📊</span>
          <span className="fin-quarterly__kpi-label">المتبقي</span>
          <span
            className="fin-quarterly__kpi-value"
            style={{ color: summary.remaining >= 0 ? '#9bc87a' : '#d97e6a' }}
          >
            {formatAmount(summary.remaining, settings)}
          </span>
        </div>
        <div className="fin-quarterly__kpi">
          <span className="fin-quarterly__kpi-icon">🏦</span>
          <span className="fin-quarterly__kpi-label">معدل الادخار</span>
          <span
            className="fin-quarterly__kpi-value"
            style={{ color: summary.savingsRate >= 0 ? '#9bc87a' : '#d97e6a' }}
          >
            {summary.savingsRate}٪
          </span>
        </div>
      </div>

      {/* ── مقارنة الأشهر الثلاثة ────────────────────────────────────────── */}
      <section className="fin-quarterly__section">
        <h3 className="fin-section__title">📅 الأشهر الثلاثة</h3>
        <div className="fin-quarterly__months">
          {summary.monthlyBreakdown.map((m) => (
            <div key={m.month} className="fin-quarterly__month-row">
              <div className="fin-quarterly__month-label">{m.shortLabel}</div>
              <div className="fin-quarterly__month-bars">
                {/* شريط الدخل */}
                <div className="fin-quarterly__bar-wrap">
                  <div
                    className="fin-quarterly__bar fin-quarterly__bar--income"
                    style={{ width: `${(m.income / maxMonthlyExpense) * 100}%` }}
                  />
                </div>
                <span className="fin-quarterly__bar-val fin-quarterly__bar-val--income">
                  {m.income > 0 ? formatAmount(m.income, settings) : '—'}
                </span>
                {/* شريط المصروف */}
                <div className="fin-quarterly__bar-wrap">
                  <div
                    className="fin-quarterly__bar fin-quarterly__bar--expense"
                    style={{
                      width: `${m.income > 0 ? (m.expense / maxMonthlyExpense) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="fin-quarterly__bar-val fin-quarterly__bar-val--expense">
                  {m.expense > 0 ? formatAmount(m.expense, settings) : '—'}
                </span>
              </div>
              <span
                className="fin-quarterly__month-rem"
                style={{ color: m.remaining >= 0 ? '#9bc87a' : '#d97e6a' }}
              >
                {m.income > 0 || m.expense > 0
                  ? (m.remaining >= 0 ? '+' : '') + formatAmount(m.remaining, settings)
                  : ''}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── الالتزامات الربعية ────────────────────────────────────────────── */}
      {summary.quarterlyObligations.length > 0 && (
        <section className="fin-quarterly__section">
          <h3 className="fin-section__title">🏗️ الالتزامات الربعية</h3>
          <div className="fin-quarterly__obligations">
            {summary.quarterlyObligations.map(
              ({ expense, isPaid, paidAmount, paidCount, dueMonth }) => {
                const totalInst = expense.totalInstallments ?? 0;
                const progress = totalInst > 0 ? Math.round((paidCount / totalInst) * 100) : 0;
                const remainingInst = totalInst > 0 ? totalInst - paidCount : null;
                const dueLabel = new Date(dueMonth + '-01').toLocaleDateString('ar-SA', {
                  month: 'long',
                });

                return (
                  <div
                    key={expense.id}
                    className={`fin-quarterly__obligation ${
                      isPaid
                        ? 'fin-quarterly__obligation--paid'
                        : 'fin-quarterly__obligation--pending'
                    }`}
                  >
                    <div className="fin-quarterly__ob-header">
                      <span className="fin-quarterly__ob-status">{isPaid ? '✅' : '⏳'}</span>
                      <div className="fin-quarterly__ob-info">
                        <span className="fin-quarterly__ob-title">
                          {expense.icon} {expense.title}
                        </span>
                        <span className="fin-quarterly__ob-meta">
                          {dueLabel} — {formatAmount(expense.amount, settings)}
                          {isPaid && paidAmount !== expense.amount && (
                            <span style={{ color: '#9bc87a' }}>
                              {' '}
                              (مدفوع: {formatAmount(paidAmount, settings)})
                            </span>
                          )}
                        </span>
                      </div>
                      {!isPaid && (
                        <button
                          className="fin-btn-sm"
                          onClick={() => onRegisterTx(expense)}
                          aria-label="سجّل الدفعة"
                        >
                          سجّل ←
                        </button>
                      )}
                    </div>

                    {/* شريط تقدم الأقساط */}
                    {totalInst > 0 && (
                      <div className="fin-quarterly__progress">
                        <div className="fin-quarterly__progress-bar">
                          <div
                            className="fin-quarterly__progress-fill"
                            style={{
                              width: `${progress}%`,
                              background: BUDGET_STATUS_COLORS.safe,
                            }}
                          />
                        </div>
                        <span className="fin-quarterly__progress-label">
                          {paidCount} من {totalInst} قسط ({progress}٪)
                          {remainingInst !== null && remainingInst > 0 && (
                            <span style={{ color: 'var(--text-muted)' }}>
                              {' — تبقى '}
                              {remainingInst}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </section>
      )}

      {/* ── توزيع الأقسام ─────────────────────────────────────────────────── */}
      {categoryTotals.length > 0 && (
        <section className="fin-quarterly__section">
          <h3 className="fin-section__title">💸 توزيع الإنفاق على الأقسام</h3>
          <div className="fin-quarterly__cats">
            {categoryTotals.map(({ category, actual }) => {
              const pct =
                summary.totalActual > 0 ? Math.round((actual / summary.totalActual) * 100) : 0;
              return (
                <div key={category.id} className="fin-quarterly__cat-row">
                  <div className="fin-quarterly__cat-info">
                    <span>
                      {category.icon} {category.name}
                    </span>
                    <span style={{ color: category.color }}>{formatAmount(actual, settings)}</span>
                  </div>
                  <div className="fin-budget-bar__track">
                    <div
                      className="fin-budget-bar__fill"
                      style={{
                        width: `${(actual / maxCatActual) * 100}%`,
                        background: category.color,
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                  <span className="fin-quarterly__cat-pct">{pct}٪</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── رؤى ربعية ────────────────────────────────────────────────────── */}
      {insights.length > 0 && (
        <section className="fin-quarterly__section">
          <h3 className="fin-section__title">🧠 رؤى ربعية</h3>
          <div className="fin-insights__list">
            {insights.map((ins, i) => {
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
        </section>
      )}

      {/* رسالة فارغة */}
      {summary.totalIncome === 0 && summary.totalActual === 0 && (
        <div className="fin-empty" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
          📭 لا توجد بيانات لهذا الربع بعد
        </div>
      )}
    </div>
  );
}
