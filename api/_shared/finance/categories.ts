/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db.js';
import { financeCategories } from '../../../src/db/schema.js';
import { eq, notInArray, and } from 'drizzle-orm';
import { ExpenseCategorySchema } from '../../../src/validation/schemas.js';
import type { FinanceResourceHandler } from './types.js';

export const categoriesHandler: FinanceResourceHandler = {
  field: 'categories',
  schema: ExpenseCategorySchema.passthrough(),

  get: async (userId: number) => {
    const rows = await db
      .select()
      .from(financeCategories)
      .where(eq(financeCategories.userId, userId));

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

    if (itemIds.length > 0) {
      await tx
        .delete(financeCategories)
        .where(
          and(eq(financeCategories.userId, userId), notInArray(financeCategories.id, itemIds))
        );
    } else {
      await tx.delete(financeCategories).where(eq(financeCategories.userId, userId));
    }

    for (const item of data) {
      if (!item.id) continue;
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
        updatedAt: item.updatedAt ? new Date(item.updatedAt as string) : new Date(),
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
  },
};
