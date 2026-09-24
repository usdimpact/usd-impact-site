import { timingSafeEqual } from 'node:crypto';

// Temporary #631 telemetry. No new endpoint, secret export, or auth bypass.
// Remove this module after diagnosis; the cutoff independently stops emission.
export const CRON_DIAGNOSTICS_EXPIRES_AT = Date.parse('2026-09-28T00:00:00.000Z');
const MIN_INTERVAL_MS = 5 * 60 * 1000;
const MAX_RECORDS_PER_INSTANCE = 8;
const MAX_INSPECTED_CHARACTERS = 4096;

function equalBytes(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function headerKind(value) {
  if (value == null) return 'missing';
  if (typeof value === 'string') return 'string';
  return Array.isArray(value) ? 'array' : 'other';
}

// Only an emission filter: this hint is spoofable and NEVER grants access.
function cronUserAgentHint(headers) {
  const direct = headers?.['user-agent'] || headers?.['User-Agent'];
  const value = direct || (typeof headers?.get === 'function' ? headers.get('user-agent') : null);
  return value === 'vercel-cron/1.0';
}

function diagnosticFacts({ request, secret, header, authorized }) {
  const headers = request?.headers;
  const rawHeader = headers?.authorization || headers?.Authorization;
  const getAvailable = typeof headers?.get === 'function';
  const alternateHeader = getAvailable ? headers.get('authorization') : null;
  const base = {
    event: 'usd_impact_cron_auth_diagnostic_v1',
    authorized,
    authorization_header_kind: headerKind(rawHeader),
    headers_get_available: getAvailable,
    headers_get_authorization_present: typeof alternateHeader === 'string' && alternateHeader.length > 0,
  };
  if (secret.length > MAX_INSPECTED_CHARACTERS || header.length > MAX_INSPECTED_CHARACTERS) {
    return { ...base, reason: 'diagnostic_input_oversize' };
  }
  const bearer = header.startsWith('Bearer ');
  const token = bearer ? header.slice(7) : null;
  const lengthEqual = token !== null && Buffer.byteLength(token) === Buffer.byteLength(secret);
  const reason = authorized ? 'authorized'
    : !secret ? 'secret_missing'
      : secret.length < 32 ? 'secret_below_minimum'
        : !header ? 'header_missing'
          : !bearer ? 'bearer_prefix_invalid'
            : !lengthEqual ? 'byte_length_mismatch' : 'value_mismatch';
  return {
    ...base,
    reason,
    secret_minimum_length_met: secret.length >= 32,
    header_present: header.length > 0,
    bearer_prefix_valid: bearer,
    token_byte_length_equal: lengthEqual,
    secret_edge_whitespace: secret !== secret.trim(),
    token_edge_whitespace: token === null ? null : token !== token.trim(),
    secret_control_character: /[\x00-\x1f\x7f]/.test(secret),
    token_control_character: token === null ? null : /[\x00-\x1f\x7f]/.test(token),
    secret_non_ascii: /[^\x00-\x7f]/.test(secret),
    token_non_ascii: token === null ? null : /[^\x00-\x7f]/.test(token),
    // Diagnostic only. The authorization decision NEVER accepts a trimmed token.
    edge_trimmed_equal: token === null || !secret.trim() ? null : equalBytes(token.trim(), secret.trim()),
  };
}

export function createCronAuthorizationDiagnosticReporter({
  now = () => Date.now(),
  write = (record) => console.warn(JSON.stringify(record)),
} = {}) {
  // Per-process bound, NOT a global rate limit or proof of scheduler identity.
  let count = 0;
  let lastAt = null;
  return function report(args) {
    try {
      if (args?.environment?.VERCEL_ENV !== 'production'
          || typeof args.secret !== 'string' || typeof args.header !== 'string'
          || typeof args.authorized !== 'boolean') return;
      const at = now();
      if (!Number.isFinite(at) || at < 0 || at >= CRON_DIAGNOSTICS_EXPIRES_AT
          || count >= MAX_RECORDS_PER_INSTANCE
          || (lastAt !== null && at - lastAt < MIN_INTERVAL_MS)
          || !cronUserAgentHint(args.request?.headers)) return;
      // Reserve before inspection/output; diagnostic failures cannot spam logs.
      count += 1;
      lastAt = at;
      const facts = diagnosticFacts(args);
      // No values, fragments, hashes, exact lengths, URLs, cookies, or identity.
      write(Object.freeze({ ...facts, observed_at: new Date(at).toISOString() }));
    } catch {
      // A diagnostic failure must not change the already-computed auth decision.
    }
  };
}

export const recordCronAuthorizationDiagnostic = createCronAuthorizationDiagnosticReporter();
