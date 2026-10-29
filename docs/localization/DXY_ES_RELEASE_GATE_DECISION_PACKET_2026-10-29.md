# ES-LATAM DXY — decision-ready compliance and publication hold (2026-10-29)

**STATUS: REVIEW ONLY / NO-GO for public release.** This is an audit and human-review packet, not an investment recommendation, legal opinion, rights licence, deployment authorization or approval to add a public route.

## Scope of the already approved work

- Exact protected Production website `main`: `06e185d39b4768e1f2ab8aeabccd63b531bf1435` (not modified by this packet).
- Exact Development Draft #932 article after the owner-approved illustrative-language fix: Git blob `079ff3b00a022ce97beb3c6e4f8083920e1f0769` / corrected body Git SHA `78cf51a6333b33c603359805be42fd8212188ad8`. `status: "review"` remains.
- Owner-approved Spanish title, SEO title, meta description, hero, and existing English Quiz 5 CTA links remain unchanged. The internal Quiz 5 is not listed as an official external source. The owner attested to first-party original-text reuse rights, supported by Google Drive/GitHub lineage, but made no claim to own the ICE proprietary index or marks.
- A standalone primary-source and rights research matrix is in `docs/localization/DXY_ES_PRIMARY_SOURCE_RIGHTS_REVIEW_2026-10-29.md`. That document distinguishes original English first-party prose from upstream factual descriptions and hypothetical index levels.
- The article remains unpublished: private noindexed Preview route only; no `/es/dxy/dxy-vs-broad-usd/` public route, sitemap, hreflang, search-indexing, email blast, affiliate campaign, auth or commerce activation.

## Verified references (link availability and claim relevance — NOT a data license)

| Published institution / document | Official URL | Supported role | Limitation |
| --- | --- | --- | --- |
| Federal Reserve H.10, release dated Oct 26, 2026 | https://www.federalreserve.gov/releases/h10/current/ | Nominal daily broad index, bilateral exchange rates and current statistical context | Not a license to copy historical tables/downloads into a commercial index product |
| Federal Reserve FEDS Note, Jan 15, 2019 | https://www.federalreserve.gov/econres/notes/feds-notes/revisions-to-the-federal-reserve-dollar-indexes-20190115.html | Broad/AFE/EME coverage, trade weighting methodology and revision history | Reference methodology; historical note not a current weight sheet |
| Federal Reserve nominal/real index summary | https://www.federalreserve.gov/releases/h10/summary/ | Nominal index daily; CPI-adjusted real index monthly | Do not present the real index as a real-time ticker |
| ICE USDX official overview | https://www.ice.com/forex/usdx | Six-currency, fixed-basket, euro-concentrated DXY; futures/options | ICE retains extensive proprietary index/data/brand rights |
| ICE USDX futures specifications / rights notice | https://www.ice.com/products/194/US-Dollar-Index-Futures/ | Specific exchange-contract context and explicit proprietary rights notice | Qualified review of permissible descriptive references needed before broader commercial marketing |

**Do not cite an inaccessible legacy ICE methodology PDF URL as a verified link**. The official ICE overview above is the vetted working source. No nonpublic ICE raw series, licensed chart, logos or index-formula redistribution is in the reviewed article Markdown.

## Educational-content risk assessment

| Review question | Current evidence | Result |
| --- | --- | --- |
| Does the lesson advise an individual investor to buy/sell/hold a financial instrument? | Read complete Spanish Draft body; it explains the two index definitions and conditional regimes | No such instruction identified — preliminary content-only pass |
| Are numerical figures reported as live market data or forecasts? | Both 100→102 and 100→103 cases introduced by `Supongamos`; owner-approved edit now repeats `En este ejemplo hipotético` | Illustrative, not historical or forecast |
| Does the article promise profitability or claim certain market outcomes? | Conditional regimes and source caveats; explicit lack of causal certainty | No explicit guarantee identified |
| Does the risk notice identify the educational-only scope? | Spanish `complianceNote` and private Preview compliance panel | Present, but disclaimer alone does not determine the communication's legal classification |
| Are sources independent of the quiz/CTA? | Three official institutional source names; Quiz 5 segregated under `internalLinks` | Yes for Draft metadata; official links available in private reviewer page |
| Is the quiz itself instantly accessible to Spanish first-time readers? | GitHub `quiz-access-map.json` has Quiz 5 `released: true`, order 5; `middleware.js` redirects users without progress to the current unlocked lesson | No — gated by quiz progression. English-only link retained by owner approval; owner should confirm UX expectation before public release |
| Can the article be marketed as investment advice-free in all LATAM/EU jurisdictions? | Target markets not individually reviewed; page-only comparison lacks all website/advertising context | **NOT established.** A regional review must identify jurisdictions and any product/referral/partner adjacency. |
| Does ICE approve descriptive or commercial uses of its index name/material? | ICE official futures specification reserves index/data/mark rights | **NOT established.** Never imply endorsement. |

### Regulatory context — use as a risk screen, not as jurisdiction-wide certification

ESMA's official [investment-recommendation guidance](https://www.esma.europa.eu/press-news/esma-news/requirements-when-posting-investments-recommendations-social-media) explains that communications suggesting buy/sell decisions or views on future financial-instrument prices can trigger recommendation obligations. This article is about conceptual currency benchmarks, not a named purchase recommendation. ESMA/EU guidance is not automatically the governing law across unspecified LATAM jurisdictions. A disclaimer is helpful but cannot override what a communication actually does.

## Human-review decisions required before any public release

- [ ] **Rights / marks:** Name the person responsible for assessing the narrow factual index description, trademark nominative use, potential ICE licensing and any planned charts/data feeds. Record `PASS / PASS WITH EDITS / HOLD` and timestamp. Owner's first-party rights attestation does not automatically clear ICE materials.
- [ ] **Target markets:** Specify which countries (LATAM and/or EEA) the Spanish public page targets. Record each relevant local financial-content/advertising consideration and reviewer decision. If the target is broad, retain a HOLD pending suitable scope.
- [ ] **Page context:** Review website CTAs, payment/referral adjacency, affiliate placement, analytics/consent behavior, and notices in the *final public layout*, not just the isolated Markdown. Do not infer that general site commerce is part of this article.
- [ ] **Education vs recommendation:** Confirm no personalized recommendation, promised upside, real-time trading signal, undue certainty, conflict omission or unlicensed data visualization was added through wrappers, structured data, promotional excerpts or calls-to-action.
- [ ] **Quiz gating and language:** Owner accepts that the linked Quiz 5 is English-only and may redirect first-time visitors to prior gated lessons. Decide whether to add an explicit public label or wait for a Spanish quiz; the current owner-approved link is unchanged.
- [ ] **Final source date and attribution:** Check official Fed/ICE links again at release, update `lastReviewed` if warranted, and approve citation wording and any use-permission decision. Working review dates are **not** an evergreen guarantee of live URLs.
- [ ] **Explicit separate publication approval:** Prepare an independent release PR only **after** the above written decisions. Include exact-head QA, noindex staging and rollback plan. No automatic merge, index flip, domain/SSO change, newsletter launch or checkout modifications are authorized.

### Technical release checklist (not authority)

1. Development-only private Preview at `/internal/localization/dxy-broad-usd/` must return 200 with `noindex, nofollow`, Spanish consent with optional analytics off, three verifiable institutional links, English-gated quiz disclosure and owner-approved sentence.
2. Preview and Production **public** `/es/dxy/dxy-vs-broad-usd/` must remain 404 until a separate release is approved.
3. Verify exact blob SHA, existing course-progress middleware untouched, no entitlement bypass, public-sitemap/hreflang exclude the new slug, and exact-head GitHub CodeQL/dependency/locale/build tests all green.
4. Maintain SSO for all protected Previews, and retain previous Production deployment URL/commit as the rollback baseline. Do not use a public-access workaround to pass QA.
5. When a separate release decision is signed, the owner must explicitly authorize the public route, index/noindex phase, canonical/hreflang scope, promotional messaging and date. Current packet does **not** request this.

**Decision currently: HOLD.** Completed: first-party provenance, owner-scoped editorial acceptance, primary-reference claims review, private technical QA and corrected hypotheticals. Open: qualified third-party rights/context review, target-jurisdiction decision, confirmed quiz UX scope, and distinct publication approval.
