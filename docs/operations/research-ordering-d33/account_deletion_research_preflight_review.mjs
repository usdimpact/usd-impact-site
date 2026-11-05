// D33 AUTHOR REVIEW-ONLY helper, not imported by the current web runtime.
// Intended call site: immediately BEFORE softDeleteAuthUser() inside
// finalizeOneDueAccount(). Until external verified cancellation policy is
// approved, ANY Research subscription puts auto-deletion on HOLD.
export class ResearchDeletionBillingHold extends Error {
  constructor(code) {
    super("Research subscription requires provider-cancellation reconciliation before Auth deletion");
    this.name = "ResearchDeletionBillingHold";
    this.code = code;
  }
}

export async function assertNoUnverifiedResearchBillingBeforeAuthDeletion({
  accountId,
  config,
  fetchImpl,
}) {
  const id = String(accountId || "").trim();
  const base = String(config?.supabase?.url || "");
  const key = String(config?.supabase?.secretKey || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      || !base.startsWith("https://")
      || !key || typeof fetchImpl !== "function") {
    throw new ResearchDeletionBillingHold("RESEARCH_DELETION_PREFLIGHT_CONFIG_INVALID");
  }
  const path = "/rest/v1/subscriptions?account_id=eq." + encodeURIComponent(id)
    + "&product_id=eq.research-membership&select=account_id,product_id,state&limit=2";
  let response;
  try {
    response = await fetchImpl(base + path, {
      method: "GET",
      headers: {
        Accept: "application/json",
        apikey: key,
        Authorization: "Bearer " + key,
      },
    });
  } catch {
    throw new ResearchDeletionBillingHold("RESEARCH_DELETION_PREFLIGHT_UNAVAILABLE");
  }
  if (!response?.ok) {
    throw new ResearchDeletionBillingHold("RESEARCH_DELETION_PREFLIGHT_UNAVAILABLE");
  }
  let rows;
  try {
    rows = JSON.parse(await response.text());
  } catch {
    throw new ResearchDeletionBillingHold("RESEARCH_DELETION_PREFLIGHT_MALFORMED");
  }
  if (!Array.isArray(rows) || rows.length > 2
      || rows.some(row => !row || row.account_id !== id
        || row.product_id !== "research-membership"
        || typeof row.state !== "string")) {
    throw new ResearchDeletionBillingHold("RESEARCH_DELETION_PREFLIGHT_MALFORMED");
  }
  if (rows.length !== 0) {
    // This is deliberately conservative: a locally-cancelled subscription
    // alone cannot prove the merchant has ceased recurring billing.
    throw new ResearchDeletionBillingHold("RESEARCH_PROVIDER_CANCELLATION_NOT_VERIFIED");
  }
  return Object.freeze({ canProceedToAuthRemoval: true, scopedSubscriptionRows: 0 });
}
