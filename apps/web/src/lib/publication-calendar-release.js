import { createHash } from 'node:crypto';
import { CalendarHold, digest, hold } from './publication-calendar.js';
import { parsePublicationCalendarSource } from './publication-calendar-source.js';
import { verifyPipelineCalendar, assertPipelineCalendarLease } from './publication-calendar-pipeline.js';

const REPOSITORY = 'usdimpact/usd-impact-site';
const PROJECT = 'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7';
const TEAM = 'team_1LuMlacGuM198mRjoID4O3Ct';
const HOST = 'www.usd-impact.com';
const SHA = /^[a-f0-9]{40}$/;
const DEPLOYMENT = /^dpl_[A-Za-z0-9]{8,80}$/;
const CONTENT_ROOT = /^apps\/web\/src\/content\/(news|catalyst-briefs)\//;
const CONTENT = /^apps\/web\/src\/content\/(news|catalyst-briefs)\/[a-z0-9-]+\.md$/;

/** Read-only staged-Production preflight. This module has no merge/promotion/write operation.
 * An enforcement controller must separately be authorized and must call this at its final boundary.
 */
export async function verifyCalendarReleasePreflight({ expectedMain, expectedHead, deploymentId } = {}, {
  fetchImpl = globalThis.fetch, now = Date.now, vercelToken = process.env.VERCEL_TOKEN,
} = {}) {
  const observations = [];
  const checks = [];
  let baseline = null;
  let candidate = null;
  const began = now();
  try {
    if (!Number.isFinite(began)) hold('HOLD_INVALID_CLOCK', 'Trusted release clock is unavailable.');
    if (!SHA.test(expectedMain ?? '') || !SHA.test(expectedHead ?? '') || !DEPLOYMENT.test(deploymentId ?? '') || expectedMain !== expectedHead) {
      hold('HOLD_REVISION_DRIFT', 'Exact current-main and staged-Production commit must match; no branch promotion is inferred.');
    }
    if (typeof vercelToken !== 'string' || !vercelToken.trim()) hold('HOLD_PROVIDER_AUTH', 'Read-only provider access is required; no credential is created by this check.');
    async function get(origin, endpoint, maxBytes = 4000000) {
      const url = `${origin}${endpoint}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetchImpl(url, {
          method: 'GET', redirect: 'error', signal: controller.signal, cache: 'no-store',
          headers: { Accept: 'application/json', 'Cache-Control': 'no-cache',
            ...(origin === 'https://api.vercel.com' ? { Authorization: `Bearer ${vercelToken}` } : {}),
          },
        });
        if (response.status !== 200 || response.redirected || (response.url && response.url !== url)) hold('HOLD_PROVIDER_RESPONSE', 'A direct successful provider response is required.');
        if (!/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '') || !response.body?.getReader) hold('HOLD_PROVIDER_RESPONSE', 'A bounded JSON provider response is required.');
        const age = response.headers.get('age');
        const dated = response.headers.get('date');
        const checked = now();
        if (!Number.isFinite(checked) || checked < began) hold('HOLD_INVALID_CLOCK', 'Provider verification clock is invalid.');
        if ((age !== null && (!/^\d+$/.test(age) || Number(age) >= 60))
            || (dated !== null && (!Number.isFinite(Date.parse(dated)) || Math.abs(checked - Date.parse(dated)) >= 60000))) {
          hold('HOLD_EVIDENCE_STALE', 'Provider mapping response cache metadata is stale or invalid.');
        }
        const reader = response.body.getReader(); const chunks = []; let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read(); if (done) break;
            size += value.byteLength;
            if (size > maxBytes) { await reader.cancel(); hold('HOLD_PROVIDER_RESPONSE', 'Provider response exceeded its size bound.'); }
            chunks.push(Buffer.from(value));
          }
        } finally { reader.releaseLock(); }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      } catch (error) {
        if (error instanceof CalendarHold) throw error;
        hold('HOLD_PROVIDER_RESPONSE', 'Provider access, JSON decoding or bounded read failed.');
      } finally { clearTimeout(timer); }
    }
    const github = (route) => get('https://api.github.com', `/repos/${REPOSITORY}${route}`);
    const vercel = (route) => get('https://api.vercel.com', `${route}?teamId=${TEAM}`);
    async function current() {
      const alias = await vercel(`/v4/aliases/${HOST}`);
      if (alias.alias !== HOST || alias.projectId !== PROJECT || alias.redirect || alias.deletedAt
          || !DEPLOYMENT.test(alias.deploymentId ?? '')
          || (alias.deployment?.id && alias.deployment.id !== alias.deploymentId)) hold('HOLD_BASELINE_UNVERIFIED', 'The canonical domain does not identify one deployment in the governed project.');
      return alias.deploymentId;
    }
    function deploymentRecord(record, expectedId) {
      const project = record.projectId ?? record.project?.id;
      if (record.id !== expectedId || record.source !== 'git' || project !== PROJECT || record.target !== 'production' || record.readyState !== 'READY'
          || record.meta?.githubCommitOrg !== 'usdimpact' || record.meta?.githubCommitRepo !== 'usd-impact-site'
          || record.meta?.githubCommitRef !== 'main' || !SHA.test(record.meta?.githubCommitSha ?? '')
          || (record.gitSource?.sha && record.gitSource.sha !== record.meta.githubCommitSha)) {
        hold('HOLD_DEPLOYMENT_UNVERIFIED', 'A READY main-branch Production deployment with exact repository identity is required.');
      }
      return { id: record.id, sha: record.meta.githubCommitSha };
    }
    async function currentMain() {
      const ref = await github('/git/ref/heads/main');
      if (ref.ref !== 'refs/heads/main' || ref.object?.type !== 'commit' || ref.object.sha !== expectedMain) hold('HOLD_REVISION_DRIFT', 'Current main differs from the expected release revision.');
    }
    await currentMain();
    const baselineId = await current();
    baseline = deploymentRecord(await vercel(`/v13/deployments/${baselineId}`), baselineId);
    candidate = deploymentRecord(await vercel(`/v13/deployments/${deploymentId}`), deploymentId);
    if (candidate.sha !== expectedHead) hold('HOLD_REVISION_DRIFT', 'Staged deployment does not match the exact expected commit.');
    if (baseline.id === candidate.id) hold('HOLD_ALREADY_CURRENT', 'The candidate is already current; this is not pre-publication evidence.');

    async function contentTree(sha) {
      const commit = await github(`/git/commits/${sha}`);
      if (commit.sha !== sha || !SHA.test(commit.tree?.sha ?? '')) hold('HOLD_REVISION_DRIFT', 'Git commit/tree mapping is invalid.');
      const tree = await github(`/git/trees/${commit.tree.sha}?recursive=1`);
      if (tree.sha !== commit.tree.sha || tree.truncated !== false || !Array.isArray(tree.tree)) hold('HOLD_REVISION_DRIFT', 'A complete immutable Git tree is required.');
      const files = new Map();
      if (tree.tree.some((row) => CONTENT_ROOT.test(row.path ?? '') && /\.md$/i.test(row.path ?? '') && !CONTENT.test(row.path))) {
        hold('HOLD_SOURCE_SCHEMA', 'Publication inventory includes an unsupported path; it cannot be silently omitted.');
      }
      for (const row of tree.tree.filter((item) => CONTENT.test(item.path ?? ''))) {
        if (row.mode !== '100644' || row.type !== 'blob' || !SHA.test(row.sha ?? '') || files.has(row.path)) hold('HOLD_SOURCE_SCHEMA', 'Publication paths must be unique regular Git blobs.');
        files.set(row.path, row.sha);
      }
      if (files.size > 500) hold('HOLD_SOURCE_SCHEMA', 'Publication inventory exceeded the reviewed bound.');
      return files;
    }
    const before = await contentTree(baseline.sha);
    const after = await contentTree(candidate.sha);
    const changes = [...new Set([...before.keys(), ...after.keys()])].sort().filter((file) => before.get(file) !== after.get(file));
    if (changes.length > 20) hold('HOLD_SOURCE_SCHEMA', 'The release exceeds the twenty-file publication review bound.');
    for (const file of changes) {
      const sha = after.get(file);
      if (!sha) hold('HOLD_ARCHIVE_CHANGE', 'Publication deletion requires a separately reviewed archive correction.');
      const blob = await github(`/git/blobs/${sha}`);
      if (blob.sha !== sha || blob.encoding !== 'base64' || typeof blob.content !== 'string' || blob.size > 256000) hold('HOLD_SOURCE_SCHEMA', 'A bounded verified publication blob is required.');
      const encoded = blob.content.replace(/\n/g, '');
      const bytes = Buffer.from(encoded, 'base64');
      const calculated = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if (encoded !== bytes.toString('base64') || blob.size !== bytes.length || calculated !== sha) hold('HOLD_REVISION_DRIFT', 'Publication bytes do not match the immutable Git blob.');
      const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const payload = parsePublicationCalendarSource(source);
      observations.push({ file, blob: sha, contentSha256: digest(source), status: payload.status });
      if (payload.status !== 'published') continue;
      const kind = file.includes('/catalyst-briefs/') ? 'brief' : 'daily';
      const expectedSlug = kind === 'brief' ? `/news/catalysts/${file.split('/').at(-1).slice(0, -3)}` : `/news/${payload.date}`;
      if (payload.slug !== expectedSlug || (kind === 'daily' && !file.endsWith(`/${payload.date}.md`))
          || payload.category !== (kind === 'daily' ? 'Daily USD Impact' : 'USD Impact Catalyst Brief')) {
        hold('HOLD_IDENTITY_MISMATCH', 'Publication route, collection and original metadata do not agree.');
      }
      const lease = await verifyPipelineCalendar(payload, { kind, boundary: 'staged-release-preflight', now, fetchImpl });
      checks.push({ file, payload, lease });
    }
    // Reconcile against the canonical deployment, not HEAD's parent or a failed build.
    if (await current() !== baseline.id) hold('HOLD_BASELINE_DRIFT', 'Canonical Production changed during release verification.');
    await currentMain();
    const finalCandidate = deploymentRecord(await vercel(`/v13/deployments/${deploymentId}`), deploymentId);
    if (finalCandidate.sha !== candidate.sha) hold('HOLD_REVISION_DRIFT', 'Candidate deployment mapping changed during verification.');
    for (const check of checks) assertPipelineCalendarLease(check.lease, check.payload, { now });
    const ended = now();
    if (!Number.isFinite(ended) || ended < began || ended - began >= 15 * 60 * 1000) hold('HOLD_EVIDENCE_STALE', 'Release preflight exceeded its trusted clock window.');
    const deadlines = checks.map((check) => check.lease.validUntil).filter(Boolean).map(Date.parse);
    return {
      decision: 'PASS_READ_ONLY_PREFLIGHT', repository: REPOSITORY, projectId: PROJECT, canonicalHost: HOST,
      baseline, candidate, expectedMain, checkedAt: new Date(ended).toISOString(),
      validUntil: new Date(Math.min(began + 15 * 60 * 1000, ...deadlines)).toISOString(),
      contentSetSha256: digest(JSON.stringify(observations)), observations,
      checks: checks.map(({ file, lease }) => ({ file, ...lease })),
      publicationAuthorized: false, promotionPerformed: false, enforcementActive: false,
    };
  } catch (error) {
    return { decision: error instanceof CalendarHold ? error.code : 'HOLD_INTERNAL_ERROR',
      reason: error instanceof CalendarHold ? error.message : 'Release verification could not complete.',
      baseline, candidate, observations, calendarAudit: error?.calendarAudit ?? null,
      publicationAuthorized: false, promotionPerformed: false, enforcementActive: false };
  }
}
