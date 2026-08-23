export const dailyCardGlossaryResolutions = Object.freeze([
  Object.freeze({
    sourcePath: 'src/content/glossary/broad-usd.md',
    sourceSlug: '/glossary/broad-usd',
    title: 'Broad USD',
    mode: 'alias',
    primaryCardId: 'card-dxy-signal-system',
    relatedCardIds: Object.freeze(['card-usd']),
    reason: 'The existing DXY-vs-dollar-system card already teaches why a narrow index is not the full dollar picture; the USD foundation card supplies the broader currency/funding context.',
    reviewedAt: '2026-08-23',
  }),
  Object.freeze({
    sourcePath: 'src/content/glossary/cpi.md',
    sourceSlug: '/glossary/cpi',
    title: 'CPI',
    mode: 'alias',
    primaryCardId: 'card-inflation-expectations-market-pricing',
    relatedCardIds: Object.freeze([]),
    reason: 'The canonical inflation-expectations card explicitly separates a CPI release from forward market pricing, preserving the glossary definition without creating a second inflation concept.',
    reviewedAt: '2026-08-23',
  }),
  Object.freeze({
    sourcePath: 'src/content/glossary/dollar-regime.md',
    sourceSlug: '/glossary/dollar-regime',
    title: 'Dollar Regime',
    mode: 'composite',
    primaryCardId: 'card-dollar-yields-liquidity',
    relatedCardIds: Object.freeze(['card-dxy-signal-system', 'card-real-yield', 'card-risk-off-environment']),
    reason: 'Dollar regime is intentionally composite: dollar direction, real rates, liquidity and risk appetite are separate dials and should not be collapsed into a duplicate single-driver card.',
    reviewedAt: '2026-08-23',
  }),
  Object.freeze({
    sourcePath: 'src/content/glossary/dxy.md',
    sourceSlug: '/glossary/dxy',
    title: 'DXY',
    mode: 'alias',
    primaryCardId: 'card-dxy-signal-system',
    relatedCardIds: Object.freeze(['card-usd']),
    reason: 'The existing DXY card states the same core distinction: DXY is a narrow signal rather than the complete global dollar system.',
    reviewedAt: '2026-08-23',
  }),
  Object.freeze({
    sourcePath: 'src/content/glossary/liquidity-stress.md',
    sourceSlug: '/glossary/liquidity-stress',
    title: 'Liquidity Stress',
    mode: 'composite',
    primaryCardId: 'card-dollar-yields-liquidity',
    relatedCardIds: Object.freeze(['card-risk-off-environment', 'card-credit-spreads-risk-liquidity', 'card-repo-policy-funding-stress']),
    reason: 'Liquidity stress spans funding, credit, volatility and market-functioning channels. The resolution intentionally points to a foundation card plus deeper channel-specific cards rather than inventing one universal stress signal.',
    reviewedAt: '2026-08-23',
  }),
  Object.freeze({
    sourcePath: 'src/content/glossary/lng.md',
    sourceSlug: '/glossary/lng',
    title: 'LNG',
    mode: 'alias',
    primaryCardId: 'card-lng-regional-gas',
    relatedCardIds: Object.freeze(['card-eia']),
    reason: 'The existing LNG card already separates dollar pricing from regional benchmarks and physical constraints; the EIA card supplies the primary-source energy-data context.',
    reviewedAt: '2026-08-23',
  }),
  Object.freeze({
    sourcePath: 'src/content/glossary/real-rates.md',
    sourceSlug: '/glossary/real-rates',
    title: 'Real Rates',
    mode: 'alias',
    primaryCardId: 'card-real-yield',
    relatedCardIds: Object.freeze(['card-gold-real-yields']),
    reason: 'The existing Real Yield card is the canonical foundation for nominal yields adjusted for inflation compensation and already links the concept to cross-asset analysis.',
    reviewedAt: '2026-08-23',
  }),
  Object.freeze({
    sourcePath: 'src/content/glossary/tips.md',
    sourceSlug: '/glossary/tips',
    title: 'TIPS',
    mode: 'alias',
    primaryCardId: 'card-real-yield',
    relatedCardIds: Object.freeze(['card-inflation-expectations-market-pricing']),
    reason: 'TIPS are a principal source of market real-yield information; the canonical Real Yield card is the correct concept destination while the inflation-expectations card provides the pricing decomposition.',
    reviewedAt: '2026-08-23',
  }),
  Object.freeze({
    sourcePath: 'src/content/glossary/treasury-yields.md',
    sourceSlug: '/glossary/treasury-yields',
    title: 'Treasury Yields',
    mode: 'composite',
    primaryCardId: 'card-dollar-yields-liquidity',
    relatedCardIds: Object.freeze(['card-treasury-yields-term-premium']),
    reason: 'The open foundation card introduces Treasury yields as a distinct dial; the deeper canonical card decomposes policy expectations and term premium instead of treating yield changes as an automatic dollar-direction signal.',
    reviewedAt: '2026-08-23',
  }),
]);

const resolutionBySourcePath = new Map(dailyCardGlossaryResolutions.map((item) => [item.sourcePath, item]));
const resolutionBySourceSlug = new Map(dailyCardGlossaryResolutions.map((item) => [item.sourceSlug, item]));

export function getDailyCardGlossaryResolutionBySourcePath(sourcePath) {
  return resolutionBySourcePath.get(sourcePath);
}

export function getDailyCardGlossaryResolutionBySourceSlug(sourceSlug) {
  return resolutionBySourceSlug.get(sourceSlug);
}
