import {
  LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF,
  LAUNCH_EMAIL_PRODUCTION_PROJECT_REF,
  LaunchEmailDispatchError,
} from './launch-email-dispatch-common.js';
import { lifecycleEmailDispatchEnabled } from './launch-email-dispatch-intent.js';
import { dispatchEnqueuedLaunchEmail } from './launch-email-dispatch-provider.js';
import { createResendLaunchEmailAdapter } from './launch-email-resend-adapter.js';

export const LAUNCH_EMAIL_RUNNER_MAX_ITEMS = 5;
export const LAUNCH_EMAIL_RUNNER_DEFAULT_ITEMS = 3;

const HALT_ACTIONS = new Set([
  'manual_escalation',
  'manual_reconciliation',
  'retry_scheduled',
]);

function expectedProjectRef(environment) {
  return String(environment.VERCEL_ENV || '').trim().toLowerCase() === 'production'
    ? LAUNCH_EMAIL_PRODUCTION_PROJECT_REF
    : LAUNCH_EMAIL_DEVELOPMENT_PROJECT_REF;
}

function requireBound(value) {
  const bound = value ?? LAUNCH_EMAIL_RUNNER_DEFAULT_ITEMS;
  if (!Number.isInteger(bound) || bound < 1 || bound > LAUNCH_EMAIL_RUNNER_MAX_ITEMS) {
    throw new LaunchEmailDispatchError(
      `Lifecycle dispatch batch size must be between 1 and ${LAUNCH_EMAIL_RUNNER_MAX_ITEMS}.`,
      'INVALID_DISPATCH_BATCH_SIZE',
    );
  }
  return bound;
}

function requireTask(task, environment) {
  if (!task || typeof task !== 'object' || !task.state?.intent || !task.state?.outbox) {
    throw new LaunchEmailDispatchError(
      'Each lifecycle dispatch task requires a persisted dispatch state.',
      'INVALID_DISPATCH_TASK',
    );
  }
  const projectRef = String(task.state.projectRef || '').trim();
  if (projectRef !== expectedProjectRef(environment)) {
    throw new LaunchEmailDispatchError(
      'Lifecycle dispatch task does not target the canonical environment project.',
      'UNEXPECTED_SUPABASE_PROJECT',
    );
  }
  return task;
}

function compactResult(state, result) {
  return Object.freeze({
    messageId: state.intent.messageId,
    action: result.action,
    reason: result.reason || null,
  });
}

function compactError(state, error) {
  return Object.freeze({
    messageId: state?.intent?.messageId || null,
    action: 'error',
    code: typeof error?.code === 'string' ? error.code : 'DISPATCH_RUNNER_FAILED',
  });
}

export async function runLaunchEmailDispatchBatch({
  tasks,
  maxItems = LAUNCH_EMAIL_RUNNER_DEFAULT_ITEMS,
  environment = process.env,
  ledgerFetchImpl = fetch,
  providerFetchImpl = fetch,
  providerClock = () => new Date(),
  nowMs = Date.now(),
} = {}) {
  if (!Array.isArray(tasks)) {
    throw new LaunchEmailDispatchError(
      'Lifecycle dispatch tasks must be an array.',
      'INVALID_DISPATCH_TASKS',
    );
  }
  const bound = requireBound(maxItems);

  if (!lifecycleEmailDispatchEnabled(environment)) {
    return Object.freeze({
      enabled: false,
      processed: 0,
      deferred: tasks.length,
      halted: false,
      results: Object.freeze([]),
    });
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

  const selected = tasks.slice(0, bound).map((task) => requireTask(task, environment));
  if (!selected.length) {
    return Object.freeze({
      enabled: true,
      processed: 0,
      deferred: 0,
      halted: false,
      results: Object.freeze([]),
    });
  }

  const providerAdapter = createResendLaunchEmailAdapter({
    environment,
    fetchImpl: providerFetchImpl,
    now: providerClock,
  });
  const results = [];
  let halted = false;

  for (const task of selected) {
    try {
      const result = await dispatchEnqueuedLaunchEmail({
        state: task.state,
        providerAdapter,
        unsubscribeUrl: task.unsubscribeUrl || null,
        consentState: task.consentState || 'not_applicable',
        suppressionState: task.suppressionState || 'none',
        environment,
        fetchImpl: ledgerFetchImpl,
        nowMs,
      });
      results.push(compactResult(task.state, result));
      if (HALT_ACTIONS.has(result.action)) {
        halted = true;
        break;
      }
    } catch (error) {
      results.push(compactError(task.state, error));
      halted = true;
      break;
    }
  }

  return Object.freeze({
    enabled: true,
    processed: results.length,
    deferred: Math.max(0, tasks.length - results.length),
    halted,
    results: Object.freeze(results),
  });
}
