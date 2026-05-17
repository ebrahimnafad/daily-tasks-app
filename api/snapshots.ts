import { applyRateLimit } from './middleware/rateLimit.ts';
import { setCorsHeaders } from './_shared/cors.ts';
import { requireAuth } from './_shared/auth.ts';
import { db } from './_shared/db.ts';
import { dailySnapshots } from '../src/db/schema.ts';
import { eq, desc, sql } from 'drizzle-orm';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(str: string) {
  if (!DATE_REGEX.test(str)) return false;
  const d = new Date(str);
  return d instanceof Date && !isNaN(d.getTime());
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rateLimit = applyRateLimit(req, 'snapshots', 'general');
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: rateLimit.message });
  }

  const { method } = req;

  try {
    const authPayload = await requireAuth(req, res);
    if (!authPayload) return;

    if (method === 'GET') {
      const { date } = req.query;

      if (date) {
        // Single snapshot
        if (!isValidDate(date)) return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة' });

        const rows = await db.select().from(dailySnapshots).where(eq(dailySnapshots.date, date));
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
          .orderBy(desc(dailySnapshots.date))
          .limit(365);

        return res.status(200).json({
          summaries: rows.map((r: any) => ({
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

      await db
        .insert(dailySnapshots)
        .values({
          date: date,
          snapshot: snapshot,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: dailySnapshots.date,
          set: {
            snapshot: snapshot,
            updatedAt: new Date(),
          },
        });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error: any) {
    console.error('Snapshots Error:', error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
