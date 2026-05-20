import { handleFinance } from './_shared/finance.js';
import type { ApiRequest, ApiResponse } from './_shared/types.js';
import { financeResourceMap } from './_shared/finance/index.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const resource = req.query.resource as string;

  const finRes = financeResourceMap[resource];

  if (!finRes) {
    return res.status(400).json({ error: 'مورد غير معروف' });
  }

  return handleFinance(req, res, finRes);
}
