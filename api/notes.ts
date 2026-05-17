import { applyRateLimit } from './middleware/rateLimit.ts';
import { setCorsHeaders } from './_shared/cors.ts';
import { requireAuth } from './_shared/auth.ts';
import { db } from './_shared/db.ts';
import { calendarNotes, calendarNotesRel } from '../src/db/schema.ts';
import { eq, notInArray, and } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rateLimit = applyRateLimit(req, 'notes', 'general');
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: rateLimit.message });
  }

  const { method } = req;

  try {
    const authPayload = await requireAuth(req, res);
    if (!authPayload) return;
    const userId = authPayload.userId;

    if (method === 'GET') {
      const rows = await db.select().from(calendarNotes).where(eq(calendarNotes.id, 1));
      return res.status(200).json({
        notes: rows[0]?.data ?? [],
        updatedAt: rows[0]?.updatedAt ?? null,
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

      const badPinned = data.find((n: any) => 'pinned' in n && typeof n.pinned !== 'boolean');
      if (badPinned) {
        return res.status(400).json({ error: 'الحقل "pinned" يجب أن يكون قيمة منطقية (boolean)' });
      }

      await db.transaction(async (tx) => {
        // Legacy JSONB Write
        await tx
          .insert(calendarNotes)
          .values({
            id: 1,
            data: data,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: calendarNotes.id,
            set: {
              data: data,
              updatedAt: new Date(),
            },
          });

        // Relational Dual-Write
        if (userId) {
          const itemIds = data.map((d: any) => d.id).filter((id: any) => id != null);
          if (itemIds.length > 0) {
            await tx
              .delete(calendarNotesRel)
              .where(
                and(eq(calendarNotesRel.userId, userId), notInArray(calendarNotesRel.id, itemIds))
              );
          } else {
            await tx.delete(calendarNotesRel).where(eq(calendarNotesRel.userId, userId));
          }

          for (const item of data) {
            if (!item.id) continue;

            const insertData = {
              id: item.id,
              userId: userId,
              noteDate: item.date || new Date().toISOString(),
              noteText: item.text || '',
              isPinned: item.isPinned ?? item.pinned ?? false,
              tags: item.tags || [],
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
            };

            await tx
              .insert(calendarNotesRel)
              .values(insertData)
              .onConflictDoUpdate({
                target: calendarNotesRel.id,
                set: {
                  ...insertData,
                  updatedAt: new Date(),
                },
              });
          }
        }
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error: any) {
    console.error('Notes Error:', error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
