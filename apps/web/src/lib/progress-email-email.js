import { createMarketingEmailUnsubscribeHeaders } from './marketing-email-preference-token.js';

const CANONICAL_ORIGIN = 'https://www.usd-impact.com';

export class ProgressEmailRendererError extends Error {
  constructor(message, code = 'PROGRESS_EMAIL_RENDERER_INVALID') {
    super(message);
    this.name = 'ProgressEmailRendererError';
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
  if (!normalized) throw new ProgressEmailRendererError(`${field} is required.`);
  return normalized;
}

function requireCanonicalUrl(value, field) {
  const raw = requireString(value, field);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new ProgressEmailRendererError(`${field} must be a valid URL.`, 'INVALID_PROGRESS_EMAIL_URL');
  }
  if (url.origin !== CANONICAL_ORIGIN || url.protocol !== 'https:' || url.username || url.password) {
    throw new ProgressEmailRendererError(
      `${field} must use the canonical USD Impact origin.`,
      'INVALID_PROGRESS_EMAIL_URL',
    );
  }
  return url.toString();
}

function requireNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ProgressEmailRendererError(`${field} must be a non-negative integer.`);
  }
  return value;
}

function validateGrant(grant) {
  if (
    !grant
    || typeof grant !== 'object'
    || grant.status !== 'granted'
    || grant.purpose !== 'learning_progress_updates'
    || typeof grant.id !== 'string'
    || !grant.id
    || !/^consent:v1:[0-9a-f]{64}$/.test(String(grant.idempotency_key ?? ''))
    || typeof grant.email_normalized !== 'string'
    || !grant.email_normalized
  ) {
    throw new ProgressEmailRendererError(
      'An active Learning Progress email consent grant is required.',
      'INVALID_PROGRESS_EMAIL_CONSENT',
    );
  }
  return grant;
}

function validatePayload(payload) {
  if (
    !payload
    || typeof payload !== 'object'
    || payload.messageId !== 'learning_progress_update'
    || payload.consentPurpose !== 'learning_progress_updates'
    || payload.classification !== 'marketing'
    || payload.locale !== 'en'
    || payload.unsubscribeRequired !== true
    || typeof payload.subject !== 'string'
    || !payload.subject.trim()
    || typeof payload.preheader !== 'string'
    || !payload.preheader.trim()
    || !payload.progress
    || !payload.nextStep
    || !Array.isArray(payload.changes)
    || !payload.latestContext?.score
    || !payload.latestContext?.weeklyReport
  ) {
    throw new ProgressEmailRendererError(
      'Learning Progress email payload is outside the approved contract.',
      'INVALID_PROGRESS_EMAIL_PAYLOAD',
    );
  }
  return payload;
}

function renderChangeText(change, index) {
  const title = requireString(change.title, `changes[${index}].title`);
  const url = requireCanonicalUrl(change.url, `changes[${index}].url`);
  return `${index + 1}. ${title}\n${url}`;
}

function renderChangeHtml(change, index) {
  const title = escapeHtml(requireString(change.title, `changes[${index}].title`));
  const url = escapeHtml(requireCanonicalUrl(change.url, `changes[${index}].url`));
  return `<tr><td style="padding:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#4f5b68;">${index + 1}. <a href="${url}" style="color:#071a33;text-decoration:underline;font-weight:700;">${title}</a></td></tr>`;
}

export function buildProgressEmail({
  payload,
  consentGrant,
  unsubscribeSecret,
  baseUrl = CANONICAL_ORIGIN,
} = {}) {
  const data = validatePayload(payload);
  const grant = validateGrant(consentGrant);
  if (grant.email_normalized !== String(grant.email_normalized).trim().toLowerCase()) {
    throw new ProgressEmailRendererError(
      'Learning Progress consent recipient must be normalized.',
      'INVALID_PROGRESS_EMAIL_CONSENT',
    );
  }

  const nextTitle = requireString(data.nextStep.title, 'nextStep.title');
  const nextDescription = requireString(data.nextStep.description, 'nextStep.description');
  const nextLabel = requireString(data.nextStep.ctaLabel, 'nextStep.ctaLabel');
  const nextUrl = requireCanonicalUrl(data.nextStep.url, 'nextStep.url');
  const scoreValue = requireString(data.latestContext.score.displayValue, 'latestContext.score.displayValue');
  const scoreRegime = requireString(data.latestContext.score.regime, 'latestContext.score.regime');
  const scoreNote = requireString(data.latestContext.score.note, 'latestContext.score.note');
  if (!scoreNote.toLowerCase().includes('not a forecast or trading signal')) {
    throw new ProgressEmailRendererError(
      'Weekly Score context must preserve the educational non-signal disclosure.',
      'INVALID_PROGRESS_EMAIL_SCORE_NOTE',
    );
  }
  const weeklyLabel = requireString(data.latestContext.weeklyReport.label, 'latestContext.weeklyReport.label');
  const weeklyUrl = requireCanonicalUrl(data.latestContext.weeklyReport.url, 'latestContext.weeklyReport.url');
  const activityCount = requireNonNegativeInteger(data.progress.activityCount, 'progress.activityCount');
  const completedCount = requireNonNegativeInteger(data.progress.completedCount, 'progress.completedCount');
  const inProgressCount = requireNonNegativeInteger(data.progress.inProgressCount, 'progress.inProgressCount');
  const complianceNote = requireString(data.complianceNote, 'complianceNote');

  const unsubscribeHeaders = createMarketingEmailUnsubscribeHeaders({
    grant: {
      idempotency_key: grant.idempotency_key,
      purpose: 'learning_progress_updates',
    },
    secret: unsubscribeSecret,
    baseUrl,
  });
  const unsubscribeUrl = unsubscribeHeaders['List-Unsubscribe'].slice(1, -1);
  const progressLine = activityCount > 0
    ? `Saved learning progress: ${completedCount} completed · ${inProgressCount} in progress.`
    : 'Your next learning step is ready when you want to continue.';
  const changeLines = data.changes.length > 0
    ? ['NEW SINCE YOUR LAST VISIT', ...data.changes.flatMap((change, index) => [renderChangeText(change, index), ''])]
    : [];

  const text = [
    'USD IMPACT LEARNING PROGRESS',
    '',
    progressLine,
    '',
    'YOUR NEXT STEP',
    nextTitle,
    nextDescription,
    `${nextLabel}: ${nextUrl}`,
    '',
    ...changeLines,
    'LATEST WEEKLY CONTEXT',
    `USD Impact Weekly Score: ${scoreValue}`,
    `Regime: ${scoreRegime}`,
    scoreNote,
    `${weeklyLabel}: ${weeklyUrl}`,
    '',
    complianceNote,
    '',
    'You are receiving this because you explicitly confirmed USD Impact learning progress updates.',
    `Unsubscribe from this email purpose: ${unsubscribeUrl}`,
    '',
    'USD Impact · KELA LEADS S.R.L.',
    'support@usd-impact.com',
  ].join('\n');

  const changesHtml = data.changes.length > 0
    ? `<tr><td style="padding:0 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#8a6b32;font-weight:700;letter-spacing:1px;">NEW SINCE YOUR LAST VISIT</td></tr><tr><td style="padding:0 28px 14px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">${data.changes.map(renderChangeHtml).join('')}</table></td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(data.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f6f8;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(data.preheader)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;background-color:#f5f6f8;">
    <tr><td align="center" style="padding:28px 14px;">
      <!--[if mso]><table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td><![endif]-->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
        <tr><td bgcolor="#071a33" style="padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#ffffff;font-weight:700;letter-spacing:1px;">USD IMPACT LEARNING PROGRESS</td></tr>
        <tr><td style="padding:32px 28px 10px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:38px;color:#071a33;font-weight:700;">Pick up where you left off</td></tr>
        <tr><td style="padding:0 28px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#4f5b68;">${escapeHtml(progressLine)}</td></tr>
        <tr><td style="padding:0 28px 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#8a6b32;font-weight:700;letter-spacing:1px;">YOUR NEXT STEP</td></tr>
        <tr><td style="padding:0 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:27px;color:#071a33;font-weight:700;">${escapeHtml(nextTitle)}</td></tr>
        <tr><td style="padding:0 28px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#4f5b68;">${escapeHtml(nextDescription)}</td></tr>
        <tr><td style="padding:0 28px 30px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td bgcolor="#071a33" style="border-radius:8px;"><a href="${escapeHtml(nextUrl)}" style="display:inline-block;padding:14px 22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:700;">${escapeHtml(nextLabel)}</a></td></tr></table></td></tr>
        ${changesHtml}
        <tr><td style="padding:2px 28px 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#8a6b32;font-weight:700;letter-spacing:1px;">LATEST WEEKLY CONTEXT</td></tr>
        <tr><td style="padding:0 28px 24px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:#eef1f4;border-collapse:collapse;"><tr><td style="padding:20px;font-family:Arial,Helvetica,sans-serif;"><p style="margin:0 0 5px;font-size:25px;line-height:31px;color:#071a33;font-weight:700;">${escapeHtml(scoreValue)}</p><p style="margin:0 0 10px;font-size:15px;line-height:22px;color:#071a33;font-weight:700;">${escapeHtml(scoreRegime)}</p><p style="margin:0 0 10px;font-size:12px;line-height:19px;color:#66717d;">${escapeHtml(scoreNote)}</p><p style="margin:0;font-size:14px;line-height:21px;"><a href="${escapeHtml(weeklyUrl)}" style="color:#071a33;text-decoration:underline;">${escapeHtml(weeklyLabel)}</a></p></td></tr></table></td></tr>
        <tr><td bgcolor="#eef1f4" style="padding:20px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#5d6874;">${escapeHtml(complianceNote)}<br><br>You are receiving this because you explicitly confirmed USD Impact learning progress updates. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#071a33;text-decoration:underline;">Unsubscribe from this email purpose</a>.<br><br>USD Impact · KELA LEADS S.R.L.<br><a href="mailto:support@usd-impact.com" style="color:#071a33;text-decoration:underline;">support@usd-impact.com</a></td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;

  return Object.freeze({
    to: grant.email_normalized,
    classification: 'marketing',
    purpose: 'learning_progress_updates',
    cohort: requireString(data.cohort, 'cohort'),
    subject: data.subject,
    preheader: data.preheader,
    text,
    html,
    headers: unsubscribeHeaders,
  });
}
