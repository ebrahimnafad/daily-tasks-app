import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from './_shared/db.js';
import { users } from '../src/db/schema.js';
import { setCorsHeaders } from './_shared/cors.js';
import { requireAuth, signToken, signRefreshToken, verifyRefreshToken } from './_shared/auth.js';
import type { ApiRequest, ApiResponse } from './_shared/types.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { action } = req.query;
  const { method } = req;

  function parseCookies(header?: string | string[]) {
    if (!header) return {};
    const str = Array.isArray(header) ? header.join(';') : header;
    return Object.fromEntries(
      str.split(';').map((v) => {
        const parts = v.split('=');
        return [parts[0].trim(), decodeURIComponent(parts.slice(1).join('='))];
      })
    );
  }

  function getCookieHeader(token: string, maxAge: number) {
    const isProd = process.env.NODE_ENV === 'production';
    return `mhm_refresh_token=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Strict${isProd ? '; Secure' : ''}`;
  }

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
      const existing = await db.select({ count: sql<number>`count(*)` }).from(users);
      const count = Number(existing[0].count);
      if (count >= 10) {
        return res.status(409).json({ error: 'تم الوصول للحد الأقصى للمستخدمين (10)' });
      }
      const { username, password } = body;
      if (!username || !password) {
        return res.status(400).json({ error: 'username و password مطلوبان' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
      }
      const hash = await bcrypt.hash(password, 12);
      await db.insert(users).values({ username, passwordHash: hash });
      return res.status(201).json({ ok: true });
    }

    if (action === 'login') {
      const { username, password } = body;
      if (!username || !password) {
        return res.status(400).json({ error: 'username و password مطلوبان' });
      }
      const foundUsers = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (!foundUsers.length) {
        await bcrypt.compare(
          password,
          '$2b$12$invalidhashpadding000000000000000000000000000000000000'
        );
        return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      }
      const user = foundUsers[0];
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      }

      const token = await signToken({ userId: user.id, username: user.username });
      const refreshToken = await signRefreshToken({ userId: user.id, username: user.username });
      res.setHeader('Set-Cookie', getCookieHeader(refreshToken, 90 * 24 * 60 * 60));

      return res.status(200).json({ ok: true, token });
    }

    if (action === 'refresh') {
      const cookies = parseCookies(req.headers.cookie);
      const refreshTokenStr = cookies.mhm_refresh_token;
      if (!refreshTokenStr) {
        return res.status(401).json({ error: 'Missing refresh token' });
      }

      const payload = await verifyRefreshToken(refreshTokenStr);
      if (!payload) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
      }

      // sliding window rotation
      const newToken = await signToken({ userId: payload.userId, username: payload.username });
      const newRefreshToken = await signRefreshToken({
        userId: payload.userId,
        username: payload.username,
      });
      res.setHeader('Set-Cookie', getCookieHeader(newRefreshToken, 90 * 24 * 60 * 60));

      return res.status(200).json({ ok: true, token: newToken });
    }

    if (action === 'logout') {
      res.setHeader('Set-Cookie', getCookieHeader('', 0)); // Max-Age 0 clears it
      return res.status(200).json({ ok: true });
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
      const foundUsers = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      const valid = await bcrypt.compare(currentPassword, foundUsers[0].passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
      }
      const hash = await bcrypt.hash(newPassword, 12);
      await db.update(users).set({ passwordHash: hash }).where(eq(users.id, payload.userId));
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'إجراء auth غير معروف' });
  } catch (error: unknown) {
    console.error('Auth Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'خطأ داخلي في الخادم', details: message });
  }
}
