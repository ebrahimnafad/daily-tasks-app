/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db.js';
import { financeCategories } from '../../../src/db/schema.js';
import { eq, notInArray, and, isNull } from 'drizzle-orm';
import { ExpenseCategorySchema } from '../../../src/validation/schemas.js';
import type { FinanceResourceHandler } from './types.js';

export const categoriesHandler: FinanceResourceHandler = {
  field: 'categories',
  schema: ExpenseCategorySchema.passthrough(),

  get: async (userId: number) => {
    const rows = await db
      .select()
      .from(financeCategories)
      .where(and(eq(financeCategories.userId, userId), isNull(financeCategories.deletedAt)));

    return rows.map((r: typeof financeCategories.$inferSelect) => ({
      id: r.id,
      title: r.name,
      name: r.name,
      icon: r.icon,
      color: r.color,
      monthlyBudget: r.monthlyBudget || 0,
      isCustom: r.isCustom || false,
      order: r.displayOrder || 0,
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
        id: financeCategories.id,
        updatedAt: financeCategories.updatedAt,
        deletedAt: financeCategories.deletedAt,
      })
      .from(financeCategories)
      .where(eq(financeCategories.userId, userId));
    const existingMap = new Map(existingRecords.map((r: any) => [r.id, r]));

    if (itemIds.length > 0) {
      await tx
        .update(financeCategories)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(financeCategories.userId, userId),
            notInArray(financeCategories.id, itemIds),
            isNull(financeCategories.deletedAt)
          )
        );
    } else {
      await tx
        .update(financeCategories)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(financeCategories.userId, userId), isNull(financeCategories.deletedAt)));
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
        name: item.name ? String(item.name) : item.title ? String(item.title) : '',
        icon: item.icon ? String(item.icon) : null,
        color: item.color ? String(item.color) : null,
        monthlyBudget: item.monthlyBudget ? String(item.monthlyBudget) : null,
        isCustom: Boolean(item.isCustom ?? false),
        displayOrder: Number(item.order || item.sortOrder || 0),
        createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
        updatedAt: new Date(),
        deletedAt: item.deletedAt ? new Date(item.deletedAt as string) : null,
      };

      await tx.insert(financeCategories).values(insertData).onConflictDoUpdate({
        target: financeCategories.id,
        set: insertData,
      });
    }
  },
};
