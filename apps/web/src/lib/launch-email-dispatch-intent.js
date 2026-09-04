import {
  EMAIL_MESSAGE_POLICIES,
  EMAIL_RETRY_POLICIES,
  EMAIL_SUPPRESSION_POLICY,
  decideEmailDeliveryAction,
  getEmailMessagePolicy,
} from './email-operations-policy.js';
import {
  buildNotificationOutboxRecord,
  normalizeEmail,
} from './email-readiness-contracts.js';
import {
  LAUNCH_EMAIL_TEMPLATE_SPECS,
  getLaunchEmailTemplateSpec,
  getLaunchEmailTemplateVersion,
  renderLaunchEmail,
} from './launch-email-templates.js';
import {
  CLOCK_SKEW_MS,
  CONSENT_STATES,
  LAUNCH_EMAIL_DISPATCH_VERSION,
  LaunchEmailDispatchError,
  PROVIDER_BOUNDARIES,
  PROVIDER_IDEMPOTENCY_WINDOW_MS,
  SENDABLE_STATUSES,
  createDispatchIdentity,
  deepFreeze,
  requireInteger,
  requireString,
  requireTimestamp,
  timestampMs,
} from './launch-email-dispatch-common.js';

const SUPPRESSION_STATES = new Set(['none', ...Object.keys(EMAIL_SUPPRESSION_POLICY)]);

function assertApprovedBoundary(messageId, policy, providerResponsibilityApproved) {
  if (!PROVIDER_BOUNDARIES.has(policy.providerBoundary)) {
    throw new LaunchEmailDispatchError(
      `${messageId} uses an unsupported provider boundary.`,
      'UNAPPROVED_PROVIDER_BOUNDARY',
    );
  }
  if (policy.providerBoundary === 'supabase_auth') {
    throw new LaunchEmailDispatchError(
      `${messageId} is provider-managed and cannot use the application lifecycle outbox.`,
      'PROVIDER_MANAGED_MESSAGE',
    );
  }
  if (
    policy.providerBoundary === 'shared_after_provider_selection'
    && providerResponsibilityApproved !== true
  ) {
    throw new LaunchEmailDispatchError(
      `${messageId} requires approved provider responsibility mapping before enqueue.`,
      'PROVIDER_RESPONSIBILITY_UNRESOLVED',
    );
  }
}

export function lifecycleEmailLedgerEnabled(environment = process.env) {
  return environment.EMAIL_READINESS_LEDGER_ENABLED === 'true';
}

export function lifecycleEmailDispatchEnabled(environment = process.env) {
  return environment.LAUNCH_EMAIL_DISPATCH_ENABLED === 'true';
}

export function createLaunchEmailDispatchIntent({
  messageId,
  businessObjectType,
  businessObjectId,
  stateVersion,
  recipientEmail,
  occurredAt = new Date().toISOString(),
  provider = 'resend',
  consent = null,
  consentCheckedAt = null,
  providerResponsibilityApproved = false,
}) {
  const policy = getEmailMessagePolicy(messageId);
  const spec = getLaunchEmailTemplateSpec(messageId);
  assertApprovedBoundary(messageId, policy, providerResponsibilityApproved);
  if (spec.classification !== policy.classification) {
    throw new LaunchEmailDispatchError(
      `${messageId} template and policy classifications do not match.`,
      'TEMPLATE_POLICY_MISMATCH',
    );
  }

  const normalizedOccurredAt = requireTimestamp(occurredAt, 'occurredAt');
  const normalizedRecipient = normalizeEmail(recipientEmail);
  const normalizedBusinessObjectType = requireString(
    businessObjectType,
    'businessObjectType',
    80,
  );
  const normalizedBusinessObjectId = requireString(
    businessObjectId,
    'businessObjectId',
    200,
  );
  const normalizedStateVersion = requireInteger(stateVersion, 'stateVersion');
  const normalizedProvider = requireString(provider, 'provider', 80);
  const identity = createDispatchIdentity({
    messageId,
    businessObjectType: normalizedBusinessObjectType,
    businessObjectId: normalizedBusinessObjectId,
    stateVersion: normalizedStateVersion,
    recipientEmail: normalizedRecipient,
  });

  const outboxRecord = buildNotificationOutboxRecord({
    eventId: identity.eventId,
    messageId,
    classification: policy.classification,
    businessObjectType: normalizedBusinessObjectType,
    businessObjectId: normalizedBusinessObjectId,
    stateVersion: normalizedStateVersion,
    recipientEmail: normalizedRecipient,
    templateId: messageId,
    templateVersion: getLaunchEmailTemplateVersion(messageId),
    provider: normalizedProvider,
    ...(consent
      ? { consent, consentCheckedAt: consentCheckedAt || normalizedOccurredAt }
      : {}),
    payload: {},
    nextAttemptAt: normalizedOccurredAt,
  });

  return deepFreeze({
    version: LAUNCH_EMAIL_DISPATCH_VERSION,
    messageId,
    occurredAt: normalizedOccurredAt,
    policy,
    spec,
    customerReference: identity.customerReference,
    providerIdempotencyKey: identity.providerIdempotencyKey,
    outboxRecord,
  });
}

export function renderLaunchEmailDispatch({ intent, unsubscribeUrl = null }) {
  if (!intent?.outboxRecord || !intent?.messageId) {
    throw new LaunchEmailDispatchError(
      'A prepared launch email intent is required.',
      'INVALID_DISPATCH_INTENT',
    );
  }
  const rendered = renderLaunchEmail({
    messageId: intent.messageId,
    reference: intent.customerReference,
    unsubscribeUrl,
  });
  if (
    rendered.classification !== intent.outboxRecord.classification
    || rendered.templateVersion !== intent.outboxRecord.template_version
  ) {
    throw new LaunchEmailDispatchError(
      'Rendered launch email does not match the durable outbox identity.',
      'RENDERED_MESSAGE_MISMATCH',
    );
  }
  return deepFreeze({
    provider: intent.outboxRecord.provider,
    idempotencyKey: intent.providerIdempotencyKey,
    messageId: intent.messageId,
    classification: rendered.classification,
    templateVersion: rendered.templateVersion,
    to: [intent.outboxRecord.recipient_email_normalized],
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    ...(rendered.headers ? { headers: rendered.headers } : {}),
  });
}

function classificationSuppressionField(classification) {
  if (classification === 'marketing') return 'stopMarketing';
  if (classification === 'operational') return 'stopOperational';
  return 'stopTransactional';
}

export function evaluateLaunchEmailEligibility({
  messageId,
  consentState = 'not_applicable',
  suppressionState = 'none',
}) {
  if (!CONSENT_STATES.has(consentState)) {
    throw new LaunchEmailDispatchError('consentState is invalid.', 'INVALID_CONSENT_STATE');
  }
  if (!SUPPRESSION_STATES.has(suppressionState)) {
    throw new LaunchEmailDispatchError('suppressionState is invalid.', 'INVALID_SUPPRESSION_STATE');
  }

  const policy = getEmailMessagePolicy(messageId);
  if (policy.consentRequired && consentState !== 'granted') {
    return deepFreeze({ action: 'cancelled_consent', reason: consentState });
  }
  if (suppressionState === 'none') return deepFreeze({ action: 'eligible' });

  const suppression = EMAIL_SUPPRESSION_POLICY[suppressionState];
  if (
    policy.consentRequired
    && ['purpose_withdrawal', 'global_unsubscribe'].includes(suppressionState)
  ) {
    return deepFreeze({ action: 'cancelled_consent', reason: suppressionState });
  }

  const stopped = suppression[classificationSuppressionField(policy.classification)] === true;
  if (stopped) {
    if (policy.classification === 'marketing') {
      return deepFreeze({ action: 'terminal_suppressed', reason: suppressionState });
    }
    if (suppression.requireManualEscalationForRequiredMail) {
      return deepFreeze({ action: 'manual_escalation', reason: suppressionState });
    }
    return deepFreeze({ action: 'terminal_suppressed', reason: suppressionState });
  }
  if (
    suppression.requireManualEscalationForRequiredMail
    && policy.classification !== 'marketing'
  ) {
    return deepFreeze({ action: 'manual_escalation', reason: suppressionState });
  }
  return deepFreeze({ action: 'eligible' });
}

export function verifyLaunchEmailOutboxIdentity(intent, row) {
  if (!row || typeof row !== 'object') {
    throw new LaunchEmailDispatchError('The notification outbox row is missing.', 'OUTBOX_ROW_MISSING');
  }
  const expected = intent.outboxRecord;
  for (const field of [
    'idempotency_key',
    'event_id',
    'message_id',
    'classification',
    'business_object_type',
    'business_object_id',
    'state_version',
    'recipient_email_normalized',
    'template_id',
    'template_version',
    'provider',
    'consent_required',
    'consent_record_id',
    'consent_purpose',
  ]) {
    if ((row[field] ?? null) !== (expected[field] ?? null)) {
      throw new LaunchEmailDispatchError(
        `The notification outbox row conflicts on ${field}.`,
        'OUTBOX_IDENTITY_CONFLICT',
      );
    }
  }
  if (timestampMs(row.consent_checked_at) !== timestampMs(expected.consent_checked_at)) {
    throw new LaunchEmailDispatchError(
      'The notification outbox row conflicts on consent_checked_at.',
      'OUTBOX_IDENTITY_CONFLICT',
    );
  }
  if (JSON.stringify(row.payload ?? {}) !== JSON.stringify(expected.payload)) {
    throw new LaunchEmailDispatchError(
      'The notification outbox payload conflicts with the approved minimized payload.',
      'OUTBOX_IDENTITY_CONFLICT',
    );
  }
  return row;
}

export function suppressionFromOutboxStatus(status) {
  if (status === 'hard_bounced') return 'hard_bounce';
  if (status === 'complained') return 'complaint';
  if (status === 'suppressed') return 'provider_suppressed';
  return null;
}

export function resolveLaunchEmailDispatchDecision({
  intent,
  outbox,
  consentState = 'not_applicable',
  suppressionState = 'none',
  nowMs = Date.now(),
}) {
  verifyLaunchEmailOutboxIdentity(intent, outbox);
  const status = String(outbox.status || '');
  const eligibility = evaluateLaunchEmailEligibility({
    messageId: intent.messageId,
    consentState,
    suppressionState: suppressionFromOutboxStatus(status) || suppressionState,
  });
  if (eligibility.action !== 'eligible') return eligibility;

  if (status === 'delivered') return deepFreeze({ action: 'complete', reason: 'delivered' });
  if (status === 'accepted') return deepFreeze({ action: 'await_callback', reason: 'accepted' });
  if (status === 'cancelled') return deepFreeze({ action: 'cancelled', reason: 'cancelled' });
  if (status === 'terminal_failed') {
    const retry = EMAIL_RETRY_POLICIES[intent.policy.retryPolicy];
    return deepFreeze({
      action: retry.manualEscalation ? 'manual_escalation' : 'terminal_failed',
      reason: 'terminal_failed',
    });
  }

  const createdAt = timestampMs(outbox.created_at);
  if (createdAt === null) {
    return deepFreeze({ action: 'manual_reconciliation', reason: 'missing-created-at' });
  }
  const completedAttempts = Number.isInteger(outbox.attempt_count) ? outbox.attempt_count : 0;
  if (status === 'sending') {
    if (outbox.provider_message_ref || outbox.accepted_at) {
      return deepFreeze({ action: 'await_callback', reason: 'provider-correlated' });
    }
    const age = nowMs - createdAt;
    if (age < -CLOCK_SKEW_MS || age > PROVIDER_IDEMPOTENCY_WINDOW_MS) {
      return deepFreeze({ action: 'manual_reconciliation', reason: 'provider-window-expired' });
    }
  } else if (SENDABLE_STATUSES.has(status)) {
    const nextAttemptAt = timestampMs(outbox.next_attempt_at);
    if (nextAttemptAt === null) {
      return deepFreeze({ action: 'manual_reconciliation', reason: 'invalid-next-attempt' });
    }
    if (nextAttemptAt > nowMs) {
      return deepFreeze({ action: 'wait', reason: 'retry-not-due' });
    }
  } else {
    return deepFreeze({ action: 'manual_reconciliation', reason: 'unknown-status' });
  }

  const decision = decideEmailDeliveryAction({
    messageId: intent.messageId,
    completedAttempts,
    elapsedSeconds: Math.max(0, Math.floor((nowMs - createdAt) / 1000)),
    providerState: 'failed',
    consentState,
  });
  if (decision.action === 'retry') {
    return deepFreeze({
      action: 'send',
      reason: status === 'sending' ? 'provider-idempotent-retry' : 'attempt-due',
      providerIdempotencyKey: intent.providerIdempotencyKey,
    });
  }
  return decision;
}

export function validateLaunchEmailDispatchContract() {
  for (const [messageId, policy] of Object.entries(EMAIL_MESSAGE_POLICIES)) {
    const spec = LAUNCH_EMAIL_TEMPLATE_SPECS[messageId];
    if (!spec) throw new Error(`${messageId} has no launch email template.`);
    if (!PROVIDER_BOUNDARIES.has(policy.providerBoundary)) {
      throw new Error(`${messageId} has an unsupported provider boundary.`);
    }
    if (spec.classification !== policy.classification) {
      throw new Error(`${messageId} template and policy classifications differ.`);
    }
    if ((messageId === 'auth_sign_in') !== (policy.providerBoundary === 'supabase_auth')) {
      throw new Error('Only auth_sign_in may use the Supabase Auth provider boundary.');
    }
  }
  return true;
}
