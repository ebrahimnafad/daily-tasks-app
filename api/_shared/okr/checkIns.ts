/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from '../db.js';
import { okrCheckIns, okrKeyResults } from '../../../src/db/schema.js';
import { eq, and, gte } from 'drizzle-orm';
import { okrCheckInSchema } from '../../../src/validation/schemas.js';
import { sql } from 'drizzle-orm';

export const checkInsHandler = {
  field: 'checkIns',
  schema: okrCheckInSchema.passthrough(),

  /**
   * Get all check-ins for a user, with optional `since` filter for incremental sync.
   * @param userId  — authenticated user ID
   * @param since   — ISO datetime string; if provided, only returns records with createdAt >= since
   */
  get: async (userId: number, since?: string) => {
    const conditions = [eq(okrCheckIns.userId, userId)];
    if (since) {
      conditions.push(gte(okrCheckIns.createdAt, new Date(since)));
    }

    const rows = await db
      .select()
      .from(okrCheckIns)
      .where(and(...conditions));

    return rows.map((r) => ({
      id: r.id,
      keyResultId: r.keyResultId,
      checkInDate: r.checkInDate,
      value: r.value,
      note: r.note,
      source: r.source,
      createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    }));
  },

  /**
   * Insert a single check-in and atomically increment currentValue on the parent key result.
   * Both writes happen in the same DB transaction — currentValue will never drift.
   *
   * Check-ins are IMMUTABLE: if the id already exists in the DB we skip silently (idempotent).
   */
  post: async (userId: number, item: any, tx: any): Promise<void> => {
    const id = String(item.id);
    const keyResultId = String(item.keyResultId);
    const value = String(item.value);

    // Idempotency: check if this check-in id already exists
    const existing = await tx
      .select({ id: okrCheckIns.id })
      .from(okrCheckIns)
      .where(and(eq(okrCheckIns.id, id), eq(okrCheckIns.userId, userId)));

    if (existing.length > 0) {
      // Already inserted — append-only, skip silently
      return;
    }

    // Insert the check-in record
    await tx.insert(okrCheckIns).values({
      id,
      userId,
      keyResultId,
      checkInDate: String(item.checkInDate),
      value,
      note: item.note ? String(item.note) : null,
      source: (item.source as string) ?? 'manual',
      createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
    });

    // Atomically increment currentValue on the parent key result in the same transaction
    await tx
      .update(okrKeyResults)
      .set({
        currentValue: sql`${okrKeyResults.currentValue} + ${value}`,
        updatedAt: new Date(),
      })
      .where(and(eq(okrKeyResults.id, keyResultId), eq(okrKeyResults.userId, userId)));
  },
};
