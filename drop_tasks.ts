import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Dropping tables...');
  await db.execute(sql`DROP TABLE IF EXISTS daily_snapshots CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS daily_state CASCADE;`);
  await db.execute(sql`DROP TABLE IF EXISTS tasks CASCADE;`);
  console.log('Done dropping tables.');
  process.exit(0);
}

main().catch(console.error);
