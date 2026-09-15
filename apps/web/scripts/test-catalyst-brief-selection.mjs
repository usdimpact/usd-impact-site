import assert from 'node:assert/strict';
import {
  catalystBriefSlug,
  catalystEventKey,
  selectImportantCatalyst,
} from '../src/lib/catalyst-briefs.js';

const latest = {
  edition: {
    date: '2026-08-05',
    catalysts: [
      {
        date: '2026-08-07',
        event: 'BLS Employment Situation — July 2026',
        eventType: 'labor',
        assets: ['DXY', 'U.S. rates', 'S&P 500'],
        importance: 'high',
        impactScore: 5,
        extraBrief: true,
        whyItMatters: 'Payrolls and unemployment can materially reprice the expected policy path.',
      },
      {
        date: '2026-08-06',
        event: 'Routine weekly petroleum statistics',
        eventType: 'energy',
        assets: ['WTI'],
        importance: 'medium',
        impactScore: 3,
        extraBrief: false,
        whyItMatters: 'Inventories can affect near-term oil pricing.',
      },
    ],
  },
};

assert.equal(
  catalystEventKey('2026-08-07', 'BLS Employment Situation — July 2026'),
  '2026-08-07-bls-employment-situation-july-2026',
);
assert.equal(
  catalystBriefSlug('2026-08-07', 'BLS Employment Situation — July 2026', 'preview'),
  '2026-08-07-bls-employment-situation-july-2026-preview',
);

const preview = selectImportantCatalyst(latest, { phase: 'preview', asOf: '2026-08-05' });
assert.equal(preview.event, 'BLS Employment Situation — July 2026');
assert.equal(preview.phase, 'preview');
assert.equal(preview.sourceEditionDate, '2026-08-05');

assert.equal(
  selectImportantCatalyst(latest, {
    phase: 'preview',
    asOf: '2026-08-05',
    existingSlugs: [preview.slug],
  }),
  null,
);
assert.equal(selectImportantCatalyst(latest, { phase: 'outcome', asOf: '2026-08-05' }), null);
assert.equal(selectImportantCatalyst({ edition: null }, { phase: 'preview', asOf: '2026-08-05' }), null);

const publishedFomcPreviewSlug = '2026-09-15-fomc-meeting-and-press-conference-september-15-16-2026-preview';

const duplicateFomcLabel = {
  edition: {
    date: '2026-09-14',
    catalysts: [
      {
        date: '2026-09-15',
        event: 'FOMC two-day meeting (rate decision window)',
        eventType: 'central-bank',
        assets: ['DXY', 'U.S. rates', 'S&P 500'],
        importance: 'high',
        impactScore: 5,
        extraBrief: true,
        whyItMatters: 'The meeting can reprice the expected policy path across rates, USD, and risk assets.',
      },
    ],
  },
};

assert.equal(
  selectImportantCatalyst(duplicateFomcLabel, {
    phase: 'preview',
    asOf: '2026-09-15',
    existingSlugs: [publishedFomcPreviewSlug],
  }),
  null,
  'PR #604 regression: a renamed preview for the same FOMC meeting must be suppressed',
);

const shiftedFomcDate = {
  edition: {
    date: '2026-09-15',
    catalysts: [
      {
        date: '2026-09-16',
        event: 'Federal Open Market Committee (FOMC) two-day meeting and press conference',
        eventType: 'central-bank',
        assets: ['DXY', 'USD', 'U.S. rates', 'S&P 500', 'Nasdaq'],
        importance: 'high',
        impactScore: 5,
        extraBrief: true,
        whyItMatters: 'The statement, projections, and press conference can reprice rates, USD, and risk assets.',
      },
    ],
  },
};

assert.equal(
  selectImportantCatalyst(shiftedFomcDate, {
    phase: 'preview',
    asOf: '2026-09-15',
    existingSlugs: [publishedFomcPreviewSlug],
  }),
  null,
  'The same two-day FOMC meeting must remain de-duplicated when a later edition keys it to decision day',
);

const fomcOutcome = selectImportantCatalyst(shiftedFomcDate, {
  phase: 'outcome',
  asOf: '2026-09-16',
  existingSlugs: [publishedFomcPreviewSlug],
});
assert.equal(fomcOutcome?.phase, 'outcome', 'An existing preview must never suppress the verified-outcome phase');
assert.equal(fomcOutcome?.eventDate, '2026-09-16');

assert.equal(
  selectImportantCatalyst(shiftedFomcDate, {
    phase: 'outcome',
    asOf: '2026-09-16',
    existingSlugs: ['2026-09-15-fomc-two-day-meeting-rate-decision-window-outcome'],
  }),
  null,
  'A same-meeting FOMC outcome must be de-duplicated across start-day/decision-day identity drift',
);

const unrelatedCentralBank = {
  edition: {
    date: '2026-09-15',
    catalysts: [
      {
        date: '2026-09-16',
        event: 'ECB monetary policy meeting',
        eventType: 'central-bank',
        assets: ['EURUSD', 'DXY'],
        importance: 'high',
        impactScore: 5,
        extraBrief: true,
        whyItMatters: 'ECB guidance can reprice euro rates and EURUSD.',
      },
    ],
  },
};

assert.equal(
  selectImportantCatalyst(unrelatedCentralBank, {
    phase: 'preview',
    asOf: '2026-09-15',
    existingSlugs: [publishedFomcPreviewSlug],
  })?.event,
  'ECB monetary policy meeting',
  'The FOMC family guard must not suppress unrelated central-bank catalysts',
);

console.log('catalyst brief selection tests pass');
