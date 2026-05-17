/* eslint-env node */
/**
 * Simple Rate Limiter for Vercel Serverless Functions
 * Uses in-memory Map (works in serverless environment with single instance)
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

function cleanup() {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (entry.resetTime < now) {
      store.delete(key);
    }
  });
}

setInterval(cleanup, 60000);

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

export function createLimiter(config: RateLimitConfig) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req: any, resource: string) => {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      'unknown';
    const key = `${ip}:${resource}`;
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || entry.resetTime < now) {
      store.set(key, { count: 1, resetTime: now + config.windowMs });
      return { allowed: true };
    }

    if (entry.count >= config.max) {
      return { allowed: false, message: config.message };
    }

    entry.count++;
    return { allowed: true };
  };
}

export const rateLimiters = {
  general: createLimiter({
    windowMs: 60000,
    max: 100,
    message: 'تم تجاوز حد الطلبات. حاول لاحقاً.',
  }),
  sync: createLimiter({ windowMs: 60000, max: 30, message: 'تم تجاوز حد المزامنة. حاول لاحقاً.' }),
  sheets: createLimiter({ windowMs: 60000, max: 10, message: 'تم تجاوز حد الإرسال. حاول لاحقاً.' }),
  auth: createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 100 : 5,
    message: 'محاولات تسجيل الدخول كثيرة جداً. حاول بعد 15 دقيقة.',
  }),
};

export function applyRateLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: any,
  resource: string,
  limiterName: keyof typeof rateLimiters = 'general'
) {
  return rateLimiters[limiterName](req, resource);
}
