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
  Object.freeze({
    sourcePath: 'src/content/pages/dxy-vs-broad-usd.md',
    sourcePageSlug: '/dxy/dxy-vs-broad-usd',
    sourceHeading: 'Match the benchmark to the exposure',
    title: 'Match the benchmark to the exposure',
    mode: 'overlap',
    primaryCardId: 'card-regime-benchmark-selection',
    relatedCardIds: Object.freeze(['card-dxy-broad-purpose', 'card-dollar-index-points-scope']),
    reason: 'The section teaches the same benchmark-selection rule already promoted as a canonical Market Application card: use bilateral, DXY, Broad USD, real-dollar or funding measures according to the exposure and claim. A second Core card would duplicate that operating rule.',
    reviewedAt: '2026-08-24',
  }),
  Object.freeze({
    sourcePath: 'src/content/pages/what-is-the-us-dollar.md',
    sourcePageSlug: '/dollar/what-is-the-us-dollar',
    sourceHeading: 'The usual mistake: starting with the asset',
    title: 'The usual mistake: starting with the asset',
    mode: 'overlap',
    primaryCardId: 'card-dollar-five-step-reading-sequence',
    relatedCardIds: Object.freeze(['card-regime-evidence-ladder', 'card-dollar-story-diagnostic-errors']),
    reason: 'The three-step upstream-first discipline is fully contained in the canonical five-step reading sequence and evidence-ladder cards. Promoting it separately would create a shorter duplicate workflow rather than a new learning objective.',
    reviewedAt: '2026-08-24',
  }),
  Object.freeze({
    sourcePath: 'src/content/pages/dxy-vs-broad-usd.md',
    sourcePageSlug: '/dxy/dxy-vs-broad-usd',
    sourceHeading: 'Common mistakes',
    title: 'Common mistakes',
    mode: 'overlap',
    primaryCardId: 'card-dollar-story-diagnostic-errors',
    relatedCardIds: Object.freeze(['card-dxy-broad-purpose', 'card-dollar-index-points-scope', 'card-regime-benchmark-selection']),
    reason: 'The DXY-versus-Broad mistake paragraph repeats canonical warnings about benchmark scope, index interpretation and avoiding automatic asset conclusions. The diagnostic card and benchmark cards preserve the learning objective without another near-duplicate mistake card.',
    reviewedAt: '2026-08-24',
  }),
  Object.freeze({
    sourcePath: 'src/content/pages/what-is-dxy.md',
    sourcePageSlug: '/dxy/what-is-dxy',
    sourceHeading: 'Lesson checkpoint',
    title: 'Lesson checkpoint',
    mode: 'overlap',
    primaryCardId: 'card-dxy-signal-system',
    relatedCardIds: Object.freeze(['card-dxy-euro-weight', 'card-dxy-broad-purpose']),
    reason: 'The checkpoint is an assessment summary rather than a distinct explanatory concept. Its DXY definition, euro-weight and broad-index distinctions are already represented by canonical cards and should remain assessment material instead of becoming a duplicate card.',
    reviewedAt: '2026-08-24',
  }),
  Object.freeze({
    sourcePath: 'src/content/pages/dxy-vs-broad-usd.md',
    sourcePageSlug: '/dxy/dxy-vs-broad-usd',
    sourceHeading: 'Lesson checkpoint',
    title: 'Lesson checkpoint',
    mode: 'overlap',
    primaryCardId: 'card-regime-benchmark-selection',
    relatedCardIds: Object.freeze(['card-dxy-broad-purpose', 'card-dxy-broad-agreement', 'card-dxy-broad-divergence']),
    reason: 'This checkpoint only asks the learner to restate benchmark coverage, agreement versus divergence and exposure matching. Those objectives are already canonical, so the checkpoint should remain assessment material rather than being promoted because it happens to be the last mechanically eligible Core Book heading.',
    reviewedAt: '2026-08-24',
  }),
  Object.freeze({
    sourcePath: 'src/content/pages/what-is-the-us-dollar.md',
    sourcePageSlug: '/dollar/what-is-the-us-dollar',
    sourceHeading: 'Lesson checkpoint',
    title: 'Lesson checkpoint',
    mode: 'overlap',
    primaryCardId: 'card-dollar-international-role-multiple-measures',
    relatedCardIds: Object.freeze(['card-usd', 'card-dollar-five-step-reading-sequence', 'card-dxy-signal-system']),
    reason: 'This checkpoint summarizes the dollar’s structural roles, USD-versus-DXY distinction and the application sequence already covered by canonical cards. It is an assessment prompt, not a new explanatory concept, and should not be promoted solely to keep the deficit-targeted Book shortlist non-empty.',
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
