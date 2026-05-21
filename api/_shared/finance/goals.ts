/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db.js';
import { financeGoalsRel } from '../../../src/db/schema.js';
import { eq, notInArray, and, isNull } from 'drizzle-orm';
import { GoalSchema } from '../../../src/validation/schemas.js';
import type { FinanceResourceHandler } from './types.js';

export const goalsHandler: FinanceResourceHandler = {
  field: 'goals',
  schema: GoalSchema.passthrough(),

  get: async (userId: number) => {
    const rows = await db
      .select()
      .from(financeGoalsRel)
      .where(and(eq(financeGoalsRel.userId, userId), isNull(financeGoalsRel.deletedAt)));

    return rows.map((r: typeof financeGoalsRel.$inferSelect) => ({
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
  },

  post: async (userId: number, data: any[], tx: any) => {
    const itemIds = data
      .map((d: any) => String(d.id))
      .filter((id: string) => id !== 'undefined' && id !== 'null');

    const existingRecords = await tx
      .select({
        id: financeGoalsRel.id,
        updatedAt: financeGoalsRel.updatedAt,
        deletedAt: financeGoalsRel.deletedAt,
      })
      .from(financeGoalsRel)
      .where(eq(financeGoalsRel.userId, userId));
    const existingMap = new Map(existingRecords.map((r: any) => [r.id, r]));

    if (itemIds.length > 0) {
      await tx
        .update(financeGoalsRel)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(financeGoalsRel.userId, userId),
            notInArray(financeGoalsRel.id, itemIds),
            isNull(financeGoalsRel.deletedAt)
          )
        );
    } else {
      await tx
        .update(financeGoalsRel)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(financeGoalsRel.userId, userId), isNull(financeGoalsRel.deletedAt)));
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
        targetAmount: item.targetAmount ? String(item.targetAmount) : '0',
        currentSaved: item.currentSaved ? String(item.currentSaved) : '0',
        deadline: item.deadline ? String(item.deadline) : null,
        monthlyTarget: item.monthlyTarget ? String(item.monthlyTarget) : null,
        isActive: Boolean(item.isActive ?? true),
        notes: item.notes ? String(item.notes) : null,
        createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
        updatedAt: new Date(),
        deletedAt: item.deletedAt ? new Date(item.deletedAt as string) : null,
      };

      await tx.insert(financeGoalsRel).values(insertData).onConflictDoUpdate({
        target: financeGoalsRel.id,
        set: insertData,
      });
    }
  },
};
