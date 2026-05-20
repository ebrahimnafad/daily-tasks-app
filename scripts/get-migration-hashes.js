import { readMigrationFiles } from 'drizzle-orm/migrator';

async function main() {
  const migrations = readMigrationFiles({ migrationsFolder: './drizzle' });
  for (const m of migrations) {
    console.log(`Tag: ${m.folderMillis}_${m.name}, Hash: ${m.hash}`);
  }
}

main();
