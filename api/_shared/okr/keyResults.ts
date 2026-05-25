/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db.js';
import { okrKeyResults } from '../../../src/db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { okrKeyResultSchema } from '../../../src/validation/schemas.js';
import type { OkrResourceHandler } from './types.js';

export const keyResultsHandler: OkrResourceHandler = {
  field: 'keyResults',
  schema: okrKeyResultSchema.passthrough(),

  get: async (userId: number) => {
    const rows = await db
      .select()
      .from(okrKeyResults)
      .where(and(eq(okrKeyResults.userId, userId), isNull(okrKeyResults.deletedAt)));

    return rows.map((r) => ({
      id: r.id,
      objectiveId: r.objectiveId,
      title: r.title,
      type: r.type,
      unit: r.unit,
      customUnit: r.customUnit,
      targetValue: r.targetValue,
      currentValue: r.currentValue,
      sortOrder: r.sortOrder,
      linkedTaskId: r.linkedTaskId,
      linkedFinanceGoalId: r.linkedFinanceGoalId,
      createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? new Date().toISOString(),
    }));
  },

  post: async (userId: number, data: any[], tx: any) => {
    for (const item of data) {
      if (!item.id) continue;

      const row = {
        id: String(item.id),
        userId,
        objectiveId: String(item.objectiveId),
        title: String(item.title ?? ''),
        type: (item.type as string) ?? 'numeric',
        unit: (item.unit as string) ?? 'count',
        customUnit: item.customUnit ? String(item.customUnit) : null,
        targetValue: String(item.targetValue ?? '1'),
        // currentValue is managed by check-in transactions; only set on initial insert.
        // On conflict update, we do NOT overwrite currentValue so the server stays authoritative.
        currentValue: String(item.currentValue ?? '0'),
        sortOrder: Number(item.sortOrder ?? 0),
        linkedTaskId: item.linkedTaskId ? String(item.linkedTaskId) : null,
        linkedFinanceGoalId: item.linkedFinanceGoalId ? String(item.linkedFinanceGoalId) : null,
        createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
        updatedAt: new Date(),
        deletedAt: item.deletedAt ? new Date(item.deletedAt as string) : null,
      };

      await tx
        .insert(okrKeyResults)
        .values(row)
        .onConflictDoUpdate({
          target: okrKeyResults.id,
          set: {
            // Intentionally exclude currentValue — it is owned by check-in transactions.
            objectiveId: row.objectiveId,
            title: row.title,
            type: row.type,
            unit: row.unit,
            customUnit: row.customUnit,
            targetValue: row.targetValue,
            sortOrder: row.sortOrder,
            linkedTaskId: row.linkedTaskId,
            linkedFinanceGoalId: row.linkedFinanceGoalId,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt,
          },
        });
    }
  },
};
