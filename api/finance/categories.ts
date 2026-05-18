import { handleFinance } from '../_shared/finance.js';
import type { ApiRequest, ApiResponse } from '../_shared/types.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const finRes = { table: 'finance_categories', field: 'categories' };
  return handleFinance(req, res, finRes);
}
