export const dailyCardBookResolutions = Object.freeze([
  Object.freeze({
    sourcePath: 'src/content/pages/dxy-vs-broad-usd.md',
    sourcePageSlug: '/dxy/dxy-vs-broad-usd',
    sourceHeading: 'Four practical scenarios',
    title: 'Four practical scenarios',
    mode: 'overlap',
    primaryCardId: 'card-dollar-breadth-signal-matrix',
    relatedCardIds: Object.freeze(['card-dxy-broad-agreement', 'card-dxy-broad-divergence', 'card-regime-benchmark-selection']),
    reason: 'The scenario set repeats the same analytical objective now covered by the canonical dollar-breadth signal-matrix card plus the existing agreement/divergence cards. Keeping a second scenario bundle would add length without a distinct learning objective.',
    reviewedAt: '2026-08-24',
  }),
  Object.freeze({
    sourcePath: 'src/content/pages/what-is-dxy.md',
    sourcePageSlug: '/dxy/what-is-dxy',
    sourceHeading: 'Four interpretation scenarios',
    title: 'Four interpretation scenarios',
    mode: 'overlap',
    primaryCardId: 'card-dollar-breadth-signal-matrix',
    relatedCardIds: Object.freeze(['card-dxy-broad-agreement', 'card-dxy-broad-divergence', 'card-regime-benchmark-selection']),
    reason: 'These four DXY scenarios substantially duplicate the canonical breadth matrix and the agreement/divergence framework. The source remains published, but a second canonical card would fragment the same concept across near-identical examples.',
    reviewedAt: '2026-08-24',
  }),
  Object.freeze({
    sourcePath: 'src/content/pages/what-is-dxy.md',
    sourcePageSlug: '/dxy/what-is-dxy',
    sourceHeading: 'Common mistakes',
    title: 'Common mistakes',
    mode: 'overlap',
    primaryCardId: 'card-dollar-story-diagnostic-errors',
    relatedCardIds: Object.freeze(['card-dxy-signal-system', 'card-dollar-move-not-proof', 'card-regime-benchmark-selection']),
    reason: 'The DXY mistake list is a narrower instance of the reviewed dollar-story diagnostic card and existing DXY scope cards. It is preserved as source material without creating another canonical mistake card with the same warnings.',
    reviewedAt: '2026-08-24',
  }),
]);

function sectionKey(sourcePath, sourceHeading) {
  return `${sourcePath}::${sourceHeading}`;
}

const resolutionBySectionKey = new Map(
  dailyCardBookResolutions.map((item) => [sectionKey(item.sourcePath, item.sourceHeading), item]),
);

export function getDailyCardBookResolution(sourcePath, sourceHeading) {
  return resolutionBySectionKey.get(sectionKey(sourcePath, sourceHeading));
}
