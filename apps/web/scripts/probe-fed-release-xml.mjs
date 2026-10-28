import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const FED_ORIGIN = 'https://www.federalreserve.gov';
const MAX_ZIP_BYTES = 32 * 1024 * 1024;
const MAX_XML_BUFFER = 96 * 1024 * 1024;

const releases = Object.freeze([
  Object.freeze({
    release: 'H10',
    url: 'https://www.federalreserve.gov/releases/h10/data/FRB_h10_xml.zip',
    identifierNeedles: ['JRXWTFB_N.B', 'JRXWTFB'],
    labelNeedles: ['Nominal Broad U.S. Dollar Index', 'Broad U.S. Dollar Index'],
  }),
  Object.freeze({
    release: 'H15',
    url: 'https://www.federalreserve.gov/releases/h15/data/FRB_h15_xml.zip',
    identifierNeedles: ['RIFLGFCY10_XII_N.B', 'RIFLGFCY10_XII'],
    labelNeedles: ['10-year', 'inflation-indexed'],
  }),
  Object.freeze({
    release: 'PRATES',
    url: 'https://www.federalreserve.gov/releases/prates/data/FRB_PRATES_xml.zip',
    identifierNeedles: ['RESBM_N.D', 'RESBM'],
    labelNeedles: ['Interest Rate on Reserve Balances', 'IORB'],
  }),
]);

function assertFedUrl(value) {
  const url = new URL(value);
  if (url.origin !== FED_ORIGIN || url.protocol !== 'https:') {
    throw new Error('Federal Reserve XML proof URL escaped the pinned origin.');
  }
  return url;
}

function listZipEntries(zipPath) {
  return execFileSync('unzip', ['-Z1', zipPath], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  }).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
}

function readZipEntry(zipPath, entry) {
  return execFileSync('unzip', ['-p', zipPath, entry], {
    encoding: 'utf8',
    maxBuffer: MAX_XML_BUFFER,
  });
}

function parseAttributes(tag) {
  const attrs = {};
  const pattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(["'])(.*?)\2/g;
  for (const match of tag.matchAll(pattern)) attrs[match[1]] = match[3];
  return attrs;
}

function safeSeriesAttributes(attrs) {
  return Object.fromEntries(Object.entries(attrs).filter(([key]) => (
    /(?:^|:)(?:ID|SERIES|SERIES_NAME|NAME|TITLE|FREQ|UNIT|CURRENCY|MATURITY|INSTRUMENT|TENOR)$/i.test(key)
    || /(?:SERIES|IDENTIFIER|FREQ|UNIT|CURRENCY|MATURITY|INSTRUMENT|TENOR)/i.test(key)
  )));
}

function rootTag(xml) {
  return xml.match(/<([A-Za-z_:][A-Za-z0-9_.:-]*)\b[^>]*>/)?.[1] || null;
}

function seriesCandidates(xml, spec) {
  const tags = [...xml.matchAll(/<([A-Za-z_:][A-Za-z0-9_.:-]*Series)\b[^>]*>/gi)]
    .map((match) => ({ tagName: match[1], tag: match[0], index: match.index ?? -1 }));

  const scored = tags.map((candidate) => {
    const attrs = parseAttributes(candidate.tag);
    const haystack = candidate.tag.toLowerCase();
    let score = 0;
    for (const needle of spec.identifierNeedles) if (haystack.includes(needle.toLowerCase())) score += 20;
    for (const needle of spec.labelNeedles) if (haystack.includes(needle.toLowerCase())) score += 5;
    return { ...candidate, attrs, score };
  }).filter((candidate) => candidate.score > 0);

  if (scored.length) return scored.sort((a, b) => b.score - a.score);

  // Some Board SDMX variants place human-readable names outside the Series start tag.
  // Find a label/identifier in the document and return the nearest preceding Series tag.
  const needles = [...spec.identifierNeedles, ...spec.labelNeedles];
  for (const needle of needles) {
    const index = xml.toLowerCase().indexOf(needle.toLowerCase());
    if (index < 0) continue;
    const prior = tags.filter((candidate) => candidate.index <= index).at(-1);
    if (prior) return [{ ...prior, attrs: parseAttributes(prior.tag), score: 1 }];
  }

  return [];
}

function firstObservationShape(xml, seriesIndex) {
  const tail = xml.slice(Math.max(0, seriesIndex));
  const closeIndex = tail.search(/<\/([A-Za-z_:][A-Za-z0-9_.:-]*Series)>/i);
  const bounded = closeIndex >= 0 ? tail.slice(0, closeIndex) : tail.slice(0, 2 * 1024 * 1024);
  const match = bounded.match(/<([A-Za-z_:][A-Za-z0-9_.:-]*(?:Obs|Observation))\b[^>]*>/i);
  if (!match) return null;
  const attrs = parseAttributes(match[0]);
  return {
    tagName: match[1],
    attributeNames: Object.keys(attrs).sort(),
    // Explicitly do not emit attribute values because those may include observations.
  };
}

async function inspectRelease(spec, tempRoot) {
  const url = assertFedUrl(spec.url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let response;
  try {
    response = await fetch(url, {
      redirect: 'error',
      signal: controller.signal,
      headers: { 'user-agent': 'USD-Impact-Fed-XML-Structure-Proof/1.0' },
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) throw new Error(`${spec.release} XML ZIP returned HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_ZIP_BYTES) {
    throw new Error(`${spec.release} XML ZIP size is outside the bounded proof range.`);
  }
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error(`${spec.release} response is not a ZIP payload.`);
  }

  const zipPath = path.join(tempRoot, `${spec.release}.zip`);
  writeFileSync(zipPath, bytes, { mode: 0o600 });
  const entries = listZipEntries(zipPath);
  const xmlEntries = entries.filter((entry) => /\.xml$/i.test(entry));
  if (!xmlEntries.length) throw new Error(`${spec.release} ZIP contains no XML files.`);

  const matches = [];
  const roots = new Set();
  const xmlFileBytes = {};
  for (const entry of xmlEntries) {
    const xml = readZipEntry(zipPath, entry);
    xmlFileBytes[entry] = Buffer.byteLength(xml, 'utf8');
    roots.add(rootTag(xml));
    for (const candidate of seriesCandidates(xml, spec).slice(0, 3)) {
      matches.push({
        file: entry,
        tagName: candidate.tagName,
        seriesAttributes: safeSeriesAttributes(candidate.attrs),
        observationShape: firstObservationShape(xml, candidate.index),
      });
    }
  }

  if (!matches.length) {
    throw new Error(`${spec.release} XML did not expose the expected series identity or label.`);
  }

  return {
    release: spec.release,
    url: spec.url,
    zipBytes: bytes.length,
    zipSha256: createHash('sha256').update(bytes).digest('hex'),
    xmlFiles: xmlEntries,
    xmlFileBytes,
    rootTags: [...roots].filter(Boolean).sort(),
    matches,
  };
}

const tempRoot = mkdtempSync(path.join(tmpdir(), 'fed-release-xml-proof-'));
try {
  const results = [];
  for (const spec of releases) results.push(await inspectRelease(spec, tempRoot));

  // This proof intentionally emits structure and identifier metadata only.
  // No observation values are printed or persisted.
  console.log(JSON.stringify({
    proof: 'federal-reserve-release-xml-structure/v1',
    observationValuesEmitted: false,
    results,
  }, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
