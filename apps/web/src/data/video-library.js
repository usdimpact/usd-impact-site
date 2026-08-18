export const libraryMeta = {
  title: "USD Impact Video Library",
  eyebrow: "Institutional macro-finance education",
  description:
    "A structured visual library for understanding how dollar measurement, rates, liquidity, funding markets, policy facilities and cross-border balance sheets connect.",
  totalDurationSeconds: 4897.148,
  totalDurationLabel: "1 hr 21 min",
  compliance: "Educational and informational purposes only. Not investment advice.",
};

export const collections = [
  {
    id: "core-framework",
    order: 1,
    kicker: "Start here",
    title: "Core Dollar Framework",
    description:
      "Begin with the distinction between DXY, the broader dollar system, yields, liquidity and market transmission.",
    formatLabel: "Short explainers",
  },
  {
    id: "asset-transmission",
    order: 2,
    kicker: "Market channels",
    title: "Asset Transmission",
    description:
      "Trace how dollar conditions may interact with gold, oil, Bitcoin, equities, LNG and EUR/USD without reducing any market to a single driver.",
    formatLabel: "Short explainers",
  },
  {
    id: "rates-liquidity-policy",
    order: 3,
    kicker: "Domestic plumbing",
    title: "Rates, Liquidity & Policy",
    description:
      "Separate policy rates, market yields, credit conditions, reserves, Treasury cash flows and liquidity facilities.",
    formatLabel: "Short explainers",
  },
  {
    id: "global-dollar-fx",
    order: 4,
    kicker: "Cross-border system",
    title: "Global Dollar & FX Mechanics",
    description:
      "Follow dollar obligations through FX swaps, basis markets, correspondent banking, hedging, reserves and cross-border credit.",
    formatLabel: "Short explainers",
  },
  {
    id: "dollar-funding-stack",
    order: 5,
    kicker: "Seven-part masterclass",
    title: "Dollar Funding Stack",
    description:
      "A sequential institutional learning path through the instruments, intermediaries, constraints and policy facilities that shape global dollar funding.",
    formatLabel: "Long-form masterclass",
  },
];

export const videos = [
  {
    order: 1, slug: "dxy-the-signal-vs-the-system", title: "DXY: The Signal vs the System", shortTitle: "DXY: Signal vs System",
    collectionId: "core-framework", format: "brief", durationSeconds: 53, durationLabel: "00:53",
    description: "Use DXY as a defined currency-basket signal while keeping broader trade-weighted dollar conditions in view.",
    concepts: ["DXY basket", "Euro weight", "Broad dollar"], sources: ["ICE", "Federal Reserve Board"],

  },
  {
    order: 2, slug: "dollar-yields-liquidity", title: "Dollar • Yields • Liquidity", shortTitle: "Dollar • Yields • Liquidity",
    collectionId: "core-framework", format: "brief", durationSeconds: 55.32, durationLabel: "00:55",
    description: "Read the dollar, U.S. yields and global liquidity as a three-dial framework rather than isolated signals.",
    concepts: ["Dollar", "Yields", "Liquidity"], sources: ["Federal Reserve Board", "U.S. Treasury", "Bank for International Settlements"],

  },
  {
    order: 3, slug: "one-dollar-shock-four-market-reactions", title: "One Dollar Shock: Four Market Reactions", shortTitle: "One Dollar Shock",
    collectionId: "core-framework", format: "brief", durationSeconds: 54.32, durationLabel: "00:54",
    description: "Compare how the same dollar impulse can travel through oil, gold, Bitcoin and equities by different channels.",
    concepts: ["Transmission paths", "Regime dependence", "Asset-specific drivers"], sources: ["EIA", "Federal Reserve Board", "World Gold Council", "IMF", "Bank for International Settlements"],

  },
  {
    order: 1, slug: "gold-dollar-vs-real-yields", title: "Gold: Dollar vs Real Yields", shortTitle: "Gold & Real Yields",
    collectionId: "asset-transmission", format: "brief", durationSeconds: 57, durationLabel: "00:57",
    description: "Place the dollar and real yields inside a wider gold framework that also includes risk, uncertainty and demand.",
    concepts: ["Real yields", "Dollar", "Risk and uncertainty"], sources: ["World Gold Council", "U.S. Treasury"],

  },
  {
    order: 2, slug: "oil-dollar-pricing-vs-physical-market", title: "Oil: Dollar Pricing vs the Physical Market", shortTitle: "Oil & the Physical Market",
    collectionId: "asset-transmission", format: "brief", durationSeconds: 56.682, durationLabel: "00:57",
    description: "Separate dollar denomination from physical balances, supply disruptions, inventories and risk demand in oil.",
    concepts: ["Dollar pricing", "Physical balances", "Supply disruption"], sources: ["U.S. Energy Information Administration", "CME Group"],

  },
  {
    order: 3, slug: "bitcoin-dollar-liquidity-vs-crypto-flows", title: "Bitcoin: Dollar Liquidity vs Crypto-Specific Flows", shortTitle: "Bitcoin & Dollar Liquidity",
    collectionId: "asset-transmission", format: "brief", durationSeconds: 56.642, durationLabel: "00:57",
    description: "Distinguish macro liquidity and the dollar from crypto-specific positioning, flows and market structure.",
    concepts: ["Dollar liquidity", "Crypto flows", "Risk appetite"], sources: ["Bitcoin white paper", "SEC", "CME Group", "Federal Reserve Board"],

  },
  {
    order: 4, slug: "equities-dollar-strength-vs-earnings", title: "Equities: Dollar Strength vs Earnings", shortTitle: "Equities & Earnings",
    collectionId: "asset-transmission", format: "brief", durationSeconds: 56.721, durationLabel: "00:57",
    description: "Connect currency translation, foreign earnings and financial conditions without treating the dollar as the only equity driver.",
    concepts: ["Currency translation", "Foreign earnings", "Financial conditions"], sources: ["Federal Reserve Board", "FASB", "Bank for International Settlements"],

  },
  {
    order: 5, slug: "lng-dollar-pricing-vs-regional-gas-markets", title: "LNG: Dollar Pricing vs Regional Gas Markets", shortTitle: "LNG & Regional Gas Markets",
    collectionId: "asset-transmission", format: "brief", durationSeconds: 56.86, durationLabel: "00:57",
    description: "Separate dollar pricing from destination, access, timing and regional gas-market conditions in LNG.",
    concepts: ["Dollar pricing", "Regional benchmarks", "Physical constraints"], sources: ["EIA", "CME Group", "ICE", "S&P Global"],

  },
  {
    order: 6, slug: "eurusd-relative-rates-and-growth", title: "EUR/USD: Relative Rates and Growth", shortTitle: "EUR/USD",
    collectionId: "asset-transmission", format: "brief", durationSeconds: 56.851, durationLabel: "00:57",
    description: "Read EUR/USD through relative rates, growth, inflation and financial conditions across two economies.",
    concepts: ["Relative rates", "Relative growth", "Financial conditions"], sources: ["European Central Bank", "Federal Reserve Board", "Bank for International Settlements"],

  },
  {
    order: 1, slug: "us-treasury-yields-policy-expectations-vs-term-premium", title: "U.S. Treasury Yields: Policy Expectations vs Term Premium", shortTitle: "Treasury Yields",
    collectionId: "rates-liquidity-policy", format: "brief", durationSeconds: 56.172, durationLabel: "00:56",
    description: "Separate expected short-rate paths from term premium and other forces embedded in Treasury yields.",
    concepts: ["Policy expectations", "Term premium", "Treasury supply"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York", "U.S. Treasury"],

  },
  {
    order: 2, slug: "credit-spreads-default-risk-vs-liquidity-stress", title: "Credit Spreads: Default Risk vs Liquidity Stress", shortTitle: "Credit Spreads",
    collectionId: "rates-liquidity-policy", format: "brief", durationSeconds: 56.96, durationLabel: "00:57",
    description: "Interpret a widening credit spread by separating weaker fundamentals from a retreat in market liquidity.",
    concepts: ["Default risk", "Liquidity premium", "Funding stress"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York", "Bank for International Settlements"],

  },
  {
    order: 3, slug: "us-yield-curve-policy-restriction-vs-growth-expectations", title: "U.S. Yield Curve: Policy Restriction vs Growth Expectations", shortTitle: "U.S. Yield Curve",
    collectionId: "rates-liquidity-policy", format: "brief", durationSeconds: 55.882, durationLabel: "00:56",
    description: "Treat curve shape as a signal requiring decomposition rather than a standalone forecast.",
    concepts: ["Curve shape", "Policy restriction", "Growth expectations"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York", "U.S. Treasury"],

  },
  {
    order: 4, slug: "inflation-expectations-cpi-vs-market-pricing", title: "Inflation Expectations: CPI Prints vs Market Pricing", shortTitle: "Inflation Expectations",
    collectionId: "rates-liquidity-policy", format: "brief", durationSeconds: 56.6, durationLabel: "00:57",
    description: "Distinguish a backward-looking inflation release from the expectations and risk compensation embedded in markets.",
    concepts: ["CPI release", "Market pricing", "Inflation compensation"], sources: ["U.S. Bureau of Labor Statistics", "Federal Reserve Board", "U.S. Treasury"],

  },
  {
    order: 5, slug: "repo-markets-policy-rates-vs-funding-stress", title: "Repo Markets: Policy Rates vs Funding Stress", shortTitle: "Repo Policy vs Stress",
    collectionId: "rates-liquidity-policy", format: "brief", durationSeconds: 56.2, durationLabel: "00:56",
    description: "Separate an administered policy-rate anchor from changing repo conditions and relative funding pressure.",
    concepts: ["SOFR", "Policy anchor", "Funding stress"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York"],

  },
  {
    order: 6, slug: "treasury-supply-issuance-vs-market-absorption", title: "Treasury Supply: Issuance vs Market Absorption", shortTitle: "Treasury Supply",
    collectionId: "rates-liquidity-policy", format: "brief", durationSeconds: 55.4, durationLabel: "00:55",
    description: "Pair the supply headline with auction demand, intermediation and the market's capacity to absorb issuance.",
    concepts: ["Issuance", "Auction demand", "Market absorption"], sources: ["U.S. Treasury", "Federal Reserve Board"],

  },
  {
    order: 7, slug: "treasury-general-account-vs-bank-reserves", title: "Treasury General Account: Cash Flows vs Bank Reserves", shortTitle: "TGA & Bank Reserves",
    collectionId: "rates-liquidity-policy", format: "brief", durationSeconds: 54.24, durationLabel: "00:54",
    description: "Trace Treasury cash flows through the TGA and distinguish their reserve effect from the broader liquidity regime.",
    concepts: ["TGA flows", "Reserve balances", "Fed liabilities"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York", "Federal Reserve Bank of Cleveland"],

  },
  {
    order: 8, slug: "quantitative-tightening-runoff-vs-reserve-scarcity", title: "Quantitative Tightening: Runoff vs Reserve Scarcity", shortTitle: "Quantitative Tightening",
    collectionId: "rates-liquidity-policy", format: "brief", durationSeconds: 56.8, durationLabel: "00:57",
    description: "Connect balance-sheet runoff to reserve conditions while preserving the role of the broader liability mix.",
    concepts: ["Balance-sheet runoff", "Reserve scarcity", "ON RRP"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York", "Federal Reserve Bank of Cleveland"],

  },
  {
    order: 9, slug: "reserve-management-purchases-vs-qe", title: "Reserve Management Purchases vs Quantitative Easing", shortTitle: "Reserve Management vs QE",
    collectionId: "rates-liquidity-policy", format: "brief", durationSeconds: 56.96, durationLabel: "00:57",
    description: "Compare balance-sheet growth by purpose, maturity and intended transmission rather than by size alone.",
    concepts: ["Reserve management", "Quantitative easing", "Policy purpose"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York"],

  },
  {
    order: 10, slug: "standing-repo-facility-backstop-vs-easing", title: "Standing Repo Facility: Backstop vs Monetary Easing", shortTitle: "Standing Repo Facility",
    collectionId: "rates-liquidity-policy", format: "brief", durationSeconds: 56.96, durationLabel: "00:57",
    description: "Distinguish an overnight rate-control backstop from a broad easing program.",
    concepts: ["Standing Repo Facility", "Rate control", "Collateralized access"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York"],

  },
  {
    order: 11, slug: "discount-window-vs-standing-repo-facility", title: "Discount Window vs Standing Repo Facility", shortTitle: "Discount Window vs SRF",
    collectionId: "rates-liquidity-policy", format: "brief", durationSeconds: 56.96, durationLabel: "00:57",
    description: "Compare counterparties, transaction structures and policy functions across two domestic liquidity backstops.",
    concepts: ["Discount Window", "Standing Repo Facility", "Counterparty access"], sources: ["Federal Reserve Board", "Federal Reserve Discount Window", "Federal Reserve Bank of New York"],

  },
  {
    order: 12, slug: "bank-reserves-vs-bank-deposits", title: "Bank Reserves vs Bank Deposits", shortTitle: "Reserves vs Deposits",
    collectionId: "rates-liquidity-policy", format: "brief", durationSeconds: 52.974, durationLabel: "00:53",
    description: "Separate central-bank reserve balances from customer deposits and trace interbank settlement.",
    concepts: ["Reserve balances", "Customer deposits", "Settlement"], sources: ["Federal Reserve Board", "Federal Reserve Financial Services"],

  },
  {
    order: 13, slug: "repo-markets-cash-vs-collateral-liquidity", title: "Repo Markets: Cash Liquidity vs Collateral Liquidity", shortTitle: "Cash vs Collateral Liquidity",
    collectionId: "rates-liquidity-policy", format: "brief", durationSeconds: 55.59, durationLabel: "00:56",
    description: "Distinguish the availability of cash from the availability, eligibility and distribution of collateral.",
    concepts: ["Cash liquidity", "Collateral liquidity", "Settlement friction"], sources: ["Federal Reserve Board", "Bank for International Settlements"],

  },
  {
    order: 1, slug: "central-bank-swaps-vs-fima-repo", title: "Central Bank Liquidity Swaps vs FIMA Repo", shortTitle: "Swap Lines vs FIMA Repo",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 56.64, durationLabel: "00:57",
    description: "Compare foreign-currency swap access with Treasury-collateralized dollar access while keeping counterparties distinct.",
    concepts: ["Swap lines", "FIMA Repo", "Counterparty boundary"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York"],

  },
  {
    order: 2, slug: "correspondent-banking", title: "Correspondent Banking", shortTitle: "Correspondent Banking",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 56.12, durationLabel: "00:56",
    description: "Follow cross-border payments across customer deposits, correspondent balances and interbank settlement.",
    concepts: ["Payment chain", "Correspondent balances", "Settlement"], sources: ["Bank for International Settlements", "Federal Reserve Board", "Federal Reserve Financial Services"],

  },
  {
    order: 3, slug: "cross-currency-basis-demand-vs-hedging-cost", title: "Cross-Currency Basis: Dollar Demand vs Hedging Cost", shortTitle: "Basis: Demand vs Hedging",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 52.88, durationLabel: "00:53",
    description: "Use the basis as a funding and hedging-price signal while checking quotation convention and context.",
    concepts: ["Cross-currency basis", "Dollar funding", "Hedging cost"], sources: ["Bank for International Settlements", "IMF"],

  },
  {
    order: 4, slug: "cross-currency-basis-vs-spot-fx", title: "Cross-Currency Basis: Funding Stress vs Spot-FX Direction", shortTitle: "Basis vs Spot FX",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 54.48, durationLabel: "00:54",
    description: "Separate a dollar-funding residual from the direction of the spot exchange rate.",
    concepts: ["Funding basis", "Spot FX", "Quotation convention"], sources: ["Bank for International Settlements", "Federal Reserve Board"],

  },
  {
    order: 5, slug: "currency-mismatch-dollar-liabilities-vs-local-cash-flow", title: "Currency Mismatch: Dollar Liabilities vs Local-Currency Cash Flow", shortTitle: "Currency Mismatch",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 55.715, durationLabel: "00:56",
    description: "Map the mismatch between dollar obligations and cash flows earned in another currency.",
    concepts: ["Dollar liabilities", "Local cash flow", "Hedging capacity"], sources: ["Bank for International Settlements", "IMF"],

  },
  {
    order: 6, slug: "currency-pegs-stability-vs-monetary-independence", title: "Currency Pegs: Exchange-Rate Stability vs Monetary Independence", shortTitle: "Currency Pegs",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 54.44, durationLabel: "00:54",
    description: "Frame the policy trade-off between exchange-rate stability, capital mobility and monetary independence.",
    concepts: ["Exchange-rate stability", "Monetary independence", "Policy trade-off"], sources: ["IMF", "Federal Reserve Board", "Bank for International Settlements"],

  },
  {
    order: 7, slug: "dollar-debt-service-interest-vs-refinancing", title: "Dollar Debt Service: Interest Payments vs Principal Refinancing", shortTitle: "Dollar Debt Service",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 53.24, durationLabel: "00:53",
    description: "Separate recurring interest payments from the market-access requirement created by maturing principal.",
    concepts: ["Interest payments", "Principal maturity", "Refinancing"], sources: ["Bank for International Settlements", "World Bank"],

  },
  {
    order: 8, slug: "dollar-funding-fx-swaps-vs-unsecured-borrowing", title: "Dollar Funding Markets: FX Swaps vs Unsecured Borrowing", shortTitle: "FX Swaps vs Unsecured Funding",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 56.6, durationLabel: "00:57",
    description: "Compare two dollar-funding channels by balance-sheet treatment, payment structure and rollover exposure.",
    concepts: ["FX-swap funding", "Unsecured borrowing", "Balance-sheet treatment"], sources: ["Bank for International Settlements", "Federal Reserve Board"],

  },
  {
    order: 9, slug: "dollar-funding-onshore-vs-offshore", title: "Dollar Funding: Onshore vs Offshore Dollar Markets", shortTitle: "Onshore vs Offshore Dollars",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 54.832, durationLabel: "00:55",
    description: "Treat onshore and offshore activity as connected parts of one dollar system while preserving institutional boundaries.",
    concepts: ["Onshore funding", "Offshore dollars", "Global transmission"], sources: ["Bank for International Settlements", "Federal Reserve Board", "IMF"],

  },
  {
    order: 10, slug: "dollar-funding-stress-basis-vs-commercial-paper", title: "Dollar Funding Stress: FX-Swap Basis vs Commercial-Paper Spreads", shortTitle: "Two Funding-Stress Signals",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 56.96, durationLabel: "00:57",
    description: "Compare stress signals from FX-swap funding and unsecured commercial-paper markets without treating them as identical.",
    concepts: ["FX-swap basis", "Commercial-paper spreads", "Funding stress"], sources: ["Bank for International Settlements", "Federal Reserve Board"],

  },
  {
    order: 11, slug: "economic-fx-exposure-contracts-vs-competitiveness", title: "Economic FX Exposure: Contractual Payments vs Operating Competitiveness", shortTitle: "Economic FX Exposure",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 56.96, durationLabel: "00:57",
    description: "Separate identifiable contractual FX exposure from longer-horizon operating competitiveness.",
    concepts: ["Transaction exposure", "Economic exposure", "Operating competitiveness"], sources: ["Bank for International Settlements", "European Central Bank"],

  },
  {
    order: 12, slug: "fx-exposure-transaction-vs-translation", title: "FX Exposure: Transaction Cash Flows vs Translation Effects", shortTitle: "Transaction vs Translation",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 56.84, durationLabel: "00:57",
    description: "Distinguish external contractual cash flows from accounting translation effects in reported statements.",
    concepts: ["Transaction exposure", "Translation effect", "Reported FX"], sources: ["IFRS Foundation"],

  },
  {
    order: 13, slug: "fx-hedging-demand-forward-points-vs-direction", title: "FX Hedging Demand: Forward Points vs Currency Direction", shortTitle: "Forward Points vs Direction",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 56.68, durationLabel: "00:57",
    description: "Separate the forward contract's pricing components from a directional spot-currency forecast.",
    concepts: ["Forward points", "Rate differential", "Hedging pressure"], sources: ["Bank for International Settlements", "Federal Reserve Board"],

  },
  {
    order: 14, slug: "fx-hedging-natural-vs-financial", title: "FX Hedging: Natural Cash Flows vs Financial Contracts", shortTitle: "Natural vs Financial Hedging",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 55.08, durationLabel: "00:55",
    description: "Compare operating cash-flow offsets with contractual financial hedges and their distinct limitations.",
    concepts: ["Natural hedge", "Financial contract", "Coverage risk"], sources: ["Bank for International Settlements"],

  },
  {
    order: 15, slug: "fx-intervention-sterilized-vs-unsterilized", title: "FX Intervention: Sterilized vs Unsterilized Operations", shortTitle: "FX Intervention",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 56.88, durationLabel: "00:57",
    description: "Distinguish an FX operation from its domestic-liquidity effect and any offsetting sterilization step.",
    concepts: ["FX operation", "Sterilization", "Domestic liquidity"], sources: ["IMF", "Bank for International Settlements"],

  },
  {
    order: 16, slug: "fx-pass-through-invoice-vs-producer-currency", title: "FX Pass-Through: Invoice Currency vs Producer Currency", shortTitle: "FX Pass-Through",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 55.312, durationLabel: "00:55",
    description: "Connect invoice currency, producer costs and firm responses to incomplete exchange-rate pass-through.",
    concepts: ["Invoice currency", "Producer currency", "Pass-through"], sources: ["Bank for International Settlements", "IMF"],

  },
  {
    order: 17, slug: "fx-reserves-liquidity-buffer-vs-defense", title: "FX Reserves: External Liquidity Buffer vs Exchange-Rate Defense", shortTitle: "FX Reserves",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 56.6, durationLabel: "00:57",
    description: "Separate headline reserve holdings from usable capacity, intervention objectives and lasting market effects.",
    concepts: ["Reserve buffer", "Usable capacity", "FX intervention"], sources: ["IMF", "Bank for International Settlements"],

  },
  {
    order: 18, slug: "fx-swap-rollovers-short-vs-long-horizon", title: "FX-Swap Rollovers: Short-Term Funding vs Long-Term Exposure", shortTitle: "FX-Swap Rollovers",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 55.68, durationLabel: "00:56",
    description: "Identify the maturity mismatch created when short-dated swap funding supports longer-horizon exposure.",
    concepts: ["Rollover risk", "Swap tenor", "Long-horizon exposure"], sources: ["Bank for International Settlements", "Federal Reserve Board"],

  },
  {
    order: 19, slug: "fx-swaps-currency-exchange-vs-funding-obligation", title: "FX Swaps: Currency Exchange vs Funding Obligation", shortTitle: "FX Swaps",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 53.037, durationLabel: "00:53",
    description: "Separate the exchange mechanics from the full-principal funding obligation, rollover risk and settlement risk.",
    concepts: ["Principal exchange", "Rollover risk", "Settlement risk"], sources: ["Bank for International Settlements"],

  },
  {
    order: 20, slug: "global-dollar-credit-bank-loans-vs-debt-securities", title: "Global Dollar Credit: Bank Loans vs International Debt Securities", shortTitle: "Global Dollar Credit",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 56.784, durationLabel: "00:57",
    description: "Compare two cross-border dollar-credit channels and their different transmission paths.",
    concepts: ["Bank loans", "Debt securities", "Dollar obligations"], sources: ["Bank for International Settlements"],

  },
  {
    order: 21, slug: "the-eurodollar-system", title: "The Eurodollar System", shortTitle: "The Eurodollar System",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 56, durationLabel: "00:56",
    description: "Map dollar deposits and funding relationships outside the United States without treating the system as one institution.",
    concepts: ["Offshore dollars", "Commercial-bank money", "FX swaps"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York", "Bank for International Settlements"],

  },
  {
    order: 22, slug: "when-dollars-disappear-global-liquidity-stress", title: "When Dollars Disappear: Global Dollar Liquidity and Funding Stress", shortTitle: "When Dollars Disappear",
    collectionId: "global-dollar-fx", format: "brief", durationSeconds: 56.12, durationLabel: "00:56",
    description: "Trace a conditional path from tighter private funding through balance sheets, market liquidity and asset sales.",
    concepts: ["Private funding", "Market liquidity", "Cross-border transmission"], sources: ["Bank for International Settlements", "Federal Reserve Board", "IMF"],

  },
  {
    order: 1, slug: "part-1-foundations", title: "Foundations", shortTitle: "Foundations",
    collectionId: "dollar-funding-stack", format: "masterclass", durationSeconds: 344.247, durationLabel: "05:44",
    description: "Build the core map of dollar funding participants, instruments and flows before moving into market-specific mechanics.",
    concepts: ["System map", "Funding channels", "Analytical boundaries"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York", "Bank for International Settlements"],

  },
  {
    order: 2, slug: "part-2-fx-swap-engine", title: "The FX Swap Engine", shortTitle: "FX Swap Engine",
    collectionId: "dollar-funding-stack", format: "masterclass", durationSeconds: 331.4, durationLabel: "05:31",
    description: "Trace the near leg and later reversal of an FX swap, and separate funding mechanics from directional market forecasts.",
    concepts: ["Near leg", "Forward reversal", "Funding mechanics"], sources: ["Bank for International Settlements", "Federal Reserve Board", "Federal Reserve Bank of New York"],

  },
  {
    order: 3, slug: "part-3-repo-collateral-and-haircuts", title: "Repo, Collateral and Haircuts", shortTitle: "Repo & Collateral",
    collectionId: "dollar-funding-stack", format: "masterclass", durationSeconds: 383.445, durationLabel: "06:23",
    description: "Follow the exchange of cash and collateral through repo, then examine haircuts, margin and collateral eligibility.",
    concepts: ["Cash and collateral", "Haircuts", "Margin"], sources: ["Federal Reserve Bank of New York", "Bank for International Settlements", "Federal Reserve Board"],

  },
  {
    order: 4, slug: "part-4-dealers-and-balance-sheet-intermediation", title: "Dealers and Balance-Sheet Intermediation", shortTitle: "Dealer Intermediation",
    collectionId: "dollar-funding-stack", format: "masterclass", durationSeconds: 354.005, durationLabel: "05:54",
    description: "See how dealer balance sheets connect funding markets and how intermediation capacity can alter market transmission.",
    concepts: ["Dealer balance sheets", "Intermediation", "Capacity constraints"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York", "Bank for International Settlements"],

  },
  {
    order: 5, slug: "part-5-funding-stress-and-market-transmission", title: "Funding Stress and Market Transmission", shortTitle: "Funding Stress",
    collectionId: "dollar-funding-stack", format: "masterclass", durationSeconds: 351.744, durationLabel: "05:52",
    description: "Connect funding conditions to market signals through conditional channels without treating any one indicator as a complete verdict.",
    concepts: ["Stress signals", "Transmission channels", "Conditional reading"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York", "Bank for International Settlements"],

  },
  {
    order: 6, slug: "part-6-global-dollar-funding-and-fx-swaps", title: "Global Dollar Funding and FX Swaps", shortTitle: "Global Dollar Funding",
    collectionId: "dollar-funding-stack", format: "masterclass", durationSeconds: 340.288, durationLabel: "05:40",
    description: "Map cross-border dollar funding through FX swaps, cross-currency basis, central-bank swap lines and FIMA Repo.",
    concepts: ["FX swaps", "Cross-currency basis", "Policy facilities"], sources: ["Bank for International Settlements", "Federal Reserve Board", "Federal Reserve Bank of New York"],

  },
  {
    order: 7, slug: "part-7-dollar-liquidity-backstops-and-policy-facilities", title: "Dollar Liquidity Backstops and Policy Facilities", shortTitle: "Liquidity Backstops",
    collectionId: "dollar-funding-stack", format: "masterclass", durationSeconds: 337.045, durationLabel: "05:37",
    description: "Distinguish standing liquidity backstops by counterparty, transaction structure, collateral, pricing and interpretation limits.",
    concepts: ["Swap lines", "FIMA Repo", "Standing facilities"], sources: ["Federal Reserve Board", "Federal Reserve Bank of New York", "Bank for International Settlements"],

  },
];

export function getCollection(id) {
  return collections.find((item) => item.id === id);
}

export function getCollectionVideos(id) {
  return videos.filter((video) => video.collectionId === id).sort((a, b) => a.order - b.order);
}

export function getVideo(slug) {
  return videos.find((video) => video.slug === slug);
}

export function getAdjacentVideos(video) {
  const collectionVideos = getCollectionVideos(video.collectionId);
  const index = collectionVideos.findIndex((item) => item.slug === video.slug);
  return {
    previous: index > 0 ? collectionVideos[index - 1] : null,
    next: index >= 0 && index < collectionVideos.length - 1 ? collectionVideos[index + 1] : null,
  };
}


export function getVideoNumber(video) {
  const index = videos.findIndex((item) => item.slug === video.slug);
  return index >= 0 ? index + 1 : null;
}

export const videoSlugs = Object.freeze(videos.map((video) => video.slug));
