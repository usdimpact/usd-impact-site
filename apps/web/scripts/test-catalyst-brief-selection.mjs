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

console.log('catalyst brief selection tests pass');
