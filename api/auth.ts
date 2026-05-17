import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { applyRateLimit } from './middleware/rateLimit.js';
import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth, signToken } from './_shared/auth.js';

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const rateLimit = applyRateLimit(req, 'auth', 'auth');
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: rateLimit.message });
  }

  if (!process.env.DATABASE_URL) {
    return res
      .status(503)
      .json({ error: 'DATABASE_URL غير مضبوط. فعّل Neon في Vercel Dashboard.' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { action } = req.query;
  const { method } = req;

  try {
    if (method === 'GET' && action === 'me') {
      const payload = await requireAuth(req, res);
      if (!payload) return;
      return res.status(200).json({ ok: true, username: payload.username });
    }

    if (method !== 'POST') {
      return res.status(400).json({ error: 'إجراء auth غير معروف' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

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

    if (action === 'login') {
      const { username, password } = body;
      if (!username || !password) {
        return res.status(400).json({ error: 'username و password مطلوبان' });
      }
      const users = await sql`SELECT * FROM users WHERE username = ${username} LIMIT 1`;
      if (!users.length) {
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
  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: error.message });
  }
}
