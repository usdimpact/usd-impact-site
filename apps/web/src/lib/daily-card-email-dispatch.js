import { buildNotificationOutboxRecord } from './email-readiness-contracts.js';
import {
  createDailyLearningUnsubscribeUrl,
  isDailyLearningGrantActive,
  listActiveDailyLearningGrants,
} from './daily-card-email-consent.js';
import { toEmailCard } from './daily-card-adapters.js';
import { getDailyCard, validateDailyCards } from './daily-card-schedule.js';
import {
  enqueueLaunchEmailIntent,
  patchLaunchEmailOutbox,
} from './launch-email-dispatch-ledger.js';
import {
  ResendLaunchEmailRequestError,
  createResendLaunchEmailAdapter,
} from './launch-email-resend-adapter.js';

export const DAILY_CARD_EMAIL_TEMPLATE_VERSION = 'daily-card-email-v1';
export const DAILY_CARD_EMAIL_MESSAGE_ID = 'daily_learning_card';
export const DAILY_CARD_EMAIL_MAX_BATCH = 25;

const TERMINAL_STATUSES = new Set([
  'accepted',
  'delivered',
  'hard_bounced',
  'complained',
  'suppressed',
  'cancelled',
  'terminal_failed',
]);
const SENDABLE_STATUSES = new Set(['queued', 'retry_scheduled']);
const RETRY_DELAY_MS = 20 * 60 * 1000;

export class DailyCardEmailDispatchError extends Error {
  constructor(message, code = 'DAILY_CARD_EMAIL_DISPATCH_FAILED') {
    super(message);
    this.name = 'DailyCardEmailDispatchError';
    this.code = code;
  }
}

function publishDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new DailyCardEmailDispatchError('Publish date is invalid.', 'INVALID_PUBLISH_DATE');
  }
  return date.toISOString().slice(0, 10);
}

function parseBatchSize(environment) {
  const value = Number.parseInt(String(environment.DAILY_CARD_EMAIL_BATCH_SIZE || '25'), 10);
  if (!Number.isInteger(value) || value < 1 || value > DAILY_CARD_EMAIL_MAX_BATCH) {
    throw new DailyCardEmailDispatchError(
      `DAILY_CARD_EMAIL_BATCH_SIZE must be between 1 and ${DAILY_CARD_EMAIL_MAX_BATCH}.`,
      'INVALID_EMAIL_BATCH_SIZE',
    );
  }
  return value;
}

function htmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function providerIdempotencyKey(outboxKey) {
  const match = String(outboxKey || '').match(/^notification:v1:([0-9a-f]{64})$/);
  if (!match) {
    throw new DailyCardEmailDispatchError('Outbox idempotency key is invalid.', 'INVALID_OUTBOX_IDEMPOTENCY_KEY');
  }
  return `launch-email/${match[1]}`;
}

function renderMessage({ card, grant, environment }) {
  const baseUrl = String(environment.DAILY_CARD_EMAIL_BASE_URL || 'https://www.usd-impact.com').replace(/\/$/, '');
  const email = toEmailCard(card, { baseUrl });
  const unsubscribeUrl = createDailyLearningUnsubscribeUrl({
    grant,
    secret: environment.WAITLIST_UNSUBSCRIBE_SECRET,
    baseUrl,
  });
  const text = `${email.text}\n\nManage this subscription: ${unsubscribeUrl}`;
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#f5f6f8;color:#161a1f;font-family:Arial,Helvetica,sans-serif;"><main style="width:min(680px,100%);margin:0 auto;padding:28px;box-sizing:border-box;"><section style="background:#fff;border:1px solid #e6e9ed;padding:32px;box-sizing:border-box;"><p style="margin:0 0 12px;color:#8a6b32;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">USD Impact Daily</p><h1 style="margin:0 0 20px;color:#071a33;font-size:30px;line-height:1.2;">${htmlEscape(card.title)}</h1><p style="font-size:17px;line-height:1.65;">${htmlEscape(card.hook)}</p><h2 style="font-size:18px;color:#071a33;">What it is</h2><p style="font-size:16px;line-height:1.65;">${htmlEscape(card.definition)}</p><h2 style="font-size:18px;color:#071a33;">Why it matters</h2><p style="font-size:16px;line-height:1.65;">${htmlEscape(card.whyItMatters)}</p>${card.commonMistake ? `<h2 style="font-size:18px;color:#071a33;">Common mistake</h2><p style="font-size:16px;line-height:1.65;">${htmlEscape(card.commonMistake)}</p>` : ''}<h2 style="font-size:18px;color:#071a33;">Key takeaway</h2><p style="font-size:16px;line-height:1.65;">${htmlEscape(card.keyTakeaway)}</p><p style="margin:28px 0 0;"><a href="${htmlEscape(email.url)}">Continue on USD Impact →</a></p><hr style="border:0;border-top:1px solid #e6e9ed;margin:28px 0;"><p style="font-size:12px;line-height:1.5;color:#5a6472;">Educational and informational purposes only. Not investment advice. <a href="${htmlEscape(unsubscribeUrl)}">Unsubscribe from Daily Learning</a>.</p></section></main></body></html>`;
  return Object.freeze({
    subject: email.subject,
    text,
    html,
    unsubscribeUrl,
  });
}

function buildIntent({ card, publishDate, grant, checkedAt }) {
  const outboxRecord = buildNotificationOutboxRecord({
    eventId: `daily-card.email:${publishDate}:${grant.id}`,
    messageId: DAILY_CARD_EMAIL_MESSAGE_ID,
    classification: 'marketing',
    businessObjectType: 'daily_card',
    businessObjectId: `${publishDate}:${card.id}`,
    stateVersion: 1,
    recipientEmail: grant.email_normalized,
    templateId: 'market_update',
    templateVersion: DAILY_CARD_EMAIL_TEMPLATE_VERSION,
    provider: 'resend',
    consent: {
      id: grant.id,
      emailNormalized: grant.email_normalized,
      purpose: grant.purpose,
      status: grant.status,
    },
    consentCheckedAt: checkedAt,
    payload: { editionId: `daily-card:${card.slug}` },
    nextAttemptAt: checkedAt,
  });
  return Object.freeze({ outboxRecord });
}

function shouldSend(outbox, nowMs) {
  const status = String(outbox?.status || '');
  if (TERMINAL_STATUSES.has(status)) return false;
  if (!SENDABLE_STATUSES.has(status)) return false;
  const nextAttemptAt = Date.parse(String(outbox.next_attempt_at || ''));
  return Number.isFinite(nextAttemptAt) && nextAttemptAt <= nowMs;
}

async function markFailure({ state, error, now, fetchImpl }) {
  const attempts = Number(state.outbox.attempt_count || 0);
  const retryable = error instanceof ResendLaunchEmailRequestError && error.retryable === true && attempts < 2;
  const status = retryable ? 'retry_scheduled' : 'terminal_failed';
  const errorCode = String(error?.code || 'DAILY_CARD_EMAIL_SEND_FAILED').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 80);
  return patchLaunchEmailOutbox({
    state,
    body: {
      status,
      error_code: errorCode,
      ...(retryable ? { next_attempt_at: new Date(now.getTime() + RETRY_DELAY_MS).toISOString() } : { failed_at: now.toISOString() }),
      updated_at: now.toISOString(),
    },
    fetchImpl,
  });
}

export function dailyCardEmailDistributionEnabled(environment = process.env) {
  return environment.DAILY_CARD_EMAIL_DISTRIBUTION_ENABLED === 'true';
}

export async function runDailyCardEmailBatch({
  publishDate = new Date().toISOString().slice(0, 10),
  environment = process.env,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const dateKey = publishDateKey(publishDate);
  if (!dailyCardEmailDistributionEnabled(environment)) {
    return Object.freeze({ enabled: false, publishDate: dateKey, attempted: 0, accepted: 0, skipped: 0, failed: 0 });
  }

  const errors = validateDailyCards();
  if (errors.length) {
    throw new DailyCardEmailDispatchError(errors.join('; '), 'DAILY_CARD_VALIDATION_FAILED');
  }

  const card = getDailyCard(new Date(`${dateKey}T12:00:00Z`), { access: 'open' });
  if (!card) throw new DailyCardEmailDispatchError('No publishable open Daily Card exists.', 'DAILY_CARD_NOT_FOUND');

  const grants = await listActiveDailyLearningGrants({ environment, fetchImpl });
  const batchSize = parseBatchSize(environment);
  const selected = grants.slice(0, batchSize);
  const adapter = createResendLaunchEmailAdapter({ environment, fetchImpl, now: () => now });
  const results = [];

  for (const grant of selected) {
    const checkedAt = now.toISOString();
    const intent = buildIntent({ card, publishDate: dateKey, grant, checkedAt });
    let state = await enqueueLaunchEmailIntent({ intent, environment, fetchImpl });
    if (!state.enabled) {
      throw new DailyCardEmailDispatchError('Email readiness ledger is disabled.', 'DAILY_CARD_EMAIL_LEDGER_DISABLED');
    }

    if (!shouldSend(state.outbox, now.getTime())) {
      results.push({ recipient: grant.email_normalized, status: 'skipped', outboxStatus: state.outbox.status });
      continue;
    }
    const active = await isDailyLearningGrantActive({ grant, environment, fetchImpl });
    if (!active) {
      const cancelled = await patchLaunchEmailOutbox({
        state,
        body: {
          status: 'cancelled',
          error_code: 'CONSENT_WITHDRAWN',
          failed_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
        fetchImpl,
      });
      results.push({ recipient: grant.email_normalized, status: 'skipped', outboxStatus: cancelled.status });
      continue;
    }

    const sending = await patchLaunchEmailOutbox({
      state,
      body: {
        status: 'sending',
        attempt_count: Number(state.outbox.attempt_count || 0) + 1,
        error_code: null,
        updated_at: now.toISOString(),
      },
      fetchImpl,
    });
    state = { ...state, outbox: sending };

    const rendered = renderMessage({ card, grant, environment });
    try {
      const accepted = await adapter.send({
        provider: 'resend',
        idempotencyKey: providerIdempotencyKey(intent.outboxRecord.idempotency_key),
        to: [grant.email_normalized],
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        headers: {
          'List-Unsubscribe': `<${rendered.unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      const acceptedRow = await patchLaunchEmailOutbox({
        state,
        body: {
          status: 'accepted',
          provider_message_ref: accepted.messageRef,
          accepted_at: accepted.occurredAt,
          error_code: null,
          updated_at: accepted.occurredAt,
        },
        fetchImpl,
      });
      results.push({ recipient: grant.email_normalized, status: 'accepted', outboxStatus: acceptedRow.status });
    } catch (error) {
      const failedRow = await markFailure({ state, error, now, fetchImpl });
      results.push({ recipient: grant.email_normalized, status: 'failed', outboxStatus: failedRow.status, code: failedRow.error_code });
    }
  }

  return Object.freeze({
    enabled: true,
    publishDate: dateKey,
    cardId: card.id,
    subscribers: grants.length,
    attempted: selected.length,
    accepted: results.filter((item) => item.status === 'accepted').length,
    skipped: results.filter((item) => item.status === 'skipped').length,
    failed: results.filter((item) => item.status === 'failed').length,
    capped: grants.length > batchSize,
    results: Object.freeze(results.map((item) => Object.freeze({ ...item }))),
  });
}
