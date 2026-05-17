import { neon } from '@neondatabase/serverless';
import { applyRateLimit } from './middleware/rateLimit.js';
import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';
import { validateNote } from './_shared/utils.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rateLimit = applyRateLimit(req, 'notes', 'general');
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
      const rows = await sql`SELECT data, updated_at FROM calendar_notes WHERE id = 1`;
      return res.status(200).json({
        notes: rows[0]?.data ?? [],
        updatedAt: rows[0]?.updated_at ?? null,
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const data = body.notes;
      if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'notes يجب أن يكون مصفوفة' });
      }
      if (data.length > 1000) {
        return res.status(400).json({ error: 'تجاوز الحد المسموح (1000 عنصر)' });
      }

      for (let i = 0; i < data.length; i++) {
        const err = validateNote(data[i], i);
        if (err) return res.status(400).json({ error: `بيانات الملاحظات غير صحيحة: ${err}` });
      }
      
      const badPinned = data.find((n) => 'pinned' in n && typeof n.pinned !== 'boolean');
      if (badPinned) {
        return res.status(400).json({ error: 'الحقل "pinned" يجب أن يكون قيمة منطقية (boolean)' });
      }

      const jsonData = JSON.stringify(data);
      
      // Legacy JSONB Write
      await sql`
        INSERT INTO calendar_notes (id, data, updated_at)
        VALUES (1, ${jsonData}::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `;

      // Relational Dual-Write
      const userId = authPayload.userId;
      if (userId) {
        try {
          await sql.begin(async (t) => {
            const itemIds = data.map((d) => d.id).filter((id) => id != null);
            if (itemIds.length > 0) {
              await t`DELETE FROM calendar_notes_rel WHERE user_id = ${userId} AND id != ALL(${itemIds})`;
            } else {
              await t`DELETE FROM calendar_notes_rel WHERE user_id = ${userId}`;
            }

            for (const item of data) {
              if (!item.id) continue;
              await t`
                INSERT INTO calendar_notes_rel (
                  id, user_id, note_date, note_text, is_pinned, tags, created_at, updated_at
                ) VALUES (
                  ${item.id}, ${userId}, ${item.date || new Date().toISOString()}, ${item.text || ''}, ${item.isPinned ?? item.pinned ?? false}, ${item.tags ? JSON.stringify(item.tags) : '[]'}::jsonb, ${item.createdAt || new Date().toISOString()}, ${item.updatedAt || new Date().toISOString()}
                ) ON CONFLICT (id) DO UPDATE SET
                  note_date = EXCLUDED.note_date,
                  note_text = EXCLUDED.note_text,
                  is_pinned = EXCLUDED.is_pinned,
                  tags = EXCLUDED.tags,
                  updated_at = NOW()
              `;
            }
          });
        } catch (err) {
          console.error('Dual-write error for notes:', err);
        }
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error) {
    console.error('Notes Error:', error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
