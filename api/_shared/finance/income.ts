/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db.js';
import { financeIncomes } from '../../../src/db/schema.js';
import { eq, notInArray, and, isNull } from 'drizzle-orm';
import { IncomeSchema } from '../../../src/validation/schemas.js';
import type { FinanceResourceHandler } from './types.js';

export const incomeHandler: FinanceResourceHandler = {
  field: 'income',
  schema: IncomeSchema.passthrough(),

  get: async (userId: number) => {
    const rows = await db
      .select()
      .from(financeIncomes)
      .where(and(eq(financeIncomes.userId, userId), isNull(financeIncomes.deletedAt)));

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

    const existingRecords = await tx
      .select({
        id: financeIncomes.id,
        updatedAt: financeIncomes.updatedAt,
        deletedAt: financeIncomes.deletedAt,
      })
      .from(financeIncomes)
      .where(eq(financeIncomes.userId, userId));
    const existingMap = new Map(existingRecords.map((r: any) => [r.id, r]));

    if (itemIds.length > 0) {
      await tx
        .update(financeIncomes)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(financeIncomes.userId, userId),
            notInArray(financeIncomes.id, itemIds),
            isNull(financeIncomes.deletedAt)
          )
        );
    } else {
      await tx
        .update(financeIncomes)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(financeIncomes.userId, userId), isNull(financeIncomes.deletedAt)));
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
        title: String(item.title || ''),
        icon: item.icon ? String(item.icon) : null,
        amount: item.amount ? String(item.amount) : '0',
        frequency: item.frequency ? String(item.frequency) : null,
        incomeType: item.type ? String(item.type) : null,
        isActive: Boolean(item.isActive ?? true),
        notes: item.notes ? String(item.notes) : null,
        createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
        updatedAt: new Date(),
        deletedAt: item.deletedAt ? new Date(item.deletedAt as string) : null,
      };

      await tx.insert(financeIncomes).values(insertData).onConflictDoUpdate({
        target: financeIncomes.id,
        set: insertData,
      });
    }
  },
};
