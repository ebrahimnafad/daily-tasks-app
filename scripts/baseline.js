import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  console.log("Creating __drizzle_migrations table if it doesn't exist...");
  await sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  const drizzleDir = path.join(process.cwd(), 'drizzle');
  const files = fs
    .readdirSync(drizzleDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(drizzleDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    const existing = await sql`SELECT id FROM "__drizzle_migrations" WHERE hash = ${hash}`;

    if (existing.length === 0) {
      console.log(`Recording migration ${file} as applied (hash: ${hash})...`);
      await sql`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (${hash}, ${Date.now()})`;
    } else {
      console.log(`Migration ${file} is already recorded.`);
    }
  }

  console.log(
    '✅ DB successfully baselined! You can now safely run `npm run migrate` in the future.'
  );
}

main().catch(console.error);
