import { inflateRawSync } from 'node:zlib';

export const BOARD_RELEASE_ORIGIN = 'https://www.federalreserve.gov';

const MAX_RELEASE_ZIP_BYTES = 16 * 1024 * 1024;
const MAX_RELEASE_XML_BYTES = 256 * 1024 * 1024;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_SIGNATURE = 0x04034b50;

function isoDate(value) {
  return value.toISOString().slice(0, 10);
}

function assertBounds(buffer, offset, length, label) {
  if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0 || offset + length > buffer.length) {
    throw new Error(`Federal Reserve release ZIP has invalid ${label} bounds.`);
  }
}

function findEocd(buffer) {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) return offset;
  }
  throw new Error('Federal Reserve release ZIP is missing the end-of-central-directory record.');
}

export function extractZipEntry(zipBytes, entryName) {
  const buffer = Buffer.isBuffer(zipBytes) ? zipBytes : Buffer.from(zipBytes);
  if (!buffer.length || buffer.length > MAX_RELEASE_ZIP_BYTES) {
    throw new Error('Federal Reserve release ZIP size is outside the bounded range.');
  }
  if (!entryName || entryName.includes('..') || entryName.startsWith('/') || entryName.includes('\\')) {
    throw new Error('Federal Reserve release ZIP entry name is invalid.');
  }

  const eocd = findEocd(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error('Federal Reserve release ZIP64 archives are not accepted.');
  }
  assertBounds(buffer, centralOffset, centralSize, 'central-directory');

  let cursor = centralOffset;
  let match = null;
  for (let index = 0; index < entryCount; index += 1) {
    assertBounds(buffer, cursor, 46, 'central-entry');
    if (buffer.readUInt32LE(cursor) !== ZIP_CENTRAL_SIGNATURE) {
      throw new Error('Federal Reserve release ZIP central directory is malformed.');
    }
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const recordLength = 46 + fileNameLength + extraLength + commentLength;
    assertBounds(buffer, cursor, recordLength, 'central-entry-record');
    const name = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf8');

    if (name === entryName) {
      if (match) throw new Error(`Federal Reserve release ZIP contains duplicate ${entryName} entries.`);
      match = { flags, method, compressedSize, uncompressedSize, localOffset, name };
    }
    cursor += recordLength;
  }

  if (!match) throw new Error(`Federal Reserve release ZIP is missing ${entryName}.`);
  console.error(JSON.stringify({ proofDiagnostic: 'release-entry-size/v1', entryName, zipBytes: buffer.length, compressedBytes: match.compressedSize, uncompressedBytes: match.uncompressedSize }));
  if (match.flags & 0x1) throw new Error('Encrypted Federal Reserve release ZIP entries are not accepted.');
  if (![0, 8].includes(match.method)) throw new Error(`Unsupported Federal Reserve release ZIP compression method: ${match.method}.`);
  if (match.uncompressedSize <= 0 || match.uncompressedSize > MAX_RELEASE_XML_BYTES) {
    throw new Error('Federal Reserve release XML size is outside the bounded range.');
  }

  assertBounds(buffer, match.localOffset, 30, 'local-header');
  if (buffer.readUInt32LE(match.localOffset) !== ZIP_LOCAL_SIGNATURE) {
    throw new Error('Federal Reserve release ZIP local header is malformed.');
  }
  const localNameLength = buffer.readUInt16LE(match.localOffset + 26);
  const localExtraLength = buffer.readUInt16LE(match.localOffset + 28);
  const localNameStart = match.localOffset + 30;
  assertBounds(buffer, localNameStart, localNameLength + localExtraLength, 'local-name');
  const localName = buffer.subarray(localNameStart, localNameStart + localNameLength).toString('utf8');
  if (localName !== entryName) throw new Error('Federal Reserve release ZIP local/central names disagree.');

  const dataOffset = localNameStart + localNameLength + localExtraLength;
  assertBounds(buffer, dataOffset, match.compressedSize, 'compressed-entry');
  const compressed = buffer.subarray(dataOffset, dataOffset + match.compressedSize);
  const output = match.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
  if (output.length !== match.uncompressedSize) {
    throw new Error('Federal Reserve release ZIP entry length failed validation.');
  }
  return output;
}

function parseAttributes(tag) {
  const attrs = {};
  const pattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(["'])(.*?)\2/g;
  for (const match of tag.matchAll(pattern)) attrs[match[1]] = match[3];
  return attrs;
}

export function parseBoardReleaseXml(xmlText, config, startDate, endDate) {
  const xml = String(xmlText ?? '');
  if (!xml || Buffer.byteLength(xml, 'utf8') > MAX_RELEASE_XML_BYTES) {
    throw new Error(`Federal Reserve Board ${config.releaseId} XML size is invalid.`);
  }

  const candidates = [];
  const seriesPattern = /<([A-Za-z_:][A-Za-z0-9_.:-]*Series)\b[^>]*>/g;
  for (const match of xml.matchAll(seriesPattern)) {
    const attrs = parseAttributes(match[0]);
    if (attrs.SERIES_NAME === config.seriesName) {
      candidates.push({ tagName: match[1], start: match.index ?? -1, startTag: match[0], attrs });
    }
  }

  if (candidates.length !== 1) {
    throw new Error(`Federal Reserve Board ${config.releaseId} XML must contain exactly one ${config.seriesName} series; found ${candidates.length}.`);
  }

  const series = candidates[0];
  for (const [name, expected] of Object.entries(config.requiredAttributes ?? {})) {
    if (series.attrs[name] !== expected) {
      throw new Error(`Federal Reserve Board ${config.releaseId} ${config.seriesName} attribute ${name} changed.`);
    }
  }

  const closeTag = `</${series.tagName}>`;
  const closeIndex = xml.indexOf(closeTag, series.start + series.startTag.length);
  if (closeIndex < 0) throw new Error(`Federal Reserve Board ${config.releaseId} series is not closed.`);
  const block = xml.slice(series.start + series.startTag.length, closeIndex);

  const start = isoDate(startDate);
  const end = isoDate(endDate);
  const points = [];
  const observationPattern = /<([A-Za-z_:][A-Za-z0-9_.:-]*(?:Obs|Observation))\b[^>]*\/?\s*>/g;
  for (const match of block.matchAll(observationPattern)) {
    const attrs = parseAttributes(match[0]);
    const date = String(attrs.TIME_PERIOD ?? '');
    const raw = String(attrs.OBS_VALUE ?? '').trim();
    const value = Number(raw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < start || date > end) continue;
    if (!raw || !Number.isFinite(value)) continue;
    points.push({ date, value });
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 2) {
    throw new Error(`Federal Reserve Board ${config.releaseId} did not provide two usable ${config.seriesName} observations in the requested window.`);
  }
  return points;
}

export async function fetchBoardReleaseSeries(config, startDate, endDate, {
  fetchImpl = fetch,
  timeoutMs = 20_000,
} = {}) {
  const requested = new URL(config.zipUrl);
  if (requested.origin !== BOARD_RELEASE_ORIGIN || requested.protocol !== 'https:') {
    throw new Error('Federal Reserve release XML source escaped the approved Board origin.');
  }

  const response = await fetchImpl(requested, {
    headers: {
      accept: 'application/zip,application/x-zip-compressed,application/octet-stream;q=0.9,*/*;q=0.5',
      'user-agent': 'USD-Impact-Three-Dials/2.0 (+https://www.usd-impact.com/)',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Federal Reserve Board ${config.releaseId} release ZIP returned HTTP ${response.status}.`);
  }

  const finalUrl = new URL(response.url || requested);
  if (finalUrl.origin !== BOARD_RELEASE_ORIGIN || finalUrl.pathname !== requested.pathname) {
    throw new Error(`Federal Reserve Board ${config.releaseId} release ZIP redirected outside the pinned release path.`);
  }

  const contentLength = Number(response.headers?.get?.('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_RELEASE_ZIP_BYTES) {
    throw new Error(`Federal Reserve Board ${config.releaseId} release ZIP is too large.`);
  }

  const zipBytes = Buffer.from(await response.arrayBuffer());
  if (zipBytes.length < 4 || zipBytes[0] !== 0x50 || zipBytes[1] !== 0x4b) {
    throw new Error(`Federal Reserve Board ${config.releaseId} release response is not a ZIP payload.`);
  }

  const xmlBytes = extractZipEntry(zipBytes, config.dataFile);
  return parseBoardReleaseXml(xmlBytes.toString('utf8'), config, startDate, endDate);
}
