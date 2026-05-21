/* eslint-disable @typescript-eslint/no-explicit-any */
import { setCorsHeaders } from './cors.js';
import { requireAuth } from './auth.js';
import type { ApiRequest, ApiResponse } from './types.js';
import { db } from './db.js';
import { z } from 'zod';
import type { FinanceResourceHandler } from './finance/types.js';

export async function handleFinance(
  req: ApiRequest,
  res: ApiResponse,
  handler: FinanceResourceHandler
) {
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
      const data = await handler.get(userId);

      let maxUpdatedAt = null;
      if (data.length > 0) {
        maxUpdatedAt = new Date(
          Math.max(...data.map((d: any) => new Date(d.updatedAt as string).getTime()))
        ).toISOString();
      }

      return res.status(200).json({
        [handler.field]: data,
        updatedAt: maxUpdatedAt,
      });
    }

    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const rawData = body[handler.field];

      if (!rawData) {
        return res.status(400).json({ error: `الحقل المطلوب مفقود: ${handler.field}` });
      }

      const parsedData = z.array(handler.schema).safeParse(rawData);

      if (!parsedData.success) {
        return res
          .status(400)
          .json({ error: 'البيانات غير صالحة', details: parsedData.error.issues });
      }

      const data = parsedData.data;

      if (data.length > 1000) {
        return res.status(400).json({ error: 'تجاوز الحد المسموح (1000 عنصر)' });
      }

      await db.transaction(async (tx) => {
        await handler.post(userId, data, tx);
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
    console.error(`Finance Error (${handler.field}):`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: message });
  }
}
