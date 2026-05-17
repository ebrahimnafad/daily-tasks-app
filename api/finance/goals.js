import { handleFinance } from '../_shared/finance.js';

export default async function handler(req, res) {
  const finRes = { table: 'finance_goals', field: 'goals' };
  return handleFinance(req, res, finRes);
}
