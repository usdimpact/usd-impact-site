# Independent Macro Weekly November 2–6, 2026 — release-readiness and owner review matrix

**STATUS: INTERNAL / DRAFT / NO RELEASE AUTHORITY.** This matrix is a review aid, not a legal opinion, proof of human review or permission to merge, deploy, index, schedule or spend. It accompanies the source packet and original editorial draft in [PR #1185](https://github.com/usdimpact/usd-impact-site/pull/1185).

## Precisely what has been established

- **Scope verified:** The review package is internal Markdown in `docs/operations/`. It has no Astro page, content feed, backend handler or publication job. The existing independent [October 26–30 edition](https://www.usd-impact.com/macro-reviews/weekly/2026-10-30/) is separately published; its existence is not authority to release another date.
- **AI-assisted factual cross-check (limited):** The five anchor figures and dates in the Nov 2–6 source packet / draft were compared with original dated U.S. issuer releases. This is **not an identified natural-person editorial sign-off**, legal clearance or a final whole-week source sweep.
- **No market-performance claim:** There are no synchronized, rights-cleared prices for DXY/USD, EURUSD, TIPS yields, WTI, Henry Hub, TTF, XAUUSD, BTCUSD or U.S. equities. Conditional transmission mechanisms are not observed movements, investment recommendations or price forecasts.
- **Score and Monthly:** The rights-held `.github/workflows/weekly-report.yml` and independent October Monthly publication remain excluded. Source claims cannot migrate into the original Score without separate rights and schema approvals.

## Source-by-source editorial sign-off ledger

| Source claim | Release date / reference period | Original official source | Machine-assisted source check | Human editor confirmation | Final correction sweep |
| --- | --- | --- | --- | --- | --- |
| September JOLTS: 7.5m openings, 5.4m hires, 3.4m quits | Nov 3 / September | https://www.bls.gov/news.release/archives/jolts_11032026.htm | Completed for listed figures | **PENDING** | **PENDING** |
| Treasury: $125bn offered, ~$97bn refunding, ~$28bn new cash; auctions Nov 9/10/12 | Nov 4 / Nov financing calendar | https://home.treasury.gov/news/press-releases/sb0678 | Completed for listed figures and dates | **PENDING** | **PENDING** |
| U.S. trade deficit $105.0bn, exports $321.5bn, imports $426.6bn | Nov 4 / September | https://www.bea.gov/news/2026/us-international-trade-goods-and-services-september-2026 | Completed for listed figures | **PENDING** | **PENDING** |
| Nonfarm labor productivity +3.6% annualized; output +3.7%; hours +0.1% | Nov 5 / Q3 preliminary | https://www.bls.gov/news.release/archives/prod2_11052026.htm | Completed for listed figures and units | **PENDING** | **PENDING** |
| Payroll employment +165,000; unemployment 4.1% | Nov 6, 08:30 ET / October | https://www.bls.gov/news.release/archives/empsit_11062026.htm | Completed for listed figures | **PENDING** | **PENDING** |

**Important scope distinction:** The table checks selected agency statements, not every nuance, revision, causal interpretation, headline or material release potentially relevant after Friday's full U.S. close. Agency release times are issuer-stated release/embargo times; they are **not** independently demonstrated first website-posting timestamps. A mutable calendar page must never substitute for a dated original document.

## Exact owner and editorial decisions — all must be recorded for a *later separate public article*

| Gate | Required concrete evidence / decision | Current state |
| --- | --- | --- |
| Final reporting-week close | Date/time of end-of-Friday U.S. session review and official agency correction/late-news sweep; mark missing important releases explicitly | **HOLD — no final sweep recorded** |
| Natural-person editorial accountability | Named responsible editor, direct source-by-source fact check, approved exact article content SHA, dated corrections and approval trace; this internal assistant check cannot fill the field | **HOLD** |
| AI transparency and disclosure | Determine the actual EU AI Act Article 50(4) path with applicable responsible person and qualified assessment where needed; use an intelligible public AI-assisted-preparation notice unless an independently evidenced exception applies | **HOLD — no legal determination** |
| Rights / attribution | No third-party licensed feeds/assets, agency logos, copied tables or long release excerpts; cross-border publication rights and any required notices assessed under [#1031](https://github.com/usdimpact/usd-impact-site/issues/1031); official links must not imply agency endorsement | **HOLD — rights assessment not certified** |
| Financial-language boundary | Original factual educational analysis only; distinguish assumptions/conditional effects from issuer facts; no USD/asset direction or return without verified right-cleared timestamps and calculations | **Partial internal check only** |
| Privacy / analytics / consent | Explicit no-tracking/noindex-first choice, actual network/cookie verification on Preview and Production after approval; no implied GA/ePrivacy compliance merely from absence of a script in one file | **HOLD** |
| Layout and legal parity | Choose and review authorized page architecture, accurate KELA LEADS S.R.L. / contact, privacy/terms/compliance footer, consent applicability, AI notice, working agency/source links and mobile accessibility | **HOLD** |
| Final public artifact | Separate protected PR with one bounded Nov 2–6 article route/content item, approved target path, true publication time and explicit indexing/sitemap/feed decision; no older article rewrite or Score workaround | **NOT CREATED / NOT AUTHORIZED** |
| Protected release | Genuine eligible `pull_request` Web Quality, dependency, migration guard and CodeQL at the *final public-artifact HEAD*; exact Preview READY, owner-specific exact-head approval, normal protected merge without bypass | **NOT STARTED** |
| Production parity and acceptance | Vercel Production READY at merge SHA; same SHA served on canonical domains; date route 200, adjacent unpublished routes 404, source links, metadata/robots, font/layout/mobile/keyboard and network checks | **NOT STARTED** |

### Notable architecture decision before implementation

The published October 30 independent Weekly is a **standalone HTML Astro page** (`apps/web/src/pages/macro-reviews/weekly/2026-10-30/index.astro`). It explicitly sets `lang=en`, robots and Googlebot to `noindex,nofollow,noarchive,nosnippet`, `referrer=no-referrer`, provides a keyboard-visible skip link, source links, operator/legal footer and an AI-assisted-preparation disclosure. It uses locally served brand fonts. Historical tracker #1031 also references `BaseLayout` parity. These are **not identical technical implementations**.

**Owner/editorial decision needed:** Specify whether the new date should reuse a reviewed standalone route with equivalent site/footer/consent obligations, or migrate to a separately audited shared layout. Do not silently swap architectures, inherit unverified tracking, or count the October 30 route's behavior as a test of the new page.

### Minimum release acceptance matrix, after an explicit article decision

1. **Source and signed editorial record:** Record final review timestamp in UTC and New York time, reference periods and five primary links, all changed/corrected issuer facts, responsible editor and AI/rights decision. Any unsupported claim means HOLD or correction.
2. **Independent route construction:** Create separately scoped date `/macro-reviews/weekly/2026-11-06/` only if approved; leave the original Score and other dated route builds unchanged. Start with `noindex,nofollow,noarchive,nosnippet` unless a separately approved indexing decision explicitly changes it.
3. **Pre-release negative tests:** Verify no new licensed feeds/Score, no unconsented analytics, no unintended sitemap/feed entries, no adjacent unpublished route generated, no changes to Daily/Monthly cron, commerce, storage or Research; check keyboard focus, 320/375/768/1280-pixel layouts and legal/footer links.
4. **Exact protection:** Genuine final-head `pull_request` checks, matching READY Preview, dated article-specific approval, protected merge and SHA-preserving deployment; fail closed if `main`, PR HEAD or checks move.
5. **Post-release independent proofs:** Target article 200, adjacent date 404, article source URLs valid, rendered robots/referrer/AI/legal statements, canonical domains/HTTPS, mobile/keyboard, tracking/consent inspection, Vercel READY exact merge SHA; only then update [publication tracker #1129](https://github.com/usdimpact/usd-impact-site/issues/1129) to `PUBLISHED_VERIFIED`.

## Solo-owner action record (not yet filled)

- Reviewer / accountable person: **NOT PROVIDED**
- Final Friday source/market close review (UTC date/time): **NOT RECORDED**
- Final approved public-article HEAD / Git blob: **NONE — no public artifact**
- AI disclosure determination and actual editorial responsibility evidence: **NOT RECORDED**
- Rights/privacy assessment and any residual-risk decision: **NOT RECORDED**
- Layout (standalone versus shared layout) decision: **NOT RECORDED**
- Owner instruction authorizing new public route, noindex/index and protected merge: **NOT GIVEN**
- Post-deployment verification evidence: **NONE — no public route**

**This matrix is documentation. It does not execute or authorize any withheld release.** Preserve independent Weekly rights review [#1031](https://github.com/usdimpact/usd-impact-site/issues/1031), Daily acceptance [#840](https://github.com/usdimpact/usd-impact-site/issues/840), publication tracker [#1129](https://github.com/usdimpact/usd-impact-site/issues/1129) and the Score/Monthly holds.
