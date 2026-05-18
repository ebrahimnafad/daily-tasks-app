import { db } from '../_shared/db.js';
import { tasks } from '../../src/db/schema.js';
import { and, isNotNull, lt } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  // Vercel cron sends GET with a cron secret header
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  await db.delete(tasks).where(and(isNotNull(tasks.deletedAt), lt(tasks.deletedAt, cutoff)));

  return res.status(200).json({ purged: true });
}
