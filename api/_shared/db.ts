import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../../src/db/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Please set it in your .env or Vercel config.');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
