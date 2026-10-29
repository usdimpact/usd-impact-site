import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const validator = fileURLToPath(new URL('./validate-news.mjs', import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'news-source-references-'));
const newsRoot = path.join(root, 'src/content/news');
fs.mkdirSync(newsRoot, { recursive: true });
const editionFile = path.join(newsRoot, '2026-10-30.md');

function edition(style, { highlightId = 'fed-scf-2025', catalystId = 'calendar' } = {}) {
  const references = (id) => style === 'inline'
    ? `    sourceIds: ["${id}"]`
    : `    sourceIds:\n      - '${id}'`;
  return `---
date: "2026-10-30"
slug: "/news/2026-10-30"
lastReviewed: "2026-10-30"
status: "published"
complianceNote: "Educational only; not investment advice."
highlights:
  - headline: "The Fed's household survey"
    verification: "verified-primary"
${references(highlightId)}
  - headline: "Banking context"
    verification: "verified-primary"
${references('fed-h8')}
  - headline: "Scheduled inflation release"
    verification: "verified-primary"
${references('calendar')}
catalysts:
  - date: "2026-10-14"
    event: "Scheduled inflation release"
${references(catalystId)}
sources:
  - id: "fed-scf-2025"
    url: "https://www.federalreserve.gov/newsevents/pressreleases/other20261009a.htm"
    sourceType: "primary"
  - id: "fed-h8"
    url: "https://www.federalreserve.gov/releases/h8/20261009/"
    sourceType: "primary"
  - id: "calendar"
    url: "https://www.bls.gov/schedule/2026/10_sched_list.htm"
    sourceType: "primary"
---
Source-reference fixture.
`;
}

function validate(source) {
  fs.writeFileSync(editionFile, source, 'utf8');
  const result = spawnSync(process.execPath, [validator], {
    cwd: root, encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, 'validator must complete within its bound');
  return result;
}

try {
  for (const style of ['inline', 'block']) {
    const valid = validate(edition(style));
    assert.equal(valid.status, 0, `${style} references should validate: ${valid.stderr}`);
    for (const entry of ['highlightId', 'catalystId']) {
      const invalid = validate(edition(style, { [entry]: 'fed-scf' }));
      assert.notEqual(invalid.status, 0, `${style} unknown ${entry} must fail`);
      assert.match(invalid.stderr, /2026-10-30\.md: unknown source ID "fed-scf"/);
    }
  }
  for (const style of ['inline', 'block']) {
    const falsePrimary = edition(style)
      .replace('https://www.federalreserve.gov/newsevents/pressreleases/other20261009a.htm', 'https://apnews.com/article/reporting-only')
      .replace('sourceType: "primary"', 'sourceType: "reporting"');
    const primaryResult = validate(falsePrimary);
    assert.notEqual(primaryResult.status, 0, 'verified-primary must cite an actual primary-classified source');
    assert.match(primaryResult.stderr, /highlight 1 is verified-primary but cites no recognized primary source/);

    const spoofedPrimary = edition(style)
      .replace('https://www.federalreserve.gov/newsevents/pressreleases/other20261009a.htm', 'https://apnews.com/article/not-a-primary');
    const spoofedResult = validate(spoofedPrimary);
    assert.notEqual(spoofedResult.status, 0, 'primary evidence requires a recognized primary publisher URL');
    assert.match(spoofedResult.stderr, /source fed-scf-2025 type does not match its recognized publisher URL/);

    for (const officialUrl of [
      'https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20261535.pdf',
      'https://treasurydirect.gov/auctions/when-auctions-happen/',
      'https://www.kansascityfed.org/research/jackson-hole-economic-symposium/jackson-hole-faqs/',
    ]) {
      const officialSource = edition(style).replace(
        'https://www.federalreserve.gov/newsevents/pressreleases/other20261009a.htm', officialUrl,
      );
      const officialResult = validate(officialSource);
      assert.equal(officialResult.status, 0, `approved issuer URL should remain valid: ${officialUrl} ${officialResult.stderr}`);
    }
    const fakeGov = edition(style).replace(
      'https://www.federalreserve.gov/newsevents/pressreleases/other20261009a.htm',
      'https://dol.gov.example.com/claims',
    );
    const fakeGovResult = validate(fakeGov);
    assert.notEqual(fakeGovResult.status, 0, 'lookalike government domain must not be trusted');
    assert.match(fakeGovResult.stderr, /source fed-scf-2025 type does not match its recognized publisher URL/);

    const originalIds = style === 'inline'
      ? '    sourceIds: ["fed-scf-2025"]'
      : "    sourceIds:\n      - 'fed-scf-2025'";
    const dualIds = style === 'inline'
      ? '    sourceIds: ["fed-scf-2025", "reporter-two"]'
      : "    sourceIds:\n      - 'fed-scf-2025'\n      - 'reporter-two'";
    const reportingCandidate = edition(style)
      .replace('verification: "verified-primary"', 'verification: "verified-multiple"')
      .replace(originalIds, dualIds)
      .replace('https://www.federalreserve.gov/newsevents/pressreleases/other20261009a.htm', 'https://apnews.com/article/reporting-one')
      .replace('sourceType: "primary"', 'sourceType: "reporting"')
      .replace('---\nSource-reference fixture.', `  - id: "reporter-two"
    url: "https://m.apnews.com/article/reporting-two"
    sourceType: "reporting"
---
Source-reference fixture.`);

    const samePublisher = validate(reportingCandidate);
    assert.notEqual(samePublisher.status, 0, 'two hostnames from the same publisher are not independent reporting evidence');
    assert.match(samePublisher.stderr, /highlight 1 is verified-multiple but cites fewer than two independent reporting domains/);

    const differentPublisher = reportingCandidate.replace(
      'https://m.apnews.com/article/reporting-two', 'https://www.reuters.com/world/reporting-two',
    );
    const validMultiple = validate(differentPublisher);
    assert.equal(validMultiple.status, 0, `different reporting domains should validate: ${validMultiple.stderr}`);
    const falseMultiple = differentPublisher.replace(
      'https://www.reuters.com/world/reporting-two',
      'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm',
    ).replace('sourceType: "reporting"\n---', 'sourceType: "primary"\n---');
    const primaryInMultiple = validate(falseMultiple);
    assert.notEqual(primaryInMultiple.status, 0, 'verified-multiple must not hide primary-source citations');
    assert.match(primaryInMultiple.stderr, /is verified-multiple but cites primary evidence/);
  }
  console.log('Daily source-reference regression passed: inline/block IDs, primary labels, independent reporting domains.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
