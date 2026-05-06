import type {
  Expense,
  Income,
  Transaction,
  ExpenseCategory,
  Goal,
  CategoryBudgetInfo,
  MonthlyFinanceSummary,
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
