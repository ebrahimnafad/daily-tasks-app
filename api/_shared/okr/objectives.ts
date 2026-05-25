/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db.js';
import { okrObjectives } from '../../../src/db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { okrObjectiveSchema } from '../../../src/validation/schemas.js';
import type { OkrResourceHandler } from './types.js';

export const objectivesHandler: OkrResourceHandler = {
  field: 'objectives',
  schema: okrObjectiveSchema.passthrough(),

  get: async (userId: number) => {
    const rows = await db
      .select()
      .from(okrObjectives)
      .where(and(eq(okrObjectives.userId, userId), isNull(okrObjectives.deletedAt)));

    return rows.map((r) => ({
      id: r.id,
      cycleId: r.cycleId,
      title: r.title,
      icon: r.icon,
      color: r.color,
      sortOrder: r.sortOrder,
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
        cycleId: String(item.cycleId),
        title: String(item.title ?? ''),
        icon: item.icon ? String(item.icon) : null,
        color: item.color ? String(item.color) : null,
        sortOrder: Number(item.sortOrder ?? 0),
        createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
        updatedAt: new Date(),
        deletedAt: item.deletedAt ? new Date(item.deletedAt as string) : null,
      };

      await tx
        .insert(okrObjectives)
        .values(row)
        .onConflictDoUpdate({
          target: okrObjectives.id,
          set: { ...row, createdAt: undefined },
        });
    }
  },
};
