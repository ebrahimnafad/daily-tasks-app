import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './src/db/schema';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const env = dotenv.parse(fs.readFileSync('.env.local'));
const sql = neon(env.DATABASE_URL);
const db = drizzle(sql, { schema });

async function run() {
  try {
    await db
      .insert(schema.scheduleConfig)
      .values({
        id: 1,
        data: [{ id: 'test', blocks: [] }],
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.scheduleConfig.id,
        set: {
          data: [{ id: 'test', blocks: [] }],
          updatedAt: new Date(),
        },
      });
    console.log('Success');
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
