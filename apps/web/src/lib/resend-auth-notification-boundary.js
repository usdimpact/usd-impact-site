// This is a provider-signed routing namespace, not proof of account sign-in.
// auth_sign_in is provider-managed and forbidden in the application outbox.
// Keep the exact observed sender and approved subject paired; sender/subject
// drift, custom tags, broadcasts, templates and negative delivery events must
// not become an implicit allowlist. Call only after verifyResendWebhook and a
// successful, strictly empty outbox lookup. Matched application records win.
const AUTH_FROM = '"USD Impact" <no-reply@updates.usd-impact.com>';
const AUTH_SUBJECT = 'Your secure USD Impact sign-in link';
const SUCCESS_EVENTS = new Set(['email.sent', 'email.delivered']);
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;

function emptyRecipients(value) {
  return value == null || (Array.isArray(value) && value.length === 0);
}

export function isProviderManagedAuthSuccess(event) {
  const raw = event?.raw;
  const data = raw?.data;
  if (!raw || Array.isArray(raw) || !data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!SUCCESS_EVENTS.has(event.type) || raw.type !== event.type || !event.trackedDeliveryEvent) return false;
  if (data.email_id !== event.emailId || typeof data.email_id !== 'string') return false;
  if (data.from !== AUTH_FROM || data.subject !== AUTH_SUBJECT) return false;
  if (!Array.isArray(data.to) || data.to.length !== 1
      || typeof data.to[0] !== 'string' || data.to[0].length > 254 || !EMAIL_PATTERN.test(data.to[0])) return false;
  if (!emptyRecipients(data.cc) || !emptyRecipients(data.bcc)) return false;
  if (data.broadcast_id != null || data.template_id != null) return false;
  if (data.tags != null && (typeof data.tags !== 'object' || Array.isArray(data.tags)
      || Object.keys(data.tags).length !== 0)) return false;
  return true;
}
