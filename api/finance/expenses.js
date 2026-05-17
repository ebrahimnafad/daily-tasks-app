import { handleFinance } from '../_shared/finance.js';

export default async function handler(req, res) {
  const finRes = { table: 'finance_obligations', field: 'expenses' };
  return handleFinance(req, res, finRes);
}
