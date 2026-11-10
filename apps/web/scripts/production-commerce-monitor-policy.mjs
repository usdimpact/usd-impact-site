// Read-only Production security-monitor expectations for the Library Pass sale gate.
// This module does not configure commerce, authorize purchases or touch secrets.
export const LIBRARY_SALES_PAUSED_MESSAGE = 'Library Pass checkout is not offered under the current learning access policy.';

export function libraryPassCommerceMonitorFailures(commerce, salesPaused) {
  const failures = [];
  if (!commerce || typeof commerce !== 'object' || Array.isArray(commerce)) {
    return ['Commerce readiness must contain an object.'];
  }

  if (salesPaused === true) {
    if (commerce.state !== 'blocked') {
      failures.push(`New Library Pass sales must remain blocked by committed policy; found: ${String(commerce.state)}`);
    }
    if (commerce.checkoutEnabled !== false) {
      failures.push('Checkout must remain disabled while new Library Pass sales are paused.');
    }
    if (commerce.message !== LIBRARY_SALES_PAUSED_MESSAGE) {
      failures.push('Blocked readiness must explicitly identify the source-approved Library Pass sales pause, not another provider or configuration failure.');
    }
  } else if (salesPaused === false) {
    // Preserve the original Live readiness expectation if a separate reviewed
    // commit ever restores sales. A premature state or mode change fails.
    if (commerce.state !== 'active') {
      failures.push(`Commerce readiness state drifted: ${String(commerce.state)}`);
    }
    if (commerce.checkoutEnabled !== true) {
      failures.push('checkoutEnabled must remain true for a separately approved Live release.');
    }
  } else {
    failures.push('Library Pass sales pause must come from a valid source-committed boolean.');
  }

  return failures;
}
