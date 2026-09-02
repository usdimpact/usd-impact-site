const CONTENT_ID_PATTERN = /^(guided-edition|video|card):([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const RESUME_POSITION_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROGRESS_STATUSES = new Set(['started', 'in_progress', 'completed']);
const MAX_PROGRESS_ROWS = 500;

const NEXT_STEPS = Object.freeze({
  product: Object.freeze({
    kind: 'product',
    title: 'Review the Library Pass',
    description: 'See what is included and activate access before starting the protected learning path.',
    href: '/book/read-the-dollar-first/',
    ctaLabel: 'Review Library Pass',
  }),
  start: Object.freeze({
    kind: 'start-guided-edition',
    title: 'Start with the Guided Edition',
    description: 'Build the dollar-first framework chapter by chapter, with saved progress and short mastery checks.',
    href: '/guided-edition/',
    ctaLabel: 'Start Guided Edition',
  }),
  video: Object.freeze({
    kind: 'explore-video-library',
    title: 'Reinforce the framework with video',
    description: 'Use the Video Library to revisit the ideas you have started in the Guided Edition.',
    href: '/guided-edition/video-library/',
    ctaLabel: 'Explore Video Library',
  }),
  audiobook: Object.freeze({
    kind: 'explore-audiobook',
    title: 'Continue with the complete audiobook',
    description: 'Revisit the full argument in audio after working through the interactive and video formats.',
    href: '/guided-edition/audiobook/',
    ctaLabel: 'Open audiobook',
  }),
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function boundedPercent(value, status) {
  if (status === 'completed') return 100;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number))) : 0;
}

function timestamp(value) {
  if (typeof value !== 'string') return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeProgressRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const contentId = String(row.content_id || '');
  if (contentId.length > 100) return null;
  const contentMatch = contentId.match(CONTENT_ID_PATTERN);
  const status = String(row.status || '').trim().toLowerCase();
  if (!contentMatch || !PROGRESS_STATUSES.has(status)) return null;

  const kind = contentMatch[1] === 'guided-edition'
    ? 'guidedEdition'
    : contentMatch[1] === 'video'
      ? 'video'
      : 'dailyCard';
  const resumePosition = typeof row.resume_position === 'string'
    && row.resume_position.length <= 80
    && RESUME_POSITION_PATTERN.test(row.resume_position)
    ? row.resume_position
    : null;
  return {
    contentId: `${contentMatch[1]}:${contentMatch[2]}`,
    kind,
    slug: contentMatch[2],
    status,
    progressPercent: boundedPercent(row.progress_percent, status),
    resumePosition,
    updatedAtMs: Math.max(timestamp(row.updated_at), timestamp(row.completed_at)),
  };
}

function resumeStep(progress) {
  if (progress.kind === 'guidedEdition') {
    const fragment = progress.resumePosition ? `#${progress.resumePosition}` : '';
    return {
      kind: 'resume-guided-edition',
      title: 'Resume your Guided Edition chapter',
      description: 'Continue where you left off and complete the mastery check when you are ready.',
      href: `/guided-edition/${progress.slug}/${fragment}`,
      ctaLabel: 'Resume chapter',
    };
  }
  return {
    kind: 'resume-video',
    title: 'Resume your Video Library lesson',
    description: 'Continue the lesson you most recently watched, then return to the related learning material.',
    href: `/guided-edition/video-library/${progress.slug}/`,
    ctaLabel: 'Resume video',
  };
}

function selectNextStep({ hasPaidAccess, progressAvailable, progress, formatCounts }) {
  if (!hasPaidAccess) return NEXT_STEPS.product;
  if (!progressAvailable || progress.length === 0) return NEXT_STEPS.start;

  const resumable = progress
    .filter((item) => (
      (item.kind === 'guidedEdition' || item.kind === 'video')
      && item.status !== 'completed'
    ))
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs)[0];
  if (resumable) return resumeStep(resumable);
  if (formatCounts.guidedEdition === 0) return NEXT_STEPS.start;
  if (formatCounts.video === 0) return NEXT_STEPS.video;
  return NEXT_STEPS.audiobook;
}

export function buildLearningJourney({
  hasPaidAccess = false,
  progressAvailable = true,
  rows = [],
} = {}) {
  const newestByContent = new Map();
  if (hasPaidAccess && progressAvailable && Array.isArray(rows)) {
    for (const row of rows.slice(0, MAX_PROGRESS_ROWS)) {
      const normalized = normalizeProgressRow(row);
      if (!normalized) continue;
      const existing = newestByContent.get(normalized.contentId);
      if (!existing || normalized.updatedAtMs >= existing.updatedAtMs) {
        newestByContent.set(normalized.contentId, normalized);
      }
    }
  }

  const progress = [...newestByContent.values()];
  const formatCounts = {
    guidedEdition: progress.filter((item) => item.kind === 'guidedEdition').length,
    video: progress.filter((item) => item.kind === 'video').length,
    dailyCard: progress.filter((item) => item.kind === 'dailyCard').length,
  };
  const completedCount = progress.filter((item) => item.status === 'completed').length;
  const nextStep = selectNextStep({
    hasPaidAccess: Boolean(hasPaidAccess),
    progressAvailable: Boolean(progressAvailable),
    progress,
    formatCounts,
  });

  return deepFreeze({
    available: Boolean(hasPaidAccess && progressAvailable),
    activityCount: progress.length,
    completedCount,
    inProgressCount: progress.length - completedCount,
    formatCounts,
    nextStep,
  });
}
