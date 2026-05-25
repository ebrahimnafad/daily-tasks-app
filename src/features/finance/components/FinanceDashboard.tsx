import { useMemo } from 'react';
import FinanceChart from './FinanceChart';
import type { MonthlyFinanceSummary, FinanceSettings } from '../types';
import { formatAmount } from '../utils';
import './FinanceDashboard.css';

interface FinanceDashboardProps {
  summary: MonthlyFinanceSummary;
  settings: FinanceSettings;
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export default function FinanceDashboard({
  summary,
  settings,
  monthLabel,
  onPrevMonth,
  onNextMonth,
}: FinanceDashboardProps) {
  // Outer ring: budget allocation (plan)
  const chartSegments = useMemo(() => {
    const cats = summary.categoryBreakdown
      .filter((c) => c.budget > 0)
      .map((c) => ({
        id: c.category.id,
        label: c.category.name,
        value: c.budget,
        color: c.category.color,
      }));

    const totalCatBudget = cats.reduce((s, c) => s + c.value, 0);
    const goalDeductions = summary.totalGoalDeductions;
    const remaining = summary.totalIncome - totalCatBudget - goalDeductions;

    if (goalDeductions > 0) {
      cats.push({ id: '_goals', label: 'ادخار', value: goalDeductions, color: '#6e9fcf' });
    }
    if (remaining > 0) {
      cats.push({
        id: '_remaining',
        label: 'متاح',
        value: remaining,
        color: 'rgba(155,200,122,0.3)',
      });
    }
    return cats;
  }, [summary]);

  // Inner ring: actual spending this month (proportional to income)
  const actualSegments = useMemo(() => {
    const cats = summary.categoryBreakdown
      .filter((c) => c.actual > 0)
      .map((c) => ({
        id: c.category.id,
        label: c.category.name,
        value: c.actual,
        color: c.category.color,
      }));

    // Add transparent "unspent" so the ring is proportional to income
    const totalActual = cats.reduce((s, c) => s + c.value, 0);
    const unspent = summary.totalIncome - totalActual;
    if (unspent > 0) {
      cats.push({
        id: '_unspent',
        label: 'غير مصروف',
        value: unspent,
        color: 'rgba(255,255,255,0.06)',
      });
    }

    return cats;
  }, [summary]);

  const surplus = summary.totalIncome - summary.totalBudget - summary.totalGoalDeductions;

  return (
    <section className="fin-dashboard" aria-label="ملخص الشهر المالي">
      <div className="fin-dashboard__header">
        <button className="fin-summary__nav" onClick={onNextMonth} aria-label="الشهر التالي">
          ◄
        </button>
        <h2 className="fin-dashboard__month">📊 {monthLabel}</h2>
        <button className="fin-summary__nav" onClick={onPrevMonth} aria-label="الشهر السابق">
          ►
        </button>
      </div>

      <FinanceChart
        segments={chartSegments}
        actualSegments={summary.totalActual > 0 ? actualSegments : undefined}
        centerValue={`${summary.savingsRate > 0 ? summary.savingsRate : 0}٪`}
        centerLabel="معدل الادخار"
      />

      {/* Stats grid */}
      <div className="fin-dashboard__grid">
        <div className="fin-dashboard__stat">
          <span className="fin-dashboard__stat-label">الدخل الشهري</span>
          <span className="fin-dashboard__stat-value" style={{ color: '#9bc87a' }}>
            {formatAmount(summary.totalIncome, settings)}
          </span>
        </div>
        <div className="fin-dashboard__stat">
          <span className="fin-dashboard__stat-label">المتبقي</span>
          <span
            className="fin-dashboard__stat-value"
            style={{ color: summary.remaining >= 0 ? '#9bc87a' : '#d97e6a' }}
          >
            {formatAmount(summary.remaining, settings)}
          </span>
        </div>
        <div className="fin-dashboard__stat">
          <span className="fin-dashboard__stat-label">المصروف الفعلي</span>
          <span className="fin-dashboard__stat-value" style={{ color: '#d97e6a' }}>
            {formatAmount(summary.totalActual, settings)}
          </span>
        </div>
        <div className="fin-dashboard__stat">
          <span className="fin-dashboard__stat-label">إجمالي الميزانية</span>
          <span className="fin-dashboard__stat-value" style={{ color: '#e6a855' }}>
            {formatAmount(summary.totalBudget, settings)}
          </span>
        </div>
      </div>

      {/* Surplus / Deficit alert */}
      {summary.totalBudget > 0 && (
        <div
          className={`fin-dashboard__alert ${surplus >= 0 ? 'fin-dashboard__alert--surplus' : 'fin-dashboard__alert--deficit'}`}
        >
          {surplus >= 0
            ? `✅ فائض متوقع: ${formatAmount(surplus, settings)}`
            : `⚠️ عجز متوقع: ${formatAmount(Math.abs(surplus), settings)}`}
          {summary.totalGoalDeductions > 0 && (
            <span className="fin-dashboard__alert-sub">
              (شامل {formatAmount(summary.totalGoalDeductions, settings)} أهداف)
            </span>
          )}
        </div>
      )}
    </section>
  );
}
