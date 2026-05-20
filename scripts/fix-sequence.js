import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const sql = neon(process.env.DATABASE_URL);

async function main() {
  try {
    const res = await sql`
      SELECT setval('drizzle.__drizzle_migrations_id_seq', (SELECT MAX(id) FROM drizzle.__drizzle_migrations))
    `;
    console.log('Sequence reset result:', res);
  } catch (err) {
    console.error('Error resetting sequence:', err);
  }
}

main();
