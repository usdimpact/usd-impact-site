const LEMON_SQUEEZY_PROVIDER = 'lemon-squeezy';

export function publicCheckoutCanOpen(commerce, disclosureRendered) {
  return commerce?.state === 'active'
    && commerce?.mode === 'live'
    && commerce?.provider === LEMON_SQUEEZY_PROVIDER
    && commerce?.checkoutEnabled === true
    && commerce?.disclosuresComplete === true
    && disclosureRendered === true;
}

export function publicCheckoutPresentation(commerce, disclosureRendered) {
  const available = publicCheckoutCanOpen(commerce, disclosureRendered);
  const readinessClaimsActive = commerce?.state === 'active' || commerce?.checkoutEnabled === true;

  return {
    available,
    verificationState: available ? 'active' : readinessClaimsActive ? 'error' : 'disabled',
    title: available ? 'Library Pass checkout is open.' : 'Checkout is not open yet.',
    introduction: available
      ? 'Purchase the Read the Dollar First Library Pass for a one-time USD 39 payment. Sign in with the USD Impact account that should receive access, review the disclosures below, then continue to Lemon Squeezy’s secure hosted checkout.'
      : 'Lemon Squeezy is the selected Merchant of Record for the one-time Library Pass. Public payment remains disabled until every Live release gate is complete and explicitly approved.',
  };
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
