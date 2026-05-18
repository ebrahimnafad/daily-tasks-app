/* eslint-env node */
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log('Running DROP statements...');
  await sql`DROP TABLE daily_state CASCADE;`;
  await sql`DROP TABLE daily_snapshots CASCADE;`;
  await sql`DROP TABLE schedule_config CASCADE;`;
  console.log('Drops completed.');
}

run().catch(console.error);
