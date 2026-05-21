import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';
import { db } from './_shared/db.js';
import { calendarNotesRel } from '../src/db/schema.js';
import { eq, notInArray, and, isNull } from 'drizzle-orm';
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
        .where(and(eq(calendarNotesRel.userId, userId), isNull(calendarNotesRel.deletedAt)));

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

      await db.transaction(async (tx) => {
        if (userId) {
          const itemIds = data
            .map((d: Record<string, unknown>) => String(d.id))
            .filter((id: string) => id !== 'undefined' && id !== 'null');

          const existingRecords = await tx
            .select({
              id: calendarNotesRel.id,
              updatedAt: calendarNotesRel.updatedAt,
              deletedAt: calendarNotesRel.deletedAt,
            })
            .from(calendarNotesRel)
            .where(eq(calendarNotesRel.userId, userId));
          const existingMap = new Map(existingRecords.map((r: any) => [r.id, r]));

          if (itemIds.length > 0) {
            await tx
              .update(calendarNotesRel)
              .set({ deletedAt: new Date(), updatedAt: new Date() })
              .where(
                and(
                  eq(calendarNotesRel.userId, userId),
                  notInArray(calendarNotesRel.id, itemIds),
                  isNull(calendarNotesRel.deletedAt)
                )
              );
          } else {
            await tx
              .update(calendarNotesRel)
              .set({ deletedAt: new Date(), updatedAt: new Date() })
              .where(and(eq(calendarNotesRel.userId, userId), isNull(calendarNotesRel.deletedAt)));
          }

          for (const item of data) {
            if (!item.id) continue;

            const existing = existingMap.get(String(item.id));
            if (existing) {
              if (existing.deletedAt) {
                throw {
                  status: 410,
                  message: 'Conflict: Deleted',
                  serverData: existing,
                  entityId: existing.id,
                };
              }
              const clientTs = item.updatedAt ? new Date(item.updatedAt as string).getTime() : 0;
              const serverTs = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
              if (clientTs < serverTs) {
                throw {
                  status: 409,
                  message: 'Conflict: Outdated',
                  serverData: existing,
                  entityId: existing.id,
                };
              }
            }

            const insertData = {
              id: String(item.id),
              userId: userId,
              noteDate: item.date ? String(item.date) : new Date().toISOString(),
              noteText: item.text ? String(item.text) : '',
              isPinned: Boolean(item.isPinned ?? item.pinned ?? false),
              tags: Array.isArray(item.tags) ? item.tags : [],
              createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
              updatedAt: new Date(),
              deletedAt: item.deletedAt ? new Date(item.deletedAt as string) : null,
            };

            await tx.insert(calendarNotesRel).values(insertData).onConflictDoUpdate({
              target: calendarNotesRel.id,
              set: insertData,
            });
          }
        }
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error: any) {
    if (error && (error.status === 409 || error.status === 410)) {
      return res.status(error.status).json({
        error: error.message,
        serverData: error.serverData,
        entityId: error.entityId,
      });
    }
    console.error('Notes Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: message });
  }
}
