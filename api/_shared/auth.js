import { SignJWT, jwtVerify } from 'jose';

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars!!';
  return new TextEncoder().encode(secret);
};

export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch {
    return null;
  }
}

/** Extracts and verifies the Bearer token. Returns payload or sends 401 and returns null. */
export async function requireAuth(req, res) {
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
