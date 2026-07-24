import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(webRoot, '../..');
const checksumPath = path.join(repoRoot, 'docs/quiz-system/SHA256SUMS.source.txt');
const quizRoot = path.join(webRoot, 'src/content');

const checksumText = await fs.readFile(checksumPath, 'utf8');
const quizEntries = checksumText
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && /\s{2}quizzes\/en\//.test(line))
  .map((line) => {
    const match = line.match(/^([a-f0-9]{64})\s{2}(.+)$/);
    if (!match) throw new Error(`Invalid checksum line: ${line}`);
    return { expected: match[1], relativePath: match[2] };
  });

if (quizEntries.length !== 12) {
  throw new Error(`Expected 12 signed quiz checksums, found ${quizEntries.length}.`);
}

for (const entry of quizEntries) {
  const filePath = path.join(quizRoot, entry.relativePath);
  const bytes = await fs.readFile(filePath);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== entry.expected) {
    throw new Error(`Signed quiz content changed: ${entry.relativePath}`);
  }
}

console.log(`Verified ${quizEntries.length} signed quiz file checksums.`);
