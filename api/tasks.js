import { neon } from '@neondatabase/serverless';
import { applyRateLimit } from './middleware/rateLimit.js';
import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';
import { z } from 'zod';
import { TaskSchema } from '../src/validation/schemas.ts';
export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rateLimit = applyRateLimit(req, 'tasks', 'sync');
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: rateLimit.message });
  }

  if (!process.env.DATABASE_URL) {
    return res
      .status(503)
      .json({ error: 'DATABASE_URL غير مضبوط. فعّل Neon في Vercel Dashboard.' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { method } = req;

  try {
    const authPayload = await requireAuth(req, res);
    if (!authPayload) return;

    if (method === 'GET') {
      const rows = await sql`SELECT * FROM tasks WHERE user_id = ${authPayload.userId}`;
      const tasks = rows.map((r) => ({
        id: r.id,
        icon: r.icon,
        title: r.title,
        category: r.category,
        color: r.color,
        shifts: r.shifts || [],
        timeBlock: r.time_block,
        isWarning: r.is_warning,
        recurrence: r.recurrence,
        date: r.target_date,
        alertTime: r.alert_time,
        isPrayerTask: r.is_prayer_task,
        isPinned: r.is_pinned,
        subtasks: r.subtasks || [],
        brief: r.brief || {},
        createdAt: r.created_at?.toISOString() || new Date().toISOString(),
        updatedAt: r.updated_at?.toISOString() || new Date().toISOString(),
      }));

      let maxUpdatedAt = null;
      if (tasks.length > 0) {
        maxUpdatedAt = new Date(
          Math.max(...tasks.map((t) => new Date(t.updatedAt).getTime()))
        ).toISOString();
      }

      return res.status(200).json({
        tasks,
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
      const tasks = parsedTasks.data;

      if (tasks.length > 500) {
        return res.status(400).json({ error: 'عدد المهام تجاوز الحد المسموح (500)' });
      }

      const userId = authPayload.userId;
      await sql.begin(async (t) => {
        const taskIds = tasks.map((tk) => tk.id).filter((id) => id != null);
        if (taskIds.length > 0) {
          await t`DELETE FROM tasks WHERE user_id = ${userId} AND id != ALL(${taskIds})`;
        } else {
          await t`DELETE FROM tasks WHERE user_id = ${userId}`;
        }

        for (const task of tasks) {
          if (task.id == null) continue;
          await t`
            INSERT INTO tasks (
              id, user_id, icon, title, category, color, shifts, time_block,
              is_warning, recurrence, target_date, alert_time,
              is_prayer_task, is_pinned, subtasks, brief,
              created_at, updated_at
            ) VALUES (
              ${task.id}, ${userId}, ${task.icon || null}, ${task.title || ''},
              ${task.category || null}, ${task.color || null},
              ${task.shifts ? JSON.stringify(task.shifts) : '[]'}::jsonb,
              ${task.timeBlock || null}, ${task.isWarning || false},
              ${task.recurrence || null}, ${task.date || null},
              ${task.alertTime || null}, ${task.isPrayerTask || false},
              ${task.isPinned || false},
              ${task.subtasks ? JSON.stringify(task.subtasks) : '[]'}::jsonb,
              ${task.brief ? JSON.stringify(task.brief) : '{}'}::jsonb,
              ${task.createdAt || new Date().toISOString()},
              ${task.updatedAt || new Date().toISOString()}
            )
            ON CONFLICT (id) DO UPDATE SET
              icon = EXCLUDED.icon,
              title = EXCLUDED.title,
              category = EXCLUDED.category,
              color = EXCLUDED.color,
              shifts = EXCLUDED.shifts,
              time_block = EXCLUDED.time_block,
              is_warning = EXCLUDED.is_warning,
              recurrence = EXCLUDED.recurrence,
              target_date = EXCLUDED.target_date,
              alert_time = EXCLUDED.alert_time,
              is_prayer_task = EXCLUDED.is_prayer_task,
              is_pinned = EXCLUDED.is_pinned,
              subtasks = EXCLUDED.subtasks,
              brief = EXCLUDED.brief,
              updated_at = NOW()
          `;
        }
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error) {
    console.error('Tasks Error:', error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
