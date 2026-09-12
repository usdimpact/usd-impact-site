import {
  PUBLICATION_GUARD_READER_RUNTIME_SCOPE,
  createPublicationGuardReaderDatabase,
} from './publication-guard-reader-database.js';

export const PUBLICATION_PREVIEW_REHEARSAL = Object.freeze({
  schema: 'publication-preview-rehearsal/v1',
  modeEnvironmentKey: 'PUBLICATION_GUARD_PREVIEW_REHEARSAL',
  approvedMode: 'readonly-v1',
});

const SHA = /^[a-f0-9]{40}$/;
const SURFACES = new Set(['article', 'homepage', 'news-composite', 'feed', 'latest-json', 'sitemap']);

export class PublicationPreviewRehearsalError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PublicationPreviewRehearsalError';
    this.code = code;
  }
}

const fail = (code) => { throw new PublicationPreviewRehearsalError(code); };
const need = (condition, code) => { if (!condition) fail(code); };

function assertRehearsalContext({ environment, envelope, bundle }) {
  need(environment[PUBLICATION_PREVIEW_REHEARSAL.modeEnvironmentKey]
    === PUBLICATION_PREVIEW_REHEARSAL.approvedMode, 'HOLD_REHEARSAL_DORMANT');
  need(environment.VERCEL === '1' && environment.VERCEL_ENV === 'preview'
    && environment.VERCEL_TARGET_ENV === 'preview', 'HOLD_REHEARSAL_CONTEXT');
  need(envelope?.kind === 'governed' && SURFACES.has(envelope.surface)
    && typeof envelope.path === 'string' && envelope.path.startsWith('/')
    && envelope.publicationAuthorized === false && envelope.enforcementActive === false,
  'HOLD_REHEARSAL_ENVELOPE');
  const runtime = envelope.runtime;
  need(runtime?.target === 'preview' && runtime.exposure === 'protected-preview', 'HOLD_REHEARSAL_CONTEXT');
  need(runtime.projectId === PUBLICATION_GUARD_READER_RUNTIME_SCOPE.approvedProjectId
    && runtime.projectId === environment.VERCEL_PROJECT_ID, 'HOLD_REHEARSAL_PROJECT');
  need(runtime.repository === PUBLICATION_GUARD_READER_RUNTIME_SCOPE.approvedRepository
    && runtime.repository === `${environment.VERCEL_GIT_REPO_OWNER}/${environment.VERCEL_GIT_REPO_SLUG}`,
  'HOLD_REHEARSAL_REPOSITORY');
  need(runtime.branch === PUBLICATION_GUARD_READER_RUNTIME_SCOPE.approvedBranch
    && runtime.branch === environment.VERCEL_GIT_COMMIT_REF, 'HOLD_REHEARSAL_BRANCH');
  need(SHA.test(runtime.commitSha ?? '') && runtime.commitSha === environment.VERCEL_GIT_COMMIT_SHA,
    'HOLD_REHEARSAL_COMMIT');
  need(runtime.deploymentHost === String(environment.VERCEL_URL ?? '').trim().toLowerCase(),
    'HOLD_REHEARSAL_HOST');
  need(bundle?.schema === 'publication-render-inputs/v1'
    && bundle.buildCommitSha === runtime.commitSha, 'HOLD_REHEARSAL_BUILD');
  return Object.freeze({
    surface: envelope.surface,
    path: envelope.path,
    runtime,
  });
}

/**
 * Read-only Preview rehearsal for #558/#559.
 *
 * The signed route envelope must already have been verified by trusted server
 * code. This rehearsal never creates serving authority, never writes an
 * admission/receipt, never invokes the Production serving policy and never
 * returns publication bytes. Its only successful terminal state is the fixed
 * HOLD_NOT_ADMITTED diagnostic after proving the reader identity and revision-0
 * managed history snapshot.
 */
export async function runPublicationPreviewRehearsal({
  environment = process.env,
  PoolClass,
  envelope,
  bundle,
} = {}) {
  const context = assertRehearsalContext({ environment, envelope, bundle });
  const database = createPublicationGuardReaderDatabase({ environment, PoolClass });
  try {
    const identity = await database.verifyIdentityAndPrivileges();
    const snapshot = await database.readBaselineSnapshot();
    need(identity.readSnapshot === true && identity.writePrivileges === false, 'HOLD_REHEARSAL_READER');
    need(snapshot.revision === '0' && snapshot.recordCount === 0, 'HOLD_REHEARSAL_SNAPSHOT');
    return Object.freeze({
      schema: PUBLICATION_PREVIEW_REHEARSAL.schema,
      decision: 'HOLD_NOT_ADMITTED',
      route: Object.freeze({ surface: context.surface, path: context.path }),
      runtime: Object.freeze({
        target: 'preview',
        exposure: 'protected-preview',
        projectId: context.runtime.projectId,
        repository: context.runtime.repository,
        branch: context.runtime.branch,
        commitSha: context.runtime.commitSha,
        deploymentHost: context.runtime.deploymentHost,
      }),
      reader: Object.freeze({
        role: identity.role,
        projectRef: identity.projectRef,
        readSnapshot: true,
        writePrivileges: false,
      }),
      snapshot,
      publicationAuthorized: false,
      enforcementActive: false,
    });
  } finally {
    await database.close();
  }
}
