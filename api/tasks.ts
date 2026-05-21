import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';
import { z } from 'zod';
import {
  TaskSchema,
  shiftSchema,
  subtaskSchema,
  assertPayloadSize,
} from '../src/validation/schemas.js';
import { db } from './_shared/db.js';
import { tasks } from '../src/db/schema.js';
import { eq, inArray, isNull, isNotNull, gte, and } from 'drizzle-orm';
import { withValidation } from './_shared/withValidation.js';
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
      if (req.query.deleted === 'true') {
        const deletedRows = await db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.userId, userId),
              isNotNull(tasks.deletedAt),
              gte(tasks.deletedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
            )
          );
        return res.status(200).json({ tasks: deletedRows });
      }

      const sinceParam = req.query.since as string | undefined;
      const since = sinceParam ? parseInt(sinceParam, 10) : null;

      const condition =
        since && !isNaN(since)
          ? and(eq(tasks.userId, userId), gte(tasks.updatedAt, new Date(since)))
          : and(eq(tasks.userId, userId), isNull(tasks.deletedAt));

      const rows = await db.select().from(tasks).where(condition);

      const tasksResponse = rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        icon: r.icon,
        title: r.title,
        category: r.category,
        color: r.color,
        shifts: r.shifts || [],
        timeBlock: r.timeBlock,
        isWarning: r.isWarning,
        recurrence: r.recurrence,
        date: r.targetDate,
        alertTime: r.alertTime,
        isPrayerTask: r.isPrayerTask,
        isPinned: r.isPinned,
        subtasks: r.subtasks || [],
        brief: r.brief || {},
        createdAt: r.createdAt
          ? new Date(r.createdAt as string | number | Date).toISOString()
          : new Date().toISOString(),
        updatedAt: r.updatedAt
          ? new Date(r.updatedAt as string | number | Date).toISOString()
          : new Date().toISOString(),
      }));

      let maxUpdatedAt = null;
      if (tasksResponse.length > 0) {
        maxUpdatedAt = new Date(
          Math.max(
            ...tasksResponse.map((t: Record<string, unknown>) =>
              new Date(t.updatedAt as string).getTime()
            )
          )
        ).toISOString();
      }

      return res.status(200).json({
        tasks: tasksResponse,
        updatedAt: maxUpdatedAt,
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

      const parsedTasks = z.array(TaskSchema).safeParse(body.tasks);
      if (!parsedTasks.success) {
        return res
          .status(400)
          .json({ error: 'البيانات غير صالحة', details: parsedTasks.error.issues });
      }
      const incomingTasks = parsedTasks.data;

      if (incomingTasks.length > 500) {
        return res.status(400).json({ error: 'عدد المهام تجاوز الحد المسموح (500)' });
      }

      if (incomingTasks.length === 0 && !body.confirmClear) {
        return res.status(400).json({
          error: 'Empty task array rejected. Pass confirmClear: true to wipe all tasks.',
        });
      }

      // JSONB Validation & Size Hardening
      const validateTaskJSONB = (task: any) => {
        if (task.shifts) {
          assertPayloadSize(task.shifts, 'shifts');
          task.shifts = shiftSchema.parse(task.shifts);
        }
        if (task.subtasks) {
          assertPayloadSize(task.subtasks, 'subtasks');
          task.subtasks = z.array(subtaskSchema).parse(task.subtasks);
        }
        if (task.brief) {
          assertPayloadSize(task.brief, 'brief');
        }
      };

      if (req.query.syncMode === 'delta') {
        const parsedChanged = z.array(TaskSchema).safeParse(body.changed || []);
        if (!parsedChanged.success) {
          return res
            .status(400)
            .json({ error: 'البيانات غير صالحة', details: parsedChanged.error.issues });
        }
        const changedTasks = parsedChanged.data;
        const deletedIds = (body.deletedIds || []) as string[];

        if (changedTasks.length > 500) {
          return res.status(400).json({ error: 'عدد المهام تجاوز الحد المسموح (500)' });
        }

        for (const task of changedTasks) {
          validateTaskJSONB(task);
        }

        await db.transaction(async (tx) => {
          if (deletedIds.length > 0) {
            await tx
              .update(tasks)
              .set({ deletedAt: new Date(), updatedAt: new Date() })
              .where(and(eq(tasks.userId, userId), inArray(tasks.id, deletedIds)));
          }

          for (const task of changedTasks) {
            const { id, ...taskData } = task;

            const insertData = {
              id: id,
              userId: userId,
              icon: taskData.icon || null,
              title: taskData.title || '',
              category: taskData.category || null,
              color: taskData.color || null,
              shifts: taskData.shifts || [],
              timeBlock: taskData.timeBlock || null,
              isWarning: taskData.isWarning || false,
              recurrence: taskData.recurrence || null,
              targetDate: taskData.date || null,
              alertTime: taskData.alertTime || null,
              isPrayerTask: taskData.isPrayerTask || false,
              isPinned: taskData.isPinned || false,
              subtasks: taskData.subtasks || [],
              brief: taskData.brief || {},
              createdAt: taskData.createdAt ? new Date(taskData.createdAt) : new Date(),
              updatedAt: new Date(),
            };

            await tx.insert(tasks).values(insertData).onConflictDoUpdate({
              target: tasks.id,
              set: insertData,
            });
          }
        });

        return res.status(200).json({ ok: true });
      }

      for (const task of incomingTasks) {
        validateTaskJSONB(task);
      }

      const incomingIds = incomingTasks.map((t) => t.id).filter(Boolean) as string[];
      const existing = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt)));

      const toDelete = existing.map((r) => r.id).filter((id) => id && !incomingIds.includes(id));

      await db.transaction(async (tx) => {
        if (toDelete.length > 0) {
          await tx
            .update(tasks)
            .set({ deletedAt: new Date() })
            .where(and(eq(tasks.userId, userId), inArray(tasks.id, toDelete)));
        }

        for (const task of incomingTasks) {
          const { id, ...taskData } = task;

          const insertData = {
            id: id,
            userId: userId,
            icon: taskData.icon || null,
            title: taskData.title || '',
            category: taskData.category || null,
            color: taskData.color || null,
            shifts: taskData.shifts || [],
            timeBlock: taskData.timeBlock || null,
            isWarning: taskData.isWarning || false,
            recurrence: taskData.recurrence || null,
            targetDate: taskData.date || null,
            alertTime: taskData.alertTime || null,
            isPrayerTask: taskData.isPrayerTask || false,
            isPinned: taskData.isPinned || false,
            subtasks: taskData.subtasks || [],
            brief: taskData.brief || {},
            createdAt: taskData.createdAt ? new Date(taskData.createdAt) : new Date(),
            updatedAt: taskData.updatedAt ? new Date(taskData.updatedAt) : new Date(),
          };

          await tx
            .insert(tasks)
            .values(insertData)
            .onConflictDoUpdate({
              target: tasks.id,
              set: {
                ...insertData,
                updatedAt: new Date(),
              },
            });
        }
      });

      const savedRows = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt)));

      const tasksResponse = savedRows.map((r: Record<string, unknown>) => ({
        id: r.id,
        icon: r.icon,
        title: r.title,
        category: r.category,
        color: r.color,
        shifts: r.shifts || [],
        timeBlock: r.timeBlock,
        isWarning: r.isWarning,
        recurrence: r.recurrence,
        date: r.targetDate,
        alertTime: r.alertTime,
        isPrayerTask: r.isPrayerTask,
        isPinned: r.isPinned,
        subtasks: r.subtasks || [],
        brief: r.brief || {},
        createdAt: r.createdAt
          ? new Date(r.createdAt as string | number | Date).toISOString()
          : new Date().toISOString(),
        updatedAt: r.updatedAt
          ? new Date(r.updatedAt as string | number | Date).toISOString()
          : new Date().toISOString(),
      }));

      return res.status(200).json({ ok: true, tasks: tasksResponse });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error: unknown) {
    console.error('Tasks Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: message });
  }
};

export default withValidation(handler);
