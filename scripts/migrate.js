import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL is not set. Skipping database migration.');
  process.exit(0);
}

async function main() {
  console.log('Running Drizzle migrator...');
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  try {
    await migrate(db, { migrationsFolder: 'drizzle' });
    console.log('✅ Database migration completed successfully.');
  } catch (error) {
    console.error('❌ Database migration failed:');
    console.error(error);
    process.exit(1);
  }
}

main();
