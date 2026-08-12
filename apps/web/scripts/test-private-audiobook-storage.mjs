import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  APPROVED_AUDIOBOOK_PROJECT,
  assertApprovedDevelopmentTarget,
  parseArguments,
  syncPrivateAudiobookStorage,
  verifyLocalAudiobookMasters,
} from './sync-private-audiobook-storage.mjs';

const config = {
  url: `https://${APPROVED_AUDIOBOOK_PROJECT.ref}.supabase.co`,
  secretKey: 'sb_secret_test_value_that_is_long_enough',
};
const content = [Buffer.from('first verified track'), Buffer.from('second verified track')];
const tracks = content.map((buffer, index) => {
  const file = `0${index}-track-${index}.mp3`;
  return Object.freeze({
    file,
    objectPath: `audiobook/read-the-dollar-first/v1/${file}`,
    size: buffer.byteLength,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  });
});

assert.deepEqual(parseArguments([
  '--source-dir=/tmp/audio',
  '--confirm-project-name=usd-impact-development',
  `--confirm-project-ref=${APPROVED_AUDIOBOOK_PROJECT.ref}`,
  '--execute',
]), {
  sourceDir: '/tmp/audio',
  confirmedProjectName: 'usd-impact-development',
  confirmedProjectRef: APPROVED_AUDIOBOOK_PROJECT.ref,
  execute: true,
});
assert.throws(() => parseArguments(['--upsert']), (error) => error.code === 'INVALID_ARGUMENT');
assert.throws(
  () => assertApprovedDevelopmentTarget({
    config: { ...config, url: 'https://gjzetjugmnwanvjkchux.supabase.co' },
    confirmedProjectName: APPROVED_AUDIOBOOK_PROJECT.name,
    confirmedProjectRef: APPROVED_AUDIOBOOK_PROJECT.ref,
  }),
  (error) => error.code === 'UNAPPROVED_SUPABASE_PROJECT',
);

const sourceDir = await mkdtemp(join(tmpdir(), 'audiobook-storage-test-'));
try {
  await Promise.all(tracks.map((track, index) => writeFile(join(sourceDir, track.file), content[index])));
  const local = await verifyLocalAudiobookMasters({ sourceDir, tracks });
  assert.equal(local.length, tracks.length);

  const stored = new Map([[tracks[0].objectPath, content[0]]]);
  const requests = [];
  const fetchImpl = async (url, options) => {
    const parsed = new URL(url);
    const authenticatedPrefix = '/storage/v1/object/authenticated/library-pass-assets/';
    const uploadPrefix = '/storage/v1/object/library-pass-assets/';
    const path = decodeURIComponent(parsed.pathname.slice(
      parsed.pathname.startsWith(authenticatedPrefix) ? authenticatedPrefix.length : uploadPrefix.length,
    ));
    requests.push({ url, options, path });
    assert.equal(options.headers.apikey, config.secretKey);
    assert.equal(options.headers.Authorization, `Bearer ${config.secretKey}`);
    if (options.method === 'GET') {
      const body = stored.get(path);
      return body ? new Response(body) : new Response('', { status: 404 });
    }
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'audio/mpeg');
    assert.equal(options.headers['x-upsert'], undefined);
    assert.equal(stored.has(path), false);
    stored.set(path, Buffer.from(options.body));
    return new Response(JSON.stringify({ Key: path }), { status: 200 });
  };

  const result = await syncPrivateAudiobookStorage({
    sourceDir,
    config,
    confirmedProjectName: APPROVED_AUDIOBOOK_PROJECT.name,
    confirmedProjectRef: APPROVED_AUDIOBOOK_PROJECT.ref,
    fetchImpl,
    tracks,
    log: () => {},
  });
  assert.deepEqual(result, { total: 2, uploaded: 1, existing: 1 });
  assert.equal(stored.size, 2);
  assert.equal(requests.filter((request) => request.options.method === 'POST').length, 1);

  stored.set(tracks[0].objectPath, Buffer.from('tampered'));
  await assert.rejects(
    syncPrivateAudiobookStorage({
      sourceDir,
      config,
      confirmedProjectName: APPROVED_AUDIOBOOK_PROJECT.name,
      confirmedProjectRef: APPROVED_AUDIOBOOK_PROJECT.ref,
      fetchImpl,
      tracks,
      log: () => {},
    }),
    (error) => error.code === 'AUDIOBOOK_INTEGRITY_MISMATCH',
  );

  await writeFile(join(sourceDir, tracks[1].file), Buffer.from('changed'));
  await assert.rejects(
    verifyLocalAudiobookMasters({ sourceDir, tracks }),
    (error) => error.code === 'AUDIOBOOK_INTEGRITY_MISMATCH',
  );
} finally {
  await rm(sourceDir, { recursive: true, force: true });
}

console.log('Private audiobook Storage sync tests passed.');
