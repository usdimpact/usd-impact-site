/**
 * Preview rehearsal registration for issue #558.
 *
 * This file only exposes the existing dormant guard as a Vercel Function on the
 * isolated rehearsal branch. It does not add a public-path rewrite, configure
 * the Preview mode/secret, inject database adapters, authorize publication, or
 * enable enforcement. Without the separately governed runtime inputs, the
 * existing guard remains fail-closed.
 */
export { default } from '../src/lib/publication-guard.js';
