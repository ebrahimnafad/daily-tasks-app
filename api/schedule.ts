import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';
import { db } from './_shared/db.js';
import { scheduleConfig } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { withValidation } from './_shared/withValidation.js';
import { scheduleDataSchema, assertPayloadSize } from '../src/validation/schemas.js';
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
      const rows = await db.select().from(scheduleConfig).where(eq(scheduleConfig.userId, userId));
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

      assertPayloadSize(schedule, 'schedule');
      const validSchedule = scheduleDataSchema.parse(schedule);

      await db
        .insert(scheduleConfig)
        .values({
          userId,
          data: validSchedule,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: scheduleConfig.userId,
          set: {
            data: validSchedule,
            updatedAt: new Date(),
          },
        });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error: unknown) {
    console.error('Schedule Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: message });
  }
};

export default withValidation(handler);
