import { handleFinance } from '../_shared/finance.js';

export default async function handler(req, res) {
  const finRes = { table: 'finance_payments', field: 'transactions' };
  return handleFinance(req, res, finRes);
}
