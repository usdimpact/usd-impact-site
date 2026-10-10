// Resend is shared by USD Impact and the separately governed Siguiendo el Dólar
// newsletter. This boundary identifies only the provider-signed Spanish sender
// namespace so its lifecycle callbacks are not mistaken for USD Impact outbox
// races. Call only after verifyResendWebhook and a successful, strictly empty
// USD Impact outbox lookup. A matching application outbox row always wins.
//
// The Spanish system sends direct, single-recipient messages only. Broadcasts,
// templates, recipient fan-out, malformed metadata, or sender drift stay
// fail-closed so this cannot become a broad account-level allowlist.
const SPANISH_NEWSLETTER_FROM = 'Siguiendo el Dólar <boletin@updates.usd-impact.com>';
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;

function emptyRecipients(value) {
  return value == null || (Array.isArray(value) && value.length === 0);
}

export function isExternallyManagedSpanishNewsletterEvent(event) {
  const raw = event?.raw;
  const data = raw?.data;
  if (!raw || Array.isArray(raw) || !data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!event.trackedDeliveryEvent || raw.type !== event.type) return false;
  if (data.email_id !== event.emailId || typeof data.email_id !== 'string') return false;
  if (data.from !== SPANISH_NEWSLETTER_FROM) return false;
  if (typeof data.subject !== 'string' || !data.subject.trim() || data.subject.length > 998) return false;
  if (!Array.isArray(data.to) || data.to.length !== 1
      || typeof data.to[0] !== 'string' || data.to[0].length > 254 || !EMAIL_PATTERN.test(data.to[0])) return false;
  if (!emptyRecipients(data.cc) || !emptyRecipients(data.bcc)) return false;
  if (data.broadcast_id != null || data.template_id != null) return false;
  return true;
}
