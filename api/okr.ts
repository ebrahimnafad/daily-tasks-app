/* eslint-disable @typescript-eslint/no-explicit-any */
import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth } from './_shared/auth.js';
import { db } from './_shared/db.js';
import { z } from 'zod';
import type { ApiRequest, ApiResponse } from './_shared/types.js';
import { okrResourceMap, checkInsHandler } from './_shared/okr/index.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { method } = req;
  const resource = req.query.resource as string;

  try {
    const authPayload = await requireAuth(req, res);
    if (!authPayload) return;
    const userId = authPayload.userId;

    // ── GET /api/okr?resource=sync-all ──────────────────────────────────────
    if (resource === 'sync-all' && method === 'GET') {
      const since = req.query.since as string | undefined;

      const [cycles, objectives, keyResults, checkIns] = await Promise.all([
        okrResourceMap['cycles'].get(userId),
        okrResourceMap['objectives'].get(userId),
        okrResourceMap['key-results'].get(userId),
        checkInsHandler.get(userId, since),
      ]);

      return res.status(200).json({ cycles, objectives, keyResults, checkIns });
    }

    // ── POST /api/okr?resource=check-ins ────────────────────────────────────
    // Check-ins use append-only semantics and atomic currentValue increment.
    // They cannot be batched through the standard upsert handler.
    if (resource === 'check-ins') {
      if (method === 'GET') {
        const since = req.query.since as string | undefined;
        const data = await checkInsHandler.get(userId, since);
        return res.status(200).json({ checkIns: data });
      }

      if (method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
        const rawData = body.checkIns;

        if (!Array.isArray(rawData)) {
          return res.status(400).json({ error: 'الحقل المطلوب مفقود: checkIns (مصفوفة)' });
        }

        const parsed = z.array(checkInsHandler.schema).safeParse(rawData);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: 'بيانات تسجيل التقدم غير صالحة', details: parsed.error.issues });
        }

        if (parsed.data.length > 500) {
          return res
            .status(400)
            .json({ error: 'تجاوز الحد المسموح (500 تسجيل في الدفعة الواحدة)' });
        }

        // Each check-in gets its own transaction to ensure atomic currentValue update.
        for (const item of parsed.data) {
          await db.transaction(async (tx) => {
            await checkInsHandler.post(userId, item, tx);
          });
        }

        return res.status(200).json({ ok: true });
      }

      return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
    }

    // ── Standard resource: cycles / objectives / key-results ─────────────────
    const resourceHandler = okrResourceMap[resource];
    if (!resourceHandler) {
      return res.status(400).json({ error: `مورد غير معروف: ${resource}` });
    }

    if (method === 'GET') {
      const data = await resourceHandler.get(userId);
      return res.status(200).json({ [resourceHandler.field]: data });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const rawData = body[resourceHandler.field];

      if (!Array.isArray(rawData)) {
        return res.status(400).json({ error: `الحقل المطلوب مفقود: ${resourceHandler.field}` });
      }

      const parsed = z.array(resourceHandler.schema).safeParse(rawData);
      if (!parsed.success) {
        return res.status(400).json({ error: 'البيانات غير صالحة', details: parsed.error.issues });
      }

      if (parsed.data.length > 1000) {
        return res.status(400).json({ error: 'تجاوز الحد المسموح (1000 عنصر)' });
      }

      await db.transaction(async (tx) => {
        await resourceHandler.post(userId, parsed.data, tx);
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  } catch (error: any) {
    console.error(`OKR API Error (${resource}):`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: message });
  }
}
