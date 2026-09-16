import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const files = [
  'src/lib/marketing-email-preferences.js',
  'src/lib/progress-email-readiness.js',
  'src/lib/progress-email-dispatch.js',
];

for (const relativePath of files) {
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  assert.match(source, /apikey:\s+config(?:\.supabase)?\.secretKey/);
  assert.doesNotMatch(source, /Authorization:\s*`Bearer \$\{config(?:\.supabase)?\.secretKey\}`/);
}

console.log('Progress email Supabase secret-key header regression passed.');
