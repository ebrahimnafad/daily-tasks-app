/**
 * Vercel Serverless Function — Neon Postgres CRUD
 *
 * Routes (via /api/db?resource=X):
 *   GET  /api/db?resource=tasks              → جلب تعريفات المهام
 *   POST /api/db?resource=tasks              → حفظ تعريفات المهام
 *   GET  /api/db?resource=daily&date=YYYY-MM-DD → جلب الحالة اليومية
 *   POST /api/db?resource=daily              → حفظ الحالة اليومية
 *
 * يتطلب Environment Variable: DATABASE_URL
 */

import { neon } from "@neondatabase/serverless";

// ── CORS: تقييد الوصول ──────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
].filter(Boolean);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || "*";
  
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

// ── Regex للتحقق من صيغة التاريخ YYYY-MM-DD ──────────────────────────────
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(str) {
  if (!DATE_REGEX.test(str)) return false;
  const d = new Date(str);
  return d instanceof Date && !isNaN(d.getTime());
}

/** إنشاء الجداول إذا لم تكن موجودة (idempotent) */
async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS tasks_definition (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row CHECK (id = 1)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS daily_state (
      date        DATE PRIMARY KEY,
      checked     JSONB DEFAULT '{}',
      sub_checked JSONB DEFAULT '{}',
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  /* ── Preflight CORS ── */
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  /* ── التحقق من DATABASE_URL ── */
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      error: "DATABASE_URL غير مضبوط. فعّل Neon في Vercel Dashboard.",
    });
  }

  const sql = neon(process.env.DATABASE_URL);
  const resource = req.query.resource;
  const method = req.method;

  // ── رفض الطلبات غير المدعومة مبكراً ────────────────────────────────────
  if (method !== "GET" && method !== "POST") {
    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  }

  try {
    await ensureSchema(sql);

    /* ─── Tasks Definition ─── */
    if (resource === "tasks") {
      if (method === "GET") {
        const rows = await sql`SELECT data, updated_at FROM tasks_definition WHERE id = 1`;
        return res.status(200).json({
          tasks:     rows[0]?.data ?? null,
          updatedAt: rows[0]?.updated_at ?? null,
        });
      }

      if (method === "POST") {
        // Vercel parses JSON bodies automatically if Content-Type is application/json
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { tasks } = body;

        if (!Array.isArray(tasks)) {
          return res.status(400).json({ error: "tasks يجب أن يكون مصفوفة" });
        }

        if (tasks.length > 500) {
          return res.status(400).json({ error: "عدد المهام تجاوز الحد المسموح (500)" });
        }

        await sql`
          INSERT INTO tasks_definition (id, data, updated_at)
          VALUES (1, ${JSON.stringify(tasks)}, NOW())
          ON CONFLICT (id) DO UPDATE
            SET data = EXCLUDED.data, updated_at = NOW()
        `;
        return res.status(200).json({ ok: true });
      }
    }

    /* ─── Daily State ─── */
    if (resource === "daily") {
      if (method === "GET") {
        const date = req.query.date;
        if (!date) return res.status(400).json({ error: "date مطلوب" });
        if (!isValidDate(date)) return res.status(400).json({ error: "صيغة التاريخ غير صحيحة (YYYY-MM-DD)" });

        const rows = await sql`
          SELECT checked, sub_checked, updated_at FROM daily_state WHERE date = ${date}
        `;
        return res.status(200).json({
          checked:    rows[0]?.checked    ?? {},
          subChecked: rows[0]?.sub_checked ?? {},
          updatedAt:  rows[0]?.updated_at  ?? null,
        });
      }

      if (method === "POST") {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { date, checked, subChecked } = body;
        
        if (!date) return res.status(400).json({ error: "date مطلوب" });
        if (!isValidDate(date)) return res.status(400).json({ error: "صيغة التاريخ غير صحيحة (YYYY-MM-DD)" });

        if (checked !== undefined && (typeof checked !== "object" || Array.isArray(checked))) {
          return res.status(400).json({ error: "checked يجب أن يكون object" });
        }
        if (subChecked !== undefined && (typeof subChecked !== "object" || Array.isArray(subChecked))) {
          return res.status(400).json({ error: "subChecked يجب أن يكون object" });
        }

        await sql`
          INSERT INTO daily_state (date, checked, sub_checked, updated_at)
          VALUES (
            ${date},
            ${JSON.stringify(checked  ?? {})},
            ${JSON.stringify(subChecked ?? {})},
            NOW()
          )
          ON CONFLICT (date) DO UPDATE
            SET checked     = EXCLUDED.checked,
                sub_checked = EXCLUDED.sub_checked,
                updated_at  = NOW()
        `;
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(400).json({ error: `resource غير معروف: ${resource}` });

  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    console.error("[db function error]", err);
    return res.status(500).json({
      error: "خطأ داخلي في الخادم",
      ...(isDev && { detail: err.message }),
    });
  }
}
