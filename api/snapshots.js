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

  const rateLimit = applyRateLimit(req, 'snapshots', 'general');
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

      if (date) {
        // Single snapshot
        if (!isValidDate(date)) return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة' });
        const rows = await sql`
          SELECT snapshot, updated_at FROM daily_snapshots WHERE date = ${date}
        `;
        return res.status(200).json({
          snapshot: rows[0]?.snapshot ?? null,
          updatedAt: rows[0]?.updated_at ?? null,
        });
      } else {
        // List of summaries
        const rows = await sql`
          SELECT to_char(date, 'YYYY-MM-DD') AS date_str, snapshot->>'progress' AS progress,
                 snapshot->>'countDone' AS count_done,
                 snapshot->>'totalOther' AS total_other
          FROM daily_snapshots
          ORDER BY date DESC
          LIMIT 365
        `;
        return res.status(200).json({
          summaries: rows.map((r) => ({
            date: r.date_str,
            progress: Number(r.progress ?? 0),
            countDone: Number(r.count_done ?? 0),
            totalOther: Number(r.total_other ?? 0),
          })),
        });
      }
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { date, snapshot } = body;
      if (!date || !snapshot) return res.status(400).json({ error: 'date و snapshot مطلوبان' });
      if (!isValidDate(date)) return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة' });
      await sql`
        INSERT INTO daily_snapshots (date, snapshot, updated_at)
        VALUES (${date}, ${JSON.stringify(snapshot)}::jsonb, NOW())
        ON CONFLICT (date) DO UPDATE
          SET snapshot = EXCLUDED.snapshot, updated_at = NOW()
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error) {
    console.error('Snapshots Error:', error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
