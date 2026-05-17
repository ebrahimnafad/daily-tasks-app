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
    return res.status(503).json({ error: 'DATABASE_URL غير مضبوط. فعّل Neon في Vercel Dashboard.' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { method } = req;

  try {
    const authPayload = await requireAuth(req, res);
    if (!authPayload) return;

    if (method === 'GET') {
      const rows = await sql`SELECT data, updated_at FROM tasks_definition WHERE id = 1`;
      return res.status(200).json({
        tasks: rows[0]?.data ?? null,
        updatedAt: rows[0]?.updated_at ?? null,
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      
      const parsedTasks = z.array(TaskSchema).safeParse(body.tasks);
      if (!parsedTasks.success) {
        return res.status(400).json({ error: 'البيانات غير صالحة', details: parsedTasks.error.issues });
      }
      const tasks = parsedTasks.data;

      if (tasks.length > 500) {
        return res.status(400).json({ error: 'عدد المهام تجاوز الحد المسموح (500)' });
      }

      // 1. Legacy JSONB Write
      await sql`
        INSERT INTO tasks_definition (id, data, updated_at)
        VALUES (1, ${JSON.stringify(tasks)}::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE
          SET data = EXCLUDED.data, updated_at = NOW()
      `;

      // 2. Relational Dual-Write (Silent fallback)
      const userId = authPayload.userId;
      if (userId) {
        try {
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
        } catch (err) {
          console.error('Dual-write error for tasks:', err);
        }
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error) {
    console.error('Tasks Error:', error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
