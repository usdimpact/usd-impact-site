import { OUTCOME, SEVERITY, result } from './integrity-watchdog-policy.mjs';
import { jsonRequest, missingProvider } from './integrity-watchdog-provider-common.mjs';

export async function resendContracts({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  const token = env.USDIMPACT_WATCHDOG_RESEND_API_KEY || '';
  const expectedDomain = env.USDIMPACT_WATCHDOG_RESEND_DOMAIN || 'usd-impact.com';
  if (!token) return [missingProvider({ id: 'RESEND-DOMAIN-HEALTH', workflowId: 'RESEND-OPS-01', title: 'Resend domain and webhook health', domain: 'resend', severity: SEVERITY.P1, names: ['USDIMPACT_WATCHDOG_RESEND_API_KEY'] })];
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
  const outcome = domainsData.observation.status !== 200 || webhooksData.observation.status !== 200 ? OUTCOME.UNKNOWN : (!domain || String(domain.status).toLowerCase() !== 'verified' ? OUTCOME.FAIL : (missing.length ? OUTCOME.WARN : OUTCOME.PASS));
  return [result({ id: 'RESEND-DOMAIN-HEALTH', workflowId: 'RESEND-OPS-01', title: 'Resend domain and webhook health', domain: 'resend', severity: SEVERITY.P1, outcome, summary: outcome === OUTCOME.PASS ? 'Resend domain is verified and lifecycle webhook coverage is present.' : (outcome === OUTCOME.FAIL ? `Expected domain ${expectedDomain} is missing or unverified.` : (outcome === OUTCOME.WARN ? `Lifecycle webhook events are missing: ${missing.join(', ')}.` : 'Resend domain or webhook metadata is inconclusive.')), evidence: [{ id: 'RESEND-METADATA', source: 'resend', expected_domain: expectedDomain, domain_status: domain?.status || null, region: domain?.region || null, webhook_count: webhooks.length, covered_lifecycle_events: requiredEvents.filter((name) => subscribed.has(name)), missing_lifecycle_events: missing, webhook_urls_collected: false, email_content_collected: false, email_sent: false }], remediation: { prohibited_actions: ['Do not send a test email automatically.'] } })];
}
