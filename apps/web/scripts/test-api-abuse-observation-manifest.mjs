import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(
  fs.readFileSync(new URL('../../../docs/operations/hardening-api-abuse-observation-manifest-2026-10-23.json', import.meta.url), 'utf8'),
);

assert.equal(manifest.status, 'preview_observation_only');
assert.equal(manifest.enforcement_enabled, false);
assert.equal(manifest.production_waf_change_authorized, false);
assert.equal(manifest.privacy.raw_ip_persistence, false);
assert.equal(manifest.privacy.raw_authorization_header_persistence, false);
assert.equal(manifest.privacy.request_body_persistence, false);
assert.equal(manifest.privacy.email_or_account_identifier_persistence, false);

const apiFiles = fs.readdirSync(new URL('../api/', import.meta.url))
  .filter((name) => name.endsWith('.js'))
  .sort();
const excluded = new Set(manifest.excluded_generated_files || []);
const expected = apiFiles.filter((name) => !excluded.has(name));
const covered = manifest.routes.map((entry) => entry.file).sort();

assert.deepEqual(covered, expected, 'Every non-generated API file must have an abuse-observation classification');

for (const entry of manifest.routes) {
  assert.ok(['critical','high','medium','low'].includes(entry.risk), `${entry.file}: invalid risk`);
  assert.equal(entry.mode, 'observe_only', `${entry.file}: hardening branch must not enable rate-limit enforcement`);
}

for (const metric of [
  'request_count',
  'http_status_class',
  'latency_bucket',
  'bounded_body_rejection_count',
  'authentication_failure_count',
  'authorization_denial_count',
]) {
  assert.ok(manifest.required_metrics.includes(metric), `Missing observation metric: ${metric}`);
}

console.log('API abuse-observation manifest contract passed.');
