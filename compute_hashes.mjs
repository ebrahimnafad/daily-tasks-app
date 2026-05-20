import crypto from 'crypto';
import fs from 'fs';

const files = [
  'drizzle/0000_bouncy_magik.sql',
  'drizzle/0001_fantastic_multiple_man.sql',
  'drizzle/0002_oval_doctor_doom.sql',
  'drizzle/0003_thankful_stick.sql'
];

files.forEach((file, index) => {
  const content = fs.readFileSync(file, 'utf-8');
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  console.log(`Migration ${index}: ${hash}`);
  console.log(`INSERT INTO drizzle.__drizzle_migrations__ (id, hash, created_at) VALUES (${index}, '${hash}', ${Date.now()});`);
});
