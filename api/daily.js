import { neon } from '@neondatabase/serverless';
import { applyRateLimit } from './middleware/rateLimit.js';
import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';
import { isValidDate } from './_shared/utils.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rateLimit = applyRateLimit(req, 'daily', 'sync');
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
      const { date } = req.query;
      if (!date) return res.status(400).json({ error: 'date مطلوب' });
      if (!isValidDate(date))
        return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)' });

      const rows = await sql`
        SELECT checked, sub_checked, skipped, updated_at FROM daily_state WHERE date = ${date}
      `;
      return res.status(200).json({
        checked: rows[0]?.checked ?? {},
        subChecked: rows[0]?.sub_checked ?? {},
        skipped: rows[0]?.skipped ?? {},
        updatedAt: rows[0]?.updated_at ?? null,
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { date, checked, subChecked, skipped } = body;

      if (!date) return res.status(400).json({ error: 'date مطلوب' });
      if (!isValidDate(date))
        return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)' });

      if (checked !== undefined && (typeof checked !== 'object' || Array.isArray(checked))) {
        return res.status(400).json({ error: 'checked يجب أن يكون object' });
      }
      if (subChecked !== undefined && (typeof subChecked !== 'object' || Array.isArray(subChecked))) {
        return res.status(400).json({ error: 'subChecked يجب أن يكون object' });
      }

      await sql`
        INSERT INTO daily_state (date, checked, sub_checked, skipped, updated_at)
        VALUES (
          ${date},
          ${JSON.stringify(checked ?? {})}::jsonb,
          ${JSON.stringify(subChecked ?? {})}::jsonb,
          ${JSON.stringify(skipped ?? {})}::jsonb,
          NOW()
        )
        ON CONFLICT (date) DO UPDATE
          SET checked     = EXCLUDED.checked,
              sub_checked = EXCLUDED.sub_checked,
              skipped     = EXCLUDED.skipped,
              updated_at  = NOW()
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error) {
    console.error('Daily Error:', error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
