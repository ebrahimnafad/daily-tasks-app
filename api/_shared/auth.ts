import { SignJWT, jwtVerify } from 'jose';
import type { ApiRequest, ApiResponse } from './types.js';

export interface JwtPayload {
  userId: number;
  username: string;
  iat?: number;
  exp?: number;
}

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET env var is not set. Set it in .env.local or Vercel dashboard.');
  }
  return new TextEncoder().encode(secret);
};

export async function signToken(payload: JwtPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/** Extracts and verifies the Bearer token. Returns payload or sends 401 and returns null. */
export async function requireAuth(req: ApiRequest, res: ApiResponse): Promise<JwtPayload | null> {
  const authHeader = req.headers.authorization as string | undefined;
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
  // Ensure userId is a number
  const typedPayload: JwtPayload = { ...payload, userId: Number(payload.userId) };
  return typedPayload;
}
