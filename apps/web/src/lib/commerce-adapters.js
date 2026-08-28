import { LEMON_SQUEEZY_ADAPTER_SCAFFOLD } from './lemon-squeezy-adapter-scaffold.js';

// Registration is code-only. Production remains fail-closed while COMMERCE_MODE is
// disabled and COMMERCE_PROVIDER is unset; no provider credentials or routes are
// activated merely by including the reviewed adapter in this registry.
export const REGISTERED_COMMERCE_ADAPTERS = Object.freeze([
  LEMON_SQUEEZY_ADAPTER_SCAFFOLD,
]);
