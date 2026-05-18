import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';
import { db } from './_shared/db.js';
import { calendarNotesRel } from '../src/db/schema.js';
import { eq, notInArray, and } from 'drizzle-orm';
import { z } from 'zod';
import { NoteSchema } from '../src/validation/schemas.js';
import type { ApiRequest, ApiResponse } from './_shared/types.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
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
      const rows = await db
        .select()
        .from(calendarNotesRel)
        .where(eq(calendarNotesRel.userId, userId));

      const notes = rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        date: r.noteDate,
        text: r.noteText,
        isPinned: r.isPinned,
        pinned: r.isPinned,
        tags: r.tags,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      const maxUpdated =
        rows.length > 0
          ? new Date(
              Math.max(
                ...rows.map((r: Record<string, unknown>) =>
                  new Date((r.updatedAt as string) || new Date()).getTime()
                )
              )
            )
          : null;

      return res.status(200).json({
        notes,
        updatedAt: maxUpdated,
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

      const parsedNotes = z.array(NoteSchema).safeParse(body.notes);
      if (!parsedNotes.success) {
        return res
          .status(400)
          .json({ error: 'بيانات غير صالحة', details: parsedNotes.error.issues });
      }

      const data = parsedNotes.data;

      if (data.length > 1000) {
        return res.status(400).json({ error: 'تجاوز الحد المسموح (1000 عنصر)' });
      }

      if (userId) {
        const itemIds = data
          .map((d: Record<string, unknown>) => String(d.id))
          .filter((id: string) => id !== 'undefined' && id !== 'null');
        if (itemIds.length > 0) {
          await db
            .delete(calendarNotesRel)
            .where(
              and(eq(calendarNotesRel.userId, userId), notInArray(calendarNotesRel.id, itemIds))
            );
        } else {
          await db.delete(calendarNotesRel).where(eq(calendarNotesRel.userId, userId));
        }

        for (const item of data) {
          if (!item.id) continue;

          const insertData = {
            id: String(item.id),
            userId: userId,
            noteDate: item.date || new Date().toISOString(),
            noteText: item.text || '',
            isPinned: item.isPinned ?? item.pinned ?? false,
            tags: item.tags || [],
            createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          };

          await db
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

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error: unknown) {
    console.error('Notes Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: message });
  }
}
