import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, '..');
const client = await fs.readFile(path.join(webRoot, 'src/components/TelemetryClient.astro'), 'utf8');
const layout = await fs.readFile(path.join(webRoot, 'src/layouts/BaseLayout.astro'), 'utf8');

for (const required of [
  "'checklist_download'",
  "'quiz_start'",
  "'quiz_complete'",
  "'quiz_retry'",
  "fetch(TELEMETRY_ENDPOINT",
  'keepalive: true',
  '.catch(() =>',
  'MutationObserver',
  'data-quiz-result-summary',
  'utm_source',
  'utm_medium',
  'utm_campaign',
]) {
  assert.match(client, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

for (const forbidden of [
  'document.cookie',
  'navigator.userAgent',
  'localStorage',
  'sessionStorage',
  'referrer',
  'email',
  'selectedAnswer',
  'correctAnswer',
]) {
  assert.doesNotMatch(client, new RegExp(forbidden, 'i'));
}

assert.match(layout, /import TelemetryClient/);
assert.match(layout, /<TelemetryClient\s*\/>/);

console.log('Telemetry client contract passed.');
