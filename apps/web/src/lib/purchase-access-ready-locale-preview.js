import { renderLaunchEmail } from './launch-email-templates.js';

// REVIEW-ONLY locale drafts. Nothing in the checkout, webhook or Resend adapter
// imports this module. Do not enable sending until a verified account-level
// language preference is persisted and snapshotted into immutable outbox state.
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const ACCOUNT_URL = 'https://www.usd-impact.com/account/';
const PRIVACY_URL = 'https://www.usd-impact.com/privacy/';
const TERMS_URL = 'https://www.usd-impact.com/terms/';
const REFUND_URL = 'https://www.usd-impact.com/refund-policy/';
const SUPPORT_ADDRESS = 'support@usd-impact.com';
export const ACCESS_READY_SUPPORTED_DRAFT_LOCALES = Object.freeze(['en', 'es']);
export const ACCESS_READY_SPANISH_DRAFT_VERSION = '2026-10-30.es.review-only';

function previewError(message, code) {
  const error = new TypeError(message);
  error.code = code;
  return error;
}

export function resolveVerifiedAccessReadyLocale({ locale = null, source = null } = {}) {
  if (locale == null && source == null) {
    return Object.freeze({ state: 'fallback', locale: 'en', reason: 'no_verified_preference' });
  }
  if (source !== 'verified_account') {
    throw previewError('Purchase email locale must come from a verified account preference, not a Resend marketing segment.', 'UNTRUSTED_PURCHASE_LOCALE_SOURCE');
  }
  if (locale == null || locale === '') {
    return Object.freeze({ state: 'fallback', locale: 'en', reason: 'no_verified_preference' });
  }
  if (typeof locale !== 'string' || locale.length > 16) {
    throw previewError('Purchase email locale is invalid.', 'INVALID_PURCHASE_LOCALE');
  }
  const normalized = locale.trim().toLowerCase();
  if (/^pt(?:-[a-z]{2}|-[0-9]{3})?$/.test(normalized)) {
    return Object.freeze({ state: 'hold', locale: null, reason: 'portuguese_publication_hold' });
  }
  if (/^es(?:-[a-z]{2}|-[0-9]{3})?$/.test(normalized)) {
    return Object.freeze({ state: 'ready', locale: 'es', reason: 'verified_account' });
  }
  if (/^en(?:-[a-z]{2}|-[0-9]{3})?$/.test(normalized)) {
    return Object.freeze({ state: 'ready', locale: 'en', reason: 'verified_account' });
  }
  throw previewError('Purchase email locale is not approved.', 'UNSUPPORTED_PURCHASE_LOCALE');
}

export function renderPurchaseAccessReadyLocalePreview({
  reference,
  locale = null,
  source = null,
} = {}) {
  if (typeof reference !== 'string' || !REFERENCE_PATTERN.test(reference)) {
    throw previewError('Only an opaque bounded purchase reference may appear in the draft.', 'INVALID_PURCHASE_REFERENCE');
  }
  const routing = resolveVerifiedAccessReadyLocale({ locale, source });
  if (routing.state === 'hold') {
    return Object.freeze({
      previewOnly: true, canDispatch: false, state: 'hold',
      locale: null, reason: routing.reason,
    });
  }

  if (routing.locale === 'en') {
    const original = renderLaunchEmail({ messageId: 'purchase_access_ready', reference });
    return Object.freeze({
      ...original, previewOnly: true, canDispatch: false,
      locale: 'en', routingState: routing.state,
    });
  }

  const subject = 'Tu Library Pass ya está activo | USD Impact';
  const heading = 'Tu acceso al Library Pass está listo.';
  const lines = [
    'USD Impact',
    '',
    heading,
    '',
    'Hemos verificado el pago completado y el acceso asociado a tu cuenta.',
    'Abre tu cuenta para acceder a la edición guiada, al audiolibro y a la videoteca incluidos en tu Library Pass.',
    'Algunos materiales están disponibles actualmente en inglés.',
    '',
    'Referencia de compra: ' + reference,
    '',
    'Abrir mi cuenta: ' + ACCOUNT_URL,
    'Soporte: ' + SUPPORT_ADDRESS,
    'Privacidad: ' + PRIVACY_URL,
    'Términos: ' + TERMS_URL,
    'Política de reembolso: ' + REFUND_URL,
    '',
    'El recibo de pago lo gestiona el proveedor de pagos por separado.',
    'Este correo es una confirmación de acceso, no una suscripción a boletines ni asesoramiento de inversión.',
  ];
  // The identifier is constrained to ASCII and safe punctuation. Escape it
  // independently before including it in markup as defense in depth.
  const safeRef = reference.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const html = [
    '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>' + subject + '</title></head>',
    '<body style="font-family:Arial,sans-serif;background:#f3f5f7;color:#161a1f;margin:0;padding:24px">',
    '<main style="max-width:600px;margin:auto;padding:28px;background:#fff">',
    '<p style="color:#071a33;font-weight:bold">USD Impact</p>',
    '<h1 style="font-size:24px">' + heading + '</h1>',
    '<p>Hemos verificado el pago completado y el acceso asociado a tu cuenta.</p>',
    '<p>Abre tu cuenta para acceder a la edición guiada, al audiolibro y a la videoteca incluidos en tu Library Pass.</p>',
    '<p>Algunos materiales están disponibles actualmente en inglés.</p>',
    '<p><a href="' + ACCOUNT_URL + '">Abrir mi cuenta</a></p>',
    '<p>Referencia de compra: ' + safeRef + '</p>',
    '<p>Soporte: ' + SUPPORT_ADDRESS + '</p>',
    '<p><a href="' + PRIVACY_URL + '">Privacidad</a> · ',
    '<a href="' + TERMS_URL + '">Términos</a> · ',
    '<a href="' + REFUND_URL + '">Política de reembolso</a></p>',
    '<p>El recibo de pago lo gestiona el proveedor de pagos por separado.</p>',
    '<p>Este correo es una confirmación de acceso, no una suscripción a boletines ni asesoramiento de inversión.</p>',
    '</main></body></html>',
  ].join('');

  return Object.freeze({
    previewOnly: true,
    canDispatch: false,
    locale: 'es',
    routingState: routing.state,
    classification: 'transactional',
    templateVersion: ACCESS_READY_SPANISH_DRAFT_VERSION,
    subject,
    text: lines.join('\n'),
    html,
  });
}
