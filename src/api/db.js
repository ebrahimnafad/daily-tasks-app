/* eslint-env node */
/**
 * Vercel Serverless Function — Neon Postgres CRUD
 *
 * Routes (via /api/db?resource=X):
 *   GET|POST  /api/db?resource=tasks         → تعريفات المهام
 *   GET|POST  /api/db?resource=daily         → الحالة اليومية
 *   GET|POST  /api/db?resource=income        → مصادر الدخل
 *   GET|POST  /api/db?resource=obligations   → الالتزامات المالية
 *   GET|POST  /api/db?resource=payments      → سجلات الدفع
 *   GET|POST  /api/db?resource=goals         → أهداف الادخار
 *
 * يتطلب Environment Variable: DATABASE_URL
 */

import { neon } from '@neondatabase/serverless';
import { applyRateLimit } from './middleware/rateLimit.js';

// ── CORS: تقييد الوصول ──────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
].filter(Boolean);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  if (!origin) {
    return;
  }

  if (!ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', 'null');
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
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
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row CHECK (id = 1)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_state (
      date        DATE PRIMARY KEY,
      checked     JSONB DEFAULT '{}',
      sub_checked JSONB DEFAULT '{}',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS schedule_config (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row_schedule CHECK (id = 1)
    )
  `;

  // ── Finance tables ──
  await sql`
    CREATE TABLE IF NOT EXISTS finance_income (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row_income CHECK (id = 1)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS finance_obligations (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row_obligations CHECK (id = 1)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS finance_payments (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row_payments CHECK (id = 1)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS finance_goals (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row_goals CHECK (id = 1)
    )
  `;

  // ── Add indexes on updated_at for time-based queries ──
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks_definition(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_daily_state_updated_at ON daily_state(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_schedule_updated_at ON schedule_config(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_finance_updated_at ON finance_income(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_finance_obligations_updated_at ON finance_obligations(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_finance_payments_updated_at ON finance_payments(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_finance_goals_updated_at ON finance_goals(updated_at)`;
}

// ── Generic JSONB single-row handler (DRY) ──
const FINANCE_TABLES = {
  income: { table: 'finance_income', field: 'income' },
  obligations: { table: 'finance_obligations', field: 'obligations' },
  payments: { table: 'finance_payments', field: 'payments' },
  goals: { table: 'finance_goals', field: 'goals' },
};

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  /* ── Preflight CORS ── */
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  /* ── Rate Limiting ── */
  const resource = req.query.resource;
  const limiterKey = resource === 'daily' || resource === 'tasks' ? 'sync' : 'general';
  const rateLimit = applyRateLimit(req, resource || 'unknown', limiterKey);

  if (!rateLimit.allowed) {
    return res.status(429).json({ error: rateLimit.message });
  }

  /* ── التحقق من DATABASE_URL ── */
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      error: 'DATABASE_URL غير مضبوط. فعّل Neon في Vercel Dashboard.',
    });
  }

  const sql = neon(process.env.DATABASE_URL);
  const method = req.method;

  // ── رفض الطلبات غير المدعومة مبكراً ────────────────────────────────────
  if (method !== 'GET' && method !== 'POST') {
    return res.status(405).json({ error: `الطريقة ${method} غير مدعومة` });
  }

  try {
    await ensureSchema(sql);

    /* ─── Tasks Definition ─── */
    if (resource === 'tasks') {
      if (method === 'GET') {
        const rows = await sql`SELECT data, updated_at FROM tasks_definition WHERE id = 1`;
        return res.status(200).json({
          tasks: rows[0]?.data ?? null,
          updatedAt: rows[0]?.updated_at ?? null,
        });
      }

      if (method === 'POST') {
        // Vercel parses JSON bodies automatically if Content-Type is application/json
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
        const { tasks } = body;

        if (!Array.isArray(tasks)) {
          return res.status(400).json({ error: 'tasks يجب أن يكون مصفوفة' });
        }

        if (tasks.length > 500) {
          return res.status(400).json({ error: 'عدد المهام تجاوز الحد المسموح (500)' });
        }

        await sql`
          INSERT INTO tasks_definition (id, data, updated_at)
          VALUES (1, ${JSON.stringify(tasks)}::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE
            SET data = EXCLUDED.data, updated_at = NOW()
        `;
        return res.status(200).json({ ok: true });
      }
    }

    /* ─── Schedule Config ─── */
    if (resource === 'schedule') {
      if (method === 'GET') {
        const rows = await sql`SELECT data, updated_at FROM schedule_config WHERE id = 1`;
        return res.status(200).json({
          schedule: rows[0]?.data ?? null,
          updatedAt: rows[0]?.updated_at ?? null,
        });
      }

      if (method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
        const { schedule } = body;

        if (!Array.isArray(schedule)) {
          return res.status(400).json({ error: 'schedule يجب أن يكون مصفوفة' });
        }

        await sql`
          INSERT INTO schedule_config (id, data, updated_at)
          VALUES (1, ${JSON.stringify(schedule)}::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE
            SET data = EXCLUDED.data, updated_at = NOW()
        `;
        return res.status(200).json({ ok: true });
      }
    }

    /* ─── Daily State ─── */
    if (resource === 'daily') {
      if (method === 'GET') {
        const date = req.query.date;
        if (!date) return res.status(400).json({ error: 'date مطلوب' });
        if (!isValidDate(date))
          return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)' });

        const rows = await sql`
          SELECT checked, sub_checked, updated_at FROM daily_state WHERE date = ${date}
        `;
        return res.status(200).json({
          checked: rows[0]?.checked ?? {},
          subChecked: rows[0]?.sub_checked ?? {},
          updatedAt: rows[0]?.updated_at ?? null,
        });
      }

      if (method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
        const { date, checked, subChecked } = body;

        if (!date) return res.status(400).json({ error: 'date مطلوب' });
        if (!isValidDate(date))
          return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)' });

        if (checked !== undefined && (typeof checked !== 'object' || Array.isArray(checked))) {
          return res.status(400).json({ error: 'checked يجب أن يكون object' });
        }
        if (
          subChecked !== undefined &&
          (typeof subChecked !== 'object' || Array.isArray(subChecked))
        ) {
          return res.status(400).json({ error: 'subChecked يجب أن يكون object' });
        }

        await sql`
          INSERT INTO daily_state (date, checked, sub_checked, updated_at)
          VALUES (
            ${date},
            ${JSON.stringify(checked ?? {})}::jsonb,
            ${JSON.stringify(subChecked ?? {})}::jsonb,
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

    /* ─── Finance Resources (generic JSONB handler) ─── */
    const finRes = FINANCE_TABLES[resource];
    if (finRes) {
      if (method === 'GET') {
        const rows = await sql(`SELECT data, updated_at FROM ${finRes.table} WHERE id = 1`);
        return res.status(200).json({
          [finRes.field]: rows[0]?.data ?? [],
          updatedAt: rows[0]?.updated_at ?? null,
        });
      }
      if (method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
        const data = body[finRes.field];
        if (!Array.isArray(data)) {
          return res.status(400).json({ error: `${finRes.field} يجب أن يكون مصفوفة` });
        }
        if (data.length > 1000) {
          return res.status(400).json({ error: 'تجاوز الحد المسموح (1000 عنصر)' });
        }
        await sql(
          `
          INSERT INTO ${finRes.table} (id, data, updated_at)
          VALUES (1, $1::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE
            SET data = EXCLUDED.data, updated_at = NOW()
        `,
          [JSON.stringify(data)]
        );
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(400).json({ error: `resource غير معروف: ${resource}` });
  } catch (err) {
    const isDev = process.env.NODE_ENV === 'development';
    console.error('[db function error]', err);
    return res.status(500).json({
      error: 'خطأ داخلي في الخادم',
      ...(isDev && { detail: err.message }),
    });
  }
}
