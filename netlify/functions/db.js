/**
 * Netlify Serverless Function — Neon Postgres CRUD
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

// ── CORS: تقييد الوصول لنطاق Netlify الخاص بالتطبيق فقط ─────────────────
const ALLOWED_ORIGINS = [
  process.env.URL,           // رابط Netlify التلقائي (مثل https://your-app.netlify.app)
  process.env.DEPLOY_URL,    // رابط النشر المحدد
  "http://localhost:5173",   // بيئة التطوير المحلية Vite
  "http://localhost:4173",   // بيئة المعاينة Vite Preview
];

function getCorsHeaders(requestOrigin) {
  // تحقق من أن الطلب قادم من نطاق مسموح به
  const origin = ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS.find(Boolean) ?? "*"; // fallback آمن في حالة غياب ENV vars

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin", // مهم: يخبر المتصفح أن الاستجابة تعتمد على الـ Origin
    "Content-Type": "application/json",
  };
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

/** استجابة JSON موحّدة */
const respond = (statusCode, body, corsHeaders) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  const requestOrigin = event.headers?.origin ?? "";
  const CORS = getCorsHeaders(requestOrigin);

  /* ── Preflight CORS ── */
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  /* ── التحقق من DATABASE_URL ── */
  if (!process.env.DATABASE_URL) {
    return respond(503, {
      error: "DATABASE_URL غير مضبوط. فعّل Neon من Netlify Dashboard.",
    }, CORS);
  }

  const sql = neon(process.env.DATABASE_URL);
  const resource = event.queryStringParameters?.resource;
  const method   = event.httpMethod;

  // ── رفض الطلبات غير المدعومة مبكراً ────────────────────────────────────
  if (method !== "GET" && method !== "POST") {
    return respond(405, { error: `الطريقة ${method} غير مدعومة` }, CORS);
  }

  try {
    await ensureSchema(sql);

    /* ─── Tasks Definition ─── */
    if (resource === "tasks") {
      if (method === "GET") {
        const rows = await sql`SELECT data, updated_at FROM tasks_definition WHERE id = 1`;
        return respond(200, {
          tasks:     rows[0]?.data ?? null,
          updatedAt: rows[0]?.updated_at ?? null,
        }, CORS);
      }

      if (method === "POST") {
        let body;
        try {
          body = JSON.parse(event.body ?? "{}");
        } catch {
          return respond(400, { error: "Body غير صالح (invalid JSON)" }, CORS);
        }

        const { tasks } = body;
        if (!Array.isArray(tasks)) {
          return respond(400, { error: "tasks يجب أن يكون مصفوفة" }, CORS);
        }

        // حماية ضد المصفوفات الضخمة جداً
        if (tasks.length > 500) {
          return respond(400, { error: "عدد المهام تجاوز الحد المسموح (500)" }, CORS);
        }

        await sql`
          INSERT INTO tasks_definition (id, data, updated_at)
          VALUES (1, ${JSON.stringify(tasks)}, NOW())
          ON CONFLICT (id) DO UPDATE
            SET data = EXCLUDED.data, updated_at = NOW()
        `;
        return respond(200, { ok: true }, CORS);
      }
    }

    /* ─── Daily State ─── */
    if (resource === "daily") {
      if (method === "GET") {
        const date = event.queryStringParameters?.date;
        if (!date) return respond(400, { error: "date مطلوب" }, CORS);
        if (!isValidDate(date)) return respond(400, { error: "صيغة التاريخ غير صحيحة (YYYY-MM-DD)" }, CORS);

        const rows = await sql`
          SELECT checked, sub_checked, updated_at FROM daily_state WHERE date = ${date}
        `;
        return respond(200, {
          checked:    rows[0]?.checked    ?? {},
          subChecked: rows[0]?.sub_checked ?? {},
          updatedAt:  rows[0]?.updated_at  ?? null,
        }, CORS);
      }

      if (method === "POST") {
        let body;
        try {
          body = JSON.parse(event.body ?? "{}");
        } catch {
          return respond(400, { error: "Body غير صالح (invalid JSON)" }, CORS);
        }

        const { date, checked, subChecked } = body;
        if (!date) return respond(400, { error: "date مطلوب" }, CORS);
        if (!isValidDate(date)) return respond(400, { error: "صيغة التاريخ غير صحيحة (YYYY-MM-DD)" }, CORS);

        // التحقق من أن البيانات objects وليست أنواعاً خطأ
        if (checked !== undefined && (typeof checked !== "object" || Array.isArray(checked))) {
          return respond(400, { error: "checked يجب أن يكون object" }, CORS);
        }
        if (subChecked !== undefined && (typeof subChecked !== "object" || Array.isArray(subChecked))) {
          return respond(400, { error: "subChecked يجب أن يكون object" }, CORS);
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
        return respond(200, { ok: true }, CORS);
      }
    }

    return respond(400, { error: `resource غير معروف: ${resource}` }, CORS);

  } catch (err) {
    // لا تكشف تفاصيل الخطأ الداخلية في بيئة الإنتاج
    const isDev = process.env.CONTEXT === "dev" || process.env.NETLIFY_DEV === "true";
    console.error("[db function error]", err);
    return respond(500, {
      error: "خطأ داخلي في الخادم",
      ...(isDev && { detail: err.message }),
    }, CORS);
  }
};
