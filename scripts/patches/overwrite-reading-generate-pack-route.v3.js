const fs = require('fs');
const path = require('path');

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function main() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const payload = path.resolve(__dirname, 'payload', 'route.tsx');
  const targetDir = path.resolve(repoRoot, 'app', 'api', 'reading', 'generate-pack');
  const targetFile = path.resolve(targetDir, 'route.tsx');

  if (!fs.existsSync(payload)) {
    console.error('❌ Payload not found:', payload);
    process.exit(1);
  }

  ensureDir(targetDir);

  if (fs.existsSync(targetFile)) {
    const backup = targetFile + `.bak_${stamp()}`;
    fs.copyFileSync(targetFile, backup);
    console.log('✅ Backup:', backup);
  }

  fs.copyFileSync(payload, targetFile);
  console.log('✅ Wrote:', targetFile);

  console.log('\nNext steps:');
  console.log('  1) Restart your dev server (stop it, then: npm run dev)');
  console.log('  2) Test: Invoke-RestMethod POST http://localhost:3000/api/reading/generate-pack');
}

main();
