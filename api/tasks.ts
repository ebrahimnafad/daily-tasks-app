import { applyRateLimit } from './middleware/rateLimit.js';
import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';
import { z } from 'zod';
import { TaskSchema } from '../src/validation/schemas.js';
import { db } from './_shared/db.js';
import { tasks } from '../src/db/schema.js';
import { eq, inArray, notInArray, and } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rateLimit = applyRateLimit(req, 'tasks', 'sync');
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: rateLimit.message });
  }

  const { method } = req;

  try {
    const authPayload = await requireAuth(req, res);
    if (!authPayload) return;
    const userId = authPayload.userId;

    if (method === 'GET') {
      const rows = await db.select().from(tasks).where(eq(tasks.userId, userId));

      const tasksResponse = rows.map((r: any) => ({
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
        createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: r.updatedAt?.toISOString() || new Date().toISOString(),
      }));

      let maxUpdatedAt = null;
      if (tasksResponse.length > 0) {
        maxUpdatedAt = new Date(
          Math.max(...tasksResponse.map((t: any) => new Date(t.updatedAt).getTime()))
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

      await db.transaction(async (tx) => {
        const taskIds = incomingTasks.map((tk: any) => tk.id).filter((id: any) => id != null);

        if (taskIds.length > 0) {
          await tx
            .delete(tasks)
            .where(and(eq(tasks.userId, userId), notInArray(tasks.id, taskIds)));
        } else {
          await tx.delete(tasks).where(eq(tasks.userId, userId));
        }

        for (const task of incomingTasks) {
          if (task.id == null) continue;

          const insertData = {
            id: task.id,
            userId: userId,
            icon: task.icon || null,
            title: task.title || '',
            category: task.category || null,
            color: task.color || null,
            shifts: task.shifts || [],
            timeBlock: task.timeBlock || null,
            isWarning: task.isWarning || false,
            recurrence: task.recurrence || null,
            targetDate: task.date || null,
            alertTime: task.alertTime || null,
            isPrayerTask: task.isPrayerTask || false,
            isPinned: task.isPinned || false,
            subtasks: task.subtasks || [],
            brief: task.brief || {},
            createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
            updatedAt: task.updatedAt ? new Date(task.updatedAt) : new Date(),
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

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error: any) {
    console.error('Tasks Error:', error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
