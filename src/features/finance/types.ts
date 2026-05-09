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

export type ExpenseType = 'fixed' | 'installment' | 'seasonal';

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
  quarterMonth?: 1 | 2 | 3; // أي شهر من الربع يُستحق فيه الدفع (1=أول، 2=ثاني، 3=ثالث)
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
  expenseId?: string;
  categoryId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  status: 'paid' | 'pending';
  notes?: string;
  currencySymbol?: string;
  exchangeRate?: number;
  originalAmount?: number;
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

export interface FinanceSettings {
  currencySymbol: string;
  showSecondaryCurrency: boolean;
  secondaryCurrencySymbol: string;
  exchangeRate?: number;
}

// ── حالات الواجهة ────────────────────────────────────────────────────────────
export type FinanceView = 'monthly' | 'quarterly' | 'annual';

export interface ExpenseModalState {
  mode: 'add' | 'edit';
  categoryId: string;
  data?: Expense;
}

export interface CategoryModalState {
  mode: 'add' | 'edit';
  data?: ExpenseCategory;
}

export type TransactionDrawerState =
  | { mode: 'register' | 'view'; expense: Expense; expenseType: ExpenseType }
  | { mode: 'register-category' | 'view-category'; category: ExpenseCategory };

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

// ── ملخص ربع سنوي ────────────────────────────────────────────────────────────
export interface QuarterlyFinanceSummary {
  totalIncome: number;
  totalActual: number;
  totalBudget: number;
  totalGoalDeductions: number;
  remaining: number;
  savingsRate: number;
  monthlyBreakdown: Array<{
    month: string;
    label: string;
    shortLabel: string;
    income: number;
    expense: number;
    remaining: number;
  }>;
  quarterlyObligations: Array<{
    expense: Expense;
    isPaid: boolean;
    paidAmount: number;
    paidCount: number; // عدد الأقساط المدفوعة إجمالاً حتى الآن
    dueMonth: string; // YYYY-MM شهر الاستحقاق في هذا الربع
  }>;
}
