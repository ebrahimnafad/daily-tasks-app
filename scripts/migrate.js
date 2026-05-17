import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL is not set. Skipping database migration.');
  process.exit(0);
}

try {
  console.log('Running drizzle-kit push...');
  execSync('npx drizzle-kit push', { stdio: 'inherit' });
  console.log('✅ Database migration completed successfully.');
} catch (error) {
  console.error('❌ Database migration failed.');
  process.exit(1);
}
