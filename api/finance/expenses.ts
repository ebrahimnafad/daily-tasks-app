import { handleFinance } from '../_shared/finance.js';

export default async function handler(req: any, res: any) {
  const finRes = { table: 'finance_obligations', field: 'expenses' };
  return handleFinance(req, res, finRes);
}
