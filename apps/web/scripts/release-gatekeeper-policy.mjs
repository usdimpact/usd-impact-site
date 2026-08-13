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
  if (!gates.paddleLive) failures.push('Paddle Live gate is not verified');
  if (!gates.productionDataPlane) failures.push('Production data-plane gate is not verified');
  if (!gates.checkoutClosed) failures.push('Checkout CLOSED gate is not verified');
  if (mode === 'checkout-enable' && !gates.protectedProduction) {
    failures.push('Protected Production verification is required before checkout approval');
  }

  return { approved: failures.length === 0, failures };
}
