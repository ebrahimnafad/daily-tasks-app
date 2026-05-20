import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const sql = neon(process.env.DATABASE_URL);

async function main() {
  try {
    const tableInfo = await sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = '__drizzle_migrations'
    `;
    console.log('Columns in __drizzle_migrations:', tableInfo);

    const rows = await sql`SELECT * FROM __drizzle_migrations ORDER BY id`;
    console.log('Rows in __drizzle_migrations:', rows);

    // Let's also check the sequence value
    const seqVal = await sql`SELECT nextval(pg_get_serial_sequence('__drizzle_migrations', 'id'))`;
    console.log('Next val of sequence:', seqVal);
  } catch (err) {
    console.error('Error debugging migrations table:', err);
  }
}

main();
