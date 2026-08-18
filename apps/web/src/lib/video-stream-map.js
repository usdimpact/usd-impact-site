/**
 * Server-only Cloudflare Stream delivery map used by the protected handler.
 *
 * Stream UIDs are identifiers, not credentials. Every referenced video has
 * requireSignedURLs enabled, so these values cannot be used for playback
 * without a short-lived token generated after entitlement verification.
 */
export const STREAM_CUSTOMER_CODE = "wtnky2hjbwkdc80r";

export const VIDEO_STREAM_UIDS = Object.freeze({
  "dxy-the-signal-vs-the-system": "dadcee426a7d47159e9714602f741b62",
  "dollar-yields-liquidity": "a237a102d3177ee07eb346c772eb2c84",
  "one-dollar-shock-four-market-reactions": "8776c95d3435ea661e6c1b53f79ac19d",
  "gold-dollar-vs-real-yields": "a9577ea2ef5793216e460388c4ecdbbf",
  "oil-dollar-pricing-vs-physical-market": "94b6a2ed5404b5d970be3c2179cb59af",
  "bitcoin-dollar-liquidity-vs-crypto-flows": "4b8531183a1461c1e43465b37dc7583e",
  "equities-dollar-strength-vs-earnings": "1cbbe7720a05f484ec16265471013176",
  "lng-dollar-pricing-vs-regional-gas-markets": "a841f926e247026f321280d784ab128c",
  "eurusd-relative-rates-and-growth": "5fae10a29f8fc1a31954052fbef9c9c7",
  "us-treasury-yields-policy-expectations-vs-term-premium": "01ddb4695131965a241ea27e6c260b7a",
  "credit-spreads-default-risk-vs-liquidity-stress": "cef6c8ae062bbc347ed1f8b2ba9727bd",
  "us-yield-curve-policy-restriction-vs-growth-expectations": "2ed0846e629029f52fd46fce28aa54ad",
  "inflation-expectations-cpi-vs-market-pricing": "91a5f1b2a60714258078c90f6613e86f",
  "repo-markets-policy-rates-vs-funding-stress": "b1435c4e9ee0eb90f5fd15bdd9cb60f7",
  "treasury-supply-issuance-vs-market-absorption": "ef52cbc76aaaba4ea67b03d2ac59b3a2",
  "treasury-general-account-vs-bank-reserves": "2e1bd692cda46d8716b9ac723440aecd",
  "quantitative-tightening-runoff-vs-reserve-scarcity": "49991c8dde1eb3370ae8bcd8312e796c",
  "reserve-management-purchases-vs-qe": "b6e81a04a7de776e78632803cf107d91",
  "standing-repo-facility-backstop-vs-easing": "867b453e66bdb301e97f319b87b1c936",
  "discount-window-vs-standing-repo-facility": "59fac8ffd3d2a2ea9a34f40a6a6d5155",
  "bank-reserves-vs-bank-deposits": "291c4d082e0703c0f38d38a850e82d31",
  "repo-markets-cash-vs-collateral-liquidity": "37179de66fd5e3b4abc0e5469c006c07",
  "central-bank-swaps-vs-fima-repo": "cb6ed6180fb2091989d9627363dcbb76",
  "correspondent-banking": "990c208dad8c8326d23bcbea7cec6f0e",
  "cross-currency-basis-demand-vs-hedging-cost": "9c1249ba7203ec49069a2ee5a2dd7450",
  "cross-currency-basis-vs-spot-fx": "e81b517d52880f1c03dc6973a3082e0c",
  "currency-mismatch-dollar-liabilities-vs-local-cash-flow": "e7cd457e1de8c832db0c79fc895b0f9d",
  "currency-pegs-stability-vs-monetary-independence": "826c999fa2e8d07d3a5eda864e931523",
  "dollar-debt-service-interest-vs-refinancing": "6370cc24e0b002d9e93adcf94a757106",
  "dollar-funding-fx-swaps-vs-unsecured-borrowing": "619dec27c2f5589ac3340d4b37e05168",
  "dollar-funding-onshore-vs-offshore": "0c9bbdacabfb536a91cf443dfc14251c",
  "dollar-funding-stress-basis-vs-commercial-paper": "22a58b05222042f773bb39c001d69e2c",
  "economic-fx-exposure-contracts-vs-competitiveness": "e3ea495b80f5668298caaa4b29ecc8bc",
  "fx-exposure-transaction-vs-translation": "9533c8ab7db1ff3b5c6bae4b3d3a2bc4",
  "fx-hedging-demand-forward-points-vs-direction": "10338e3abb4a4d65e601333f4477f191",
  "fx-hedging-natural-vs-financial": "465f43578b2cfaee87a7d8addcebede7",
  "fx-intervention-sterilized-vs-unsterilized": "d4d8e737257b79c4a57fa5d2a6c78a5f",
  "fx-pass-through-invoice-vs-producer-currency": "d3996e6adddb1ed29bbfedaa88b0bb93",
  "fx-reserves-liquidity-buffer-vs-defense": "e1ae7da0b90c49293dc57eee65864b8c",
  "fx-swap-rollovers-short-vs-long-horizon": "939d62e2bbb9b2d88d3f4605f5090158",
  "fx-swaps-currency-exchange-vs-funding-obligation": "716e2aebb86cc39d6d774511535ca539",
  "global-dollar-credit-bank-loans-vs-debt-securities": "2bdd790c8b53df235ec70171d99badd3",
  "the-eurodollar-system": "647c03ec418f52707e199781e27b9adb",
  "when-dollars-disappear-global-liquidity-stress": "06cae05d40755058b6da8d89211e5a3c",
  "part-1-foundations": "fd3acd3c746926bfb9ebbc26cf7954fa",
  "part-2-fx-swap-engine": "afc1461f0ca008916886517d0ebd3add",
  "part-3-repo-collateral-and-haircuts": "cf35212082eb6f5077c1679e4655689a",
  "part-4-dealers-and-balance-sheet-intermediation": "520c37afef9676788a156dcbce4ae233",
  "part-5-funding-stress-and-market-transmission": "a170a5c956efb12ead56cbb7680c96ca",
  "part-6-global-dollar-funding-and-fx-swaps": "772168655f240abcbc70606c1485da02",
  "part-7-dollar-liquidity-backstops-and-policy-facilities": "5c578fc7c7272238462067d20a53c3f9"
});

export function getStreamUid(slug) {
  return VIDEO_STREAM_UIDS[slug] || null;
}

export function getStreamCustomerCode(environment = process.env) {
  const override = String(environment.CLOUDFLARE_STREAM_CUSTOMER_CODE || '').trim();
  return override || STREAM_CUSTOMER_CODE;
}
