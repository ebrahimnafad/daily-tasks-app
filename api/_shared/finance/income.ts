/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db.js';
import { financeIncomes } from '../../../src/db/schema.js';
import { eq, notInArray, and } from 'drizzle-orm';
import { IncomeSchema } from '../../../src/validation/schemas.js';
import type { FinanceResourceHandler } from './types.js';

export const incomeHandler: FinanceResourceHandler = {
  field: 'income',
  schema: IncomeSchema.passthrough(),

  get: async (userId: number) => {
    const rows = await db.select().from(financeIncomes).where(eq(financeIncomes.userId, userId));

    return rows.map((r: typeof financeIncomes.$inferSelect) => ({
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
  },

  post: async (userId: number, data: any[], tx: any) => {
    const itemIds = data
      .map((d: any) => String(d.id))
      .filter((id: string) => id !== 'undefined' && id !== 'null');

    if (itemIds.length > 0) {
      await tx
        .delete(financeIncomes)
        .where(and(eq(financeIncomes.userId, userId), notInArray(financeIncomes.id, itemIds)));
    } else {
      await tx.delete(financeIncomes).where(eq(financeIncomes.userId, userId));
    }

    for (const item of data) {
      if (!item.id) continue;
      const insertData = {
        id: String(item.id),
        userId: userId,
        title: String(item.title || ''),
        icon: item.icon ? String(item.icon) : null,
        amount: item.amount ? String(item.amount) : '0',
        frequency: item.frequency ? String(item.frequency) : null,
        incomeType: item.type ? String(item.type) : null,
        isActive: Boolean(item.isActive ?? true),
        notes: item.notes ? String(item.notes) : null,
        createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt as string) : new Date(),
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
  },
};
