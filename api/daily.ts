import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';
import { db } from './_shared/db.js';
import { dailyState } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import type { ApiRequest, ApiResponse } from './_shared/types.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function isValidDate(str: string) {
  if (!DATE_REGEX.test(str)) return false;
  const d = new Date(str);
  return d instanceof Date && !isNaN(d.getTime());
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
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
      const date = typeof req.query.date === 'string' ? req.query.date : undefined;
      if (!date) return res.status(400).json({ error: 'date مطلوب' });
      if (!isValidDate(date))
        return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)' });

      const rows = await db
        .select()
        .from(dailyState)
        .where(and(eq(dailyState.userId, userId), eq(dailyState.date, date)));

      return res.status(200).json({
        checked: rows[0]?.checked ?? {},
        subChecked: rows[0]?.subChecked ?? {},
        skipped: rows[0]?.skipped ?? {},
        updatedAt: rows[0]?.updatedAt ?? null,
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { date, checked, subChecked, skipped } = body;

      if (!date) return res.status(400).json({ error: 'date مطلوب' });
      if (!isValidDate(date))
        return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)' });

      const checkedMapSchema = z.record(z.string(), z.boolean());
      let parsedChecked, parsedSubChecked, parsedSkipped;

      try {
        parsedChecked = checked !== undefined ? checkedMapSchema.parse(checked) : {};
        parsedSubChecked = subChecked !== undefined ? checkedMapSchema.parse(subChecked) : {};
        parsedSkipped = skipped !== undefined ? checkedMapSchema.parse(skipped) : {};
      } catch (e: unknown) {
        return res
          .status(400)
          .json({
            error: 'بيانات غير صالحة',
            details: e instanceof Error ? e.message : 'Unknown error',
          });
      }

      await db
        .insert(dailyState)
        .values({
          userId,
          date: date,
          checked: parsedChecked,
          subChecked: parsedSubChecked,
          skipped: parsedSkipped,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [dailyState.userId, dailyState.date],
          set: {
            checked: parsedChecked,
            subChecked: parsedSubChecked,
            skipped: parsedSkipped,
            updatedAt: new Date(),
          },
        });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error: unknown) {
    console.error('Daily Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: message });
  }
}
