import { applyRateLimit } from './middleware/rateLimit.js';
import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';
import { db } from './_shared/db.js';
import { scheduleConfig } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rateLimit = applyRateLimit(req, 'schedule', 'general');
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: rateLimit.message });
  }

  const { method } = req;

  try {
    const authPayload = await requireAuth(req, res);
    if (!authPayload) return;

    if (method === 'GET') {
      const rows = await db.select().from(scheduleConfig).where(eq(scheduleConfig.id, 1));
      return res.status(200).json({
        schedule: rows[0]?.data ?? null,
        updatedAt: rows[0]?.updatedAt ?? null,
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { schedule } = body;

      if (!Array.isArray(schedule)) {
        return res.status(400).json({ error: 'schedule يجب أن يكون مصفوفة' });
      }

      await db
        .insert(scheduleConfig)
        .values({
          id: 1,
          data: schedule,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: scheduleConfig.id,
          set: {
            data: schedule,
            updatedAt: new Date(),
          },
        });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error: any) {
    console.error('Schedule Error:', error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
