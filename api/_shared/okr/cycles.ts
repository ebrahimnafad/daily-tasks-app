/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db.js';
import { okrCycles } from '../../../src/db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { okrCycleSchema } from '../../../src/validation/schemas.js';
import type { OkrResourceHandler } from './types.js';

export const cyclesHandler: OkrResourceHandler = {
  field: 'cycles',
  schema: okrCycleSchema.passthrough(),

  get: async (userId: number) => {
    const rows = await db
      .select()
      .from(okrCycles)
      .where(and(eq(okrCycles.userId, userId), isNull(okrCycles.deletedAt)));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status,
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
        title: String(item.title ?? ''),
        startDate: String(item.startDate),
        endDate: String(item.endDate),
        status: (item.status as string) ?? 'active',
        createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
        updatedAt: new Date(),
        deletedAt: item.deletedAt ? new Date(item.deletedAt as string) : null,
      };

      await tx
        .insert(okrCycles)
        .values(row)
        .onConflictDoUpdate({
          target: okrCycles.id,
          set: { ...row, createdAt: undefined }, // never overwrite createdAt
        });
    }
  },
};
