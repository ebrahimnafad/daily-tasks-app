import { neon } from '@neondatabase/serverless';
import { applyRateLimit } from './middleware/rateLimit.js';
import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rateLimit = applyRateLimit(req, 'schedule', 'general');
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
      const rows = await sql`SELECT data, updated_at FROM schedule_config WHERE id = 1`;
      return res.status(200).json({
        schedule: rows[0]?.data ?? null,
        updatedAt: rows[0]?.updated_at ?? null,
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { schedule } = body;

      if (!Array.isArray(schedule)) {
        return res.status(400).json({ error: 'schedule يجب أن يكون مصفوفة' });
      }

      await sql`
        INSERT INTO schedule_config (id, data, updated_at)
        VALUES (1, ${JSON.stringify(schedule)}::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE
          SET data = EXCLUDED.data, updated_at = NOW()
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error) {
    console.error('Schedule Error:', error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
