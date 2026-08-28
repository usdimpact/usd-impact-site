const MAX_PUBLIC_TEXT_LENGTH = 1_000;

export const COMMERCE_PUBLIC_DISCLOSURE_VERSION = 1;

export const COMMERCE_PUBLIC_IDENTITY = Object.freeze({
  brand: 'USD Impact',
  legalName: 'KELA LEADS S.R.L.',
  jurisdiction: 'Romania',
  registration: 'CUI 40790448 · Trade Register J38/820/2020 · EUID ROONRC.J38/820/2020',
  supportEmail: 'support@usd-impact.com',
});

export const COMMERCE_PUBLIC_DISCLOSURE_FIELDS = Object.freeze([
  'COMMERCE_TRADER_ADDRESS_PUBLIC',
  'COMMERCE_TAX_STATUS_PUBLIC',
  'COMMERCE_MERCHANT_OF_RECORD_NAME',
  'COMMERCE_MERCHANT_OF_RECORD_TERMS_URL',
  'COMMERCE_MERCHANT_OF_RECORD_PRIVACY_URL',
  'COMMERCE_TAX_CHECKOUT_PUBLIC',
  'COMMERCE_REFUND_SUPPORT_PUBLIC',
  'COMMERCE_SELLER_DISCLOSURE_APPROVED',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validatePublicText(value, fieldName, reasons) {
  const text = normalizedString(value);
  if (!text) {
    reasons.push(`${fieldName} is required before controlled Live or Live checkout.`);
    return null;
  }
  if (text.length > MAX_PUBLIC_TEXT_LENGTH) {
    reasons.push(`${fieldName} exceeds the public disclosure length limit.`);
    return null;
  }
  return text;
}

function validateHttpsUrl(value, fieldName, reasons) {
  const raw = normalizedString(value);
  if (!raw) {
    reasons.push(`${fieldName} is required before controlled Live or Live checkout.`);
    return null;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) {
      reasons.push(`${fieldName} must be an HTTPS URL without embedded credentials.`);
      return null;
    }
    return url.toString();
  } catch {
    reasons.push(`${fieldName} must be a valid HTTPS URL.`);
    return null;
  }
}

function validateApproval(value, reasons) {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0' || value == null || value === '') {
    reasons.push('COMMERCE_SELLER_DISCLOSURE_APPROVED must be explicitly true before controlled Live or Live checkout.');
    return false;
  }
  reasons.push('COMMERCE_SELLER_DISCLOSURE_APPROVED must use true/false or 1/0.');
  return false;
}

export function resolveCommercePublicDisclosure(environment = {}) {
  const reasons = [];
  const geographicAddress = validatePublicText(
    environment.COMMERCE_TRADER_ADDRESS_PUBLIC,
    'COMMERCE_TRADER_ADDRESS_PUBLIC',
    reasons,
  );
  const taxStatus = validatePublicText(
    environment.COMMERCE_TAX_STATUS_PUBLIC,
    'COMMERCE_TAX_STATUS_PUBLIC',
    reasons,
  );
  const merchantOfRecord = validatePublicText(
    environment.COMMERCE_MERCHANT_OF_RECORD_NAME,
    'COMMERCE_MERCHANT_OF_RECORD_NAME',
    reasons,
  );
  const buyerTermsUrl = validateHttpsUrl(
    environment.COMMERCE_MERCHANT_OF_RECORD_TERMS_URL,
    'COMMERCE_MERCHANT_OF_RECORD_TERMS_URL',
    reasons,
  );
  const providerPrivacyUrl = validateHttpsUrl(
    environment.COMMERCE_MERCHANT_OF_RECORD_PRIVACY_URL,
    'COMMERCE_MERCHANT_OF_RECORD_PRIVACY_URL',
    reasons,
  );
  const checkoutTaxDisclosure = validatePublicText(
    environment.COMMERCE_TAX_CHECKOUT_PUBLIC,
    'COMMERCE_TAX_CHECKOUT_PUBLIC',
    reasons,
  );
  const refundSupportDisclosure = validatePublicText(
    environment.COMMERCE_REFUND_SUPPORT_PUBLIC,
    'COMMERCE_REFUND_SUPPORT_PUBLIC',
    reasons,
  );
  const approved = validateApproval(environment.COMMERCE_SELLER_DISCLOSURE_APPROVED, reasons);
  const ready = reasons.length === 0 && approved;

  return deepFreeze({
    version: COMMERCE_PUBLIC_DISCLOSURE_VERSION,
    ready,
    approved,
    reasons,
    publicDisclosure: ready ? {
      ...COMMERCE_PUBLIC_IDENTITY,
      geographicAddress,
      taxStatus,
      merchantOfRecord,
      buyerTermsUrl,
      providerPrivacyUrl,
      checkoutTaxDisclosure,
      refundSupportDisclosure,
    } : null,
  });
}
