import { OUTCOME, SEVERITY, result } from './integrity-watchdog-policy.mjs';
import { jsonRequest } from './integrity-watchdog-provider-common.mjs';

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
  const expectedDomain = env.USDIMPACT_WATCHDOG_RESEND_DOMAIN || 'usd-impact.com';

  if (!token) {
    return [unavailable(
      ['USDIMPACT_WATCHDOG_RESEND_API_KEY', 'USDIMPACT_WATCHDOG_RESEND_FULL_ACCESS_APPROVED'],
      'Resend metadata could not be inspected. Resend currently offers full-access or sending-access API keys, not a metadata-only read key.',
      {
        proposed_changes: ['Keep this contract UNKNOWN unless a separately approved full-access credential is accepted for GET-only watchdog use or Resend provides a read-only credential type.'],
        prohibited_actions: ['Do not create a sending-access key for this collector; it cannot satisfy the metadata contract.', 'Do not install a full-access Resend key without separate owner approval.'],
      },
    )];
  }

  if (!fullAccessApproved) {
    return [unavailable(
      ['USDIMPACT_WATCHDOG_RESEND_FULL_ACCESS_APPROVED'],
      'A Resend credential is present, but use is blocked because the provider does not offer a metadata-only API key and full-access use has not been explicitly approved.',
      {
        proposed_changes: ['Record explicit owner acceptance before enabling GET-only use of a full-access Resend key.'],
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
  const requiredEvents = ['email.delivered', 'email.bounced', 'email.complained', 'email.suppressed'];
  const subscribed = new Set(webhooks.flatMap((entry) => entry.events || []));
  const missing = requiredEvents.filter((name) => !subscribed.has(name));
  const outcome = domainsData.observation.status !== 200 || webhooksData.observation.status !== 200
    ? OUTCOME.UNKNOWN
    : (!domain || String(domain.status).toLowerCase() !== 'verified'
      ? OUTCOME.FAIL
      : (missing.length ? OUTCOME.WARN : OUTCOME.PASS));

  return [result({
    id: 'RESEND-DOMAIN-HEALTH',
    workflowId: 'RESEND-OPS-01',
    title: 'Resend domain and webhook health',
    domain: 'resend',
    severity: SEVERITY.P1,
    outcome,
    summary: outcome === OUTCOME.PASS
      ? 'Resend domain is verified and lifecycle webhook coverage is present.'
      : (outcome === OUTCOME.FAIL
        ? `Expected domain ${expectedDomain} is missing or unverified.`
        : (outcome === OUTCOME.WARN
          ? `Lifecycle webhook events are missing: ${missing.join(', ')}.`
          : 'Resend domain or webhook metadata is inconclusive.')),
    evidence: [{
      id: 'RESEND-METADATA',
      source: 'resend',
      expected_domain: expectedDomain,
      domain_status: domain?.status || null,
      region: domain?.region || null,
      webhook_count: webhooks.length,
      covered_lifecycle_events: requiredEvents.filter((name) => subscribed.has(name)),
      missing_lifecycle_events: missing,
      provider_read_only_api_key_available: false,
      full_access_credential_use_approved: true,
      request_methods_used: ['GET'],
      webhook_urls_collected: false,
      email_content_collected: false,
      email_sent: false,
      external_mutation_performed: false,
    }],
    remediation: {
      prohibited_actions: ['Do not send a test email automatically.', 'Do not mutate domains, webhooks, contacts, templates, broadcasts, or API keys.'],
    },
  })];
}
