const LEMON_SQUEEZY_PROVIDER = 'lemon-squeezy';

export function publicCheckoutCanOpen(commerce, disclosureRendered) {
  return commerce?.state === 'active'
    && commerce?.mode === 'live'
    && commerce?.provider === LEMON_SQUEEZY_PROVIDER
    && commerce?.checkoutEnabled === true
    && commerce?.disclosuresComplete === true
    && disclosureRendered === true;
}

export function approvedLaunchCheckoutUrl(payload) {
  if (
    payload?.ok !== true
    || payload?.testMode !== false
    || payload?.purchaseIntent?.priceTier !== 'launch'
    || payload?.purchaseIntent?.amountCents !== 3900
    || payload?.purchaseIntent?.currency !== 'USD'
    || typeof payload?.checkoutUrl !== 'string'
  ) return null;

  try {
    const url = new URL(payload.checkoutUrl);
    const isLemonSqueezyHost = url.hostname === 'lemonsqueezy.com'
      || url.hostname.endsWith('.lemonsqueezy.com');
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || !isLemonSqueezyHost
      || !url.pathname.toLowerCase().includes('checkout')
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function createCheckoutIdempotencyKey(randomUuid) {
  if (typeof randomUuid !== 'function') return null;
  const uuid = String(randomUuid()).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)
    ? `library-pass:${uuid}`
    : null;
}
