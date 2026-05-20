import { readMigrationFiles } from 'drizzle-orm/migrator';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

const migrations = readMigrationFiles({ migrationsFolder: './drizzle' });
console.log(`Found ${migrations.length} migration(s) in ./drizzle`);

// Remove the placeholder record inserted earlier
await sql`DELETE FROM __drizzle_migrations WHERE hash = '<migration_hash_here>'`;
console.log('Removed placeholder record.');

// Fetch what's currently recorded
const existing = await sql`SELECT hash FROM __drizzle_migrations`;
const existingHashes = new Set(existing.map((r) => r.hash));

for (const migration of migrations) {
  if (existingHashes.has(migration.hash)) {
    console.log(`↩ Already recorded: ${migration.hash}`);
  } else {
    await sql`
      INSERT INTO __drizzle_migrations (hash, created_at)
      VALUES (${migration.hash}, ${Date.now()})
    `;
    console.log(`✓ Inserted: ${migration.hash}`);
  }
}

console.log('Repair complete. Safe to redeploy.');
