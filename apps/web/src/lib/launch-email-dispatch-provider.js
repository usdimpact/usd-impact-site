import {
  EMAIL_RETRY_POLICIES,
  decideEmailDeliveryAction,
} from './email-operations-policy.js';
import {
  FAILURE_PROVIDER_STATES,
  PROVIDER_RESULT_STATES,
  LaunchEmailDispatchError,
  deepFreeze,
  requireTimestamp,
  safeErrorCode,
  timestampMs,
} from './launch-email-dispatch-common.js';
import {
  evaluateLaunchEmailEligibility,
  lifecycleEmailDispatchEnabled,
  renderLaunchEmailDispatch,
  resolveLaunchEmailDispatchDecision,
  suppressionFromOutboxStatus,
} from './launch-email-dispatch-intent.js';
import {
  loadLaunchEmailOutbox,
  patchLaunchEmailOutbox,
} from './launch-email-dispatch-ledger.js';

function requireProviderAdapter(adapter, provider) {
  if (!adapter || adapter.id !== provider || typeof adapter.send !== 'function') {
    throw new LaunchEmailDispatchError(
      'A matching provider adapter with a send function is required.',
      'PROVIDER_ADAPTER_REQUIRED',
    );
  }
  return adapter;
}

function requireProviderMessageRef(value) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 255) {
    throw new LaunchEmailDispatchError(
      'Provider message reference is missing or invalid.',
      'INVALID_PROVIDER_MESSAGE_REF',
    );
  }
  return value.trim();
}

function providerFailureState(error) {
  const state = String(error?.providerState || 'failed').trim().toLowerCase();
  return FAILURE_PROVIDER_STATES.has(state) ? state : 'failed';
}

function retryTimestamp(nowMs, delaySeconds) {
  return new Date(nowMs + delaySeconds * 1000).toISOString();
}

async function recordProviderFailure({
  state,
  sending,
  error,
  consentState,
  nowMs,
  fetchImpl,
}) {
  const providerState = providerFailureState(error);
  const attemptedAt = new Date(nowMs).toISOString();
  const errorCode = safeErrorCode(error?.code);
  const sendingState = { ...state, outbox: sending };

  if (providerState === 'accepted_ambiguous') {
    const outbox = await patchLaunchEmailOutbox({
      state: sendingState,
      body: { status: 'sending', error_code: 'PROVIDER_ACCEPTANCE_AMBIGUOUS' },
      fetchImpl,
    });
    return deepFreeze({
      action: 'manual_reconciliation',
      reason: 'provider_acceptance_ambiguous',
      outbox,
    });
  }

  const terminal = {
    bounced: { status: 'hard_bounced', code: 'PROVIDER_HARD_BOUNCE' },
    complained: { status: 'complained', code: 'PROVIDER_COMPLAINT' },
    suppressed: { status: 'suppressed', code: 'PROVIDER_SUPPRESSED' },
  }[providerState];
  if (terminal) {
    const outbox = await patchLaunchEmailOutbox({
      state: sendingState,
      body: {
        status: terminal.status,
        failed_at: attemptedAt,
        error_code: terminal.code,
      },
      fetchImpl,
    });
    const decision = evaluateLaunchEmailEligibility({
      messageId: state.intent.messageId,
      consentState,
      suppressionState: suppressionFromOutboxStatus(terminal.status),
    });
    return deepFreeze({ ...decision, outbox });
  }

  if (providerState === 'failed' && error?.retryable === false) {
    const retry = EMAIL_RETRY_POLICIES[state.intent.policy.retryPolicy];
    const outbox = await patchLaunchEmailOutbox({
      state: sendingState,
      body: {
        status: 'terminal_failed',
        failed_at: attemptedAt,
        error_code: errorCode,
      },
      fetchImpl,
    });
    return deepFreeze({
      action: retry.manualEscalation ? 'manual_escalation' : 'terminal_failed',
      reason: 'provider_permanent_failure',
      outbox,
    });
  }

  const createdAt = timestampMs(sending.created_at) ?? nowMs;
  const completedAttempts = Number.isInteger(sending.attempt_count) ? sending.attempt_count : 1;
  const policyDecision = decideEmailDeliveryAction({
    messageId: state.intent.messageId,
    completedAttempts,
    elapsedSeconds: Math.max(0, Math.floor((nowMs - createdAt) / 1000)),
    providerState: 'failed',
    consentState,
  });
  if (policyDecision.action === 'retry') {
    const outbox = await patchLaunchEmailOutbox({
      state: sendingState,
      body: {
        status: 'retry_scheduled',
        next_attempt_at: retryTimestamp(nowMs, policyDecision.delaySeconds),
        error_code: errorCode,
      },
      fetchImpl,
    });
    return deepFreeze({
      action: 'retry_scheduled',
      delaySeconds: policyDecision.delaySeconds,
      outbox,
    });
  }
  if (policyDecision.action === 'cancelled_consent') {
    const outbox = await patchLaunchEmailOutbox({
      state: sendingState,
      body: {
        status: 'cancelled',
        failed_at: attemptedAt,
        error_code: 'CONSENT_NOT_CURRENT',
      },
      fetchImpl,
    });
    return deepFreeze({ ...policyDecision, outbox });
  }

  const outbox = await patchLaunchEmailOutbox({
    state: sendingState,
    body: {
      status: 'terminal_failed',
      failed_at: attemptedAt,
      error_code: policyDecision.action === 'manual_escalation'
        ? 'MANUAL_ESCALATION_REQUIRED'
        : errorCode,
    },
    fetchImpl,
  });
  return deepFreeze({ ...policyDecision, outbox });
}

export async function dispatchEnqueuedLaunchEmail({
  state,
  providerAdapter,
  unsubscribeUrl = null,
  consentState = 'not_applicable',
  suppressionState = 'none',
  environment = process.env,
  fetchImpl = fetch,
  nowMs = Date.now(),
}) {
  if (!lifecycleEmailDispatchEnabled(environment)) {
    return deepFreeze({ enabled: false, action: 'disabled' });
  }
  if (!state?.enabled || !state?.config || !state?.outbox || !state?.intent) {
    throw new LaunchEmailDispatchError(
      'An enabled, persisted launch email state is required.',
      'INVALID_DISPATCH_STATE',
    );
  }
  if (
    String(environment.VERCEL_ENV || '').trim().toLowerCase() === 'production'
    && environment.LAUNCH_EMAIL_PRODUCTION_APPROVED !== 'true'
  ) {
    throw new LaunchEmailDispatchError(
      'Production launch email delivery is not approved.',
      'PRODUCTION_DISPATCH_NOT_APPROVED',
    );
  }

  const currentOutbox = await loadLaunchEmailOutbox({
    config: state.config,
    intent: state.intent,
    id: state.outbox.id,
    fetchImpl,
  });
  const currentState = { ...state, outbox: currentOutbox };
  const decision = resolveLaunchEmailDispatchDecision({
    intent: currentState.intent,
    outbox: currentOutbox,
    consentState,
    suppressionState,
    nowMs,
  });
  if (decision.action !== 'send') {
    return deepFreeze({ enabled: true, ...decision, outbox: currentOutbox });
  }

  const message = renderLaunchEmailDispatch({ intent: currentState.intent, unsubscribeUrl });
  const adapter = requireProviderAdapter(providerAdapter, message.provider);
  const attemptedAt = new Date(nowMs).toISOString();
  const sending = await patchLaunchEmailOutbox({
    state: currentState,
    body: {
      status: 'sending',
      attempt_count: currentOutbox.attempt_count + 1,
      next_attempt_at: attemptedAt,
      error_code: null,
    },
    fetchImpl,
  });

  let result;
  try {
    result = await adapter.send(message);
  } catch (error) {
    return recordProviderFailure({
      state: currentState,
      sending,
      error,
      consentState,
      nowMs,
      fetchImpl,
    });
  }

  const providerState = String(result?.state || 'accepted').trim().toLowerCase();
  if (!PROVIDER_RESULT_STATES.has(providerState)) {
    return recordProviderFailure({
      state: currentState,
      sending,
      error: { code: 'INVALID_PROVIDER_RESULT', providerState: 'accepted_ambiguous' },
      consentState,
      nowMs,
      fetchImpl,
    });
  }
  let providerMessageRef;
  try {
    providerMessageRef = requireProviderMessageRef(result?.messageRef);
  } catch {
    return recordProviderFailure({
      state: currentState,
      sending,
      error: { code: 'INVALID_PROVIDER_MESSAGE_REF', providerState: 'accepted_ambiguous' },
      consentState,
      nowMs,
      fetchImpl,
    });
  }

  const completedAt = result?.occurredAt
    ? requireTimestamp(result.occurredAt, 'provider occurredAt')
    : attemptedAt;
  const outbox = await patchLaunchEmailOutbox({
    state: { ...currentState, outbox: sending },
    body: providerState === 'delivered'
      ? {
          status: 'delivered',
          provider_message_ref: providerMessageRef,
          accepted_at: completedAt,
          delivered_at: completedAt,
          failed_at: null,
          error_code: null,
        }
      : {
          status: 'accepted',
          provider_message_ref: providerMessageRef,
          accepted_at: completedAt,
          failed_at: null,
          error_code: null,
        },
    fetchImpl,
  });
  return deepFreeze({ enabled: true, action: providerState, providerMessageRef, outbox });
}
