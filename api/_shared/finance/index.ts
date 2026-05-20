import { incomeHandler } from './income.js';
import { categoriesHandler } from './categories.js';
import { expensesHandler } from './expenses.js';
import { transactionsHandler } from './transactions.js';
import { goalsHandler } from './goals.js';
import type { FinanceResourceHandler } from './types.js';

export const financeResourceMap: Record<string, FinanceResourceHandler> = {
  income: incomeHandler,
  categories: categoriesHandler,
  expenses: expensesHandler,
  transactions: transactionsHandler,
  goals: goalsHandler,
};
