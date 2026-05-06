// ── أقسام المصروفات ─────────────────────────────────────────────────────────
export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  monthlyBudget: number;
  isCustom: boolean;
  order: number;
}

// ── بند مصروف ────────────────────────────────────────────────────────────────
export type ExpenseFrequency =
  | 'monthly'
  | 'weekly'
  | 'quarterly'
  | 'semi-annual'
  | 'annual'
  | 'one-time';

export type ExpenseType = 'fixed' | 'variable' | 'installment' | 'seasonal';

export interface Expense {
  id: string;
  categoryId: string;
  title: string;
  icon: string;
  amount: number;
  frequency: ExpenseFrequency;
  type: ExpenseType;
  isActive: boolean;
  dueDay?: number;
  // حقول الأقساط
  totalAmount?: number;
  totalInstallments?: number;
  endDate?: string;
  // حقول الموسمي
  seasonMonth?: number;
  monthlySetAside?: number;
  notes?: string;
}

// ── معاملة مالية ─────────────────────────────────────────────────────────────
export interface Transaction {
  id: string;
  expenseId: string;
  categoryId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  status: 'paid' | 'pending';
  notes?: string;
}

// ── مصدر دخل ─────────────────────────────────────────────────────────────────
export interface Income {
  id: string;
  title: string;
  icon: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  type: 'fixed' | 'variable';
  isActive: boolean;
  notes?: string;
}

// ── هدف ادخاري ───────────────────────────────────────────────────────────────
export interface Goal {
  id: string;
  title: string;
  icon: string;
  targetAmount: number;
  currentSaved: number;
  deadline?: string | null;
  monthlyTarget: number;
  isActive: boolean;
  notes?: string;
}

// ── إعدادات المالية ──────────────────────────────────────────────────────────
export interface FinanceSettings {
  currency: 'SAR' | 'EGP';
  exchangeRate?: number; // سعر التحويل الاختياري SAR → EGP
  showExchangeRate: boolean;
}

// ── حالات الواجهة ────────────────────────────────────────────────────────────
export type FinanceView = 'monthly' | 'annual';

export interface ExpenseModalState {
  mode: 'add' | 'edit';
  categoryId: string;
  data?: Expense;
}

export interface CategoryModalState {
  mode: 'add' | 'edit';
  data?: ExpenseCategory;
}

export interface TransactionDrawerState {
  mode: 'register' | 'view';
  expense: Expense;
}

// ── حسابات الميزانية ─────────────────────────────────────────────────────────
export interface CategoryBudgetInfo {
  category: ExpenseCategory;
  budget: number;
  actual: number;
  percentage: number;
  status: 'safe' | 'warning' | 'danger';
  expenses: Expense[];
}

export interface MonthlyFinanceSummary {
  totalIncome: number;
  totalBudget: number;
  totalActual: number;
  totalGoalDeductions: number;
  remaining: number;
  savingsRate: number;
  categoryBreakdown: CategoryBudgetInfo[];
}
