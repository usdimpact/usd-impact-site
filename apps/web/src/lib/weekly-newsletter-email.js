import { createMarketingEmailUnsubscribeHeaders } from './marketing-email-preference-token.js';

const CANONICAL_ORIGIN = 'https://www.usd-impact.com';

export class WeeklyNewsletterEmailError extends Error {
  constructor(message, code = 'WEEKLY_NEWSLETTER_EMAIL_INVALID') {
    super(message);
    this.name = 'WeeklyNewsletterEmailError';
    this.code = code;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function requireString(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new WeeklyNewsletterEmailError(`${field} is required.`);
  return normalized;
}

function requireCanonicalUrl(value, field) {
  const raw = requireString(value, field);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new WeeklyNewsletterEmailError(`${field} must be a valid URL.`, 'INVALID_WEEKLY_NEWSLETTER_URL');
  }
  if (url.origin !== CANONICAL_ORIGIN || url.protocol !== 'https:' || url.username || url.password) {
    throw new WeeklyNewsletterEmailError(
      `${field} must use the canonical USD Impact origin.`,
      'INVALID_WEEKLY_NEWSLETTER_URL',
    );
  }
  return url.toString();
}

function validateCandidate(candidate) {
  if (
    !candidate
    || typeof candidate !== 'object'
    || candidate.eligible !== true
    || candidate.action !== 'queue_candidate'
    || candidate.reason !== 'eligible'
    || typeof candidate.recipientEmail !== 'string'
    || !candidate.recipientEmail
    || typeof candidate.consentGrantId !== 'string'
    || !candidate.consentGrantId
    || !/^consent:v1:[0-9a-f]{64}$/.test(String(candidate.consentIdempotencyKey ?? ''))
  ) {
    throw new WeeklyNewsletterEmailError(
      'An eligible Weekly Newsletter candidate is required.',
      'WEEKLY_NEWSLETTER_CANDIDATE_REQUIRED',
    );
  }
  const payload = candidate.payload;
  if (
    !payload
    || payload.messageId !== 'weekly_newsletter'
    || payload.consentPurpose !== 'weekly_newsletter'
    || payload.classification !== 'marketing'
    || payload.locale !== 'en'
    || payload.weekEnding !== candidate.weekEnding
    || payload.unsubscribeRequired !== true
    || !Array.isArray(payload.highlights)
    || payload.highlights.length !== 3
    || !Array.isArray(payload.links)
    || payload.links.length < 4
  ) {
    throw new WeeklyNewsletterEmailError(
      'Weekly Newsletter candidate payload is invalid.',
      'INVALID_WEEKLY_NEWSLETTER_PAYLOAD',
    );
  }
  return payload;
}

function renderHighlightText(highlight, index) {
  return `${index + 1}. ${requireString(highlight.title, `highlights[${index}].title`)}\n${requireString(highlight.summary, `highlights[${index}].summary`)}`;
}

function renderHighlightHtml(highlight, index) {
  const title = escapeHtml(requireString(highlight.title, `highlights[${index}].title`));
  const summary = escapeHtml(requireString(highlight.summary, `highlights[${index}].summary`));
  return `<tr><td style="padding-top:0;padding-right:0;padding-bottom:18px;padding-left:0;font-family:Arial,Helvetica,sans-serif;"><p style="margin:0 0 6px;font-size:15px;line-height:22px;color:#071a33;font-weight:700;">${index + 1}. ${title}</p><p style="margin:0;font-size:14px;line-height:22px;color:#4f5b68;">${summary}</p></td></tr>`;
}

function renderLinkText(link) {
  return `${requireString(link.label, 'link.label')}: ${requireCanonicalUrl(link.url, 'link.url')}`;
}

function renderLinkHtml(link) {
  const label = escapeHtml(requireString(link.label, 'link.label'));
  const url = escapeHtml(requireCanonicalUrl(link.url, 'link.url'));
  return `<tr><td style="padding-top:0;padding-right:0;padding-bottom:10px;padding-left:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;"><a href="${url}" style="color:#071a33;text-decoration:underline;">${label}</a></td></tr>`;
}

export function buildWeeklyNewsletterEmail({
  candidate,
  unsubscribeSecret,
  baseUrl = CANONICAL_ORIGIN,
} = {}) {
  const payload = validateCandidate(candidate);
  const primaryUrl = requireCanonicalUrl(payload.primaryCta?.url, 'primaryCta.url');
  const primaryLabel = requireString(payload.primaryCta?.label, 'primaryCta.label');
  const scoreValue = requireString(payload.score?.displayValue, 'score.displayValue');
  const scoreRegime = requireString(payload.score?.regime, 'score.regime');
  const weeklyChange = requireString(payload.score?.displayWeekOverWeekChange, 'score.displayWeekOverWeekChange');
  const fourWeekChange = requireString(payload.score?.displayFourWeekChange, 'score.displayFourWeekChange');
  const scoreNote = requireString(payload.score?.note, 'score.note');
  const complianceNote = requireString(payload.complianceNote, 'complianceNote');

  const grant = {
    idempotency_key: candidate.consentIdempotencyKey,
    purpose: 'weekly_newsletter',
  };
  const unsubscribeHeaders = createMarketingEmailUnsubscribeHeaders({
    grant,
    secret: unsubscribeSecret,
    baseUrl,
  });
  const unsubscribeUrl = unsubscribeHeaders['List-Unsubscribe'].slice(1, -1);

  const text = [
    'USD IMPACT WEEKLY',
    `Week ending ${payload.weekEnding}`,
    '',
    `USD Impact Weekly Score: ${scoreValue}`,
    `Regime: ${scoreRegime}`,
    `Week-over-week change: ${weeklyChange}`,
    `Four-week change: ${fourWeekChange}`,
    scoreNote,
    '',
    'HIGHLIGHTS',
    ...payload.highlights.flatMap((highlight, index) => [renderHighlightText(highlight, index), '']),
    'USEFUL LINKS',
    ...payload.links.map(renderLinkText),
    '',
    `${primaryLabel}: ${primaryUrl}`,
    '',
    complianceNote,
    '',
    'You are receiving this because you explicitly confirmed the Weekly USD Impact email.',
    `Unsubscribe from this email purpose: ${unsubscribeUrl}`,
    '',
    'USD Impact · KELA LEADS S.R.L.',
    'support@usd-impact.com',
  ].join('\n');

  const highlightsHtml = payload.highlights.map(renderHighlightHtml).join('');
  const linksHtml = payload.links.map(renderLinkHtml).join('');
  const escapedPrimaryUrl = escapeHtml(primaryUrl);
  const escapedPrimaryLabel = escapeHtml(primaryLabel);
  const escapedUnsubscribeUrl = escapeHtml(unsubscribeUrl);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(payload.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f6f8;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(payload.preheader)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;background-color:#f5f6f8;">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td><![endif]-->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
          <tr><td bgcolor="#071a33" style="padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#ffffff;font-weight:700;letter-spacing:1px;">USD IMPACT WEEKLY</td></tr>
          <tr><td style="padding:32px 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#8a6b32;font-weight:700;letter-spacing:1px;">WEEK ENDING ${escapeHtml(payload.weekEnding)}</td></tr>
          <tr><td style="padding:0 28px 22px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:38px;color:#071a33;font-weight:700;">${escapeHtml(payload.title)}</td></tr>
          <tr><td style="padding:0 28px 26px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:#eef1f4;border-collapse:collapse;"><tr><td style="padding:22px;font-family:Arial,Helvetica,sans-serif;"><p style="margin:0 0 6px;font-size:13px;line-height:19px;color:#66717d;font-weight:700;letter-spacing:.7px;">USD IMPACT WEEKLY SCORE</p><p style="margin:0 0 5px;font-size:30px;line-height:36px;color:#071a33;font-weight:700;">${escapeHtml(scoreValue)}</p><p style="margin:0 0 10px;font-size:15px;line-height:22px;color:#071a33;font-weight:700;">${escapeHtml(scoreRegime)}</p><p style="margin:0 0 10px;font-size:13px;line-height:20px;color:#4f5b68;">Weekly change ${escapeHtml(weeklyChange)} · Four-week change ${escapeHtml(fourWeekChange)}</p><p style="margin:0;font-size:12px;line-height:19px;color:#66717d;">${escapeHtml(scoreNote)}</p></td></tr></table></td></tr>
          <tr><td style="padding:0 28px 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#8a6b32;font-weight:700;letter-spacing:1px;">VERIFIED HIGHLIGHTS</td></tr>
          <tr><td style="padding:0 28px 12px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">${highlightsHtml}</table></td></tr>
          <tr><td style="padding:0 28px 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#8a6b32;font-weight:700;letter-spacing:1px;">USEFUL LINKS</td></tr>
          <tr><td style="padding:0 28px 14px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">${linksHtml}</table></td></tr>
          <tr><td style="padding:4px 28px 30px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td bgcolor="#071a33" style="border-radius:8px;"><a href="${escapedPrimaryUrl}" style="display:inline-block;padding:14px 22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:700;">${escapedPrimaryLabel}</a></td></tr></table></td></tr>
          <tr><td bgcolor="#eef1f4" style="padding:20px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5d6874;">${escapeHtml(complianceNote)}<br><br>You are receiving this because you explicitly confirmed the Weekly USD Impact email. <a href="${escapedUnsubscribeUrl}" style="color:#071a33;text-decoration:underline;">Unsubscribe from this email purpose</a>.<br><br>USD Impact · KELA LEADS S.R.L.<br><a href="mailto:support@usd-impact.com" style="color:#071a33;text-decoration:underline;">support@usd-impact.com</a></td></tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  return Object.freeze({
    to: candidate.recipientEmail,
    classification: 'marketing',
    purpose: 'weekly_newsletter',
    weekEnding: payload.weekEnding,
    subject: payload.subject,
    preheader: payload.preheader,
    text,
    html,
    headers: unsubscribeHeaders,
  });
}
