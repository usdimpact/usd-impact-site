import assert from 'node:assert/strict';
import { generateSocialCandidate } from '../src/lib/social-candidate-generator.js';

const daily = generateSocialCandidate({
  title: 'Daily USD Impact — Test Edition',
  date: '2026-09-17',
  status: 'published',
  url: 'https://www.usd-impact.com/news/2026-09-17/',
  summary: 'The dollar, real rates and liquidity sent a mixed cross-asset signal.',
  marketRegime: 'Mixed dollar and rates pressure',
  highlights: [
    { headline: 'Dollar signal', whyItMatters: 'A firmer dollar tightened the cross-asset backdrop.' },
    { headline: 'Rates signal', whyItMatters: 'Real-rate pressure remained relevant for duration-sensitive assets.' },
    { headline: 'Liquidity signal', whyItMatters: 'Funding conditions did not confirm a broad stress regime.' },
  ],
  sources: [{ url: 'https://fred.stlouisfed.org/' }],
}, 'daily');

assert.equal(daily.state, 'draft');
assert.equal(daily.qa.publishable, false);
assert.equal(daily.qa.humanReviewRequired, true);
assert.equal(daily.brand.captionedVariantRequiredForPublish, true);
assert.match(daily.candidateId, /^social-daily-2026-09-17-/);
assert.equal(daily.outputs.carousel.slides[0].text, 'USD IMPACT TODAY');

const weekly = generateSocialCandidate({
  title: 'Weekly USD Impact Brief — Test Week',
  periodEnd: '2026-09-11',
  status: 'published',
  url: 'https://www.usd-impact.com/weekly/2026-09-11/',
  score: { value: 61, regime: 'Moderately restrictive' },
  themes: [
    { title: 'Dollar', summary: 'Dollar pressure increased.' },
    { title: 'Real rates', summary: 'Real yields remained elevated.' },
    { title: 'Liquidity', summary: 'Liquidity stayed mixed.' },
  ],
  sourceEditions: [{ url: 'https://www.usd-impact.com/news/2026-09-10/' }],
}, 'weekly');

assert.equal(weekly.state, 'draft');
assert.equal(weekly.outputs.reel.family, 'Weekly Score');
assert.match(weekly.outputs.reel.narrationSegments.at(-1), /not as a standalone trading signal/);

const catalyst = generateSocialCandidate({
  title: 'USD Impact Catalyst Brief — Test Event',
  event: 'Test central-bank decision',
  eventDate: '2026-09-17',
  phase: 'outcome',
  status: 'published',
  url: 'https://www.usd-impact.com/news/catalysts/test-event',
  verifiedFacts: [
    { statement: 'The official decision was released.' },
    { statement: 'The policy statement contained updated guidance.' },
  ],
  transmissionChannels: [
    { channel: 'Dollar', conditionalImpact: 'The dollar response depends on the change in expected policy relative to prior pricing.' },
    { channel: 'Real rates', conditionalImpact: 'Real yields can reprice if the expected policy path changes.' },
  ],
  whatToWatch: ['Whether the initial dollar move holds after the press conference.'],
  sources: [{ url: 'https://www.federalreserve.gov/' }],
}, 'catalyst');

assert.equal(catalyst.state, 'draft');
assert.equal(catalyst.outputs.reel.family, 'Catalyst Result');
assert.ok(catalyst.outputs.carousel.slides.some((slide) => slide.role === 'verified-fact'));

const report = generateSocialCandidate({
  title: 'Test Deep Dive',
  date: '2026-09-17',
  status: 'published',
  url: 'https://www.usd-impact.com/reports/test-deep-dive/',
  summary: 'A structured review of the dollar transmission mechanism.',
  keyPoints: [
    'Dollar direction is one input, not the entire system.',
    'Real rates can create a separate pressure channel.',
    'Funding conditions can confirm or contradict the headline signal.',
  ],
  evidence: [{ url: 'https://www.federalreserve.gov/' }],
}, 'report');

assert.equal(report.state, 'draft');
assert.equal(report.outputs.reel.family, 'Report / Deep Dive');
assert.equal(report.outputs.carousel.slides.at(-1).role, 'cta');

const blockedUnpublished = generateSocialCandidate({
  title: 'Draft Daily',
  date: '2026-09-17',
  status: 'review',
  url: 'https://www.usd-impact.com/news/2026-09-17/',
  summary: 'Draft.',
  highlights: [{ headline: 'Draft', whyItMatters: 'Draft.' }],
}, 'daily');

assert.equal(blockedUnpublished.state, 'blocked');
assert.ok(blockedUnpublished.failures.some((failure) => failure.includes('status must be published')));
assert.equal(blockedUnpublished.qa.publishable, false);

const blockedNoEvidence = generateSocialCandidate({
  title: 'Published without evidence',
  date: '2026-09-17',
  status: 'published',
  summary: 'Missing evidence.',
  highlights: [{ headline: 'Missing evidence', whyItMatters: 'This must fail closed.' }],
}, 'daily');

assert.equal(blockedNoEvidence.state, 'blocked');
assert.ok(blockedNoEvidence.failures.some((failure) => failure.includes('source')));

const invalid = generateSocialCandidate(null, 'daily');
assert.equal(invalid.state, 'blocked');
assert.deepEqual(invalid.failures, ['source must be an object']);

console.log('Social candidate generator contract tests passed.');
