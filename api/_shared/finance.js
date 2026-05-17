/* eslint-env node */
import { neon } from '@neondatabase/serverless';
import { applyRateLimit } from '../middleware/rateLimit.js';
import { setCorsHeaders } from './cors.js';
import { requireAuth } from './auth.js';
import { z } from 'zod';
import { 
  IncomeSchema, 
  ExpenseSchema, 
  TransactionSchema, 
  GoalSchema, 
  ExpenseCategorySchema 
} from '../../src/validation/schemas.ts';

export async function handleFinance(req, res, finRes) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rateLimit = applyRateLimit(req, finRes.field, 'general');
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: rateLimit.message });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'DATABASE_URL غير مضبوط. فعّل Neon في Vercel Dashboard.' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { method } = req;

  try {
    const authPayload = await requireAuth(req, res);
    if (!authPayload) return;

    if (method === 'GET') {
      let rows;
      switch (finRes.table) {
        case 'finance_income':
          rows = await sql`SELECT data, updated_at FROM finance_income WHERE id = 1`;
          break;
        case 'finance_obligations':
          rows = await sql`SELECT data, updated_at FROM finance_obligations WHERE id = 1`;
          break;
        case 'finance_payments':
          rows = await sql`SELECT data, updated_at FROM finance_payments WHERE id = 1`;
          break;
        case 'finance_goals':
          rows = await sql`SELECT data, updated_at FROM finance_goals WHERE id = 1`;
          break;
        case 'finance_categories':
          rows = await sql`SELECT data, updated_at FROM finance_categories_legacy WHERE id = 1`; // if categories exist
          break;
        default:
          return res.status(400).json({ error: `جدول غير معروف: ${finRes.table}` });
      }
      return res.status(200).json({
        [finRes.field]: rows[0]?.data ?? [],
        updatedAt: rows[0]?.updated_at ?? null,
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const rawData = body[finRes.field];
      
      let parsedData;
      switch (finRes.table) {
        case 'finance_income':
          parsedData = z.array(IncomeSchema.passthrough()).safeParse(rawData);
          break;
        case 'finance_obligations':
          parsedData = z.array(ExpenseSchema.passthrough()).safeParse(rawData);
          break;
        case 'finance_payments':
          parsedData = z.array(TransactionSchema.passthrough()).safeParse(rawData);
          break;
        case 'finance_goals':
          parsedData = z.array(GoalSchema.passthrough()).safeParse(rawData);
          break;
        case 'finance_categories':
          parsedData = z.array(ExpenseCategorySchema.passthrough()).safeParse(rawData);
          break;
        default:
          return res.status(400).json({ error: `جدول غير معروف: ${finRes.table}` });
      }

      if (!parsedData.success) {
        return res.status(400).json({ error: 'البيانات غير صالحة', details: parsedData.error.issues });
      }
      
      const data = parsedData.data;

      if (data.length > 1000) {
        return res.status(400).json({ error: 'تجاوز الحد المسموح (1000 عنصر)' });
      }
      const jsonData = JSON.stringify(data);

      switch (finRes.table) {
        case 'finance_income':
          await sql`INSERT INTO finance_income (id, data, updated_at) VALUES (1, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
          break;
        case 'finance_obligations':
          await sql`INSERT INTO finance_obligations (id, data, updated_at) VALUES (1, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
          break;
        case 'finance_payments':
          await sql`INSERT INTO finance_payments (id, data, updated_at) VALUES (1, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
          break;
        case 'finance_goals':
          await sql`INSERT INTO finance_goals (id, data, updated_at) VALUES (1, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
          break;
        case 'finance_categories':
          await sql`INSERT INTO finance_categories_legacy (id, data, updated_at) VALUES (1, ${jsonData}::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
          break;
        default:
          return res.status(400).json({ error: `جدول غير معروف: ${finRes.table}` });
      }

      // 2. Relational Dual-Write (Silent fallback)
      const userId = authPayload.userId;
      if (userId) {
        try {
          await sql.begin(async (t) => {
            const itemIds = data.map((d) => d.id).filter((id) => id != null);

            if (finRes.table === 'finance_income') {
              if (itemIds.length > 0) await t`DELETE FROM finance_incomes WHERE user_id = ${userId} AND id != ALL(${itemIds})`;
              else await t`DELETE FROM finance_incomes WHERE user_id = ${userId}`;

              for (const item of data) {
                if (!item.id) continue;
                await t`
                  INSERT INTO finance_incomes (
                    id, user_id, title, icon, amount, frequency, income_type, is_active, notes, created_at, updated_at
                  ) VALUES (
                    ${item.id}, ${userId}, ${item.title || ''}, ${item.icon || null}, ${item.amount || 0}, ${item.frequency || null}, ${item.type || null}, ${item.isActive ?? true}, ${item.notes || null}, ${item.createdAt || new Date().toISOString()}, ${item.updatedAt || new Date().toISOString()}
                  ) ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    icon = EXCLUDED.icon,
                    amount = EXCLUDED.amount,
                    frequency = EXCLUDED.frequency,
                    income_type = EXCLUDED.income_type,
                    is_active = EXCLUDED.is_active,
                    notes = EXCLUDED.notes,
                    updated_at = NOW()
                `;
              }
            } else if (finRes.table === 'finance_obligations') {
              if (itemIds.length > 0) await t`DELETE FROM finance_expenses WHERE user_id = ${userId} AND id != ALL(${itemIds})`;
              else await t`DELETE FROM finance_expenses WHERE user_id = ${userId}`;

              for (const item of data) {
                if (!item.id) continue;
                await t`
                  INSERT INTO finance_expenses (
                    id, user_id, category_id, title, icon, amount, frequency, expense_type, is_active, due_day, quarter_month, total_amount, total_installments, end_date, season_month, monthly_set_aside, notes, created_at, updated_at
                  ) VALUES (
                    ${item.id}, ${userId}, ${item.categoryId || null}, ${item.title || ''}, ${item.icon || null}, ${item.amount || 0}, ${item.frequency || null}, ${item.type || null}, ${item.isActive ?? true}, ${item.dueDay || null}, ${item.quarterMonth || null}, ${item.totalAmount || null}, ${item.totalInstallments || null}, ${item.endDate || null}, ${item.seasonMonth || null}, ${item.monthlySetAside || null}, ${item.notes || null}, ${item.createdAt || new Date().toISOString()}, ${item.updatedAt || new Date().toISOString()}
                  ) ON CONFLICT (id) DO UPDATE SET
                    category_id = EXCLUDED.category_id,
                    title = EXCLUDED.title,
                    icon = EXCLUDED.icon,
                    amount = EXCLUDED.amount,
                    frequency = EXCLUDED.frequency,
                    expense_type = EXCLUDED.expense_type,
                    is_active = EXCLUDED.is_active,
                    due_day = EXCLUDED.due_day,
                    quarter_month = EXCLUDED.quarter_month,
                    total_amount = EXCLUDED.total_amount,
                    total_installments = EXCLUDED.total_installments,
                    end_date = EXCLUDED.end_date,
                    season_month = EXCLUDED.season_month,
                    monthly_set_aside = EXCLUDED.monthly_set_aside,
                    notes = EXCLUDED.notes,
                    updated_at = NOW()
                `;
              }
            } else if (finRes.table === 'finance_payments') {
              if (itemIds.length > 0) await t`DELETE FROM finance_transactions WHERE user_id = ${userId} AND id != ALL(${itemIds})`;
              else await t`DELETE FROM finance_transactions WHERE user_id = ${userId}`;

              for (const item of data) {
                if (!item.id || !item.categoryId) continue; 
                await t`
                  INSERT INTO finance_transactions (
                    id, user_id, expense_id, category_id, amount, transaction_date, status, notes, currency_symbol, exchange_rate, original_amount, created_at, updated_at
                  ) VALUES (
                    ${item.id}, ${userId}, ${item.expenseId || null}, ${item.categoryId}, ${item.amount || 0}, ${item.date || new Date().toISOString()}, ${item.status || null}, ${item.notes || null}, ${item.currencySymbol || null}, ${item.exchangeRate || null}, ${item.originalAmount || null}, ${item.createdAt || new Date().toISOString()}, ${item.updatedAt || new Date().toISOString()}
                  ) ON CONFLICT (id) DO UPDATE SET
                    expense_id = EXCLUDED.expense_id,
                    category_id = EXCLUDED.category_id,
                    amount = EXCLUDED.amount,
                    transaction_date = EXCLUDED.transaction_date,
                    status = EXCLUDED.status,
                    notes = EXCLUDED.notes,
                    currency_symbol = EXCLUDED.currency_symbol,
                    exchange_rate = EXCLUDED.exchange_rate,
                    original_amount = EXCLUDED.original_amount,
                    updated_at = NOW()
                `;
              }
            } else if (finRes.table === 'finance_goals') {
              if (itemIds.length > 0) await t`DELETE FROM finance_goals_rel WHERE user_id = ${userId} AND id != ALL(${itemIds})`;
              else await t`DELETE FROM finance_goals_rel WHERE user_id = ${userId}`;

              for (const item of data) {
                if (!item.id) continue;
                await t`
                  INSERT INTO finance_goals_rel (
                    id, user_id, title, icon, target_amount, current_saved, deadline, monthly_target, is_active, notes, created_at, updated_at
                  ) VALUES (
                    ${item.id}, ${userId}, ${item.title || ''}, ${item.icon || null}, ${item.targetAmount || 0}, ${item.currentSaved || 0}, ${item.deadline || null}, ${item.monthlyTarget || null}, ${item.isActive ?? true}, ${item.notes || null}, ${item.createdAt || new Date().toISOString()}, ${item.updatedAt || new Date().toISOString()}
                  ) ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    icon = EXCLUDED.icon,
                    target_amount = EXCLUDED.target_amount,
                    current_saved = EXCLUDED.current_saved,
                    deadline = EXCLUDED.deadline,
                    monthly_target = EXCLUDED.monthly_target,
                    is_active = EXCLUDED.is_active,
                    notes = EXCLUDED.notes,
                    updated_at = NOW()
                `;
              }
            } else if (finRes.table === 'finance_categories') {
              if (itemIds.length > 0) await t`DELETE FROM finance_categories WHERE user_id = ${userId} AND id != ALL(${itemIds})`;
              else await t`DELETE FROM finance_categories WHERE user_id = ${userId}`;

              for (const item of data) {
                if (!item.id) continue;
                await t`
                  INSERT INTO finance_categories (
                    id, user_id, title, icon, color, type, is_active, parent_id, sort_order, created_at, updated_at
                  ) VALUES (
                    ${item.id}, ${userId}, ${item.title || ''}, ${item.icon || null}, ${item.color || null}, ${item.type || null}, ${item.isActive ?? true}, ${item.parentId || null}, ${item.sortOrder || 0}, ${item.createdAt || new Date().toISOString()}, ${item.updatedAt || new Date().toISOString()}
                  ) ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    icon = EXCLUDED.icon,
                    color = EXCLUDED.color,
                    type = EXCLUDED.type,
                    is_active = EXCLUDED.is_active,
                    parent_id = EXCLUDED.parent_id,
                    sort_order = EXCLUDED.sort_order,
                    updated_at = NOW()
                `;
              }
            }
          });
        } catch (err) {
          console.error(`Dual-write error for ${finRes.table}:`, err);
        }
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error) {
    console.error(`Finance Error (${finRes.table}):`, error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
