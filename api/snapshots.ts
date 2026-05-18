import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';
import { db } from './_shared/db.js';
import { dailySnapshots } from '../src/db/schema.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import { withValidation } from './_shared/withValidation.js';
import { snapshotSchema, assertPayloadSize } from '../src/validation/schemas.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(str: string) {
  if (!DATE_REGEX.test(str)) return false;
  const d = new Date(str);
  return d instanceof Date && !isNaN(d.getTime());
}

import type { ApiRequest, ApiResponse } from './_shared/types.js';

const handler = async function handler(req: ApiRequest, res: ApiResponse) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { method } = req;

  try {
    const authPayload = await requireAuth(req, res);
    if (!authPayload) return;
    const userId = authPayload.userId;

    if (method === 'GET') {
      const dateQuery = req.query.date;
      const date = Array.isArray(dateQuery) ? dateQuery[0] : dateQuery;

      if (date) {
        // Single snapshot
        if (!isValidDate(date)) return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة' });

        const rows = await db
          .select()
          .from(dailySnapshots)
          .where(and(eq(dailySnapshots.userId, userId), eq(dailySnapshots.date, date)));
        return res.status(200).json({
          snapshot: rows[0]?.snapshot ?? null,
          updatedAt: rows[0]?.updatedAt ?? null,
        });
      } else {
        // List of summaries
        const rows = await db
          .select({
            date_str: sql<string>`to_char(${dailySnapshots.date}, 'YYYY-MM-DD')`,
            progress: sql<string>`${dailySnapshots.snapshot}->>'progress'`,
            count_done: sql<string>`${dailySnapshots.snapshot}->>'countDone'`,
            total_other: sql<string>`${dailySnapshots.snapshot}->>'totalOther'`,
          })
          .from(dailySnapshots)
          .where(eq(dailySnapshots.userId, userId))
          .orderBy(desc(dailySnapshots.date))
          .limit(365);

        return res.status(200).json({
          summaries: rows.map((r: Record<string, unknown>) => ({
            date: r.date_str,
            progress: Number(r.progress ?? 0),
            countDone: Number(r.count_done ?? 0),
            totalOther: Number(r.total_other ?? 0),
          })),
        });
      }
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { date, snapshot } = body;
      if (!date || !snapshot) return res.status(400).json({ error: 'date و snapshot مطلوبان' });
      if (!isValidDate(date)) return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة' });

      assertPayloadSize(snapshot, 'snapshot');
      const validSnapshot = snapshotSchema.parse(snapshot);

      await db
        .insert(dailySnapshots)
        .values({
          userId,
          date: date,
          snapshot: validSnapshot,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [dailySnapshots.userId, dailySnapshots.date],
          set: {
            snapshot: validSnapshot,
            updatedAt: new Date(),
          },
        });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error: unknown) {
    console.error('Snapshots Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: message });
  }
};

export default withValidation(handler);
