import { applyRateLimit } from '../middleware/rateLimit.js';
import { setCorsHeaders } from './cors.js';
import { requireAuth } from './auth.js';
import { z } from 'zod';
import { db } from './db.js';
import {
  financeIncomes,
  financeExpenses,
  financeTransactions,
  financeGoalsRel,
  financeCategories,
} from '../../src/db/schema.js';
import { eq, notInArray, and } from 'drizzle-orm';
import {
  IncomeSchema,
  ExpenseSchema,
  TransactionSchema,
  GoalSchema,
  ExpenseCategorySchema,
} from '../../src/validation/schemas.js';

interface FinRes {
  table: string;
  field: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleFinance(req: any, res: any, finRes: FinRes) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rateLimit = applyRateLimit(req, finRes.field, 'general');
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: rateLimit.message });
  }

  const { method } = req;

  try {
    const authPayload = await requireAuth(req, res);
    if (!authPayload) return;
    const userId = authPayload.userId;

    if (method === 'GET') {
      let data: Record<string, unknown>[] = [];

      switch (finRes.table) {
        case 'finance_income': {
          const rows = await db
            .select()
            .from(financeIncomes)
            .where(eq(financeIncomes.userId, userId));
          data = rows.map((r: typeof financeIncomes.$inferSelect) => ({
            id: r.id,
            title: r.title,
            icon: r.icon,
            amount: r.amount,
            frequency: r.frequency,
            type: r.incomeType,
            isActive: r.isActive,
            notes: r.notes,
            createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: r.updatedAt?.toISOString() || new Date().toISOString(),
          }));
          break;
        }
        case 'finance_obligations': {
          const rows = await db
            .select()
            .from(financeExpenses)
            .where(eq(financeExpenses.userId, userId));
          data = rows.map((r: typeof financeExpenses.$inferSelect) => ({
            id: r.id,
            categoryId: r.categoryId,
            title: r.title,
            icon: r.icon,
            amount: r.amount,
            frequency: r.frequency,
            type: r.expenseType,
            isActive: r.isActive,
            dueDay: r.dueDay,
            quarterMonth: r.quarterMonth,
            totalAmount: r.totalAmount,
            totalInstallments: r.totalInstallments,
            endDate: r.endDate,
            seasonMonth: r.seasonMonth,
            monthlySetAside: r.monthlySetAside,
            notes: r.notes,
            createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: r.updatedAt?.toISOString() || new Date().toISOString(),
          }));
          break;
        }
        case 'finance_payments': {
          const rows = await db
            .select()
            .from(financeTransactions)
            .where(eq(financeTransactions.userId, userId));
          data = rows.map((r: typeof financeTransactions.$inferSelect) => ({
            id: r.id,
            expenseId: r.expenseId,
            categoryId: r.categoryId,
            amount: r.amount,
            date: r.transactionDate?.toISOString() || new Date().toISOString(),
            status: r.status,
            notes: r.notes,
            currencySymbol: r.currencySymbol,
            exchangeRate: r.exchangeRate,
            originalAmount: r.originalAmount,
            createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: r.updatedAt?.toISOString() || new Date().toISOString(),
          }));
          break;
        }
        case 'finance_goals': {
          const rows = await db
            .select()
            .from(financeGoalsRel)
            .where(eq(financeGoalsRel.userId, userId));
          data = rows.map((r: typeof financeGoalsRel.$inferSelect) => ({
            id: r.id,
            title: r.title,
            icon: r.icon,
            targetAmount: r.targetAmount,
            currentSaved: r.currentSaved,
            deadline: r.deadline,
            monthlyTarget: r.monthlyTarget,
            isActive: r.isActive,
            notes: r.notes,
            createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: r.updatedAt?.toISOString() || new Date().toISOString(),
          }));
          break;
        }
        case 'finance_categories': {
          const rows = await db
            .select()
            .from(financeCategories)
            .where(eq(financeCategories.userId, userId));
          // Provide default mapping if properties missing, though z.object allows it mapping logic expects it.
          // In original code it mapped title, color, type from frontend.
          // We map back to what the frontend schema expects:
          data = rows.map((r: typeof financeCategories.$inferSelect) => ({
            id: r.id,
            title: r.name || r.title, // map db 'name' to frontend 'name/title'
            name: r.name || r.title,
            icon: r.icon,
            color: r.color,
            monthlyBudget: r.monthlyBudget || 0,
            isCustom: r.isCustom || false,
            order: r.displayOrder || r.sortOrder || 0,
            type: r.type,
            isActive: r.isActive,
            parentId: r.parentId,
            sortOrder: r.displayOrder || r.sortOrder || 0,
            createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: r.updatedAt?.toISOString() || new Date().toISOString(),
          }));
          break;
        }
        default:
          return res.status(400).json({ error: `جدول غير معروف: ${finRes.table}` });
      }

      let maxUpdatedAt = null;
      if (data.length > 0) {
        maxUpdatedAt = new Date(
          Math.max(
            ...data.map((d: Record<string, unknown>) => new Date(d.updatedAt as string).getTime())
          )
        ).toISOString();
      }

      return res.status(200).json({
        [finRes.field]: data,
        updatedAt: maxUpdatedAt,
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
        return res
          .status(400)
          .json({ error: 'البيانات غير صالحة', details: parsedData.error.issues });
      }

      const data = parsedData.data;

      if (data.length > 1000) {
        return res.status(400).json({ error: 'تجاوز الحد المسموح (1000 عنصر)' });
      }

      await db.transaction(async (tx) => {
        const itemIds = data.map((d: any) => d.id).filter((id: any) => id != null);

        if (finRes.table === 'finance_income') {
          if (itemIds.length > 0)
            await tx
              .delete(financeIncomes)
              .where(
                and(eq(financeIncomes.userId, userId), notInArray(financeIncomes.id, itemIds))
              );
          else await tx.delete(financeIncomes).where(eq(financeIncomes.userId, userId));

          for (const item of data) {
            if (!item.id) continue;
            const insertData = {
              id: item.id,
              userId: userId,
              title: item.title || '',
              icon: item.icon || null,
              amount: item.amount ? String(item.amount) : '0',
              frequency: item.frequency || null,
              incomeType: item.type || null,
              isActive: item.isActive ?? true,
              notes: item.notes || null,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
            };

            await tx
              .insert(financeIncomes)
              .values(insertData)
              .onConflictDoUpdate({
                target: financeIncomes.id,
                set: {
                  ...insertData,
                  updatedAt: new Date(),
                },
              });
          }
        } else if (finRes.table === 'finance_obligations') {
          if (itemIds.length > 0)
            await tx
              .delete(financeExpenses)
              .where(
                and(eq(financeExpenses.userId, userId), notInArray(financeExpenses.id, itemIds))
              );
          else await tx.delete(financeExpenses).where(eq(financeExpenses.userId, userId));

          for (const item of data) {
            if (!item.id) continue;
            const insertData = {
              id: item.id,
              userId: userId,
              categoryId: item.categoryId || null,
              title: item.title || '',
              icon: item.icon || null,
              amount: item.amount ? String(item.amount) : '0',
              frequency: item.frequency || null,
              expenseType: item.type || null,
              isActive: item.isActive ?? true,
              dueDay: item.dueDay || null,
              quarterMonth: item.quarterMonth || null,
              totalAmount: item.totalAmount ? String(item.totalAmount) : null,
              totalInstallments: item.totalInstallments || null,
              endDate: item.endDate ? new Date(item.endDate) : null,
              seasonMonth: item.seasonMonth || null,
              monthlySetAside: item.monthlySetAside ? String(item.monthlySetAside) : null,
              notes: item.notes || null,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
            };

            await tx
              .insert(financeExpenses)
              .values(insertData)
              .onConflictDoUpdate({
                target: financeExpenses.id,
                set: {
                  ...insertData,
                  updatedAt: new Date(),
                },
              });
          }
        } else if (finRes.table === 'finance_payments') {
          if (itemIds.length > 0)
            await tx
              .delete(financeTransactions)
              .where(
                and(
                  eq(financeTransactions.userId, userId),
                  notInArray(financeTransactions.id, itemIds)
                )
              );
          else await tx.delete(financeTransactions).where(eq(financeTransactions.userId, userId));

          for (const item of data) {
            if (!item.id || !item.categoryId) continue;
            const insertData = {
              id: item.id,
              userId: userId,
              expenseId: item.expenseId || null,
              categoryId: item.categoryId,
              amount: item.amount ? String(item.amount) : '0',
              transactionDate: item.date ? new Date(item.date) : new Date(),
              status: item.status || null,
              notes: item.notes || null,
              currencySymbol: item.currencySymbol || null,
              exchangeRate: item.exchangeRate ? String(item.exchangeRate) : null,
              originalAmount: item.originalAmount ? String(item.originalAmount) : null,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
            };

            await tx
              .insert(financeTransactions)
              .values(insertData)
              .onConflictDoUpdate({
                target: financeTransactions.id,
                set: {
                  ...insertData,
                  updatedAt: new Date(),
                },
              });
          }
        } else if (finRes.table === 'finance_goals') {
          if (itemIds.length > 0)
            await tx
              .delete(financeGoalsRel)
              .where(
                and(eq(financeGoalsRel.userId, userId), notInArray(financeGoalsRel.id, itemIds))
              );
          else await tx.delete(financeGoalsRel).where(eq(financeGoalsRel.userId, userId));

          for (const item of data) {
            if (!item.id) continue;
            const insertData = {
              id: item.id,
              userId: userId,
              title: item.title || '',
              icon: item.icon || null,
              targetAmount: item.targetAmount ? String(item.targetAmount) : '0',
              currentSaved: item.currentSaved ? String(item.currentSaved) : '0',
              deadline: item.deadline ? new Date(item.deadline) : null,
              monthlyTarget: item.monthlyTarget ? String(item.monthlyTarget) : null,
              isActive: item.isActive ?? true,
              notes: item.notes || null,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
            };

            await tx
              .insert(financeGoalsRel)
              .values(insertData)
              .onConflictDoUpdate({
                target: financeGoalsRel.id,
                set: {
                  ...insertData,
                  updatedAt: new Date(),
                },
              });
          }
        } else if (finRes.table === 'finance_categories') {
          if (itemIds.length > 0)
            await tx
              .delete(financeCategories)
              .where(
                and(eq(financeCategories.userId, userId), notInArray(financeCategories.id, itemIds))
              );
          else await tx.delete(financeCategories).where(eq(financeCategories.userId, userId));

          for (const item of data) {
            if (!item.id) continue;
            const insertData = {
              id: item.id,
              userId: userId,
              name: item.name || item.title || '',
              icon: item.icon || null,
              color: item.color || null,
              monthlyBudget: item.monthlyBudget ? String(item.monthlyBudget) : null,
              isCustom: item.isCustom ?? false,
              displayOrder: item.order || item.sortOrder || 0,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
            };

            await tx
              .insert(financeCategories)
              .values(insertData)
              .onConflictDoUpdate({
                target: financeCategories.id,
                set: {
                  ...insertData,
                  updatedAt: new Date(),
                },
              });
          }
        }
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error: any) {
    console.error(`Finance Error (${finRes.table}):`, error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
