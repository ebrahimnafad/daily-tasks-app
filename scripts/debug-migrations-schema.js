import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const sql = neon(process.env.DATABASE_URL);

async function main() {
  try {
    const tableInfo = await sql`
      SELECT table_schema, column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = '__drizzle_migrations'
    `;
    console.log('Columns in all schemas:', tableInfo);

    const publicRows = await sql`SELECT * FROM public.__drizzle_migrations ORDER BY id`;
    console.log('Rows in public.__drizzle_migrations:', publicRows);

    const drizzleRows = await sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`;
    console.log('Rows in drizzle.__drizzle_migrations:', drizzleRows);

    try {
      const seqValDrizzle = await sql`SELECT nextval('drizzle.__drizzle_migrations_id_seq')`;
      console.log('Next val of drizzle sequence:', seqValDrizzle);
    } catch (e) {
      console.log('Could not get nextval of drizzle.__drizzle_migrations_id_seq:', e.message);
    }
  } catch (err) {
    console.error('Error debugging migrations table:', err);
  }
}

main();
