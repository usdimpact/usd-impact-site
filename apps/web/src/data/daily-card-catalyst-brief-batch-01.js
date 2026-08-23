const catalystBriefSourcePath = 'src/content/catalyst-briefs/2026-08-12-bls-consumer-price-index-cpi-for-july-2026-preview.md';

export const dailyCardCatalystBriefBatch01 = Object.freeze([
  Object.freeze({
    id: 'card-inflation-release-component-mix',
    slug: 'inflation-release-component-mix',
    title: 'Inflation Releases Are a Component Mix, Not One Headline',
    shortTitle: 'Inflation Component Mix',
    collectionId: 'rates-liquidity-policy',
    format: 'connection',
    level: 'intermediate',
    access: 'open',
    hook: 'A headline inflation print can hide very different signals across core prices, shelter, energy and other components.',
    definition: 'An inflation release combines several price categories and summary measures. Headline inflation, core inflation and major components can move differently, so the top-line number is only one part of the signal.',
    whyItMatters: 'Policy expectations and market pricing can respond differently to persistent core pressure, shelter behavior or temporary energy swings even when the headline reading looks simple.',
    example: 'A softer energy contribution can reduce headline inflation while other components remain firm, producing a more mixed policy signal than the headline alone suggests.',
    commonMistake: 'Treating one headline inflation number as a complete description of the underlying inflation signal.',
    whatToWatch: ['headline inflation', 'core inflation', 'shelter', 'energy', 'component breadth', 'Treasury-yield response'],
    keyTakeaway: 'Inspect the component mix before translating one inflation headline into a policy or market conclusion.',
    assets: ['USD', 'DXY', 'UST', 'equities', 'XAUUSD'],
    concepts: ['inflation components', 'headline inflation', 'core inflation', 'shelter', 'energy'],
    relatedCardIds: ['card-inflation-expectations-market-pricing', 'card-macro-release-transmission-chain', 'card-real-yield'],
    sourceNames: ['USD Impact Catalyst Brief', 'U.S. Bureau of Labor Statistics', 'Federal Reserve Bank of St. Louis'],
    sourcePaths: [catalystBriefSourcePath],
    status: 'ready-for-build',
    lastReviewed: '2026-08-24',
  }),
]);
