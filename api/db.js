/* eslint-env node */
/**
 * Vercel Serverless Function — Neon Postgres CRUD
 *
 * Routes (via /api/db?resource=X):
 *   POST      /api/db?resource=auth&action=setup  → إنشاء الحساب (مرة واحدة)
 *   POST      /api/db?resource=auth&action=login  → تسجيل الدخول → JWT
 *   GET       /api/db?resource=auth&action=me     → التحقق من الجلسة
 *   POST      /api/db?resource=auth&action=change-password → تغيير كلمة المرور
 *   GET|POST  /api/db?resource=tasks         → تعريفات المهام
 *   GET|POST  /api/db?resource=daily         → الحالة اليومية
 *   GET|POST  /api/db?resource=income        → مصادر الدخل
 *   GET|POST  /api/db?resource=obligations   → الالتزامات المالية
 *   GET|POST  /api/db?resource=payments      → سجلات الدفع
 *   GET|POST  /api/db?resource=goals         → أهداف الادخار
 *
 * يتطلب Environment Variables: DATABASE_URL, JWT_SECRET, SETUP_SECRET
 */

import { neon } from '@neondatabase/serverless';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Setup-Secret');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

// ── JWT helpers ──────────────────────────────────────────────────────────
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars!!';
  return new TextEncoder().encode(secret);
};

async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());
}

async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch {
    return null;
  }
}

/** Extracts and verifies the Bearer token. Returns payload or sends 401 and returns null. */
async function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'غير مصرح — يرجى تسجيل الدخول' });
    return null;
  }
  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'جلسة منتهية الصلاحية — يرجى تسجيل الدخول مجدداً' });
    return null;
  }
  return payload;
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
  // ── Users ──
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

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

  // Add skipped column if not exists (idempotent migration)
  await sql`ALTER TABLE daily_state ADD COLUMN IF NOT EXISTS skipped JSONB DEFAULT '{}'`;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_snapshots (
      date       DATE PRIMARY KEY,
      snapshot   JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON daily_snapshots(date)`;

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

  await sql`
    CREATE TABLE IF NOT EXISTS calendar_notes (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row_calendar_notes CHECK (id = 1)
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
  await sql`CREATE INDEX IF NOT EXISTS idx_calendar_notes_updated_at ON calendar_notes(updated_at)`;
}

// ── Generic JSONB single-row handler (DRY) ──
const FINANCE_TABLES = {
  income: { table: 'finance_income', field: 'income' },
  obligations: { table: 'finance_obligations', field: 'obligations' },
  payments: { table: 'finance_payments', field: 'payments' },
  goals: { table: 'finance_goals', field: 'goals' },
  notes: { table: 'calendar_notes', field: 'notes' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-handlers (one per resource)
// ─────────────────────────────────────────────────────────────────────────────

async function handleAuth(req, res, sql) {
  const { action } = req.query;
  const { method } = req;

  // GET action=me — verify token
  if (method === 'GET' && action === 'me') {
    const payload = await requireAuth(req, res);
    if (!payload) return;
    return res.status(200).json({ ok: true, username: payload.username });
  }

  if (method !== 'POST') {
    return res.status(400).json({ error: 'إجراء auth غير معروف' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

  // POST action=setup — one-time account creation
  if (action === 'setup') {
    const setupSecret = req.headers['x-setup-secret'];
    const envSecret = process.env.SETUP_SECRET;
    if (!envSecret || setupSecret !== envSecret) {
      return res.status(403).json({ error: 'مفتاح الإعداد غير صحيح أو مفقود' });
    }
    const existing = await sql`SELECT COUNT(*) AS count FROM users`;
    if (parseInt(existing[0].count) > 0) {
      return res.status(409).json({ error: 'الحساب موجود بالفعل' });
    }
    const { username, password } = body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username و password مطلوبان' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }
    const hash = await bcrypt.hash(password, 12);
    await sql`INSERT INTO users (username, password_hash) VALUES (${username}, ${hash})`;
    return res.status(201).json({ ok: true });
  }

  // POST action=login
  if (action === 'login') {
    const { username, password } = body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username و password مطلوبان' });
    }
    const users = await sql`SELECT * FROM users WHERE username = ${username} LIMIT 1`;
    if (!users.length) {
      // Timing-safe: still run hash compare to prevent user enumeration
      await bcrypt.compare(
        password,
        '$2b$12$invalidhashpadding000000000000000000000000000000000000'
      );
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    const token = await signToken({ userId: user.id, username: user.username });
    return res.status(200).json({ ok: true, token });
  }

  // POST action=change-password
  if (action === 'change-password') {
    const payload = await requireAuth(req, res);
    if (!payload) return;
    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword و newPassword مطلوبان' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
    }
    const users = await sql`SELECT * FROM users WHERE id = ${payload.userId} LIMIT 1`;
    const valid = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${payload.userId}`;
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'إجراء auth غير معروف' });
}

async function handleTasks(req, res, sql) {
  const { method } = req;

  if (method === 'GET') {
    const rows = await sql`SELECT data, updated_at FROM tasks_definition WHERE id = 1`;
    return res.status(200).json({
      tasks: rows[0]?.data ?? null,
      updatedAt: rows[0]?.updated_at ?? null,
    });
  }

  if (method === 'POST') {
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

async function handleSchedule(req, res, sql) {
  const { method } = req;

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

async function handleDailyState(req, res, sql) {
  const { method } = req;

  if (method === 'GET') {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date مطلوب' });
    if (!isValidDate(date))
      return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)' });

    const rows = await sql`
      SELECT checked, sub_checked, skipped, updated_at FROM daily_state WHERE date = ${date}
    `;
    return res.status(200).json({
      checked: rows[0]?.checked ?? {},
      subChecked: rows[0]?.sub_checked ?? {},
      skipped: rows[0]?.skipped ?? {},
      updatedAt: rows[0]?.updated_at ?? null,
    });
  }

  if (method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { date, checked, subChecked, skipped } = body;

    if (!date) return res.status(400).json({ error: 'date مطلوب' });
    if (!isValidDate(date))
      return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)' });

    if (checked !== undefined && (typeof checked !== 'object' || Array.isArray(checked))) {
      return res.status(400).json({ error: 'checked يجب أن يكون object' });
    }
    if (subChecked !== undefined && (typeof subChecked !== 'object' || Array.isArray(subChecked))) {
      return res.status(400).json({ error: 'subChecked يجب أن يكون object' });
    }

    await sql`
      INSERT INTO daily_state (date, checked, sub_checked, skipped, updated_at)
      VALUES (
        ${date},
        ${JSON.stringify(checked ?? {})}::jsonb,
        ${JSON.stringify(subChecked ?? {})}::jsonb,
        ${JSON.stringify(skipped ?? {})}::jsonb,
        NOW()
      )
      ON CONFLICT (date) DO UPDATE
        SET checked     = EXCLUDED.checked,
            sub_checked = EXCLUDED.sub_checked,
            skipped     = EXCLUDED.skipped,
            updated_at  = NOW()
    `;
    return res.status(200).json({ ok: true });
  }
}

async function handleSnapshot(req, res, sql) {
  const { method } = req;

  if (method === 'GET') {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date مطلوب' });
    if (!isValidDate(date)) return res.status(400).json({ error: 'صيغة التاريخ غير صحيحة' });
    const rows = await sql`
      SELECT snapshot, updated_at FROM daily_snapshots WHERE date = ${date}
    `;
    return res.status(200).json({
      snapshot: rows[0]?.snapshot ?? null,
      updatedAt: rows[0]?.updated_at ?? null,
    });
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
}

async function handleSnapshots(req, res, sql) {
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT date, snapshot->>'progress' AS progress,
             snapshot->>'countDone' AS count_done,
             snapshot->>'totalOther' AS total_other
      FROM daily_snapshots
      ORDER BY date DESC
      LIMIT 365
    `;
    return res.status(200).json({
      summaries: rows.map((r) => ({
        date:
          r.date instanceof Date
            ? r.date.toISOString().split('T')[0]
            : String(r.date).split('T')[0],
        progress: Number(r.progress ?? 0),
        countDone: Number(r.count_done ?? 0),
        totalOther: Number(r.total_other ?? 0),
      })),
    });
  }
}

async function handleFinance(req, res, sql, finRes) {
  const { method } = req;

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

// ─────────────────────────────────────────────────────────────────────────────
// Main handler — routing only
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  /* ── Preflight CORS ── */
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  /* ── Rate Limiting ── */
  const { resource } = req.query;
  const isAuthRoute = resource === 'auth';
  const limiterKey = isAuthRoute
    ? 'auth'
    : resource === 'daily' || resource === 'tasks'
      ? 'sync'
      : 'general';
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

  // ── رفض الطلبات غير المدعومة مبكراً ────────────────────────────────────
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: `الطريقة ${req.method} غير مدعومة` });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    await ensureSchema(sql);

    // ── Route to the appropriate sub-handler ──
    if (resource === 'auth') return handleAuth(req, res, sql);

    /* ── All other resources require authentication ── */
    const authPayload = await requireAuth(req, res);
    if (!authPayload) return;

    if (resource === 'tasks') return handleTasks(req, res, sql);
    if (resource === 'schedule') return handleSchedule(req, res, sql);
    if (resource === 'daily') return handleDailyState(req, res, sql);
    if (resource === 'snapshot') return handleSnapshot(req, res, sql);
    if (resource === 'snapshots') return handleSnapshots(req, res, sql);

    const finRes = FINANCE_TABLES[resource];
    if (finRes) return handleFinance(req, res, sql, finRes);

    return res.status(400).json({ error: `resource غير معروف: ${resource}` });
  } catch (error) {
    console.error(`DB Error (${resource}):`, error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
