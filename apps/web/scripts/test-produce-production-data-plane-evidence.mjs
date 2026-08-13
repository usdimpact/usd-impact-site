import assert from 'node:assert/strict';
import { produceProductionDataPlaneEvidence } from './produce-production-data-plane-evidence.mjs';

const releaseHead = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const now = Date.parse('2026-08-13T02:30:00.000Z');

function snapshot(overrides = {}) {
  return {
    provider: 'supabase',
    authenticated: true,
    readOnly: true,
    valuesExposed: false,
    source: 'supabase-api',
    ref: 'supabase-api:production-data-plane:gjzetjugmnwanvjkchux:20260813T022900Z',
    observedAt: '2026-08-13T02:29:00.000Z',
    project: {
      id: 'gjzetjugmnwanvjkchux',
      name: 'usd-impact-production',
      region: 'eu-central-1',
      status: 'ACTIVE_HEALTHY',
    },
    invariants: {
      hasPrivilegeMigration: true,
      hasAccountRpcMigration: true,
      guidedContentRlsForced: true,
      guidedSupplementRlsForced: true,
      serviceRoleContentSelect: true,
      serviceRoleSupplementSelect: true,
      anonContentSelect: false,
      authenticatedContentSelect: false,
      anonSupplementSelect: false,
      authenticatedSupplementSelect: false,
      libraryBucketPrivate: true,
      audiobookMp3Count: 20,
      audiobookMediaBytes: '372647590',
      publishedChapterCount: 13,
      publishedSupplementCount: 3,
    },
    ...overrides,
  };
}

const record = produceProductionDataPlaneEvidence(snapshot(), { releaseHead, now });
assert.deepEqual(record, {
  gate: 'production-data-plane',
  status: 'verified',
  source: 'supabase-api',
  ref: 'supabase-api:production-data-plane:gjzetjugmnwanvjkchux:20260813T022900Z',
  observed_at: '2026-08-13T02:29:00.000Z',
  release_head: releaseHead,
});

assert.throws(
  () => produceProductionDataPlaneEvidence(snapshot({ valuesExposed: true }), { releaseHead, now }),
  /must not expose secret values/,
);
assert.throws(
  () => produceProductionDataPlaneEvidence(snapshot({ project: { ...snapshot().project, id: 'wrong' } }), { releaseHead, now }),
  /Unexpected Production Supabase project id/,
);
assert.throws(
  () => produceProductionDataPlaneEvidence(snapshot({ project: { ...snapshot().project, status: 'PAUSED' } }), { releaseHead, now }),
  /not healthy/,
);
assert.throws(
  () => produceProductionDataPlaneEvidence(snapshot({ invariants: { ...snapshot().invariants, hasPrivilegeMigration: false } }), { releaseHead, now }),
  /privilege migration/,
);
assert.throws(
  () => produceProductionDataPlaneEvidence(snapshot({ invariants: { ...snapshot().invariants, anonContentSelect: true } }), { releaseHead, now }),
  /anon must not have SELECT/,
);
assert.throws(
  () => produceProductionDataPlaneEvidence(snapshot({ invariants: { ...snapshot().invariants, libraryBucketPrivate: false } }), { releaseHead, now }),
  /must remain private/,
);
assert.throws(
  () => produceProductionDataPlaneEvidence(snapshot({ invariants: { ...snapshot().invariants, audiobookMp3Count: 19 } }), { releaseHead, now }),
  /MP3 count/,
);
assert.throws(
  () => produceProductionDataPlaneEvidence(snapshot({ observedAt: '2026-08-12T00:00:00.000Z' }), { releaseHead, now }),
  /stale/,
);
assert.throws(
  () => produceProductionDataPlaneEvidence(snapshot(), { releaseHead: 'short', now }),
  /full lowercase SHA/,
);
assert.throws(
  () => produceProductionDataPlaneEvidence(snapshot({ extra: true }), { releaseHead, now }),
  /unsupported fields/,
);

console.log('Production data-plane evidence producer tests passed.');
