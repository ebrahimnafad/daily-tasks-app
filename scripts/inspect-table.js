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
      WHERE table_name = 'schedule_config'
    `;
    console.log('Columns in schedule_config:', tableInfo);
  } catch (err) {
    console.error('Error inspecting schedule_config:', err);
  }
}

main();
