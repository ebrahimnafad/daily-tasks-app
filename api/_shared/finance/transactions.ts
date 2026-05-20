/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db.js';
import { financeTransactions } from '../../../src/db/schema.js';
import { eq, notInArray, and } from 'drizzle-orm';
import { TransactionSchema } from '../../../src/validation/schemas.js';
import type { FinanceResourceHandler } from './types.js';

export const transactionsHandler: FinanceResourceHandler = {
  field: 'transactions',
  schema: TransactionSchema.passthrough(),

  get: async (userId: number) => {
    const rows = await db
      .select()
      .from(financeTransactions)
      .where(eq(financeTransactions.userId, userId));

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

    if (itemIds.length > 0) {
      await tx
        .delete(financeTransactions)
        .where(
          and(eq(financeTransactions.userId, userId), notInArray(financeTransactions.id, itemIds))
        );
    } else {
      await tx.delete(financeTransactions).where(eq(financeTransactions.userId, userId));
    }

    for (const item of data) {
      if (!item.id || !item.categoryId) continue;
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
        updatedAt: item.updatedAt ? new Date(item.updatedAt as string) : new Date(),
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
  },
};
