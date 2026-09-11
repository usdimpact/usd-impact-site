const DEVELOPMENT_SUPABASE_URL = 'https://ycstrcvshdluovtuasjc.supabase.co';
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const API_KEY_PATTERN = /^re_[A-Za-z0-9._-]{16,}$/;
const MARKETING_SECRET_PATTERN = /^moi_[A-Za-z0-9_-]{43,}$/;
const SUPABASE_PUBLISHABLE_PATTERN = /^sb_publishable_[A-Za-z0-9._-]{16,}$/;
const SUPABASE_SECRET_PATTERN = /^sb_secret_[A-Za-z0-9._-]{16,}$/;

const REQUIRED_TRUE_FLAGS = Object.freeze([
  'EMAIL_READINESS_LEDGER_ENABLED',
  'EMAIL_OPT_IN_REQUEST_ENABLED',
  'EMAIL_OPT_IN_DELIVERY_ENABLED',
  'WEEKLY_NEWSLETTER_DISPATCH_ENABLED',
  'WEEKLY_NEWSLETTER_DELIVERY_ENABLED',
  'WEEKLY_NEWSLETTER_QA_BATCH_ENABLED',
  'PROGRESS_EMAIL_READINESS_ENABLED',
  'PROGRESS_EMAIL_DISPATCH_ENABLED',
  'PROGRESS_EMAIL_DELIVERY_ENABLED',
  'PROGRESS_EMAIL_QA_BATCH_ENABLED',
]);

export class NewsletterPreviewReadinessError extends Error {
  constructor(message, code = 'NEWSLETTER_PREVIEW_READINESS_INVALID') {
    super(message);
    this.name = 'NewsletterPreviewReadinessError';
    this.code = code;
  }
}

function check(key, ok, reason) {
  return Object.freeze({ key, ok: ok === true, reason: ok === true ? null : reason });
}

function parseMailbox(value) {
  const sender = String(value ?? '').trim();
  if (!sender || /[\r\n]/.test(sender)) return null;
  const bracketed = sender.match(/<([^<>]+)>$/);
  const mailbox = (bracketed ? bracketed[1] : sender).trim().toLowerCase();
  return EMAIL_PATTERN.test(mailbox) ? mailbox : null;
}

function parseEmailSet(value) {
  const raw = String(value ?? '');
  const entries = raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (entries.length === 0 || entries.some((email) => email.length > 320 || !EMAIL_PATTERN.test(email))) {
    return null;
  }
  return new Set(entries);
}

function expectedPreviewOrigin(environment) {
  const hostname = String(environment.VERCEL_URL ?? '').trim().toLowerCase();
  if (!hostname || hostname.includes('/') || !hostname.endsWith('.vercel.app')) return null;
  return `https://${hostname}`;
}

function originMatches(value, expected) {
  if (!expected) return false;
  try {
    const parsed = new URL(String(value ?? '').trim());
    return !parsed.username && !parsed.password && parsed.origin === expected;
  } catch {
    return false;
  }
}

function commonQaCount(sets) {
  if (sets.some((set) => !(set instanceof Set) || set.size === 0)) return 0;
  const [first, ...rest] = sets;
  let count = 0;
  for (const email of first) {
    if (rest.every((set) => set.has(email))) count += 1;
  }
  return count;
}

export function inspectNewsletterPreviewReadiness(environment = process.env) {
  const checks = [];
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim().toLowerCase();
  checks.push(check(
    'VERCEL_ENV',
    vercelEnvironment === 'preview',
    'Must be the Vercel Preview environment.',
  ));

  const previewOrigin = expectedPreviewOrigin(environment);
  checks.push(check(
    'VERCEL_URL',
    Boolean(previewOrigin),
    'Must identify the active .vercel.app Preview deployment.',
  ));
  const bypassSecret = String(environment.VERCEL_AUTOMATION_BYPASS_SECRET ?? '').trim();
  checks.push(check(
    'VERCEL_AUTOMATION_BYPASS_SECRET',
    bypassSecret.length >= 16 && !/[\r\n]/.test(bypassSecret),
    'Must provide the Vercel Deployment Protection automation bypass for protected Preview artifact access.',
  ));

  checks.push(check(
    'SUPABASE_URL',
    String(environment.SUPABASE_URL ?? '').trim() === DEVELOPMENT_SUPABASE_URL,
    'Must target canonical USD Impact Development Supabase.',
  ));
  checks.push(check(
    'SUPABASE_PUBLISHABLE_KEY',
    SUPABASE_PUBLISHABLE_PATTERN.test(String(environment.SUPABASE_PUBLISHABLE_KEY ?? '')),
    'Must contain a valid server-configured Development publishable key.',
  ));
  checks.push(check(
    'SUPABASE_SECRET_KEY',
    SUPABASE_SECRET_PATTERN.test(String(environment.SUPABASE_SECRET_KEY ?? '')),
    'Must contain a valid server-only Development secret key.',
  ));

  for (const key of REQUIRED_TRUE_FLAGS) {
    checks.push(check(key, environment[key] === 'true', 'Must be explicitly true for controlled Preview QA.'));
  }

  checks.push(check(
    'MARKETING_OPT_IN_SECRET',
    MARKETING_SECRET_PATTERN.test(String(environment.MARKETING_OPT_IN_SECRET ?? '')),
    'Must contain the purpose-specific opt-in/unsubscribe signing secret.',
  ));
  checks.push(check(
    'RESEND_API_KEY',
    API_KEY_PATTERN.test(String(environment.RESEND_API_KEY ?? '')),
    'Must contain a valid Resend API key.',
  ));

  const sender = parseMailbox(environment.RESEND_FROM_EMAIL);
  checks.push(check(
    'RESEND_FROM_EMAIL',
    Boolean(sender && sender.endsWith('@updates.usd-impact.com')),
    'Must use the verified updates.usd-impact.com sending domain.',
  ));
  const replyToRaw = String(environment.RESEND_REPLY_TO ?? '').trim();
  checks.push(check(
    'RESEND_REPLY_TO',
    replyToRaw === '' || Boolean(parseMailbox(replyToRaw)),
    'If present, must be a valid reply-to address.',
  ));
  checks.push(check(
    'CRON_SECRET',
    String(environment.CRON_SECRET ?? '').length >= 32,
    'Must contain at least 32 characters for protected QA handler authorization.',
  ));

  const optInQa = parseEmailSet(environment.EMAIL_OPT_IN_QA_RECIPIENTS);
  const weeklyQa = parseEmailSet(environment.WEEKLY_NEWSLETTER_QA_RECIPIENTS);
  const progressQa = parseEmailSet(environment.PROGRESS_EMAIL_QA_RECIPIENTS);
  checks.push(check(
    'EMAIL_OPT_IN_QA_RECIPIENTS',
    Boolean(optInQa),
    'Must contain at least one valid QA email address.',
  ));
  checks.push(check(
    'WEEKLY_NEWSLETTER_QA_RECIPIENTS',
    Boolean(weeklyQa),
    'Must contain at least one valid QA email address.',
  ));
  checks.push(check(
    'PROGRESS_EMAIL_QA_RECIPIENTS',
    Boolean(progressQa),
    'Must contain at least one valid QA email address.',
  ));
  const sharedQaCount = commonQaCount([optInQa, weeklyQa, progressQa]);
  checks.push(check(
    'QA_RECIPIENT_INTERSECTION',
    sharedQaCount > 0,
    'At least one QA address must be shared across opt-in, Weekly, and Progress allowlists.',
  ));

  for (const key of ['WEEKLY_NEWSLETTER_QA_BATCH_LIMIT', 'PROGRESS_EMAIL_QA_BATCH_LIMIT']) {
    const raw = String(environment[key] ?? '').trim();
    checks.push(check(
      key,
      raw === '' || raw === '1',
      'Initial controlled QA must use the default/explicit single-recipient batch size.',
    ));
  }

  checks.push(check(
    'WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL',
    originMatches(environment.WEEKLY_NEWSLETTER_ARTIFACT_BASE_URL, previewOrigin),
    'Must equal the exact active Preview origin derived from VERCEL_URL.',
  ));
  checks.push(check(
    'WEEKLY_NEWSLETTER_PUBLIC_BASE_URL',
    originMatches(environment.WEEKLY_NEWSLETTER_PUBLIC_BASE_URL, previewOrigin),
    'Must equal the exact active Preview origin derived from VERCEL_URL.',
  ));
  checks.push(check(
    'PROGRESS_EMAIL_BASE_URL',
    originMatches(environment.PROGRESS_EMAIL_BASE_URL, previewOrigin),
    'Must equal the exact active Preview origin derived from VERCEL_URL.',
  ));

  const failures = checks.filter((item) => !item.ok);
  return Object.freeze({
    ready: failures.length === 0,
    environment: vercelEnvironment || 'unknown',
    checked: checks.length,
    passed: checks.length - failures.length,
    failed: failures.length,
    sharedQaRecipients: sharedQaCount,
    checks: Object.freeze(checks),
  });
}

export function requireNewsletterPreviewReadiness(environment = process.env) {
  const report = inspectNewsletterPreviewReadiness(environment);
  if (!report.ready) {
    const missing = report.checks.filter((item) => !item.ok).map((item) => item.key);
    const error = new NewsletterPreviewReadinessError(
      `Newsletter Preview QA is not ready: ${missing.join(', ')}.`,
      'NEWSLETTER_PREVIEW_NOT_READY',
    );
    error.report = report;
    throw error;
  }
  return report;
}
