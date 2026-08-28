export const EMAIL_OPERATIONS_POLICY_VERSION = '2026-08-28.v2';
export const EMAIL_SUPPORT_ADDRESS = 'support@usd-impact.com';
export const EMAIL_PRODUCT_ID = 'read_the_dollar_first_library_pass';

const CLASSIFICATIONS = new Set([
  'transactional',
  'transactional_security',
  'transactional_operational',
  'operational',
  'marketing',
]);

export const EMAIL_OWNER_ROLES = deepFreeze({
  authentication: {
    businessEntity: 'KELA LEADS S.R.L.',
    primary: 'USD Impact owner/operator',
    backup: 'KELA LEADS S.R.L. authorized administrator',
    escalation: 'USD Impact incident owner',
  },
  commerce: {
    businessEntity: 'KELA LEADS S.R.L.',
    primary: 'USD Impact commerce operations',
    backup: 'KELA LEADS S.R.L. authorized administrator',
    escalation: 'USD Impact incident owner',
  },
  support: {
    businessEntity: 'KELA LEADS S.R.L.',
    primary: 'USD Impact support operations',
    backup: 'KELA LEADS S.R.L. authorized administrator',
    escalation: 'USD Impact owner/operator',
  },
  privacy: {
    businessEntity: 'KELA LEADS S.R.L.',
    primary: 'USD Impact privacy operations',
    backup: 'KELA LEADS S.R.L. authorized administrator',
    escalation: 'USD Impact owner/operator',
  },
  marketing: {
    businessEntity: 'KELA LEADS S.R.L.',
    primary: 'USD Impact editorial operations',
    backup: 'USD Impact owner/operator',
    escalation: 'USD Impact privacy operations',
  },
});

export const EMAIL_RETRY_POLICIES = deepFreeze({
  security_short_lived: {
    maxAttempts: 2,
    delaysSeconds: [0, 60],
    staleAfterSeconds: 600,
    manualEscalation: true,
    consentRecheckBeforeAttempt: false,
  },
  transactional_critical: {
    maxAttempts: 5,
    delaysSeconds: [0, 60, 300, 1800, 7200],
    staleAfterSeconds: 86_400,
    manualEscalation: true,
    consentRecheckBeforeAttempt: false,
  },
  operational_standard: {
    maxAttempts: 4,
    delaysSeconds: [0, 300, 1800, 7200],
    staleAfterSeconds: 86_400,
    manualEscalation: true,
    consentRecheckBeforeAttempt: false,
  },
  marketing_consented: {
    maxAttempts: 2,
    delaysSeconds: [0, 1800],
    staleAfterSeconds: 86_400,
    manualEscalation: false,
    consentRecheckBeforeAttempt: true,
  },
});

export const EMAIL_RETENTION_POLICIES = deepFreeze({
  security_ephemeral: {
    payloadDays: 7,
    deliveryMetadataDays: 90,
    evidenceDays: 90,
    sourceOfTruth: 'supabase_auth',
  },
  transactional_customer: {
    payloadDays: 30,
    deliveryMetadataDays: 730,
    evidenceDays: 730,
    sourceOfTruth: 'commerce_and_entitlement_records',
  },
  operational_customer: {
    payloadDays: 30,
    deliveryMetadataDays: 365,
    evidenceDays: 365,
    sourceOfTruth: 'application_business_record',
  },
  support_case: {
    payloadDays: 730,
    deliveryMetadataDays: 730,
    evidenceDays: 730,
    sourceOfTruth: 'support_case_record',
  },
  privacy_request: {
    payloadDays: 90,
    deliveryMetadataDays: 1095,
    evidenceDays: 1095,
    sourceOfTruth: 'privacy_request_record',
  },
  consent_and_marketing: {
    payloadDays: 30,
    deliveryMetadataDays: 365,
    evidenceDays: 1095,
    sourceOfTruth: 'consent_and_suppression_record',
  },
});

export const EMAIL_SUPPRESSION_POLICY = deepFreeze({
  purpose_withdrawal: {
    stopMarketing: true,
    stopOperational: false,
    stopTransactional: false,
    requireManualEscalationForRequiredMail: false,
  },
  global_unsubscribe: {
    stopMarketing: true,
    stopOperational: false,
    stopTransactional: false,
    requireManualEscalationForRequiredMail: false,
  },
  hard_bounce: {
    stopMarketing: true,
    stopOperational: true,
    stopTransactional: false,
    requireManualEscalationForRequiredMail: true,
  },
  complaint: {
    stopMarketing: true,
    stopOperational: true,
    stopTransactional: false,
    requireManualEscalationForRequiredMail: true,
  },
  provider_suppressed: {
    stopMarketing: true,
    stopOperational: true,
    stopTransactional: false,
    requireManualEscalationForRequiredMail: true,
  },
});

export const LAUNCH_CRITICAL_MESSAGE_IDS = Object.freeze([
  'auth_sign_in',
  'purchase_pending',
  'purchase_access_ready',
  'purchase_failed',
  'refund_approved',
  'dispute_warning',
  'chargeback_revoked',
  'dispute_reversal_restored',
  'privacy_export_acknowledgement',
  'account_deletion_requested',
  'account_deletion_completed',
  'support_case_received',
  'waitlist_confirmation',
  'book_availability',
]);

export const EMAIL_MESSAGE_POLICIES = deepFreeze({
  auth_sign_in: messagePolicy({
    classification: 'transactional_security',
    owner: 'authentication',
    providerBoundary: 'supabase_auth',
    retryPolicy: 'security_short_lived',
    retentionPolicy: 'security_ephemeral',
    supportEscalation: true,
  }),
  purchase_pending: messagePolicy({
    classification: 'transactional_operational',
    owner: 'commerce',
    providerBoundary: 'shared_after_provider_selection',
    retryPolicy: 'transactional_critical',
    retentionPolicy: 'transactional_customer',
    supportEscalation: true,
  }),
  purchase_access_ready: messagePolicy({
    classification: 'transactional',
    owner: 'commerce',
    providerBoundary: 'application_owned_after_verified_event',
    retryPolicy: 'transactional_critical',
    retentionPolicy: 'transactional_customer',
    supportEscalation: true,
  }),
  purchase_failed: messagePolicy({
    classification: 'transactional_operational',
    owner: 'commerce',
    providerBoundary: 'shared_after_provider_selection',
    retryPolicy: 'operational_standard',
    retentionPolicy: 'transactional_customer',
    supportEscalation: true,
  }),
  refund_approved: messagePolicy({
    classification: 'transactional',
    owner: 'commerce',
    providerBoundary: 'application_owned_after_verified_event',
    retryPolicy: 'transactional_critical',
    retentionPolicy: 'transactional_customer',
    supportEscalation: true,
  }),
  dispute_warning: messagePolicy({
    classification: 'transactional_operational',
    owner: 'commerce',
    providerBoundary: 'application_owned_after_verified_event',
    retryPolicy: 'transactional_critical',
    retentionPolicy: 'transactional_customer',
    supportEscalation: true,
  }),
  chargeback_revoked: messagePolicy({
    classification: 'transactional',
    owner: 'commerce',
    providerBoundary: 'application_owned_after_verified_event',
    retryPolicy: 'transactional_critical',
    retentionPolicy: 'transactional_customer',
    supportEscalation: true,
  }),
  dispute_reversal_restored: messagePolicy({
    classification: 'transactional',
    owner: 'commerce',
    providerBoundary: 'application_owned_after_verified_event',
    retryPolicy: 'transactional_critical',
    retentionPolicy: 'transactional_customer',
    supportEscalation: true,
  }),
  privacy_export_acknowledgement: messagePolicy({
    classification: 'transactional_operational',
    owner: 'privacy',
    providerBoundary: 'application_owned',
    retryPolicy: 'transactional_critical',
    retentionPolicy: 'privacy_request',
    supportEscalation: true,
    securePayloadForbidden: true,
  }),
  account_deletion_requested: messagePolicy({
    classification: 'transactional_operational',
    owner: 'privacy',
    providerBoundary: 'application_owned',
    retryPolicy: 'transactional_critical',
    retentionPolicy: 'privacy_request',
    supportEscalation: true,
  }),
  account_deletion_completed: messagePolicy({
    classification: 'transactional_operational',
    owner: 'privacy',
    providerBoundary: 'application_owned',
    retryPolicy: 'transactional_critical',
    retentionPolicy: 'privacy_request',
    supportEscalation: true,
  }),
  support_case_received: messagePolicy({
    classification: 'operational',
    owner: 'support',
    providerBoundary: 'application_owned',
    retryPolicy: 'operational_standard',
    retentionPolicy: 'support_case',
    supportEscalation: true,
  }),
  waitlist_confirmation: messagePolicy({
    classification: 'operational',
    owner: 'marketing',
    providerBoundary: 'application_owned',
    retryPolicy: 'operational_standard',
    retentionPolicy: 'consent_and_marketing',
    consentPurpose: 'book_availability',
    consentRequired: true,
    unsubscribeRequired: true,
    supportEscalation: true,
  }),
  book_availability: messagePolicy({
    classification: 'marketing',
    owner: 'marketing',
    providerBoundary: 'application_owned',
    retryPolicy: 'marketing_consented',
    retentionPolicy: 'consent_and_marketing',
    consentPurpose: 'book_availability',
    consentRequired: true,
    unsubscribeRequired: true,
    supportEscalation: true,
  }),
});

export function getEmailMessagePolicy(messageId) {
  const policy = EMAIL_MESSAGE_POLICIES[messageId];
  if (!policy) throw new TypeError(`Unknown email message policy: ${messageId}`);
  return policy;
}

export function getRetryDelaySeconds({ messageId, completedAttempts }) {
  if (!Number.isInteger(completedAttempts) || completedAttempts < 0) {
    throw new TypeError('completedAttempts must be a non-negative integer.');
  }
  const message = getEmailMessagePolicy(messageId);
  const retry = EMAIL_RETRY_POLICIES[message.retryPolicy];
  if (completedAttempts >= retry.maxAttempts) return null;
  return retry.delaysSeconds[completedAttempts];
}

export function decideEmailDeliveryAction({
  messageId,
  completedAttempts,
  elapsedSeconds,
  providerState,
  consentState = 'not_applicable',
}) {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new TypeError('elapsedSeconds must be a non-negative number.');
  }
  const message = getEmailMessagePolicy(messageId);
  const retry = EMAIL_RETRY_POLICIES[message.retryPolicy];

  if (providerState === 'delivered') return deepFreeze({ action: 'delivered' });
  if (message.consentRequired && consentState !== 'granted') {
    return deepFreeze({ action: 'cancelled_consent' });
  }
  if (['bounced', 'complained', 'suppressed'].includes(providerState)) {
    return deepFreeze({
      action: message.classification === 'marketing' ? 'terminal_suppressed' : 'manual_escalation',
      reason: providerState,
    });
  }
  if (providerState === 'accepted_ambiguous') {
    return deepFreeze({ action: 'manual_reconciliation', reason: 'provider_acceptance_ambiguous' });
  }
  if (elapsedSeconds >= retry.staleAfterSeconds || completedAttempts >= retry.maxAttempts) {
    return deepFreeze({
      action: retry.manualEscalation ? 'manual_escalation' : 'terminal_failed',
      reason: elapsedSeconds >= retry.staleAfterSeconds ? 'stale' : 'attempts_exhausted',
    });
  }
  return deepFreeze({
    action: 'retry',
    delaySeconds: retry.delaysSeconds[completedAttempts],
  });
}

export function validateEmailOperationsPolicy() {
  const configuredIds = Object.keys(EMAIL_MESSAGE_POLICIES).sort();
  const requiredIds = [...LAUNCH_CRITICAL_MESSAGE_IDS].sort();
  if (JSON.stringify(configuredIds) !== JSON.stringify(requiredIds)) {
    throw new Error('Launch-critical email message coverage is incomplete or contains an unapproved entry.');
  }

  for (const [policyId, policy] of Object.entries(EMAIL_RETRY_POLICIES)) {
    if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1 || policy.maxAttempts > 5) {
      throw new Error(`${policyId} maxAttempts must be between 1 and 5.`);
    }
    if (policy.delaysSeconds.length !== policy.maxAttempts) {
      throw new Error(`${policyId} delaysSeconds must match maxAttempts.`);
    }
    if (policy.delaysSeconds.some((delay) => !Number.isInteger(delay) || delay < 0)) {
      throw new Error(`${policyId} delaysSeconds must be non-negative integers.`);
    }
  }

  for (const [retentionId, retention] of Object.entries(EMAIL_RETENTION_POLICIES)) {
    for (const field of ['payloadDays', 'deliveryMetadataDays', 'evidenceDays']) {
      if (!Number.isInteger(retention[field]) || retention[field] < 0 || retention[field] > 1095) {
        throw new Error(`${retentionId}.${field} must be between 0 and 1095 days.`);
      }
    }
  }

  for (const [messageId, message] of Object.entries(EMAIL_MESSAGE_POLICIES)) {
    if (!CLASSIFICATIONS.has(message.classification)) {
      throw new Error(`${messageId} has an unsupported classification.`);
    }
    if (!EMAIL_OWNER_ROLES[message.owner]) {
      throw new Error(`${messageId} has no approved owner.`);
    }
    if (!EMAIL_RETRY_POLICIES[message.retryPolicy]) {
      throw new Error(`${messageId} has no approved retry policy.`);
    }
    if (!EMAIL_RETENTION_POLICIES[message.retentionPolicy]) {
      throw new Error(`${messageId} has no approved retention policy.`);
    }
    if (message.classification === 'marketing' && !message.consentRequired) {
      throw new Error(`${messageId} marketing delivery requires consent.`);
    }
    if (message.classification === 'marketing' && !message.unsubscribeRequired) {
      throw new Error(`${messageId} marketing delivery requires unsubscribe.`);
    }
    if (message.consentRequired && !message.consentPurpose) {
      throw new Error(`${messageId} consent-bound delivery requires a purpose.`);
    }
    if (!message.consentRequired && message.consentPurpose) {
      throw new Error(`${messageId} must not attach a consent purpose to required mail.`);
    }
  }

  return true;
}

function messagePolicy({
  classification,
  owner,
  providerBoundary,
  retryPolicy,
  retentionPolicy,
  consentPurpose = null,
  consentRequired = false,
  unsubscribeRequired = false,
  supportEscalation = false,
  securePayloadForbidden = false,
}) {
  return {
    classification,
    owner,
    providerBoundary,
    retryPolicy,
    retentionPolicy,
    consentPurpose,
    consentRequired,
    unsubscribeRequired,
    supportEscalation,
    securePayloadForbidden,
    requiredAtLaunch: true,
    customerFacing: true,
    productId: EMAIL_PRODUCT_ID,
    supportAddress: supportEscalation ? EMAIL_SUPPORT_ADDRESS : null,
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

validateEmailOperationsPolicy();