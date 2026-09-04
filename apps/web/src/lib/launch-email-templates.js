import {
  EMAIL_MESSAGE_POLICIES,
  EMAIL_SUPPORT_ADDRESS,
  LAUNCH_CRITICAL_MESSAGE_IDS,
} from './email-operations-policy.js';
import { buildWaitlistConfirmationEmail } from './waitlist-email-template.js';

export const LAUNCH_EMAIL_TEMPLATE_VERSION = '2026-08-20.v1';
export const PURCHASE_ACCESS_READY_EMAIL_TEMPLATE_VERSION = '2026-09-04.v2';
export const LAUNCH_EMAIL_PRODUCT_NAME = 'Read the Dollar First Library Pass';

const SITE_ORIGIN = 'https://www.usd-impact.com';
const URLS = Object.freeze({
  account: `${SITE_ORIGIN}/account/`,
  guidedEdition: `${SITE_ORIGIN}/guided-edition/`,
  audiobook: `${SITE_ORIGIN}/guided-edition/audiobook/`,
  videoLibrary: `${SITE_ORIGIN}/guided-edition/video-library/`,
  product: `${SITE_ORIGIN}/book/read-the-dollar-first/`,
  privacy: `${SITE_ORIGIN}/privacy/`,
  refund: `${SITE_ORIGIN}/refund-policy/`,
  terms: `${SITE_ORIGIN}/terms/`,
});
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const FORBIDDEN_COPY = [
  /\bPaddle\b/i,
  /\bFastSpring\b/i,
  /guaranteed (?:profit|return|outcome)/i,
  /risk[- ]free/i,
  /buy now/i,
  /will pump/i,
];

export function isCanonicalSiteUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.origin === SITE_ORIGIN
      && parsed.protocol === 'https:'
      && parsed.username === ''
      && parsed.password === '';
  } catch {
    return false;
  }
}

export function isSupportMailtoUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'mailto:'
      && parsed.pathname.toLowerCase() === EMAIL_SUPPORT_ADDRESS.toLowerCase()
      && parsed.hash === '';
  } catch {
    return false;
  }
}

export const LAUNCH_EMAIL_TEMPLATE_SPECS = deepFreeze({
  auth_sign_in: {
    classification: 'transactional_security',
    providerManaged: true,
    subject: 'Your secure USD Impact sign-in link',
    purpose: 'Authenticate the requested account session through Supabase Auth.',
    secureActionUrlRequired: true,
  },
  purchase_pending: appTemplate({
    classification: 'transactional_operational',
    subject: 'We are confirming your Library Pass payment',
    heading: 'Payment confirmation is pending.',
    paragraphs: [
      'USD Impact has not granted Library Pass access because a verified completed-payment event has not yet been received.',
      'No action is required unless the authorized payment provider asks you to complete or retry the payment.',
    ],
    ctaLabel: 'Review your account',
    ctaUrl: URLS.account,
    referenceLabel: 'Purchase reference',
  }),
  purchase_access_ready: appTemplate({
    templateVersion: PURCHASE_ACCESS_READY_EMAIL_TEMPLATE_VERSION,
    classification: 'transactional',
    subject: 'Your Read the Dollar First Library Pass is ready',
    heading: 'Your Library Pass is active.',
    paragraphs: [
      'A verified completed-payment event has been matched to your USD Impact account.',
      'Choose one of these first steps now, or return to your Account whenever you are ready.',
    ],
    firstSteps: [
      { label: 'Start with the Guided Edition', url: URLS.guidedEdition },
      { label: 'Listen to the audiobook', url: URLS.audiobook },
      { label: 'Explore the Video Library', url: URLS.videoLibrary },
    ],
    ctaLabel: 'Open your account',
    ctaUrl: URLS.account,
    referenceLabel: 'Purchase reference',
  }),
  purchase_failed: appTemplate({
    classification: 'transactional_operational',
    subject: 'Your Library Pass purchase was not completed',
    heading: 'No Library Pass access was granted.',
    paragraphs: [
      'USD Impact did not receive a verified completed-payment event for this purchase attempt.',
      'Review any notice from the authorized payment provider before retrying. A browser redirect or checkout screen never grants access by itself.',
    ],
    ctaLabel: 'Review your account',
    ctaUrl: URLS.account,
    referenceLabel: 'Purchase reference',
  }),
  refund_approved: appTemplate({
    classification: 'transactional',
    subject: 'Your Library Pass refund was approved',
    heading: 'Your refund was approved.',
    paragraphs: [
      'The Library Pass entitlement tied to the refunded purchase has been removed.',
      'The authorized payment provider controls the timing of funds returning to the original payment method.',
    ],
    ctaLabel: 'Read the refund policy',
    ctaUrl: URLS.refund,
    referenceLabel: 'Refund reference',
  }),
  dispute_warning: appTemplate({
    classification: 'transactional_operational',
    subject: 'Your Library Pass access is temporarily suspended',
    heading: 'A payment dispute is under review.',
    paragraphs: [
      'The authorized payment provider reported a dispute or chargeback review for the purchase tied to this account.',
      'Library Pass access is temporarily suspended while the commercial state is reviewed. Contact support if you believe this is incorrect.',
    ],
    ctaLabel: 'Contact support',
    ctaUrl: `mailto:${EMAIL_SUPPORT_ADDRESS}?subject=Library%20Pass%20dispute%20support`,
    referenceLabel: 'Dispute reference',
  }),
  chargeback_revoked: appTemplate({
    classification: 'transactional',
    subject: 'Your Library Pass access was revoked',
    heading: 'The payment chargeback is complete.',
    paragraphs: [
      'The authorized payment provider reported a completed chargeback or lost dispute for the purchase tied to this account.',
      'The matching Library Pass entitlement has been revoked. Contact support if you have verified evidence that the commercial state is different.',
    ],
    ctaLabel: 'Contact support',
    ctaUrl: `mailto:${EMAIL_SUPPORT_ADDRESS}?subject=Library%20Pass%20chargeback%20support`,
    referenceLabel: 'Chargeback reference',
  }),
  dispute_reversal_restored: appTemplate({
    classification: 'transactional',
    subject: 'Your Library Pass access was restored',
    heading: 'Your Library Pass is active again.',
    paragraphs: [
      'The authorized payment provider reported an eligible dispute reversal and no final blocking state remains.',
      'The matching Library Pass entitlement has been restored.',
    ],
    ctaLabel: 'Open your account',
    ctaUrl: URLS.account,
    referenceLabel: 'Reversal reference',
  }),
  privacy_export_acknowledgement: appTemplate({
    classification: 'transactional_operational',
    subject: 'We received your USD Impact data export request',
    heading: 'Your privacy request is recorded.',
    paragraphs: [
      'USD Impact is preparing the account data covered by your verified request.',
      'No export payload, authentication secret, or private account data is attached to this ordinary email. Any delivery step will use the approved secure process.',
    ],
    ctaLabel: 'Read the privacy notice',
    ctaUrl: URLS.privacy,
    referenceLabel: 'Privacy request reference',
    securePayloadForbidden: true,
  }),
  account_deletion_requested: appTemplate({
    classification: 'transactional_operational',
    subject: 'Your USD Impact account deletion request is being processed',
    heading: 'Your deletion request is recorded.',
    paragraphs: [
      'The account has entered the reviewed deletion process and access may be restricted while required checks complete.',
      'Contact support promptly if you did not request this action.',
    ],
    ctaLabel: 'Contact support',
    ctaUrl: `mailto:${EMAIL_SUPPORT_ADDRESS}?subject=Account%20deletion%20support`,
    referenceLabel: 'Deletion request reference',
  }),
  account_deletion_completed: appTemplate({
    classification: 'transactional_operational',
    subject: 'Your USD Impact account deletion is complete',
    heading: 'The account deletion process is complete.',
    paragraphs: [
      'Access associated with the deleted account has ended.',
      'Any limited record retained under an approved legal, accounting, fraud, dispute, or privacy hold remains access-controlled and is reviewed under the recorded retention policy.',
    ],
    ctaLabel: 'Read the privacy notice',
    ctaUrl: URLS.privacy,
    referenceLabel: 'Deletion request reference',
  }),
  support_case_received: appTemplate({
    classification: 'operational',
    subject: 'We received your USD Impact support request',
    heading: 'Your support request is recorded.',
    paragraphs: [
      'USD Impact support will review the request under the launch support procedure.',
      'You may reply with relevant context, but do not send passwords, complete authentication links, card data, or provider secrets.',
    ],
    ctaLabel: 'Review your account',
    ctaUrl: URLS.account,
    referenceLabel: 'Support case reference',
  }),
  waitlist_confirmation: {
    classification: 'operational',
    delegated: true,
    requiresUnsubscribe: true,
    subject: "You're on the Read the Dollar First waitlist",
  },
  book_availability: appTemplate({
    classification: 'marketing',
    subject: 'Read the Dollar First is available',
    heading: 'The Library Pass is available.',
    paragraphs: [
      'You asked to receive the purchase link and essential availability updates for Read the Dollar First.',
      'Review the official product page for the current price, launch conditions, included learning features, policies, and payment-provider identification before entering payment details.',
    ],
    ctaLabel: 'Review the Library Pass',
    ctaUrl: URLS.product,
    referenceLabel: 'Availability notice reference',
    requiresUnsubscribe: true,
  }),
});

export function getLaunchEmailTemplateSpec(messageId) {
  const spec = LAUNCH_EMAIL_TEMPLATE_SPECS[messageId];
  if (!spec) throw new TypeError(`Unknown launch email template: ${messageId}`);
  return spec;
}

export function getLaunchEmailTemplateVersion(messageId) {
  return getLaunchEmailTemplateSpec(messageId).templateVersion || LAUNCH_EMAIL_TEMPLATE_VERSION;
}

export function renderLaunchEmail({ messageId, reference = null, unsubscribeUrl = null }) {
  const spec = getLaunchEmailTemplateSpec(messageId);
  if (spec.providerManaged) {
    throw new TypeError(`${messageId} is provider-managed and must be verified through its provider configuration.`);
  }
  if (spec.delegated) {
    return Object.freeze({
      ...buildWaitlistConfirmationEmail({ unsubscribeUrl: requireUnsubscribeUrl(unsubscribeUrl) }),
      classification: spec.classification,
      templateVersion: getLaunchEmailTemplateVersion(messageId),
    });
  }

  const normalizedReference = spec.referenceLabel
    ? normalizeReference(reference)
    : null;
  const normalizedUnsubscribeUrl = spec.requiresUnsubscribe
    ? requireUnsubscribeUrl(unsubscribeUrl)
    : null;
  const policy = EMAIL_MESSAGE_POLICIES[messageId];
  const referenceLine = normalizedReference ? `${spec.referenceLabel}: ${normalizedReference}` : null;
  const consentLines = spec.requiresUnsubscribe
    ? [
        'You are receiving this message because you requested Read the Dollar First availability updates.',
        `Unsubscribe from book availability email: ${normalizedUnsubscribeUrl}`,
      ]
    : [];
  const firstStepLines = spec.firstSteps?.length
    ? [
        '',
        'Three ways to begin:',
        ...spec.firstSteps.map((step, index) => `${index + 1}. ${step.label}: ${step.url}`),
      ]
    : [];
  const text = [
    'USD Impact',
    '',
    spec.heading,
    '',
    ...spec.paragraphs,
    ...firstStepLines,
    ...(referenceLine ? ['', referenceLine] : []),
    '',
    `${spec.ctaLabel}: ${spec.ctaUrl}`,
    `Support: ${EMAIL_SUPPORT_ADDRESS}`,
    `Privacy notice: ${URLS.privacy}`,
    ...consentLines,
    '',
    'This message concerns USD Impact product, account, support, privacy, or availability operations. It is not investment, legal, tax, trading, or financial advice.',
  ].join('\n');
  const html = buildHtml({
    spec,
    referenceLine,
    unsubscribeUrl: normalizedUnsubscribeUrl,
  });
  const headers = normalizedUnsubscribeUrl
    ? Object.freeze({
        'List-Unsubscribe': `<${normalizedUnsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      })
    : null;

  return Object.freeze({
    subject: spec.subject,
    text,
    html,
    classification: policy.classification,
    templateVersion: getLaunchEmailTemplateVersion(messageId),
    ...(headers ? { headers } : {}),
  });
}

export function validateLaunchEmailTemplateRegistry() {
  const configured = Object.keys(LAUNCH_EMAIL_TEMPLATE_SPECS).sort();
  const required = [...LAUNCH_CRITICAL_MESSAGE_IDS].sort();
  if (JSON.stringify(configured) !== JSON.stringify(required)) {
    throw new Error('Launch email template coverage is incomplete or contains an unapproved entry.');
  }

  for (const [messageId, spec] of Object.entries(LAUNCH_EMAIL_TEMPLATE_SPECS)) {
    const policy = EMAIL_MESSAGE_POLICIES[messageId];
    if (!policy) throw new Error(`${messageId} has no email operations policy.`);
    if (spec.classification !== policy.classification) {
      throw new Error(`${messageId} classification does not match the email operations policy.`);
    }
    if (spec.providerManaged && messageId !== 'auth_sign_in') {
      throw new Error(`${messageId} is not approved as a provider-managed template.`);
    }
    if (spec.delegated && messageId !== 'waitlist_confirmation') {
      throw new Error(`${messageId} is not approved as a delegated template.`);
    }
    if (policy.unsubscribeRequired !== Boolean(spec.requiresUnsubscribe)) {
      throw new Error(`${messageId} unsubscribe behavior does not match policy.`);
    }
    if (!spec.providerManaged && !spec.delegated) {
      for (const field of ['subject', 'heading', 'paragraphs', 'ctaLabel', 'ctaUrl']) {
        if (!spec[field] || (Array.isArray(spec[field]) && spec[field].length === 0)) {
          throw new Error(`${messageId}.${field} is required.`);
        }
      }
      const copy = [spec.subject, spec.heading, ...spec.paragraphs].join(' ');
      for (const pattern of FORBIDDEN_COPY) {
        if (pattern.test(copy)) throw new Error(`${messageId} contains prohibited or provider-specific copy.`);
      }
      if (!isCanonicalSiteUrl(spec.ctaUrl) && !isSupportMailtoUrl(spec.ctaUrl)) {
        throw new Error(`${messageId} CTA must use the canonical site or support address.`);
      }
      for (const step of spec.firstSteps || []) {
        if (!step?.label || !isCanonicalSiteUrl(step.url)) {
          throw new Error(`${messageId} first-step links must use a label and canonical site URL.`);
        }
      }
    }
  }
  return true;
}

function appTemplate({
  classification,
  subject,
  heading,
  paragraphs,
  ctaLabel,
  ctaUrl,
  referenceLabel,
  requiresUnsubscribe = false,
  securePayloadForbidden = false,
  templateVersion = LAUNCH_EMAIL_TEMPLATE_VERSION,
  firstSteps = [],
}) {
  return {
    classification,
    providerManaged: false,
    delegated: false,
    subject,
    heading,
    paragraphs,
    ctaLabel,
    ctaUrl,
    referenceLabel,
    requiresUnsubscribe,
    securePayloadForbidden,
    templateVersion,
    firstSteps,
  };
}

function normalizeReference(value) {
  if (typeof value !== 'string' || !REFERENCE_PATTERN.test(value)) {
    throw new TypeError('reference must be a bounded opaque identifier.');
  }
  return value;
}

function requireUnsubscribeUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? ''));
  } catch {
    throw new TypeError('unsubscribeUrl must be a valid absolute URL.');
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new TypeError('unsubscribeUrl must use HTTPS outside localhost.');
  }
  if (url.username || url.password || url.hash || url.pathname !== '/unsubscribe') {
    throw new TypeError('unsubscribeUrl must use the approved /unsubscribe route without credentials or a fragment.');
  }
  const keys = [...new Set(url.searchParams.keys())];
  if (keys.length !== 1 || keys[0] !== 'token' || !url.searchParams.get('token')) {
    throw new TypeError('unsubscribeUrl must contain only a non-empty token query parameter.');
  }
  return url.toString();
}

function buildHtml({ spec, referenceLine, unsubscribeUrl }) {
  const paragraphs = spec.paragraphs
    .map((paragraph) => `<p style="margin:0 0 14px; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:25px; color:#161A1F;">${escapeHtml(paragraph)}</p>`)
    .join('');
  const reference = referenceLine
    ? `<p style="margin:22px 0 0; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:20px; color:#5A6472;">${escapeHtml(referenceLine)}</p>`
    : '';
  const firstSteps = spec.firstSteps?.length
    ? `<div style="margin:22px 0 0; padding:18px; border:1px solid #D9DEE5; background:#F8FAFC;">
        <p style="margin:0 0 10px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:20px; color:#071A33; font-weight:700;">Three ways to begin</p>
        <ol style="margin:0; padding-left:22px; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:25px; color:#161A1F;">
          ${spec.firstSteps.map((step) => `<li><a href="${escapeHtmlAttribute(step.url)}" style="color:#071A33; text-decoration:underline;">${escapeHtml(step.label)}</a></li>`).join('')}
        </ol>
      </div>`
    : '';
  const consent = unsubscribeUrl
    ? `<p style="margin:12px 0 0; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:20px; color:#5A6472;">You requested Read the Dollar First availability updates. <a href="${escapeHtmlAttribute(unsubscribeUrl)}" style="color:#071A33; text-decoration:underline;">Unsubscribe from book availability email</a>.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(spec.subject)}</title>
</head>
<body style="margin:0; padding:0; width:100%; background-color:#F3F5F7;">
  <span style="display:none; max-height:0; max-width:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(spec.heading)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; background-color:#F3F5F7;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; border-collapse:separate; border-spacing:0; background-color:#FFFFFF; border:1px solid #E6E9ED;">
          <tr>
            <td bgcolor="#071A33" style="background-color:#071A33; padding:24px 28px;">
              <p style="margin:0 0 8px; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:18px; letter-spacing:2px; text-transform:uppercase; color:#C9A35B; font-weight:700;">USD Impact</p>
              <p style="margin:0; font-family:Georgia, 'Times New Roman', serif; font-size:22px; line-height:29px; color:#FFFFFF;">How the Dollar Moves Global Markets.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 28px;">
              <h1 style="margin:0 0 18px; font-family:Georgia, 'Times New Roman', serif; font-size:30px; line-height:38px; color:#071A33;">${escapeHtml(spec.heading)}</h1>
              ${paragraphs}
              ${firstSteps}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate; margin-top:24px;">
                <tr><td bgcolor="#071A33" style="background-color:#071A33;"><a href="${escapeHtmlAttribute(spec.ctaUrl)}" style="display:inline-block; padding:13px 20px; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:20px; color:#FFFFFF; font-weight:700; text-decoration:none;">${escapeHtml(spec.ctaLabel)}</a></td></tr>
              </table>
              ${reference}
              <p style="margin:22px 0 0; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:20px; color:#5A6472;">For help, email <a href="mailto:${EMAIL_SUPPORT_ADDRESS}" style="color:#071A33; text-decoration:underline;">${EMAIL_SUPPORT_ADDRESS}</a>. Read the <a href="${URLS.privacy}" style="color:#071A33; text-decoration:underline;">privacy notice</a>, <a href="${URLS.terms}" style="color:#071A33; text-decoration:underline;">terms</a>, and <a href="${URLS.refund}" style="color:#071A33; text-decoration:underline;">refund policy</a>.</p>
              ${consent}
              <p style="margin:18px 0 0; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:19px; color:#5A6472;">This message concerns USD Impact product, account, support, privacy, or availability operations. It is not investment, legal, tax, trading, or financial advice.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

validateLaunchEmailTemplateRegistry();
