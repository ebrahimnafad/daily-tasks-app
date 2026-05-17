/* eslint-env node */
/**
 * Simple Rate Limiter for Vercel Serverless Functions
 * Uses in-memory Map (works in serverless environment with single instance)
 */

const store = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key);
    }
  }
}

setInterval(cleanup, 60000);

export function createLimiter(config) {
  return (req, resource) => {
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
    max: 5,
    message: 'محاولات تسجيل الدخول كثيرة جداً. حاول بعد 15 دقيقة.',
  }),
};

export function applyRateLimit(req, resource, limiterName = 'general') {
  return rateLimiters[limiterName](req, resource);
}
