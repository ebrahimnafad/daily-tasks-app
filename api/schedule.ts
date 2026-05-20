import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';
import { db } from './_shared/db.js';
import { scheduleConfig } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { withValidation } from './_shared/withValidation.js';
import {
  scheduleDataSchema,
  assertPayloadSize,
  calendarExceptionsSchema,
  vacationBalanceSchema,
} from '../src/validation/schemas.js';
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
        offExceptions: rows[0]?.offExceptions ?? [],
        workExceptions: rows[0]?.workExceptions ?? [],
        vacationDays: rows[0]?.vacationDays ?? [],
        vacationBalance: rows[0]?.vacationBalance ?? 0,
        updatedAt: rows[0]?.updatedAt ?? null,
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { schedule, offExceptions, workExceptions, vacationDays, vacationBalance } = body;

      if (!Array.isArray(schedule)) {
        return res.status(400).json({ error: 'schedule يجب أن يكون مصفوفة' });
      }

      assertPayloadSize(schedule, 'schedule');
      const validSchedule = scheduleDataSchema.parse(schedule);

      const updateData: Partial<typeof scheduleConfig.$inferInsert> = {
        data: validSchedule,
        updatedAt: new Date(),
      };
      if (offExceptions !== undefined) {
        updateData.offExceptions = calendarExceptionsSchema.parse(offExceptions);
      }
      if (workExceptions !== undefined) {
        updateData.workExceptions = calendarExceptionsSchema.parse(workExceptions);
      }
      if (vacationDays !== undefined) {
        updateData.vacationDays = calendarExceptionsSchema.parse(vacationDays);
      }
      if (vacationBalance !== undefined) {
        updateData.vacationBalance = vacationBalanceSchema.parse(vacationBalance);
      }

      // Explicit upsert: avoids a Drizzle 0.45.x bug where onConflictDoUpdate
      // targets the wrong column ("id" instead of "user_id") on tables that have
      // both a bare `id` field and a primaryKey() defined in the table config.
      const existing = await db
        .select({ userId: scheduleConfig.userId })
        .from(scheduleConfig)
        .where(eq(scheduleConfig.userId, userId));

      if (existing.length > 0) {
        await db.update(scheduleConfig).set(updateData).where(eq(scheduleConfig.userId, userId));
      } else {
        await db.insert(scheduleConfig).values({
          userId,
          data: validSchedule,
          offExceptions:
            offExceptions !== undefined ? calendarExceptionsSchema.parse(offExceptions) : [],
          workExceptions:
            workExceptions !== undefined ? calendarExceptionsSchema.parse(workExceptions) : [],
          vacationDays:
            vacationDays !== undefined ? calendarExceptionsSchema.parse(vacationDays) : [],
          vacationBalance:
            vacationBalance !== undefined ? vacationBalanceSchema.parse(vacationBalance) : 0,
          updatedAt: new Date(),
        });
      }

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
