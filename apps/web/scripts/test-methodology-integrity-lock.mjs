import assert from 'node:assert/strict';
import fs from 'node:fs';

const methodology = fs.readFileSync(new URL('../src/pages/score/methodology.astro', import.meta.url), 'utf8');

const requiredMarkers = [
  'USD Impact Score v2 is a descriptive weekly regime indicator.',
  'It is not a return forecast, trading signal, probability model or optimized portfolio rule.',
  'January 1, 2015 onward',
  'production start date is 2015-01-01',
  'full-sample mean',
  'pandas sample standard deviation',
  'default <code>ddof=1</code>',
  '−3.5, +3.5',
  'Score<sub>t,T</sub> = 0.125 × (DXY − WTI − SPX + VIX − BTC − GOLD + UST2Y + UST10Y)',
  'The eight absolute weights sum to 1.00.',
  '<td>DXY</td><td>Yahoo: DX-Y.NYB</td><td>Weekly level</td><td>+0.125</td>',
  '<td>WTI</td><td>Yahoo: CL=F</td><td>Weekly level</td><td>−0.125</td>',
  '<td>S&amp;P 500</td><td>Yahoo: ^GSPC</td><td>Weekly level</td><td>−0.125</td>',
  '<td>VIX</td><td>Yahoo: ^VIX</td><td>Weekly level</td><td>+0.125</td>',
  '<td>Bitcoin</td><td>Yahoo: BTC-USD</td><td>Weekly level</td><td>−0.125</td>',
  '<td>Gold</td><td>Yahoo: GC=F</td><td>Weekly level</td><td>−0.125</td>',
  '<td>U.S. 2Y yield</td><td>FRED: DGS2</td><td>Weekly yield level</td><td>+0.125</td>',
  '<td>U.S. 10Y yield</td><td>FRED: DGS10</td><td>Weekly yield level</td><td>+0.125</td>',
  '<tr><td>≥ +1.0</td><td>Strong dollar regime</td></tr>',
  '<tr><td>+0.3 to &lt; +1.0</td><td>Firm dollar regime</td></tr>',
  '<tr><td>−0.3 to &lt; +0.3</td><td>Neutral / transitional</td></tr>',
  '<tr><td>−1.0 to &lt; −0.3</td><td>Soft dollar regime</td></tr>',
  '<tr><td>&lt; −1.0</td><td>Weak dollar regime</td></tr>',
  'The signed 12.5% weights are static.',
  'v2 does not apply PCA, covariance adjustment, risk parity or cluster caps.',
  'Raw observations are not winsorized.',
  'Standardized component values are clipped only after z-scoring, at −3.5 and +3.5.',
];

for (const marker of requiredMarkers) {
  assert.ok(methodology.includes(marker), `Methodology integrity lock changed or missing: ${marker}`);
}

assert.doesNotMatch(
  methodology,
  /USD Impact Score v2 is (?:a )?(?:predictive|forecast|trading signal)/i,
  'Production Score v2 must remain descriptive/non-predictive.',
);

console.log('Methodology integrity lock passed.');
