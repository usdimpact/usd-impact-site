export function evaluateReleaseGatekeeper({ mode, pr, expectedHead, quality, gates }) {
  const failures = [];

  if (!['production-promotion', 'checkout-enable'].includes(mode)) {
    failures.push(`Unsupported gatekeeper mode: ${mode}`);
    return { approved: false, failures };
  }

  if (pr.base?.ref !== 'main') failures.push(`PR base is ${pr.base?.ref ?? 'unknown'}, not main`);
  if (pr.head?.sha?.toLowerCase() !== expectedHead.toLowerCase()) {
    failures.push(`PR head ${pr.head?.sha ?? 'unknown'} does not match expected ${expectedHead}`);
  }

  if (mode === 'production-promotion') {
    if (pr.state !== 'open') failures.push(`PR is ${pr.state}, not open`);
    if (pr.draft !== true) failures.push('PR is not Draft');
    if (pr.merged === true || pr.merged_at) failures.push('PR is already merged');
  }

  if (mode === 'checkout-enable') {
    if (pr.merged !== true && !pr.merged_at) failures.push('PR is not merged');
  }

  if (!quality) failures.push('No Web quality run found for exact head');
  else if (quality.status !== 'completed' || quality.conclusion !== 'success') {
    failures.push(`Web quality is ${quality.status}/${quality.conclusion ?? 'none'}, not completed/success`);
  }

  if (!gates.vercelProductionEnvironment) failures.push('Vercel Production environment gate is not verified');
  if (!gates.productionDataPlane) failures.push('Production data-plane gate is not verified');
  if (!gates.checkoutClosed) failures.push('Checkout CLOSED gate is not verified');

  // Commerce-provider readiness is intentionally not a Production-promotion
  // prerequisite while checkout is explicitly CLOSED. This allows the
  // protected application/content release to ship independently of a
  // declined, pending, or replaceable payment provider. Provider readiness
  // becomes mandatory only at the separate checkout-enable boundary.
  if (mode === 'checkout-enable') {
    const commerceProviderLive = gates.commerceProviderLive ?? gates.paddleLive ?? false;
    if (!commerceProviderLive) failures.push('Live commerce-provider gate is not verified');
    if (!gates.protectedProduction) {
      failures.push('Protected Production verification is required before checkout approval');
    }
  }

  return { approved: failures.length === 0, failures };
}
