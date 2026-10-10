// Provider-signed routing metadata for the shared USD Impact Resend account.
// Preview and local Development both write to the canonical Development
// Supabase project, so routing follows the data owner rather than the Vercel
// hosting label.
//
// Webhook callers must perform a local outbox lookup first. A matching local
// outbox row always wins. This module only identifies a strictly tagged event
// that belongs to the other data scope.
const APP_TAG = 'usd_impact';
const ROUTING_TAG_KEYS = Object.freeze([
  'usd_impact_app',
  'usd_impact_flow',
  'usd_impact_scope',
]);
const FLOWS = new Set([
  'launch_email',
  'waitlist',
  'marketing_opt_in',
  'weekly_newsletter',
  'learning_progress',
]);
const SCOPES = new Set(['production', 'development']);
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;

export function usdImpactResendDataScope(environment = {}) {
  const value = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  if (value === 'production') return 'production';
  if (value === 'preview' || value === 'development') return 'development';
  return null;
}

export function buildUsdImpactResendTags(environment, flow) {
  const scope = usdImpactResendDataScope(environment);
  const normalizedFlow = String(flow ?? '').trim();
  if (!scope) throw new TypeError('Resend routing requires an explicit Production, Preview, or Development environment.');
  if (!FLOWS.has(normalizedFlow)) throw new TypeError('Resend routing flow is not approved.');
  return Object.freeze([
    Object.freeze({ name: 'usd_impact_app', value: APP_TAG }),
    Object.freeze({ name: 'usd_impact_scope', value: scope }),
    Object.freeze({ name: 'usd_impact_flow', value: normalizedFlow }),
  ]);
}

function emptyRecipients(value) {
  return value == null || (Array.isArray(value) && value.length === 0);
}

function senderMailbox(value) {
  const sender = typeof value === 'string' ? value.trim() : '';
  const bracketed = sender.match(/<([^<>]+)>$/);
  const mailbox = (bracketed ? bracketed[1] : sender).trim().toLowerCase();
  return EMAIL_PATTERN.test(mailbox) ? mailbox : null;
}

function exactRoutingTags(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const keys = Object.keys(value).sort();
  if (keys.length !== ROUTING_TAG_KEYS.length
      || keys.some((key, index) => key !== [...ROUTING_TAG_KEYS].sort()[index])) return null;
  const app = value.usd_impact_app;
  const scope = value.usd_impact_scope;
  const flow = value.usd_impact_flow;
  if (app !== APP_TAG || !SCOPES.has(scope) || !FLOWS.has(flow)) return null;
  return { scope, flow };
}

export function isForeignUsdImpactResendEvent(event, environment) {
  const currentScope = usdImpactResendDataScope(environment);
  if (!currentScope) return false;

  const raw = event?.raw;
  const data = raw?.data;
  if (!raw || Array.isArray(raw) || !data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!event.trackedDeliveryEvent || raw.type !== event.type) return false;
  if (data.email_id !== event.emailId || typeof data.email_id !== 'string') return false;

  const route = exactRoutingTags(data.tags);
  if (!route || route.scope === currentScope) return false;

  const mailbox = senderMailbox(data.from);
  if (!mailbox || !mailbox.endsWith('@updates.usd-impact.com')) return false;
  if (typeof data.subject !== 'string' || !data.subject.trim() || data.subject.length > 998) return false;
  if (!Array.isArray(data.to) || data.to.length !== 1
      || typeof data.to[0] !== 'string' || data.to[0].length > 254 || !EMAIL_PATTERN.test(data.to[0])) return false;
  if (!emptyRecipients(data.cc) || !emptyRecipients(data.bcc)) return false;
  if (data.broadcast_id != null || data.template_id != null) return false;

  return true;
}
