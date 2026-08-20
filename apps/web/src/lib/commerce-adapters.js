// Providers are registered only after their adapter, sandbox evidence, operational
// ownership, and environment-scoped configuration have passed the release gate.
// Keeping this list empty makes Production ready for configuration but unable to
// create checkout sessions or accept provider webhooks.
export const REGISTERED_COMMERCE_ADAPTERS = Object.freeze([]);
