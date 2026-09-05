import { OUTCOME, SEVERITY, result } from './integrity-watchdog-policy.mjs';
import { jsonRequest } from './integrity-watchdog-provider-common.mjs';

const DEFAULT_DOMAIN = 'updates.usd-impact.com';
const REQUIRED_EVENTS = ['email.delivered', 'email.bounced', 'email.complained', 'email.suppressed'];

function normalizeEndpoint(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return null;
  }
}

function unavailable(names, summary, remediation) {
  return result({
    id: 'RESEND-DOMAIN-HEALTH',
    workflowId: 'RESEND-OPS-01',
    title: 'Resend domain and webhook health',
    domain: 'resend',
    severity: SEVERITY.P1,
    outcome: OUTCOME.UNKNOWN,
    summary,
    evidence: [{
      id: 'RESEND-CONFIG',
      source: 'environment',
      configured: false,
      required_environment_names: names,
      provider_read_only_api_key_available: false,
    }],
    remediation,
  });
}

export async function resendContracts({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  const token = env.USDIMPACT_WATCHDOG_RESEND_API_KEY || '';
  const fullAccessApproved = env.USDIMPACT_WATCHDOG_RESEND_FULL_ACCESS_APPROVED === 'true';
  const expectedDomain = env.USDIMPACT_WATCHDOG_RESEND_DOMAIN || DEFAULT_DOMAIN;
  const expectedWebhookEndpoint = normalizeEndpoint(env.USDIMPACT_WATCHDOG_RESEND_WEBHOOK_ENDPOINT || '');

  if (!token) {
    return [unavailable(
      ['USDIMPACT_WATCHDOG_RESEND_API_KEY', 'USDIMPACT_WATCHDOG_RESEND_FULL_ACCESS_APPROVED'],
      'Resend metadata could not be inspected. Resend currently offers full-access or sending-access API keys, not a metadata-only read key.',
      {
        proposed_changes: ['Keep this contract UNKNOWN unless a separately approved dedicated full-access credential is accepted for GET-only watchdog use or Resend provides a read-only credential type.'],
        prohibited_actions: ['Do not create a sending-access key for this collector; it cannot satisfy the metadata contract.', 'Do not reuse a general Production Resend key solely to remove UNKNOWN.', 'Do not install a full-access Resend key without separate owner approval.'],
      },
    )];
  }

  if (!fullAccessApproved) {
    return [unavailable(
      ['USDIMPACT_WATCHDOG_RESEND_FULL_ACCESS_APPROVED'],
      'A dedicated Resend credential is present, but use is blocked because the provider does not offer a metadata-only API key and full-access use has not been explicitly approved.',
      {
        proposed_changes: ['Record explicit owner acceptance before enabling GET-only use of a dedicated full-access Resend key.'],
        prohibited_actions: ['Do not call Resend with the credential until the approval flag is true.', 'Do not send email or mutate Resend state.'],
      },
    )];
  }

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const [domainsData, webhooksData] = await Promise.all([
    jsonRequest({ fetchImpl, url: 'https://api.resend.com/domains', headers }),
    jsonRequest({ fetchImpl, url: 'https://api.resend.com/webhooks', headers }),
  ]);
  const domains = Array.isArray(domainsData.json?.data) ? domainsData.json.data : [];
  const domain = domains.find((entry) => entry.name === expectedDomain) || null;
  const webhooks = Array.isArray(webhooksData.json?.data) ? webhooksData.json.data : [];
  const enabledWebhooks = webhooks.filter((entry) => String(entry?.status || '').toLowerCase() !== 'disabled');
  const matchingEnabledWebhooks = expectedWebhookEndpoint
    ? enabledWebhooks.filter((entry) => normalizeEndpoint(entry?.endpoint || entry?.url) === expectedWebhookEndpoint)
    : enabledWebhooks;
  const subscribed = new Set(matchingEnabledWebhooks.flatMap((entry) => entry.events || []));
  const missing = REQUIRED_EVENTS.filter((name) => !subscribed.has(name));
  const metadataConclusive = domainsData.observation.status === 200 && webhooksData.observation.status === 200;
  const domainVerified = Boolean(domain && String(domain.status).toLowerCase() === 'verified');

  let outcome = OUTCOME.UNKNOWN;
  let summary = 'Resend domain or webhook metadata is inconclusive.';
  if (metadataConclusive && !domainVerified) {
    outcome = OUTCOME.FAIL;
    summary = `Expected domain ${expectedDomain} is missing or unverified.`;
  } else if (metadataConclusive && expectedWebhookEndpoint && matchingEnabledWebhooks.length === 0) {
    outcome = OUTCOME.WARN;
    summary = 'No enabled Resend webhook matches the expected USD Impact lifecycle endpoint.';
  } else if (metadataConclusive && missing.length) {
    outcome = OUTCOME.WARN;
    summary = `Lifecycle webhook events are missing: ${missing.join(', ')}.`;
  } else if (metadataConclusive) {
    outcome = OUTCOME.PASS;
    summary = 'Resend domain is verified and enabled lifecycle webhook coverage is present.';
  }

  return [result({
    id: 'RESEND-DOMAIN-HEALTH',
    workflowId: 'RESEND-OPS-01',
    title: 'Resend domain and webhook health',
    domain: 'resend',
    severity: SEVERITY.P1,
    outcome,
    summary,
    evidence: [{
      id: 'RESEND-METADATA',
      source: 'resend',
      expected_domain: expectedDomain,
      domain_status: domain?.status || null,
      region: domain?.region || null,
      webhook_count: webhooks.length,
      enabled_webhook_count: enabledWebhooks.length,
      disabled_webhook_count: webhooks.length - enabledWebhooks.length,
      matching_enabled_webhook_count: matchingEnabledWebhooks.length,
      expected_webhook_endpoint_configured: Boolean(expectedWebhookEndpoint),
      covered_lifecycle_events: REQUIRED_EVENTS.filter((name) => subscribed.has(name)),
      missing_lifecycle_events: missing,
      provider_read_only_api_key_available: false,
      full_access_credential_use_approved: true,
      dedicated_api_key_required: true,
      request_methods_used: ['GET'],
      webhook_urls_collected: false,
      email_content_collected: false,
      email_sent: false,
      external_mutation_performed: false,
    }],
    remediation: {
      proposed_changes: outcome === OUTCOME.WARN
        ? ['Verify the enabled canonical Resend webhook and its required lifecycle subscriptions without changing delivery state.']
        : [],
      prohibited_actions: ['Do not send a test email automatically.', 'Do not mutate domains, webhooks, contacts, templates, broadcasts, or API keys.'],
    },
  })];
}
