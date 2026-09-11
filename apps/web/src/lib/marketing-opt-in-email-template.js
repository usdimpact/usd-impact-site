const PURPOSE_COPY = Object.freeze({
  weekly_newsletter: Object.freeze({
    subject: 'Confirm your Weekly USD Impact email',
    eyebrow: 'Weekly USD Impact',
    heading: 'Confirm your weekly email',
    summary: 'One concise weekly email with the published USD Impact Weekly Score, key cross-asset highlights, and useful links.',
    boundary: 'The Weekly Score is educational market-regime context. It is not a forecast, trading signal, or personalized investment advice.',
  }),
  learning_progress_updates: Object.freeze({
    subject: 'Confirm USD Impact learning progress updates',
    eyebrow: 'USD Impact Learning',
    heading: 'Confirm learning progress updates',
    summary: 'Occasional educational follow-ups that help you resume your USD Impact learning journey when there is something useful to continue.',
    boundary: 'These messages summarize your educational progress and newly available learning context. They are not market alerts or personalized investment advice.',
  }),
});

const PURPOSE_SET = new Set(Object.keys(PURPOSE_COPY));
const MAX_URL_LENGTH = 2048;

export class MarketingOptInEmailTemplateError extends Error {
  constructor(message, code = 'MARKETING_OPT_IN_EMAIL_TEMPLATE_INVALID') {
    super(message);
    this.name = 'MarketingOptInEmailTemplateError';
    this.code = code;
  }
}

function requirePurpose(value) {
  const purpose = String(value ?? '').trim().toLowerCase();
  if (!PURPOSE_SET.has(purpose)) {
    throw new MarketingOptInEmailTemplateError('Email confirmation purpose is not approved.', 'INVALID_OPT_IN_PURPOSE');
  }
  return purpose;
}

function requireConfirmationUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > MAX_URL_LENGTH) {
    throw new MarketingOptInEmailTemplateError('Confirmation URL is missing or too long.', 'INVALID_CONFIRMATION_URL');
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new MarketingOptInEmailTemplateError('Confirmation URL is invalid.', 'INVALID_CONFIRMATION_URL');
  }

  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if ((!local && url.protocol !== 'https:') || (local && !['http:', 'https:'].includes(url.protocol))) {
    throw new MarketingOptInEmailTemplateError('Confirmation URL must use HTTPS outside localhost.', 'INVALID_CONFIRMATION_URL');
  }
  if (url.username || url.password || url.pathname !== '/email/confirm' || !url.searchParams.get('token')) {
    throw new MarketingOptInEmailTemplateError('Confirmation URL is outside the approved route contract.', 'INVALID_CONFIRMATION_URL');
  }
  return url.toString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function buildMarketingOptInConfirmationEmail({ purpose, confirmationUrl } = {}) {
  const normalizedPurpose = requirePurpose(purpose);
  const url = requireConfirmationUrl(confirmationUrl);
  const copy = PURPOSE_COPY[normalizedPurpose];
  const escapedUrl = escapeHtml(url);

  const text = [
    copy.eyebrow,
    '',
    copy.heading,
    '',
    copy.summary,
    '',
    'Confirm this request:',
    url,
    '',
    'This confirmation link expires 48 hours after the request was created.',
    'Opening the link does not subscribe you. The confirmation page asks you to explicitly confirm the request.',
    '',
    copy.boundary,
    '',
    'If you did not request this email, ignore it. No subscription is activated unless you explicitly confirm.',
    '',
    'USD Impact · KELA LEADS S.R.L.',
    'support@usd-impact.com',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding-top:0;padding-right:0;padding-bottom:0;padding-left:0;background-color:#f5f6f8;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;background-color:#f5f6f8;">
    <tr>
      <td align="center" bgcolor="#f5f6f8" style="background-color:#f5f6f8;padding-top:32px;padding-right:16px;padding-bottom:32px;padding-left:16px;">
        <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td><![endif]-->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
          <tr>
            <td bgcolor="#071a33" style="background-color:#071a33;padding-top:18px;padding-right:28px;padding-bottom:18px;padding-left:28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#ffffff;font-weight:700;letter-spacing:1px;">
              USD IMPACT
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding-top:34px;padding-right:28px;padding-bottom:10px;padding-left:28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#8a6b32;font-weight:700;letter-spacing:1px;">
              ${escapeHtml(copy.eyebrow.toUpperCase())}
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding-top:0;padding-right:28px;padding-bottom:14px;padding-left:28px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:38px;color:#071a33;font-weight:700;">
              ${escapeHtml(copy.heading)}
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding-top:0;padding-right:28px;padding-bottom:24px;padding-left:28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#4f5b68;">
              ${escapeHtml(copy.summary)}
            </td>
          </tr>
          <tr>
            <td align="left" bgcolor="#ffffff" style="background-color:#ffffff;padding-top:0;padding-right:28px;padding-bottom:24px;padding-left:28px;">
              <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td bgcolor="#071a33" style="background-color:#071a33;border-radius:8px;padding-top:0;padding-right:0;padding-bottom:0;padding-left:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;color:#ffffff;font-weight:700;">
                    <a href="${escapedUrl}" style="display:inline-block;padding-top:14px;padding-right:22px;padding-bottom:14px;padding-left:22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:700;">Review and confirm</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding-top:0;padding-right:28px;padding-bottom:14px;padding-left:28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#4f5b68;">
              This link expires 48 hours after the request. Opening it does not subscribe you; the confirmation page requires an explicit confirmation.
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding-top:0;padding-right:28px;padding-bottom:14px;padding-left:28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#66717d;">
              ${escapeHtml(copy.boundary)}
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding-top:0;padding-right:28px;padding-bottom:30px;padding-left:28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#66717d;">
              If you did not request this email, ignore it. No subscription is activated unless you explicitly confirm.
            </td>
          </tr>
          <tr>
            <td bgcolor="#eef1f4" style="background-color:#eef1f4;padding-top:20px;padding-right:28px;padding-bottom:20px;padding-left:28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5d6874;">
              USD Impact · KELA LEADS S.R.L.<br>
              <a href="mailto:support@usd-impact.com" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#071a33;text-decoration:underline;">support@usd-impact.com</a>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  return Object.freeze({
    purpose: normalizedPurpose,
    subject: copy.subject,
    text,
    html,
  });
}
