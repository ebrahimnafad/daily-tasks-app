import type {
  Expense,
  Income,
  Transaction,
  ExpenseCategory,
  Goal,
  CategoryBudgetInfo,
  MonthlyFinanceSummary,
  QuarterlyFinanceSummary,
  FinanceSettings,
} from './types';
import { CURRENCY_SYMBOLS } from './constants';

// ── تحويل التردد لمكافئ شهري ─────────────────────────────────────────────────
export function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly':
      return amount * 4.33;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'semi-annual':
      return amount / 6;
    case 'annual':
      return amount / 12;
    case 'one-time':
      return 0; // لا يُحتسب شهرياً
    default:
      return amount;
  }
}

// ── إجمالي الدخل الشهري ──────────────────────────────────────────────────────
export function calcTotalMonthlyIncome(incomes: Income[]): number {
  return incomes
    .filter((i) => i.isActive)
    .reduce((sum, i) => sum + toMonthlyAmount(i.amount, i.frequency), 0);
}

// ── حساب الفعلي لقسم في شهر معين ────────────────────────────────────────────
export function calcCategoryActual(
  categoryId: string,
  transactions: Transaction[],
  month: string // YYYY-MM
): number {
  return transactions
    .filter((t) => t.categoryId === categoryId && t.date.startsWith(month) && t.status === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);
}

// ── حساب الميزانية الشهرية لقسم (مع بنود غير شهرية) ──────────────────────────
export function calcCategoryMonthlyBudget(category: ExpenseCategory, expenses: Expense[]): number {
  // إذا حُددت ميزانية يدوياً، استخدمها
  if (category.monthlyBudget > 0) return category.monthlyBudget;

  // وإلا، اجمع المكافئ الشهري لكل بنود القسم
  return expenses
    .filter((e) => e.categoryId === category.id && e.isActive)
    .reduce((sum, e) => {
      if (e.type === 'seasonal' && e.monthlySetAside) {
        return sum + e.monthlySetAside;
      }
      return sum + toMonthlyAmount(e.amount, e.frequency);
    }, 0);
}

// ── حالة الميزانية ───────────────────────────────────────────────────────────
export function getBudgetStatus(percentage: number): 'safe' | 'warning' | 'danger' {
  if (percentage >= 100) return 'danger';
  if (percentage >= 80) return 'warning';
  return 'safe';
}

export const BUDGET_STATUS_COLORS = {
  safe: '#9bc87a',
  warning: '#e6a855',
  danger: '#d97e6a',
};

// ── ملخص شهري كامل ───────────────────────────────────────────────────────────
export function calcMonthlySummary(
  incomes: Income[],
  categories: ExpenseCategory[],
  expenses: Expense[],
  transactions: Transaction[],
  goals: Goal[],
  month: string
): MonthlyFinanceSummary {
  const totalIncome = calcTotalMonthlyIncome(incomes);

  const categoryBreakdown: CategoryBudgetInfo[] = categories
    .sort((a, b) => a.order - b.order)
    .map((cat) => {
      const catExpenses = expenses.filter((e) => e.categoryId === cat.id && e.isActive);
      const budget = calcCategoryMonthlyBudget(cat, expenses);
      const actual = calcCategoryActual(cat.id, transactions, month);
      const percentage = budget > 0 ? Math.round((actual / budget) * 100) : 0;

      return {
        category: cat,
        budget,
        actual,
        percentage,
        status: getBudgetStatus(percentage),
        expenses: catExpenses,
      };
    });

  const totalBudget = categoryBreakdown.reduce((s, c) => s + c.budget, 0);
  const totalActual = categoryBreakdown.reduce((s, c) => s + c.actual, 0);
  const totalGoalDeductions = goals
    .filter((g) => g.isActive)
    .reduce((s, g) => s + (g.monthlyTarget || 0), 0);

  const remaining = totalIncome - totalActual - totalGoalDeductions;
  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalIncome - totalBudget - totalGoalDeductions) / totalIncome) * 100)
      : 0;

  return {
    totalIncome,
    totalBudget,
    totalActual,
    totalGoalDeductions,
    remaining,
    savingsRate,
    categoryBreakdown,
  };
}

// ── تنسيق المبلغ ─────────────────────────────────────────────────────────────
export function formatAmount(amount: number, settings: FinanceSettings): string {
  const symbol = CURRENCY_SYMBOLS[settings.currency] || 'ر.س';
  const displayAmount =
    settings.currency === 'EGP' && settings.exchangeRate ? amount * settings.exchangeRate : amount;
  return `${Math.round(displayAmount).toLocaleString('ar-SA')} ${symbol}`;
}

// ── حساب الاقتطاع الشهري لهدف ────────────────────────────────────────────────
export function calcGoalMonthlyTarget(
  targetAmount: number,
  currentSaved: number,
  deadline: string | null | undefined
): number {
  if (!deadline) return 0;
  const now = new Date();
  const end = new Date(deadline);
  const monthsLeft = Math.max(
    1,
    Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  );
  return Math.ceil((targetAmount - currentSaved) / monthsLeft);
}

// ── الشهر الحالي كنص YYYY-MM ─────────────────────────────────────────────────
export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ── التنقل بين الأشهر ────────────────────────────────────────────────────────
export function shiftMonth(month: string, delta: number): string {
  const d = new Date(month + '-01');
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 7);
}

// ── تسمية الشهر بالعربي ──────────────────────────────────────────────────────
export function formatMonthLabel(month: string): string {
  const d = new Date(month + '-01');
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' });
}

// ── الربع السنوي الحالي ───────────────────────────────────────────────────────
export function getCurrentQuarter(): { year: number; quarter: 1 | 2 | 3 | 4 } {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const quarter = Math.ceil(month / 3) as 1 | 2 | 3 | 4;
  return { year: now.getFullYear(), quarter };
}

// ── أشهر ربع سنوي → ['YYYY-MM', 'YYYY-MM', 'YYYY-MM'] ────────────────────────
export function getQuarterMonths(year: number, quarter: 1 | 2 | 3 | 4): string[] {
  const startMonth = (quarter - 1) * 3 + 1; // 1, 4, 7, 10
  return [0, 1, 2].map((offset) => {
    const m = startMonth + offset;
    return `${year}-${String(m).padStart(2, '0')}`;
  });
}

// ── تسمية ربع سنوي بالعربي ───────────────────────────────────────────────────
export function formatQuarterLabel(year: number, quarter: 1 | 2 | 3 | 4): string {
  const names = ['الأول', 'الثاني', 'الثالث', 'الرابع'];
  const months = getQuarterMonths(year, quarter);
  const startLabel = new Date(months[0] + '-01').toLocaleDateString('ar-SA', { month: 'long' });
  const endLabel = new Date(months[2] + '-01').toLocaleDateString('ar-SA', { month: 'long' });
  return `الربع ${names[quarter - 1]} ${year} (${startLabel}–${endLabel})`;
}

// ── الانتقال بين الأرباع ─────────────────────────────────────────────────────
export function shiftQuarter(
  year: number,
  quarter: 1 | 2 | 3 | 4,
  delta: number
): { year: number; quarter: 1 | 2 | 3 | 4 } {
  let q = quarter - 1 + delta; // 0-indexed
  let y = year;
  while (q < 0) {
    q += 4;
    y -= 1;
  }
  while (q > 3) {
    q -= 4;
    y += 1;
  }
  return { year: y, quarter: (q + 1) as 1 | 2 | 3 | 4 };
}

// ── الشهر الفعلي للاستحقاق داخل الربع ────────────────────────────────────────
export function getQuarterlyDueMonth(
  expense: { quarterMonth?: 1 | 2 | 3 },
  quarterMonths: string[]
): string {
  const idx = (expense.quarterMonth ?? 1) - 1; // 0-indexed
  return quarterMonths[Math.min(idx, 2)];
}

// ── هل دُفع القسط الربعي في هذا الربع؟ ──────────────────────────────────────
export function isQuarterlyExpensePaid(
  expense: { id: string },
  transactions: Transaction[],
  quarterMonths: string[]
): { isPaid: boolean; paidAmount: number } {
  const paid = transactions.filter(
    (t) =>
      t.expenseId === expense.id &&
      t.status === 'paid' &&
      quarterMonths.some((m) => t.date.startsWith(m))
  );
  const paidAmount = paid.reduce((s, t) => s + t.amount, 0);
  return { isPaid: paid.length > 0, paidAmount };
}

// ── ملخص ربع سنوي كامل ───────────────────────────────────────────────────────
export function calcQuarterlySummary(
  incomes: Income[],
  categories: ExpenseCategory[],
  expenses: Expense[],
  transactions: Transaction[],
  goals: Goal[],
  year: number,
  quarter: 1 | 2 | 3 | 4
): QuarterlyFinanceSummary {
  const quarterMonths = getQuarterMonths(year, quarter);

  // ملخص كل شهر
  const monthlyBreakdown = quarterMonths.map((month) => {
    const s = calcMonthlySummary(incomes, categories, expenses, transactions, goals, month);
    return {
      month,
      label: formatMonthLabel(month),
      shortLabel: new Date(month + '-01').toLocaleDateString('ar-SA', { month: 'long' }),
      income: s.totalIncome,
      expense: s.totalActual,
      remaining: s.remaining,
    };
  });

  // إجماليات الربع
  const totalActual = monthlyBreakdown.reduce((s, m) => s + m.expense, 0);
  const totalBudget = monthlyBreakdown[0].income * 3; // الميزانية الربعية = الشهرية × 3 تقريباً
  const totalGoalDeductions =
    goals.filter((g) => g.isActive).reduce((s, g) => s + (g.monthlyTarget || 0), 0) * 3;

  // حساب الإجمالي الدقيق للدخل الربعي
  const totalIncomeQuarterly = monthlyBreakdown.reduce((s, m) => s + m.income, 0);
  const remaining = totalIncomeQuarterly - totalActual - totalGoalDeductions;
  const savingsRate =
    totalIncomeQuarterly > 0
      ? Math.round(
          ((totalIncomeQuarterly - totalActual - totalGoalDeductions) / totalIncomeQuarterly) * 100
        )
      : 0;

  // الالتزامات الربعية: كل مصروف تكراره quarterly
  const quarterlyObligations = expenses
    .filter((e) => e.isActive && e.frequency === 'quarterly')
    .map((e) => {
      const { isPaid, paidAmount } = isQuarterlyExpensePaid(e, transactions, quarterMonths);
      const paidCount = transactions.filter(
        (t) => t.expenseId === e.id && t.status === 'paid'
      ).length;
      const dueMonth = getQuarterlyDueMonth(e, quarterMonths);
      return { expense: e, isPaid, paidAmount, paidCount, dueMonth };
    });

  return {
    totalIncome: totalIncomeQuarterly,
    totalActual,
    totalBudget,
    totalGoalDeductions,
    remaining,
    savingsRate,
    monthlyBreakdown,
    quarterlyObligations,
  };
}
