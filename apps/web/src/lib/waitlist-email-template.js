export const WAITLIST_EMAIL_SUBJECT = "You're on the Read the Dollar First waitlist";
export const WAITLIST_SUPPORT_EMAIL = 'support@usd-impact.com';
export const WAITLIST_PRIVACY_URL = 'https://www.usd-impact.com/privacy/';
export const WAITLIST_TEMPLATE_VERSION = 'waitlist-confirmation-v2';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function createWaitlistConfirmationEmail({ supportEmail = WAITLIST_SUPPORT_EMAIL } = {}) {
  const normalizedSupportEmail = String(supportEmail).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedSupportEmail)) {
    throw new TypeError('supportEmail must be a valid email address.');
  }

  const safeSupportEmail = escapeHtml(normalizedSupportEmail);
  const text = [
    'USD IMPACT',
    '',
    "You're on the waitlist.",
    '',
    'Thank you for joining the waitlist for Read the Dollar First.',
    'We will email the purchase link when the book becomes available.',
    '',
    `To withdraw from book-availability updates, contact ${normalizedSupportEmail}.`,
    `Privacy notice: ${WAITLIST_PRIVACY_URL}`,
    '',
    'Educational product information only. This is not investment, legal, tax, trading, or financial advice.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(WAITLIST_EMAIL_SUBJECT)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;color:#161a1f;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your Read the Dollar First waitlist confirmation.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f6f8;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #e6e9ed;border-radius:12px;">
            <tr>
              <td style="padding:32px 28px;line-height:1.6;">
                <p style="margin:0 0 14px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#8a6b32;font-weight:700;">USD Impact</p>
                <h1 style="margin:0 0 18px;font-size:30px;line-height:1.2;color:#071a33;">You’re on the waitlist.</h1>
                <p style="margin:0 0 14px;font-size:16px;">Thank you for joining the waitlist for <strong><em>Read the Dollar First</em></strong>.</p>
                <p style="margin:0 0 22px;font-size:16px;">We will email the purchase link when the book becomes available.</p>
                <p style="margin:0 0 10px;font-size:14px;color:#5a6472;">To withdraw from book-availability updates, contact <a href="mailto:${safeSupportEmail}" style="color:#071a33;">${safeSupportEmail}</a>.</p>
                <p style="margin:0 0 22px;font-size:14px;color:#5a6472;"><a href="${WAITLIST_PRIVACY_URL}" style="color:#071a33;">Read the privacy notice</a>.</p>
                <p style="margin:0;font-size:13px;color:#5a6472;border-top:1px solid #e6e9ed;padding-top:18px;">Educational product information only. This is not investment, legal, tax, trading, or financial advice.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return Object.freeze({
    subject: WAITLIST_EMAIL_SUBJECT,
    text,
    html,
    templateVersion: WAITLIST_TEMPLATE_VERSION,
  });
}
