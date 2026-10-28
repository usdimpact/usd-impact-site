import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  inspectResearchReportSource,
  inspectResearchReportTree,
  compareResearchReportInventory,
  runInventoryCheck,
} from './audit-research-report-inventory.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/research-report-public-baseline-2026-10-28.json', import.meta.url));
const baseline = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const observed = inspectResearchReportTree();
const check = runInventoryCheck();
assert.equal(check.status, 'INVENTORY_MATCH_ONLY');
assert.equal(check.releaseAuthorized, false);
assert.equal(check.weekly, 13);
assert.equal(check.monthly, 3);
assert.equal(check.contributionLanguage, 16);
assert.equal(check.weeklyInputReferences, 13);
assert.equal(check.publicSamples, 1);
assert.equal(observed.length, 16);
assert.equal(baseline.entries.length, 16);
assert.ok(observed.every(row => row.rightsStatus === 'HOLD_UNREVIEWED'));

// Named/approved public sample is not the same as a rights grant.
const sample = observed.find(row => row.type === 'weekly' && row.periodEnd === '2026-08-07');
assert.equal(sample.approvedSampleRoute, '/research/sample/');
assert.equal(sample.rightsStatus, 'HOLD_UNREVIEWED');

const syntheticWeekly = inspectResearchReportSource({
  type: 'weekly', filename: '2026-11-06.md',
  markdown: [
    '---',
    'periodEnd: "2026-11-06"',
    'slug: "/reports/weekly/2026-11-06"',
    'status: "published"',
    'score:',
    '  sourceUrl: "https://example.invalid/archive/2026-11-06/weekly_input.json"',
    '  nearestRegimeBoundary: -0.3',
    '---',
    'Component contributions are synthetic test content.',
  ].join('\n'),
});
assert.equal(syntheticWeekly.publicRoute, '/reports/weekly/2026-11-06');
assert.equal(syntheticWeekly.hasWeeklyInputReference, true);
assert.equal(syntheticWeekly.hasNearestRegimeBoundary, true);
assert.equal(syntheticWeekly.hasComponentDiscussion, true);
assert.equal(syntheticWeekly.rightsStatus, 'HOLD_UNREVIEWED');
assert.equal(syntheticWeekly.approvedSampleRoute, null);

const noRights = compareResearchReportInventory([...observed, syntheticWeekly], baseline);
assert.equal(noRights.status, 'HOLD');
assert.equal(noRights.reason, 'public-report-inventory-drift');
assert.equal(noRights.releaseAuthorized, false);
assert.equal(noRights.observedReports, 17);

const changedClassification = observed.map((row, i) =>
  i === 0 ? { ...row, rightsStatus: 'APPROVED' } : row);
assert.equal(compareResearchReportInventory(changedClassification, baseline).status, 'HOLD');
const changedSourceSurface = observed.map((row, i) =>
  i === 0 ? { ...row, hasWeeklyInputReference: false } : row);
assert.equal(compareResearchReportInventory(changedSourceSurface, baseline).status, 'HOLD');

const duplicate = [...observed, observed[0]];
assert.equal(compareResearchReportInventory(duplicate, baseline).reason, 'duplicate-report-key');
assert.equal(compareResearchReportInventory(observed, { entries: observed }).reason, 'invalid-baseline');
assert.throws(() => inspectResearchReportSource({
  type: 'monthly', filename: '../2026-11-20.md', markdown: '---\n---\n',
}), /invalid/);
assert.throws(() => inspectResearchReportSource({
  type: 'weekly', filename: '2026-11-06.md',
  markdown: '---\nperiodEnd: "2026-11-06"\nslug: "/reports/monthly/2026-11-06"\n---\n',
}), /slug/);
assert.throws(() => inspectResearchReportSource({
  type: 'weekly', filename: '2026-11-06.md',
  markdown: '---\nperiodEnd: "2026-11-13"\nslug: "/reports/weekly/2026-11-06"\n---\n',
}), /periodEnd/);

console.log('Research public report inventory: 16 observed and frozen; drift fails closed, rights HOLD unchanged.');
