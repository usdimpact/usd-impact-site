# Multilingual “Following the Dollar” companion-publication network — foundation v1

Status: **REGISTRATION GATE PASSED / ARCHITECTURE READY / PUBLIC LAUNCH HOLD**  
Checkpoint: **2026-10-28**  
Related issue: **#798**

## 1. What changed

The issue's explicit prerequisite — wait for all ten domain-registration confirmations before build work starts — is now satisfied.

Virtono sent individual successful registration confirmations for all ten companion domains. The machine-readable record is:

`docs/operations/multilingual-companion-domain-registry-2026-10-28.json`

The connected Cloudflare account currently contains none of those names as zones. This is not a registration failure; it means Cloudflare is not the present DNS/zone authority for the ten-domain set.

A recent Virtono support ticket also established the current containment state:
- companion/adjacent domains are attached to a shared cPanel account;
- directory listing from the shared `public_html` root was exposed when no index existed;
- Virtono added `Options -Indexes`;
- non-built parked domains now fail closed rather than expose directory contents;
- `siguiendoeldollar.com` continues to serve the existing Spanish publication over HTTPS.

No public companion launch is authorized by this registration finding.

## 2. Existing Spanish reference

`https://siguiendoeldollar.com/` is the editorial reference, not a translation template to clone mechanically.

Current public characteristics verified on 2026-10-28:
- standalone Spanish educational publication identity;
- headline proposition centered on understanding markets through the dollar;
- topic hubs for Dollar/FX, Economy/Central Banks, Markets, Energy, Gold/Commodities, Bitcoin/Crypto, Equities/Indices and Geopolitics;
- long-form evergreen explainers and dated macro/current-affairs articles;
- source lists and educational/compliance notes;
- author/reviewer attribution;
- contextual links into deeper USD Impact framework material;
- explicit statement that Siguiendo el Dólar is developed by the USD Impact team;
- no personalized advice, price targets or buy/sell signals.

This is the minimum conceptual standard. The other nine sites must have genuine local editorial value, not merely translated copies.

## 3. Architecture decision

### Do not place ten public sites inside `apps/web`

The USD Impact repository currently has one runtime application: `apps/web`.

Adding ten independent editorial brands/domains directly into that runtime would unnecessarily couple:
- USD Impact deployment risk;
- commerce/auth/member systems;
- locale release controls;
- sitemaps/canonicals;
- incident/rollback scope;
- editorial publishing cadence.

### Preferred architecture

Use **one reusable companion-publication codebase** with **isolated site configurations/content roots and independent deployments**.

Conceptual layout:

```text
following-dollar-network/
  packages/
    editorial-core/
    design-system/
    source-citations/
    seo-contracts/
  sites/
    es/
      site.config.*
      content/
    pt/
      site.config.*
      content/
    it/
      ...
    fr/
    de/
    nl/
    pl/
    ro/
    el/
    sq/
```

Shared code is acceptable.

Shared article bodies are **not** the default.

Each site build must be capable of producing one domain independently without depending on another language's deployment.

## 4. Hosting / deployment boundary

Current parked-alias hosting is acceptable only as a fail-closed holding state.

Before any new language becomes public, it should receive either:
- its own dedicated cPanel document root; or
- its own isolated Vercel project/deployment boundary; or
- another reviewed dedicated hosting boundary.

Do **not** launch nine sites as aliases that all resolve to the same shared document root.

Reasons:
- accidental cross-domain content exposure;
- canonical collisions;
- one bad deployment affecting every brand;
- directory/root leakage;
- unclear rollback ownership.

### DNS rule

Do not change registrar nameservers or DNS merely to begin development.

Build on Preview/temporary deployment URLs first.

DNS/public-domain changes are a late release gate after:
- brand clearance;
- native editorial QA;
- canonical/robots/sitemap QA;
- privacy/legal pages;
- launch acceptance.

## 5. Standalone editorial-value contract

A companion site is not launch-eligible merely because translated pages render.

Each language must have a native editorial package.

Minimum launch candidate:

1. localized homepage with market-specific editorial positioning;
2. localized About/editorial-methodology page;
3. corrections/contact path;
4. privacy/cookie/legal/compliance pages appropriate to the deployment;
5. at least **six meaningful topic hubs** relevant to that audience;
6. at least **15 substantive launch articles**;
7. at least **5 articles materially localized beyond translation**, using examples, institutions, currencies, energy exposure, regional market context or search intent relevant to the target audience;
8. primary-source citations;
9. named editorial/reviewer attribution model;
10. educational/non-advice note;
11. no unsupported performance claims;
12. natural USD Impact links only where the framework genuinely adds depth.

The numeric thresholds are an internal quality floor, not an SEO guarantee.

## 6. Translation / localization policy

Never run:

`English article → machine translate → publish ten times`

Allowed workflow:

1. choose a source topic or local query opportunity;
2. write a language-specific editorial brief;
3. decide whether to:
   - create a local-original article;
   - adapt an existing Spanish/English article;
   - decline the topic as low-value for that market;
4. translate/adapt with terminology control;
5. localize examples and search intent;
6. verify primary sources independently;
7. native-language review;
8. compliance review;
9. publish only to the intended site.

When one common factual core is reused, every language version still needs independent editorial ownership and source validation.

## 7. Search / canonical rules

Each publication is a distinct site.

Default:
- self-referencing canonical on each domain;
- one sitemap index per domain;
- one robots policy per domain;
- no blanket cross-domain canonical to USD Impact;
- no blanket cross-domain canonical to the Spanish companion;
- no automatic hreflang across loosely adapted articles.

Use hreflang only when pages are true language/region alternatives of substantially equivalent content and the reciprocal mapping can be governed reliably.

Independent local-original articles should stand on their own.

## 8. USD Impact relationship

The network should not masquerade as ten unrelated publications.

Recommended disclosure:

> “[Publication] is an educational publication developed by the USD Impact team.”

The exact local-language wording should be reviewed natively.

Link behavior:
- contextual, editorial links into relevant USD Impact framework pages;
- no sitewide exact-match keyword footer-link farm;
- no forced backlinks from every article;
- no circular network designed primarily to manipulate rankings.

USD Impact remains the structured framework/product authority. Companion publications broaden editorial coverage and local relevance.

## 9. Content model

Shared schema should support:

- title;
- slug;
- locale;
- publication date;
- last reviewed date;
- authorship;
- reviewer;
- topic;
- summary;
- key points;
- article body;
- USD/dollar transmission relevance;
- source list;
- source accessed dates;
- compliance note;
- optional related USD Impact framework link;
- correction history;
- status: draft/review/published/retired.

Each site's taxonomy may differ. Do not force identical category names when local search/editorial practice suggests a better structure.

## 10. Source hierarchy

Required default:

1. primary official/statutory/institutional source;
2. official data publisher/exchange/issuer;
3. high-quality secondary reporting only where necessary;
4. no unsupported social post used as factual authority.

For time-sensitive market/current-affairs pieces:
- verify event date;
- separate fact from interpretation;
- distinguish scheduled preview from released outcome;
- avoid invented market reaction;
- fail closed if the relevant current source is unavailable.

## 11. Brand/trademark/collision gate

Before any public-facing launch:
- search exact proposed publication name;
- search close phonetic/visual variants;
- check relevant trademark/company/publication conflicts in target markets where appropriate;
- review domain/social-search collisions;
- record result.

Passing the domain-registration gate does **not** satisfy this requirement.

Any collision should be resolved before public indexing and marketing.

## 12. Security / privacy baseline

Before public deployment:
- dedicated document root/deployment;
- directory indexing disabled;
- no shared filesystem browsing;
- HTTPS;
- security headers baseline;
- no secrets in client bundle;
- no inherited USD Impact member/auth cookies unless explicitly designed;
- consent/cookie behavior appropriate to actual analytics/marketing stack;
- minimal data collection;
- support/corrections contact;
- incident rollback path.

No companion needs access to USD Impact Supabase, commerce, entitlements or member data for the editorial publication model.

Keep those systems separated.

## 13. Proposed implementation phases

### Phase 0 — complete

- ten domains registered;
- Spanish reference publication live;
- directory-listing exposure contained;
- registration inventory recorded.

### Phase 1 — shared foundation, no public launch

Create an isolated companion-publication codebase with:
- common static editorial shell;
- site configuration schema;
- article schema;
- source/citation component;
- topic landing component;
- About/methodology/corrections templates;
- canonical/robots/sitemap contracts;
- compliance template;
- per-site build command;
- automated checks preventing cross-domain canonicals and missing required disclosure.

Use placeholder/test content only.

### Phase 2 — choose one non-Spanish pilot

Pilot-selection criteria:
- native reviewer availability;
- editorial backlog quality;
- brand/collision clearance;
- market relevance;
- ability to produce 15+ substantive articles without thin translation.

Do not choose solely by domain age or language size.

Pilot stays on Preview until editorial threshold is met.

### Phase 3 — pilot acceptance

Verify:
- native editorial QA;
- standalone value;
- all sources;
- mobile/desktop;
- canonical;
- sitemap;
- robots;
- legal/privacy/corrections;
- no duplicate/thin page patterns;
- no dependence on USD Impact auth/commerce;
- isolated deployment rollback.

### Phase 4 — explicit public-domain authorization

Only after separate owner authorization:
- configure dedicated domain;
- HTTPS/DNS acceptance;
- crawl/indexability check;
- Search Console setup;
- launch monitoring.

### Phase 5 — sequential languages

Do not launch nine sites simultaneously.

Repeat the accepted pilot process language by language.

## 14. What may be built now

Now that the registration gate is cleared, safe current work includes:
- shared static publishing foundation;
- configuration/schema validation;
- Preview-only pilot shell;
- editorial planning;
- brand/collision research;
- native terminology packs;
- source-quality policy;
- test fixtures.

## 15. What remains HOLD

Without a later explicit release approval:
- DNS changes;
- public content replacement on the nine parked domains;
- Search Console/indexing submissions;
- advertising/marketing campaigns;
- automatic cross-posting;
- bulk translated article publication;
- USD Impact auth/commerce/member integration.

## 16. Immediate next engineering unit

Build **Phase 1 only** in an isolated codebase/Preview:

- multi-site static shell;
- config for all ten registered brands;
- no production domain bindings;
- no provider/database/auth dependency;
- one synthetic fixture article per site used only to prove build isolation;
- tests that each build emits its own canonical domain and never another companion domain.

After that exact-head Preview passes, choose the first non-Spanish pilot based on editorial/reviewer readiness rather than convenience.
