import { handleFinance } from '../_shared/finance.ts';

export default async function handler(req: any, res: any) {
  const finRes = { table: 'finance_income', field: 'income' };
  return handleFinance(req, res, finRes);
}
