import { createHash, timingSafeEqual } from 'node:crypto';
import { enqueueAccountDeletionCompletedEmail } from './account-deletion-completed-email.js';
import { readSupabaseServerConfig } from './supabase-server.js';

const DEVELOPMENT_PROJECT_REF = 'ycstrcvshdluovtuasjc';
const PRODUCTION_PROJECT_REF = 'gjzetjugmnwanvjkchux';
const MAX_BATCH_SIZE = 25;

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
    ) {
      throw new AccountDeletionFinalizerError(
        'Production account deletion finalization is not approved for this project.',
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
  const limit = Math.min(Math.max(Number.parseInt(batchSize, 10) || 1, 1), MAX_BATCH_SIZE);
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
  const path = `/rest/v1/profiles?account_id=eq.${encodeURIComponent(accountId)}&select=account_id,status,deleted_at&limit=1`;
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

export async function recordDeletionFinalizationEscalation({
  config,
  accountId,
  email,
  errorCode,
  fetchImpl = fetch,
}) {
  const reference = opaqueReference(accountId);
  const response = await fetchImpl(`${config.supabase.url}/rest/v1/support_requests`, {
    method: 'POST',
    headers: {
      ...jsonHeaders(config.supabase.secretKey),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      account_id: null,
      email,
      category: 'privacy',
      subject: 'Account deletion finalization requires manual review',
      message: `Deletion completion reference ${reference} requires manual review. Error code: ${errorCode}. Do not request credentials or authentication links.`,
      status: 'open',
    }),
  });
  await requireOk(response, 'ACCOUNT_DELETION_ESCALATION_FAILED');
  return reference;
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
    if (completion?.recipient_email || originalEmail) {
      try {
        await recordDeletionFinalizationEscalation({
          config,
          accountId,
          email: completion?.recipient_email || originalEmail,
          errorCode: code,
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
    return Object.freeze({ enabled: false, scanned: 0, finalized: 0, alreadyFinalized: 0, failed: 0 });
  }

  const profiles = await listDueAccountDeletions({ config, fetchImpl, now, batchSize });
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
  return Object.freeze({ enabled: true, scanned: profiles.length, finalized, alreadyFinalized, failed });
}

export function validCronAuthorization(request, environment = process.env) {
  const secret = String(environment.CRON_SECRET || '');
  const header = String(request?.headers?.authorization || request?.headers?.Authorization || '');
  if (secret.length < 32 || !header.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
