import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { enqueueAccountDeletionCompletedEmail } from './account-deletion-completed-email.js';
import { readSupabaseServerConfig } from './supabase-server.js';

const DEVELOPMENT_PROJECT_REF = 'ycstrcvshdluovtuasjc';
const PRODUCTION_PROJECT_REF = 'gjzetjugmnwanvjkchux';
const MAX_BATCH_SIZE = 25;
const RECOVERABLE_ESCALATION_SUBJECT = 'Account deletion completion acknowledgement requires recovery';
const MANUAL_ESCALATION_SUBJECT = 'Account deletion finalization requires manual review';

export class AccountDeletionFinalizerError extends Error {
  constructor(message, code = 'ACCOUNT_DELETION_FINALIZER_FAILED') {
    super(message);
    this.name = 'AccountDeletionFinalizerError';
    this.code = code;
  }
}

function projectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function normalizeBatchSize(batchSize) {
  return Math.min(Math.max(Number.parseInt(batchSize, 10) || 1, 1), MAX_BATCH_SIZE);
}

export function readAccountDeletionFinalizerConfig(environment = process.env) {
  if (!enabled(environment.ACCOUNT_DELETION_FINALIZER_ENABLED)) {
    return Object.freeze({ enabled: false });
  }
  if (!enabled(environment.EMAIL_READINESS_LEDGER_ENABLED)) {
    throw new AccountDeletionFinalizerError(
      'Account deletion finalization requires the durable email ledger.',
      'ACCOUNT_DELETION_LEDGER_REQUIRED',
    );
  }
  const supabase = readSupabaseServerConfig(environment, { requireSecret: true });
  const projectRef = projectRefFromUrl(supabase.url);
  const vercelEnvironment = String(environment.VERCEL_ENV || '').trim().toLowerCase();
  const production = vercelEnvironment === 'production';
  if (production) {
    if (
      projectRef !== PRODUCTION_PROJECT_REF
      || !enabled(environment.ACCOUNT_DELETION_FINALIZER_PRODUCTION_APPROVED)
      || !enabled(environment.EMAIL_READINESS_PRODUCTION_APPROVED)
    ) {
      throw new AccountDeletionFinalizerError(
        'Production account deletion finalization is not approved for this project and durable email ledger.',
        'ACCOUNT_DELETION_PRODUCTION_NOT_APPROVED',
      );
    }
  } else if (projectRef !== DEVELOPMENT_PROJECT_REF) {
    throw new AccountDeletionFinalizerError(
      'Non-Production account deletion finalization must target canonical Development.',
      'ACCOUNT_DELETION_PROJECT_MISMATCH',
    );
  }
  return Object.freeze({ enabled: true, production, projectRef, supabase });
}

function jsonHeaders(secretKey) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
  };
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function requireOk(response, code) {
  const payload = await readJson(response);
  if (!response.ok) {
    throw new AccountDeletionFinalizerError(
      `Supabase deletion finalizer request failed with status ${response.status}.`,
      code,
    );
  }
  return payload;
}

export async function listDueAccountDeletions({
  config,
  fetchImpl = fetch,
  now = new Date(),
  batchSize = MAX_BATCH_SIZE,
}) {
  if (!config?.enabled) return [];
  const limit = normalizeBatchSize(batchSize);
  const dueAt = new Date(now).toISOString();
  const path = `/rest/v1/profiles?status=eq.deletion_pending&deletion_due_at=lte.${encodeURIComponent(dueAt)}&select=account_id,email,status,deletion_requested_at,deletion_due_at&order=deletion_due_at.asc&limit=${limit}`;
  const response = await fetchImpl(`${config.supabase.url}${path}`, {
    method: 'GET',
    headers: jsonHeaders(config.supabase.secretKey),
  });
  const rows = await requireOk(response, 'ACCOUNT_DELETION_DUE_SCAN_FAILED');
  return Array.isArray(rows) ? rows : [];
}

export async function readDeletionProfile({ config, accountId, fetchImpl = fetch }) {
  const path = `/rest/v1/profiles?account_id=eq.${encodeURIComponent(accountId)}&select=account_id,status,deletion_requested_at,deletion_due_at,deleted_at&limit=1`;
  const response = await fetchImpl(`${config.supabase.url}${path}`, {
    method: 'GET',
    headers: jsonHeaders(config.supabase.secretKey),
  });
  const rows = await requireOk(response, 'ACCOUNT_DELETION_PROFILE_RELOAD_FAILED');
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function softDeleteAuthUser({ config, accountId, fetchImpl = fetch }) {
  const response = await fetchImpl(
    `${config.supabase.url}/auth/v1/admin/users/${encodeURIComponent(accountId)}?should_soft_delete=true`,
    {
      method: 'DELETE',
      headers: jsonHeaders(config.supabase.secretKey),
    },
  );
  if (response.status === 404) return Object.freeze({ alreadyAbsent: true });
  await requireOk(response, 'ACCOUNT_DELETION_AUTH_SOFT_DELETE_FAILED');
  return Object.freeze({ alreadyAbsent: false });
}

export async function finalizeAccountDeletionRecord({ config, accountId, fetchImpl = fetch }) {
  const response = await fetchImpl(`${config.supabase.url}/rest/v1/rpc/finalize_account_deletion`, {
    method: 'POST',
    headers: jsonHeaders(config.supabase.secretKey),
    body: JSON.stringify({ finalize_account_id: accountId }),
  });
  const payload = await requireOk(response, 'ACCOUNT_DELETION_DATABASE_FINALIZE_FAILED');
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (row?.account_id && row?.recipient_email && row?.deleted_at) return row;

  const profile = await readDeletionProfile({ config, accountId, fetchImpl });
  if (profile?.status === 'deleted' && profile?.deleted_at) {
    return Object.freeze({ alreadyFinalized: true, account_id: accountId, deleted_at: profile.deleted_at });
  }

  throw new AccountDeletionFinalizerError(
    'The account deletion finalization did not return an authoritative completion row.',
    'ACCOUNT_DELETION_COMPLETION_ROW_MISSING',
  );
}

function opaqueReference(accountId) {
  return `ui-${createHash('sha256').update(String(accountId)).digest('hex').slice(0, 16)}`;
}

function scrubbedSupportEmail(accountId) {
  const digest = createHash('sha256').update(String(accountId)).digest('hex').slice(0, 32);
  return `deleted+${digest}@support.invalid`;
}

function recoveryProof({ config, recoveryId, accountId, email }) {
  return createHmac('sha256', config.supabase.secretKey)
    .update(`account-deletion-recovery:v1\n${recoveryId}\n${accountId}\n${String(email).trim().toLowerCase()}`)
    .digest('hex');
}

function validRecoveryProof({ config, recovery }) {
  const match = String(recovery?.message || '').match(/Recovery proof: adr1:([0-9a-f]{64})(?:\.|$)/i);
  if (!match) return false;
  const expected = Buffer.from(recoveryProof({
    config,
    recoveryId: recovery.id,
    accountId: recovery.account_id,
    email: recovery.email,
  }), 'hex');
  const supplied = Buffer.from(match[1].toLowerCase(), 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function recordDeletionFinalizationEscalation({
  config,
  accountId,
  email,
  errorCode,
  recoverable = false,
  fetchImpl = fetch,
}) {
  const reference = opaqueReference(accountId);
  const recoveryId = recoverable ? randomUUID() : null;
  const proof = recoverable
    ? recoveryProof({ config, recoveryId, accountId, email })
    : null;
  const response = await fetchImpl(`${config.supabase.url}/rest/v1/support_requests`, {
    method: 'POST',
    headers: {
      ...jsonHeaders(config.supabase.secretKey),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      ...(recoveryId ? { id: recoveryId } : {}),
      account_id: recoverable ? accountId : null,
      email,
      category: 'privacy',
      subject: recoverable ? RECOVERABLE_ESCALATION_SUBJECT : MANUAL_ESCALATION_SUBJECT,
      message: recoverable
        ? `Deletion completion reference ${reference} requires acknowledgement recovery. Error code: ${errorCode}. Recovery proof: adr1:${proof}. Do not request credentials or authentication links.`
        : `Deletion completion reference ${reference} requires manual review. Error code: ${errorCode}. Do not request credentials or authentication links.`,
      status: 'open',
    }),
  });
  await requireOk(response, 'ACCOUNT_DELETION_ESCALATION_FAILED');
  return reference;
}

export async function listDeletionCompletionRecoveries({
  config,
  fetchImpl = fetch,
  batchSize = MAX_BATCH_SIZE,
}) {
  if (!config?.enabled) return [];
  const limit = normalizeBatchSize(batchSize);
  const scanLimit = Math.min(limit * 4, 100);
  const subject = encodeURIComponent(RECOVERABLE_ESCALATION_SUBJECT);
  const path = `/rest/v1/support_requests?category=eq.privacy&subject=eq.${subject}&status=in.(open,in_progress)&account_id=not.is.null&email=not.is.null&select=id,account_id,email,message,status,created_at&order=created_at.desc&limit=${scanLimit}`;
  const response = await fetchImpl(`${config.supabase.url}${path}`, {
    method: 'GET',
    headers: jsonHeaders(config.supabase.secretKey),
  });
  const rows = await requireOk(response, 'ACCOUNT_DELETION_RECOVERY_SCAN_FAILED');
  return Array.isArray(rows)
    ? rows.filter((row) => validRecoveryProof({ config, recovery: row })).slice(0, limit)
    : [];
}

export async function resolveDeletionCompletionRecovery({
  config,
  recoveryId,
  accountId,
  fetchImpl = fetch,
  now = new Date(),
}) {
  const path = `/rest/v1/support_requests?id=eq.${encodeURIComponent(recoveryId)}&account_id=eq.${encodeURIComponent(accountId)}&status=in.(open,in_progress)`;
  const response = await fetchImpl(`${config.supabase.url}${path}`, {
    method: 'PATCH',
    headers: {
      ...jsonHeaders(config.supabase.secretKey),
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      account_id: null,
      email: scrubbedSupportEmail(accountId),
      status: 'completed',
      closed_at: new Date(now).toISOString(),
    }),
  });
  const rows = await requireOk(response, 'ACCOUNT_DELETION_RECOVERY_RESOLVE_FAILED');
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new AccountDeletionFinalizerError(
      'The account deletion completion recovery escalation changed concurrently.',
      'ACCOUNT_DELETION_RECOVERY_STATE_CONFLICT',
    );
  }
  return rows[0];
}

export async function recoverOneDeletionCompletionAcknowledgement({
  recovery,
  config,
  environment = process.env,
  fetchImpl = fetch,
  now = new Date(),
}) {
  const accountId = String(recovery?.account_id || '');
  const recipientEmail = String(recovery?.email || '');
  const recoveryId = String(recovery?.id || '');
  if (!accountId || !recipientEmail || !recoveryId || !validRecoveryProof({ config, recovery })) {
    throw new AccountDeletionFinalizerError(
      'The account deletion completion recovery record is incomplete or unauthenticated.',
      'ACCOUNT_DELETION_RECOVERY_RECORD_INVALID',
    );
  }

  const profile = await readDeletionProfile({ config, accountId, fetchImpl });
  const recoveryCreatedAt = Date.parse(String(recovery?.created_at || ''));
  const profileDeletedAt = Date.parse(String(profile?.deleted_at || ''));
  if (
    profile?.status !== 'deleted'
    || !profile?.deletion_requested_at
    || !profile?.deleted_at
    || !Number.isFinite(recoveryCreatedAt)
    || !Number.isFinite(profileDeletedAt)
    || recoveryCreatedAt < profileDeletedAt
  ) {
    throw new AccountDeletionFinalizerError(
      'The account deletion completion recovery target is not authoritatively finalized.',
      'ACCOUNT_DELETION_RECOVERY_PROFILE_NOT_FINALIZED',
    );
  }

  const emailState = await enqueueAccountDeletionCompletedEmail({
    finalizationResult: {
      account_id: accountId,
      recipient_email: recipientEmail,
      deletion_requested_at: profile.deletion_requested_at,
      deleted_at: profile.deleted_at,
    },
    environment,
    fetchImpl,
  });
  if (!emailState?.enabled || !emailState?.outbox?.id) {
    throw new AccountDeletionFinalizerError(
      'The recovered completion acknowledgement was not durably recorded.',
      'ACCOUNT_DELETION_RECOVERY_EMAIL_NOT_RECORDED',
    );
  }

  await resolveDeletionCompletionRecovery({
    config,
    recoveryId,
    accountId,
    fetchImpl,
    now,
  });
  return Object.freeze({
    status: 'recovered',
    accountReference: opaqueReference(accountId),
    outboxId: emailState.outbox.id,
  });
}

export async function runDeletionCompletionRecoveries({
  config,
  environment = process.env,
  fetchImpl = fetch,
  now = new Date(),
  batchSize = MAX_BATCH_SIZE,
}) {
  const recoveries = await listDeletionCompletionRecoveries({ config, fetchImpl, batchSize });
  let recovered = 0;
  let failed = 0;
  for (const recovery of recoveries) {
    try {
      await recoverOneDeletionCompletionAcknowledgement({
        recovery,
        config,
        environment,
        fetchImpl,
        now,
      });
      recovered += 1;
    } catch (error) {
      failed += 1;
      console.error('Account deletion completion acknowledgement recovery failed.', {
        code: typeof error?.code === 'string' ? error.code : 'ACCOUNT_DELETION_RECOVERY_FAILED',
      });
    }
  }
  return Object.freeze({ scanned: recoveries.length, recovered, failed });
}

async function finalizedProfileAfterFailure({ config, accountId, fetchImpl }) {
  try {
    const profile = await readDeletionProfile({ config, accountId, fetchImpl });
    if (profile?.status === 'deleted' && profile?.deleted_at) return profile;
  } catch (error) {
    console.error('Account deletion finalization state reconciliation failed.', {
      code: typeof error?.code === 'string'
        ? error.code
        : 'ACCOUNT_DELETION_PROFILE_RELOAD_FAILED',
    });
  }
  return null;
}

export async function finalizeOneDueAccount({
  profile,
  config,
  environment = process.env,
  fetchImpl = fetch,
}) {
  const accountId = String(profile?.account_id || '');
  const originalEmail = String(profile?.email || '');
  let completion = null;
  try {
    await softDeleteAuthUser({ config, accountId, fetchImpl });
    completion = await finalizeAccountDeletionRecord({ config, accountId, fetchImpl });

    if (completion.alreadyFinalized === true) {
      return Object.freeze({
        status: 'already_finalized',
        accountReference: opaqueReference(accountId),
        outboxId: null,
      });
    }

    const emailState = await enqueueAccountDeletionCompletedEmail({
      finalizationResult: completion,
      environment,
      fetchImpl,
    });
    if (!emailState?.enabled || !emailState?.outbox?.id) {
      throw new AccountDeletionFinalizerError(
        'The completion acknowledgement was not durably recorded.',
        'ACCOUNT_DELETION_COMPLETION_EMAIL_NOT_RECORDED',
      );
    }
    return Object.freeze({
      status: 'finalized',
      accountReference: opaqueReference(accountId),
      outboxId: emailState.outbox.id,
    });
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'ACCOUNT_DELETION_FINALIZER_FAILED';
    const finalizedProfile = completion?.recipient_email
      ? null
      : await finalizedProfileAfterFailure({ config, accountId, fetchImpl });
    const recoverable = Boolean(completion?.recipient_email || finalizedProfile);
    if (completion?.recipient_email || originalEmail) {
      try {
        await recordDeletionFinalizationEscalation({
          config,
          accountId,
          email: completion?.recipient_email || originalEmail,
          errorCode: code,
          recoverable,
          fetchImpl,
        });
      } catch (escalationError) {
        console.error('Account deletion finalization escalation failed.', {
          code: typeof escalationError?.code === 'string'
            ? escalationError.code
            : 'ACCOUNT_DELETION_ESCALATION_FAILED',
        });
      }
    }
    throw error;
  }
}

export async function runDueAccountDeletionFinalizer({
  environment = process.env,
  fetchImpl = fetch,
  now = new Date(),
  batchSize = MAX_BATCH_SIZE,
} = {}) {
  const config = readAccountDeletionFinalizerConfig(environment);
  if (!config.enabled) {
    return Object.freeze({
      enabled: false,
      recoveryScanned: 0,
      recovered: 0,
      recoveryFailed: 0,
      scanned: 0,
      finalized: 0,
      alreadyFinalized: 0,
      failed: 0,
    });
  }

  const limit = normalizeBatchSize(batchSize);
  const recovery = await runDeletionCompletionRecoveries({
    config,
    environment,
    fetchImpl,
    now,
    batchSize: limit,
  });
  const remaining = Math.max(limit - recovery.scanned, 0);
  const profiles = remaining > 0
    ? await listDueAccountDeletions({ config, fetchImpl, now, batchSize: remaining })
    : [];
  let finalized = 0;
  let alreadyFinalized = 0;
  let failed = 0;
  for (const profile of profiles) {
    try {
      const result = await finalizeOneDueAccount({ profile, config, environment, fetchImpl });
      if (result.status === 'already_finalized') alreadyFinalized += 1;
      else finalized += 1;
    } catch (error) {
      failed += 1;
      console.error('Account deletion finalization failed.', {
        code: typeof error?.code === 'string' ? error.code : 'ACCOUNT_DELETION_FINALIZER_FAILED',
      });
    }
  }
  return Object.freeze({
    enabled: true,
    recoveryScanned: recovery.scanned,
    recovered: recovery.recovered,
    recoveryFailed: recovery.failed,
    scanned: profiles.length,
    finalized,
    alreadyFinalized,
    failed,
  });
}

export function validCronAuthorization(request, environment = process.env) {
  const secret = String(environment.CRON_SECRET || '');
  const header = String(request?.headers?.authorization || request?.headers?.Authorization || '');
  if (secret.length < 32 || !header.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
