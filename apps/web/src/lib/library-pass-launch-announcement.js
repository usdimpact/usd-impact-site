import { publicCheckoutCanOpen } from './checkout-client.js';

export function libraryPassLaunchAnnouncementCanOpen(payload) {
  const commerce = payload?.commerce;

  return payload?.ok === true
    && commerce?.providerConfigured === true
    && publicCheckoutCanOpen(commerce, true);
}
