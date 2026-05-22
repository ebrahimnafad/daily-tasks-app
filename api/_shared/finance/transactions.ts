/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db.js';
import { financeTransactions } from '../../../src/db/schema.js';
import { eq, notInArray, and, isNull } from 'drizzle-orm';
import { TransactionSchema } from '../../../src/validation/schemas.js';
import type { FinanceResourceHandler } from './types.js';

export const transactionsHandler: FinanceResourceHandler = {
  field: 'transactions',
  schema: TransactionSchema.passthrough(),

  get: async (userId: number) => {
    const rows = await db
      .select()
      .from(financeTransactions)
      .where(and(eq(financeTransactions.userId, userId), isNull(financeTransactions.deletedAt)));

    return rows.map((r: typeof financeTransactions.$inferSelect) => ({
      id: r.id,
      expenseId: r.expenseId,
      categoryId: r.categoryId,
      amount: r.amount,
      date: r.transactionDate ? String(r.transactionDate) : new Date().toISOString(),
      status: r.status,
      notes: r.notes,
      currencySymbol: r.currencySymbol,
      exchangeRate: r.exchangeRate,
      originalAmount: r.originalAmount,
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
        id: financeTransactions.id,
        updatedAt: financeTransactions.updatedAt,
        deletedAt: financeTransactions.deletedAt,
      })
      .from(financeTransactions)
      .where(eq(financeTransactions.userId, userId));
    type ExistingRec = { id: string; updatedAt: Date | null; deletedAt: Date | null };
    const existingMap = new Map<string, ExistingRec>(
      (existingRecords as ExistingRec[]).map((r) => [r.id, r])
    );

    if (itemIds.length > 0) {
      await tx
        .update(financeTransactions)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(financeTransactions.userId, userId),
            notInArray(financeTransactions.id, itemIds),
            isNull(financeTransactions.deletedAt)
          )
        );
    } else {
      await tx
        .update(financeTransactions)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(financeTransactions.userId, userId), isNull(financeTransactions.deletedAt)));
    }

    for (const item of data) {
      if (!item.id || !item.categoryId) continue;
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
        expenseId: item.expenseId ? String(item.expenseId) : null,
        categoryId: String(item.categoryId),
        amount: item.amount ? String(item.amount) : '0',
        transactionDate: item.date ? String(item.date) : new Date().toISOString(),
        status: item.status ? String(item.status) : null,
        notes: item.notes ? String(item.notes) : null,
        currencySymbol: item.currencySymbol ? String(item.currencySymbol) : null,
        exchangeRate: item.exchangeRate ? String(item.exchangeRate) : null,
        originalAmount: item.originalAmount ? String(item.originalAmount) : null,
        createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
        updatedAt: new Date(),
        deletedAt: item.deletedAt ? new Date(item.deletedAt as string) : null,
      };

      await tx.insert(financeTransactions).values(insertData).onConflictDoUpdate({
        target: financeTransactions.id,
        set: insertData,
      });
    }
  },
};
