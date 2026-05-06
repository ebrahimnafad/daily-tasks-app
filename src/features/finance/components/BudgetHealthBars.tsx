import type { CategoryBudgetInfo, FinanceSettings } from '../types';
import { BUDGET_STATUS_COLORS, formatAmount } from '../utils';

interface BudgetHealthBarsProps {
  breakdown: CategoryBudgetInfo[];
  settings: FinanceSettings;
}

export default function BudgetHealthBars({ breakdown, settings }: BudgetHealthBarsProps) {
  const activeCats = breakdown.filter((c) => c.budget > 0 || c.actual > 0);

  if (activeCats.length === 0) return null;

  return (
    <section className="fin-budget-bars" aria-label="صحة الميزانية">
      <h3 className="fin-section__title" style={{ marginBottom: 'var(--space-md)' }}>
        📊 صحة الميزانية
      </h3>
      <div className="fin-budget-bars__list">
        {activeCats.map((info) => {
          const pct = Math.min(info.percentage, 150);
          const barWidth = Math.min(pct, 100);
          const overflowWidth = pct > 100 ? Math.min(pct - 100, 50) : 0;

          return (
            <div key={info.category.id} className="fin-budget-bar">
              <div className="fin-budget-bar__header">
                <span className="fin-budget-bar__name">
                  {info.category.icon} {info.category.name}
                </span>
                <span className="fin-budget-bar__values">
                  <span style={{ color: BUDGET_STATUS_COLORS[info.status] }}>
                    {formatAmount(info.actual, settings)}
                  </span>
                  {' / '}
                  {formatAmount(info.budget, settings)}
                </span>
              </div>
              <div className="fin-budget-bar__track">
                <div
                  className="fin-budget-bar__fill"
                  style={{
                    width: `${barWidth}%`,
                    background: BUDGET_STATUS_COLORS[info.status],
                    transition: 'width 0.5s ease',
                  }}
                />
                {overflowWidth > 0 && (
                  <div
                    className="fin-budget-bar__overflow"
                    style={{
                      width: `${overflowWidth}%`,
                      transition: 'width 0.5s ease',
                    }}
                  />
                )}
              </div>
              <div className="fin-budget-bar__pct">{info.percentage}٪</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
