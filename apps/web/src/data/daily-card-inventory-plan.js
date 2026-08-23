export const dailyCardInventoryTargets = Object.freeze({
  'core-framework': 25,
  'asset-transmission': 30,
  'rates-liquidity-policy': 35,
  'global-dollar-fx': 20,
  'dollar-funding-stack': 15,
  'market-application': 15,
  'history-institutions': 10,
});

export const dailyCardInventoryTargetTotal = Object.values(dailyCardInventoryTargets)
  .reduce((sum, value) => sum + value, 0);

export const dailyCardSourceHierarchy = Object.freeze([
  Object.freeze({ id: 'video-library', order: 1, label: 'Reviewed Video Library' }),
  Object.freeze({ id: 'glossary', order: 2, label: 'Glossary' }),
  Object.freeze({ id: 'book-audiobook', order: 3, label: 'Read the Dollar First / audiobook' }),
  Object.freeze({ id: 'frameworks', order: 4, label: 'Framework pages' }),
  Object.freeze({ id: 'quizzes', order: 5, label: 'Existing quizzes' }),
  Object.freeze({ id: 'weekly-score', order: 6, label: 'Weekly Score' }),
  Object.freeze({ id: 'daily-usd-impact', order: 7, label: 'Daily USD Impact' }),
  Object.freeze({ id: 'catalyst-briefs', order: 8, label: 'Catalyst Briefs' }),
]);

export const dailyCardPromotionRules = Object.freeze({
  machineCandidateStatus: 'review',
  publishableStatuses: Object.freeze(['ready-for-build', 'published']),
  requiredEditorialFields: Object.freeze([
    'definition',
    'whyItMatters',
    'keyTakeaway',
    'sourceNames',
    'lastReviewed',
  ]),
  rule: 'Machine-derived candidates must never become publishable without explicit editorial completion and source review.',
});
