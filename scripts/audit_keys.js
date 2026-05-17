import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function auditKeys(sql) {
  const tables = [
    'tasks_definition',
    'schedule_config',
    'finance_income',
    'finance_obligations',
    'finance_payments',
    'finance_goals',
    'calendar_notes'
  ];

  for (const table of tables) {
    try {
      console.log(`\n--- Auditing keys for ${table} ---`);
      const res = await sql(`
        SELECT key, count(*) as count 
        FROM (
          SELECT jsonb_object_keys(elem) as key
          FROM ${table}, jsonb_array_elements(data) as elem
        ) t
        GROUP BY key
        ORDER BY count DESC
      `);
      console.log(res);
    } catch (e) {
      console.error(`Failed to audit ${table}:`, e.message);
    }
  }
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  await auditKeys(sql);
  process.exit(0);
}

run();
