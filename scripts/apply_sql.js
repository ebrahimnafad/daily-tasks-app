import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const query = fs.readFileSync('drizzle/0003_thankful_stick.sql', 'utf8');

  console.log('Running SQL...');
  const statements = query.split('--> statement-breakpoint');
  for (let stmt of statements) {
    stmt = stmt.trim();
    if (!stmt) continue;
    console.log('Executing:', stmt);
    await sql(stmt);
  }
  console.log('✅ Success!');
}

main().catch(console.error);
