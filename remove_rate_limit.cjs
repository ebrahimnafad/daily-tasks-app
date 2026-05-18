const fs = require('fs');
const path = require('path');

const files = [
  'api/notes.ts',
  'api/tasks.ts',
  'api/snapshots.ts',
  'api/schedule.ts',
  'api/daily.ts',
  'api/auth.ts',
  'api/webhooks.ts',
  'api/_shared/finance.ts'
];

for (const file of files) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  
  let content = fs.readFileSync(p, 'utf8');
  
  // Remove the import statement
  content = content.replace(/import\s+\{\s*applyRateLimit\s*\}\s+from\s+['"].*?rateLimit.*?['"];?\r?\n?/g, '');
  
  // Remove the usage block
  // It looks like:
  // const rateLimit = applyRateLimit(req, '...', '...');
  // if (!rateLimit.allowed) {
  //   return res.status(429).json({ error: rateLimit.message });
  // }
  
  content = content.replace(/[ \t]*const\s+rateLimit\s*=\s*applyRateLimit\([^;]+\);\r?\n[ \t]*if\s*\(!rateLimit\.allowed\)\s*\{\r?\n[ \t]*return\s+res\.status\(429\)\.json\([^)]+\);\r?\n[ \t]*\}\r?\n?/g, '');
  
  fs.writeFileSync(p, content, 'utf8');
  console.log(`Cleaned ${file}`);
}
