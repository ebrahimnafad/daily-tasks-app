import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const res = await sql`SELECT DISTINCT recurrence FROM tasks`;
  console.log(
    'Distinct recurrence values:',
    res.map((r) => r.recurrence)
  );
}

main().catch(console.error);
