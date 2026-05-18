import { handleFinance } from './_shared/finance.js';
import type { ApiRequest, ApiResponse } from './_shared/types.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const resource = req.query.resource as string;

  const map: Record<string, { table: string; field: string }> = {
    income: { table: 'finance_income', field: 'income' },
    categories: { table: 'finance_categories', field: 'categories' },
    expenses: { table: 'finance_obligations', field: 'expenses' },
    transactions: { table: 'finance_payments', field: 'transactions' },
    goals: { table: 'finance_goals', field: 'goals' },
  };

  const finRes = map[resource];

  if (!finRes) {
    return res.status(400).json({ error: 'مورد غير معروف' });
  }

  return handleFinance(req, res, finRes);
}
