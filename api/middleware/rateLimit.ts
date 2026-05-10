/* eslint-env node */
/**
 * Simple Rate Limiter for Vercel Serverless Functions
 * Uses in-memory Map (works in serverless environment with single instance)
 */

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key);
    }
  }
}

setInterval(cleanup, 60000);

export function createLimiter(config: RateLimitConfig) {
  return (
    req: { headers: Record<string, string | undefined> },
    resource: string
  ): { allowed: boolean; message?: string } => {
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
};

export function applyRateLimit(
  req: { headers: Record<string, string | undefined> },
  resource: string,
  limiterName: keyof typeof rateLimiters = 'general'
): { allowed: boolean; message?: string } {
  return rateLimiters[limiterName](req, resource);
}
