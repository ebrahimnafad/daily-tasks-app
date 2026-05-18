import { handleFinance } from '../_shared/finance.js';
import type { ApiRequest, ApiResponse } from '../_shared/types.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const finRes = { table: 'finance_income', field: 'income' };
  return handleFinance(req, res, finRes);
}
