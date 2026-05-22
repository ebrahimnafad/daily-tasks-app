/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db.js';
import { financeExpenses } from '../../../src/db/schema.js';
import { eq, notInArray, and, isNull } from 'drizzle-orm';
import { ExpenseSchema } from '../../../src/validation/schemas.js';
import type { FinanceResourceHandler } from './types.js';

export const expensesHandler: FinanceResourceHandler = {
  field: 'expenses',
  schema: ExpenseSchema.passthrough(),

  get: async (userId: number) => {
    const rows = await db
      .select()
      .from(financeExpenses)
      .where(and(eq(financeExpenses.userId, userId), isNull(financeExpenses.deletedAt)));

    return rows.map((r: typeof financeExpenses.$inferSelect) => ({
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
  },

  post: async (userId: number, data: any[], tx: any) => {
    const itemIds = data
      .map((d: any) => String(d.id))
      .filter((id: string) => id !== 'undefined' && id !== 'null');

    const existingRecords = await tx
      .select({
        id: financeExpenses.id,
        updatedAt: financeExpenses.updatedAt,
        deletedAt: financeExpenses.deletedAt,
      })
      .from(financeExpenses)
      .where(eq(financeExpenses.userId, userId));
    type ExistingRec = { id: string; updatedAt: Date | null; deletedAt: Date | null };
    const existingMap = new Map<string, ExistingRec>(
      (existingRecords as ExistingRec[]).map((r) => [r.id, r])
    );

    if (itemIds.length > 0) {
      await tx
        .update(financeExpenses)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(financeExpenses.userId, userId),
            notInArray(financeExpenses.id, itemIds),
            isNull(financeExpenses.deletedAt)
          )
        );
    } else {
      await tx
        .update(financeExpenses)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(financeExpenses.userId, userId), isNull(financeExpenses.deletedAt)));
    }

    for (const item of data) {
      if (!item.id) continue;
      const existing = existingMap.get(String(item.id));
      if (existing) {
        if (existing.deletedAt) {
          throw {
            status: 410,
            message: 'Conflict: Deleted',
            serverData: existing,
            entityId: existing.id,
          };
        }
        const clientTs = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
        const serverTs = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        if (clientTs < serverTs) {
          throw {
            status: 409,
            message: 'Conflict: Outdated',
            serverData: existing,
            entityId: existing.id,
          };
        }
      }

      const insertData = {
        id: String(item.id),
        userId: userId,
        categoryId: item.categoryId ? String(item.categoryId) : null,
        title: String(item.title || ''),
        icon: item.icon ? String(item.icon) : null,
        amount: item.amount ? String(item.amount) : '0',
        frequency: item.frequency ? String(item.frequency) : null,
        expenseType: item.type ? String(item.type) : null,
        isActive: Boolean(item.isActive ?? true),
        dueDay: item.dueDay ? Number(item.dueDay) : null,
        quarterMonth: item.quarterMonth ? Number(item.quarterMonth) : null,
        totalAmount: item.totalAmount ? String(item.totalAmount) : null,
        totalInstallments: item.totalInstallments ? Number(item.totalInstallments) : null,
        endDate: item.endDate ? String(item.endDate) : null,
        seasonMonth: item.seasonMonth ? Number(item.seasonMonth) : null,
        monthlySetAside: item.monthlySetAside ? String(item.monthlySetAside) : null,
        notes: item.notes ? String(item.notes) : null,
        createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
        updatedAt: new Date(),
        deletedAt: item.deletedAt ? new Date(item.deletedAt as string) : null,
      };

      await tx.insert(financeExpenses).values(insertData).onConflictDoUpdate({
        target: financeExpenses.id,
        set: insertData,
      });
    }
  },
};
