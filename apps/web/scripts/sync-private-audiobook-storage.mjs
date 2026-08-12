import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PRIVATE_AUDIOBOOK_BUCKET,
  privateAudiobookTracks,
} from '../src/lib/private-audiobook.js';

export const APPROVED_AUDIOBOOK_PROJECT = Object.freeze({
  name: 'usd-impact-development',
  ref: 'ycstrcvshdluovtuasjc',
});

function storageError(message, code) {
  const error = new Error(message);
  error.name = 'PrivateAudiobookStorageError';
  error.code = code;
  return error;
}

function encodeStoragePath(value) {
  return String(value).split('/').map(encodeURIComponent).join('/');
}

function requireSourceDirectory(value) {
  if (typeof value !== 'string' || !isAbsolute(value)) {
    throw storageError('--source-dir must be an absolute path.', 'INVALID_SOURCE_DIRECTORY');
  }
  return value;
}

function requireOperatorConfig(environment) {
  let url;
  try {
    url = new URL(environment.SUPABASE_URL);
  } catch {
    throw storageError('SUPABASE_URL is missing or invalid.', 'INVALID_SUPABASE_URL');
  }
  const secretKey = environment.SUPABASE_SECRET_KEY;
  if (typeof secretKey !== 'string' || !secretKey.startsWith('sb_secret_') || secretKey.length < 26) {
    throw storageError('SUPABASE_SECRET_KEY is missing or invalid.', 'INVALID_SUPABASE_SECRET_KEY');
  }
  return Object.freeze({ url: url.origin, secretKey });
}

export function assertApprovedDevelopmentTarget({ config, confirmedProjectName, confirmedProjectRef }) {
  const expectedOrigin = `https://${APPROVED_AUDIOBOOK_PROJECT.ref}.supabase.co`;
  if (
    config?.url !== expectedOrigin
    || confirmedProjectName !== APPROVED_AUDIOBOOK_PROJECT.name
    || confirmedProjectRef !== APPROVED_AUDIOBOOK_PROJECT.ref
  ) {
    throw storageError(
      `Refusing Storage access: confirm ${APPROVED_AUDIOBOOK_PROJECT.name} (${APPROVED_AUDIOBOOK_PROJECT.ref}).`,
      'UNAPPROVED_SUPABASE_PROJECT',
    );
  }
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function sha256Buffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function assertIntegrity(track, { size, sha256 }, location) {
  if (size !== track.size || sha256 !== track.sha256) {
    throw storageError(
      `${location} failed integrity verification for ${track.file}.`,
      'AUDIOBOOK_INTEGRITY_MISMATCH',
    );
  }
}

export async function verifyLocalAudiobookMasters({ sourceDir, tracks = privateAudiobookTracks }) {
  const directory = requireSourceDirectory(sourceDir);
  const verified = [];
  for (const track of tracks) {
    const filePath = join(directory, track.file);
    let metadata;
    try {
      metadata = await stat(filePath);
    } catch {
      throw storageError(`Missing local master: ${track.file}.`, 'AUDIOBOOK_MASTER_MISSING');
    }
    if (!metadata.isFile()) {
      throw storageError(`Local master is not a file: ${track.file}.`, 'AUDIOBOOK_MASTER_INVALID');
    }
    const integrity = { size: metadata.size, sha256: await sha256File(filePath) };
    assertIntegrity(track, integrity, 'Local master');
    verified.push(Object.freeze({ track, filePath }));
  }
  return Object.freeze(verified);
}

function objectEndpoint(config, track, { authenticated = false } = {}) {
  const access = authenticated ? 'authenticated/' : '';
  return `${config.url}/storage/v1/object/${access}${encodeURIComponent(PRIVATE_AUDIOBOOK_BUCKET)}/${encodeStoragePath(track.objectPath)}`;
}

function storageHeaders(config, headers = {}) {
  return {
    apikey: config.secretKey,
    Authorization: `Bearer ${config.secretKey}`,
    ...headers,
  };
}

async function readRemoteObject({ config, track, fetchImpl }) {
  let response;
  try {
    response = await fetchImpl(objectEndpoint(config, track, { authenticated: true }), {
      method: 'GET',
      cache: 'no-store',
      headers: storageHeaders(config),
    });
  } catch {
    throw storageError(`Could not read back ${track.file}.`, 'AUDIOBOOK_READBACK_FAILED');
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw storageError(`Read-back failed for ${track.file} (HTTP ${response.status}).`, 'AUDIOBOOK_READBACK_FAILED');
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  assertIntegrity(track, { size: buffer.byteLength, sha256: sha256Buffer(buffer) }, 'Remote object');
  return buffer;
}

async function uploadMissingObject({ config, track, filePath, fetchImpl }) {
  const body = await readFile(filePath);
  let response;
  try {
    response = await fetchImpl(objectEndpoint(config, track), {
      method: 'POST',
      headers: storageHeaders(config, {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': '3600',
      }),
      body,
    });
  } catch {
    response = null;
  }
  if (response?.ok) return;

  // A connection can fail after Storage commits the object. Read back before
  // reporting failure so a safe rerun never needs overwrite semantics.
  const recovered = await readRemoteObject({ config, track, fetchImpl }).catch(() => null);
  if (recovered) return;
  const status = response ? ` (HTTP ${response.status})` : '';
  throw storageError(`Upload failed for ${track.file}${status}.`, 'AUDIOBOOK_UPLOAD_FAILED');
}

export async function syncPrivateAudiobookStorage({
  sourceDir,
  config,
  confirmedProjectName,
  confirmedProjectRef,
  fetchImpl = fetch,
  tracks = privateAudiobookTracks,
  log = console.log,
}) {
  assertApprovedDevelopmentTarget({ config, confirmedProjectName, confirmedProjectRef });
  const verified = await verifyLocalAudiobookMasters({ sourceDir, tracks });

  const missing = [];
  for (const entry of verified) {
    const existing = await readRemoteObject({ config, track: entry.track, fetchImpl });
    if (existing) log(`verified existing ${entry.track.file}`);
    else missing.push(entry);
  }

  for (const entry of missing) {
    await uploadMissingObject({ config, track: entry.track, filePath: entry.filePath, fetchImpl });
    log(`uploaded ${entry.track.file}`);
  }

  for (const entry of verified) {
    await readRemoteObject({ config, track: entry.track, fetchImpl });
    log(`read-back verified ${entry.track.file}`);
  }

  return Object.freeze({ total: verified.length, uploaded: missing.length, existing: verified.length - missing.length });
}

function optionValue(argumentsList, name) {
  const prefix = `--${name}=`;
  return argumentsList.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

export function parseArguments(argumentsList) {
  const allowed = new Set(['--execute']);
  const prefixes = ['--source-dir=', '--confirm-project-name=', '--confirm-project-ref='];
  const unknown = argumentsList.find((argument) => !allowed.has(argument) && !prefixes.some((prefix) => argument.startsWith(prefix)));
  if (unknown) throw storageError(`Unknown argument: ${unknown}.`, 'INVALID_ARGUMENT');
  return Object.freeze({
    sourceDir: optionValue(argumentsList, 'source-dir'),
    confirmedProjectName: optionValue(argumentsList, 'confirm-project-name'),
    confirmedProjectRef: optionValue(argumentsList, 'confirm-project-ref'),
    execute: argumentsList.includes('--execute'),
  });
}

export async function main({ argumentsList = process.argv.slice(2), environment = process.env } = {}) {
  const options = parseArguments(argumentsList);
  const verified = await verifyLocalAudiobookMasters({ sourceDir: options.sourceDir });
  if (!options.execute) {
    console.log(`Verified ${verified.length} local audiobook masters. Dry run only; no network request was made.`);
    return;
  }
  const result = await syncPrivateAudiobookStorage({
    ...options,
    config: requireOperatorConfig(environment),
  });
  console.log(`Private audiobook Storage sync complete: ${result.uploaded} uploaded, ${result.existing} already verified, ${result.total} read back.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`${error.code || 'AUDIOBOOK_STORAGE_SYNC_FAILED'}: ${error.message}`);
    process.exitCode = 1;
  });
}
