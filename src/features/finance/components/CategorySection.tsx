import { useState, useMemo } from 'react';
import type { Expense, ExpenseCategory, Transaction, FinanceSettings } from '../types';
import { FREQUENCY_LABELS } from '../constants';
import { toMonthlyAmount, formatAmount } from '../utils';

interface CategorySectionProps {
  category: ExpenseCategory;
  expenses: Expense[];
  transactions: Transaction[];
  month: string;
  settings: FinanceSettings;
  onAddExpense: (categoryId: string) => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onRegisterTx: (expense: Expense) => void;
  onViewTxs: (expense: Expense) => void;
  onEditCategory: (cat: ExpenseCategory) => void;
  onAddCategoryTx: (cat: ExpenseCategory) => void;
  onViewCategoryTxs: (cat: ExpenseCategory) => void;
  onSetBudget: (catId: string, budget: number) => void;
}

export default function CategorySection({
  category,
  expenses,
  transactions,
  month,
  settings,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  onRegisterTx,
  onViewTxs,
  onEditCategory,
  onAddCategoryTx,
  onViewCategoryTxs,
}: CategorySectionProps) {
  const [expanded, setExpanded] = useState(false);

  const catExpenses = useMemo(
    () => expenses.filter((e) => e.categoryId === category.id),
    [expenses, category.id]
  );

  const monthlyTotal = useMemo(
    () =>
      catExpenses
        .filter((e) => e.isActive)
        .reduce((sum, e) => {
          if (e.type === 'seasonal' && e.monthlySetAside) return sum + e.monthlySetAside;
          return sum + toMonthlyAmount(e.amount, e.frequency);
        }, 0),
    [catExpenses]
  );

  const actualSpent = useMemo(
    () =>
      transactions
        .filter(
          (t) => t.categoryId === category.id && t.date.startsWith(month) && t.status === 'paid'
        )
        .reduce((s, t) => s + t.amount, 0),
    [transactions, category.id, month]
  );

  const directTxCount = useMemo(
    () =>
      transactions.filter(
        (t) => t.categoryId === category.id && !t.expenseId && t.date.startsWith(month)
      ).length,
    [transactions, category.id, month]
  );

  const budget = category.monthlyBudget > 0 ? category.monthlyBudget : monthlyTotal;
  const pct = budget > 0 ? Math.round((actualSpent / budget) * 100) : 0;
  const statusColor = pct >= 100 ? '#d97e6a' : pct >= 80 ? '#e6a855' : '#9bc87a';

  return (
    <section className="fin-cat" style={{ '--cat-color': category.color } as React.CSSProperties}>
      {/* Collapsible header */}
      <button
        className="fin-cat__header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="fin-cat__header-main">
          <span className="fin-cat__icon">{category.icon}</span>
          <div className="fin-cat__info">
            <span className="fin-cat__name">{category.name}</span>
            <span className="fin-cat__count">{catExpenses.length} بند</span>
          </div>
        </div>
        <div className="fin-cat__header-stats">
          <div className="fin-cat__amounts">
            <span style={{ color: statusColor }}>{formatAmount(actualSpent, settings)}</span>
            {budget > 0 && (
              <span className="fin-cat__budget-label">/ {formatAmount(budget, settings)}</span>
            )}
          </div>
          {budget > 0 && (
            <>
              <div className="fin-cat__bar">
                <div
                  className="fin-cat__bar-fill"
                  style={{ width: `${Math.min(pct, 100)}%`, background: statusColor }}
                />
                {pct > 100 && (
                  <div
                    className="fin-cat__bar-overflow"
                    style={{ width: `${Math.min(pct - 100, 50)}%` }}
                  />
                )}
              </div>
              <span className="fin-cat__pct" style={{ color: statusColor }}>
                {pct}٪
              </span>
            </>
          )}
        </div>
        <span className={`fin-cat__chevron ${expanded ? 'fin-cat__chevron--open' : ''}`}>▼</span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="fin-cat__body">
          {/* Edit category button */}
          <div className="fin-cat__actions-row" style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button
              className="fin-btn-secondary fin-btn-sm"
              onClick={() => onAddCategoryTx(category)}
            >
              📝 فاتورة مباشرة
            </button>
            <button className="fin-btn-sm" onClick={() => onViewCategoryTxs(category)}>
              📋 السجل{directTxCount > 0 ? ` (${directTxCount})` : ''}
            </button>
            <button
              className="fin-btn-sm"
              onClick={() => onEditCategory(category)}
              style={{ marginInlineStart: 'auto' }}
            >
              ⚙️
            </button>
          </div>

          {catExpenses.length === 0 && (
            <div className="fin-empty" style={{ marginBottom: 'var(--space-md)' }}>
              لا توجد بنود في هذا القسم
            </div>
          )}

          {catExpenses.map((exp) => {
            const expTxCount = transactions.filter(
              (t) => t.expenseId === exp.id && t.status === 'paid'
            ).length;
            const monthTxs = transactions.filter(
              (t) => t.expenseId === exp.id && t.date.startsWith(month) && t.status === 'paid'
            );
            const monthPaid = monthTxs.reduce((s, t) => s + t.amount, 0);

            return (
              <div key={exp.id} className={`fin-exp ${!exp.isActive ? 'fin-exp--disabled' : ''}`}>
                <div className="fin-exp__main">
                  <span className="fin-exp__icon">{exp.icon}</span>
                  <div className="fin-exp__info">
                    <div className="fin-exp__title">{exp.title}</div>
                    <div className="fin-exp__meta">
                      {FREQUENCY_LABELS[exp.frequency] || exp.frequency}
                      {exp.type === 'installment' && ` · قسط`}
                      {exp.type === 'seasonal' && ' · موسمي'}
                    </div>
                  </div>
                  <div className="fin-exp__amount-col">
                    <span className="fin-exp__amount">{formatAmount(exp.amount, settings)}</span>
                    {monthPaid > 0 && (
                      <span className="fin-exp__paid">
                        مدفوع: {formatAmount(monthPaid, settings)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="fin-exp__actions">
                  <button
                    className="fin-btn-sm"
                    onClick={() => onRegisterTx(exp)}
                    aria-label="تسجيل دفعة"
                  >
                    ✅
                  </button>
                  <button className="fin-btn-sm" onClick={() => onViewTxs(exp)} aria-label="السجل">
                    📎 {expTxCount > 0 && `(${expTxCount})`}
                  </button>
                  <button
                    className="fin-btn-sm"
                    onClick={() => onEditExpense(exp)}
                    aria-label="تعديل"
                  >
                    ✏️
                  </button>
                  <button
                    className="fin-btn-sm"
                    onClick={() => {
                      if (window.confirm('حذف هذا البند؟')) onDeleteExpense(exp.id);
                    }}
                    aria-label="حذف"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}

          <button className="fin-add-btn" onClick={() => onAddExpense(category.id)}>
            ＋ إضافة بند
          </button>
        </div>
      )}
    </section>
  );
}
