const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('api');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  // Replace imports like: from './something' or from '../../src/db/schema' or from './something.ts'
  // with from './something.js'
  content = content.replace(/from\s+['"](\..*?)['"]/g, (match, p1) => {
    // If it already ends with .js, skip
    if (p1.endsWith('.js')) return match;
    // If it ends with .ts, replace with .js
    if (p1.endsWith('.ts')) {
      changed = true;
      return `from '${p1.slice(0, -3)}.js'`;
    }
    // Otherwise, append .js
    changed = true;
    return `from '${p1}.js'`;
  });

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
