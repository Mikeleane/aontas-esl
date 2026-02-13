/*
  overwrite-reading-generate-pack-route.v4.js
  - Backs up current route.tsx
  - Overwrites app/api/reading/generate-pack/route.tsx with the bundled v4 content

  Run from repo root:
    node .\\scripts\\patches\\overwrite-reading-generate-pack-route.v4.js
*/

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const target = path.join(repoRoot, 'app', 'api', 'reading', 'generate-pack', 'route.tsx');
const backup = target + `.bak_${new Date().toISOString().replace(/[:.]/g,'-')}`;

const contentPath = path.join(__dirname, 'route.v4.tsx');

function die(msg){
  console.error('❌ ' + msg);
  process.exit(1);
}

if (!fs.existsSync(target)) {
  die(`Target not found: ${target}`);
}

// Find the bundled route content (either alongside this script, or allow inline fallback)
let content = null;
if (fs.existsSync(contentPath)) {
  content = fs.readFileSync(contentPath, 'utf8');
} else {
  die(`Missing bundled route file next to script: ${contentPath}`);
}

fs.copyFileSync(target, backup);
console.log('✅ Backup:', backup);

fs.writeFileSync(target, content, 'utf8');
console.log('✅ Wrote:', target);
console.log('ℹ️  Restart dev server (Ctrl+C, npm run dev).');
