/* eslint-env node */
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log('Running TRUNCATE statements...');
  await sql`TRUNCATE TABLE daily_state CASCADE;`;
  await sql`TRUNCATE TABLE daily_snapshots CASCADE;`;
  await sql`TRUNCATE TABLE schedule_config CASCADE;`;
  console.log('Truncates completed.');
}

run().catch(console.error);
