# Publication rehearsal prerequisites and exposure evidence - #558 / #615

## Status and scope

Reconciled and updated for the approved source-only containment, September 16, 2026. **HOLD LIVE REHEARSAL / HOLD MERGE / HOLD PRODUCTION ACTIVATION.** The metadata-only positive exposure classification is contained; effective-policy verification and Production route activation remain unimplemented. This test/design plan is not authorization to execute a live rehearsal. `publicationAuthorized=false` and `enforcementActive=false` remain governing state.

The earlier documentation increment changed only this plan, `publication-production-authority-558.md` and `publication-production-vercel-provider-558.md`. That earlier increment changed no application code or tests. The subsequent approved six-file containment changes only the provider exposure classification, its provider and authority tests, and these three runbooks. The authority implementation, workflows, SQL, environment values, alias lists, firewall rules, content and methodology are unchanged. Normal branch CI/Preview may run after the source commit; neither is a manual rehearsal or Production release.

Historical source baseline before the earlier documentation increment:

- repository: `usdimpact/usd-impact-site`;
- current base/main: `df175c72baa2c4b80eaec8bb372e92e43c18c76e`;
- parent candidate: `36808f421fcf16dc4449a66e19960009982b0dda`;
- branch: `publishing/558-calendar-validation-refresh-20260915`, draft PR #615;
- parent tree: `ee9b89c230c736efd91c580d56981a2eb0ab9a2b`.

These are a dated baseline, not perpetual current-state assertions. The documentation successor has its own SHA and needs its own checks. The eight green parent workflows and matching Preview cannot be relabeled as successor-head results. The inherited 147-file parent candidate is not granted a whole-PR release approval by this three-document increment.

## Evidence precedence and completed work

Use fresh provider/runtime evidence for live state, exact-revision source for code behavior, and explicit governing decisions for allowed actions. Preserve historical records without following superseded setup instructions.

| Area | Established evidence | Limit / action to avoid |
| --- | --- | --- |
| Source refresh | [Refresh receipt](https://github.com/usdimpact/usd-impact-site/pull/615#issuecomment-5701142538) binds the parent candidate and original combined checks. | Re-read base/head before any write/release; no silent rebase or older-head greens. |
| Revision reader | September 16 read-only managed ledger confirms `20260915141933_publication_production_reader_revision_558.sql` installed in the dedicated publication-guard Production database. The earlier catalog inspection verified the inspected reader grants and unadmitted history. | Do not reapply the installed migration. Management reads do not prove a Vercel Function's reader authentication or TLS. No secret values were retrieved. |
| Reader inputs | Earlier provisioning is recorded in the provider runbook. | Current runtime validity remains unverified; do not repeat provisioning or rotate credentials from old wording. |
| Preview wiring | [Route record](publication-route-candidate-558.md) preserves the September 15 canonical Middleware/header-forwarding/unsigned-rejection rehearsal and cleanup on the earlier #559 revision. | Not current-head, Production, admission or first-response witness proof. Do not repeat without a specific new requirement. |
| Firewall observation | [Activation receipt](https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5702611433) and [access checkpoint](https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5702737974) establish completed owner publication of the exact-host Log rule. | Keep Log; do not republish/recreate. Rule-specific traffic remains unavailable to the automation browser. Overview totals and a dash do not prove zero matches. |
| Credential alternatives | [Governing decision](https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5693790537) retires OAuth/Connect setup as a workaround for missing provider-control access. | Retained code/tests/schema are history, not instructions to provision a connector, token, key or wider permission. |

Installed schema is not active application enforcement. `publication-public-route-wiring.js` still declares `productionActivation: not-implemented`; its only accepted active mode is Preview-only. No documentation statement overrides that code fact.

## Three evidence layers must remain distinct

1. **Assigned identity:** authenticated provider metadata binds project/team/repository, exact deployment/commit and assigned hostnames.
2. **Effective access policy:** the applied protection/firewall configuration, relevant rule ordering/exceptions and actual host scope establish intended public, protected or denied entry points. A draft is not an applied version.
3. **Publication authorization and delivery:** trusted content/admission/history checks and the independent witness/receipt chain establish whether exact publication bytes may be served. Neither a hostname binding nor an HTTP 200 login page proves this layer.

The dormant `publication-production-vercel-provider.js` reads deployment metadata and assigned aliases, then now returns `exposure: unverified`. It does not inspect Deployment Protection/WAF or obtain anonymous response evidence. The authority implementation remains strict and rejects this result before reader/history access. **The unsupported positive classification is contained in source; effective-access verification is still missing, and no Production enforcement is active.**

Before live integration, review a fail-closed source contract separating these layers while retaining exact deployment/commit/artifact/manifest/history binding. Do not weaken the pinned alias comparison, trust forwarded headers, or treat a manual observation as a substitute for a runtime authority adapter. Any new evidence fields, freshness/revocation mechanism or runtime implementation require a separately scoped source change and tests.

## Source-only containment and test boundary

The approved containment starts from #615 head `9b0680ea4e39a98f3b78866f8f5b317d089d9f8f` and base `df175c72baa2c4b80eaec8bb372e92e43c18c76e`. Stop on revision drift. Exactly six existing paths are in scope: the provider loader, its provider test, the authority test and these three runbooks. No authority implementation, schema field, route, permission or credential path is added or weakened.

The regression contract requires metadata-only exposure to stay unverified, including synthetic unexpected redirects, opaque protection metadata and self-declared approval. The actual loader-to-authority composition must return `HOLD_PRODUCTION_AUTHORITY_PROVIDER_BINDING` before reader identity, revision or snapshot calls. Approved fixtures retained in isolated authority-component tests are explicitly synthetic and do not represent metadata-loader output or live access evidence.

Missing/extra/duplicate aliases, wrong deployment/commit, credential failures, no-redirect/no-store metadata requests, freshness bounds and token-error sanitization remain covered. The successor commit requires its own normal checks and matching Preview; earlier green checks are not substituted. No hosted connection, live access-policy probe, witness or admission is performed by these tests. This containment is not completion of #558 and does not clear the platform or application gates below.

## Hostname disposition to settle before enforcement

The existing five-host code constant is an assigned-alias inventory. Do not rename its runtime fields or change it in this increment.

| Host class | Review intent / known dependency | Evidence still required |
| --- | --- | --- |
| `www.usd-impact.com`, `usd-impact.com` | Preserve canonical public access and existing apex navigation. | Exact effective policy and actual public route/redirect behavior under the proposed design. |
| `usd-impact-site.vercel.app` | The published exact-host Log rule observes this address only. No Deny is approved. | Rule-filtered traffic and current callback/generation/monitoring dependencies; assigned metadata alone does not settle access. |
| `usd-impact-site-usd-impact.vercel.app`, `usd-impact-site-git-main-usd-impact.vercel.app` | Assigned technical Production aliases, not silently cleared for blocking or exclusion. | Decide and verify their effective host class individually. |
| Immutable current and historical deployment hosts | Separate from the fixed assigned-alias list. | Anonymous protection and old-deployment behavior, including after promotion/rollback. Do not test stale publication bypass only on the newest deployment. |
| Controlled Preview/branch hosts | Existing artifact/review workflows use `VERCEL_URL` / `VERCEL_BRANCH_URL`. | Preserve legitimate protected review and artifact access; never substitute a wildcard `.vercel.app` block. |

[Dependency audit](https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5701857311) and [generation-host checkpoint](https://github.com/usdimpact/usd-impact-site/issues/558#issuecomment-5702127921) are dated evidence. Historical receiving-host evidence on the canonical domain does not prove there was no upstream redirect, no later configuration change or no other consumer. Do not retrieve a secret merely to recheck that historical request.

A hostname remaining assigned but denied is not the same as an unassigned hostname. A hostname-only rule also does not prove an external proxy is the exclusive origin path. Neither claim should be added to the release packet without separate evidence.

## Platform design is not yet selected or proven

**Retain Standard Protection and the existing Log rule.** Do not switch the live project to All Deployments or stage denial under this document.

The older All-Deployments-plus-canonical-exceptions arrangement remains unproven. Official exceptions documentation describes Preview domains; a Preview exception demonstration is not proof of the required Production-domain behavior. The September 9 announcement changes feature pricing, not that logical distinction. Do not repeat obsolete paid-upgrade instructions.

Standard Protection plus narrowly scoped hostname WAF is an alternative design candidate, not a deployed stale-publication control. Its assigned/effective-access contract, legitimate dependencies and current rule-specific observations must be reconciled before choosing an enforcement test. Quiet traffic alone is insufficient: record the sampled interval/timezone, natural scheduled cycles actually included, retention limits and consumers not covered. No universal safe duration or zero-match threshold is established here.

The September 16 accessible Vercel inventory showed only the Production-bearing `usd-impact-site` project. A Preview within it is not project isolation. The exposed connector did not provide protection/firewall read-change-restore controls; the attempted browser reached Login. This is an access limitation, not missing approval. Do not repeat blocked login attempts, request setup screenshots again or expand credentials to evade it.

## Gate before any isolated platform test

No disposable project, deployment, alias, token or permission is created by this plan. Before requesting execution approval, record all of the following:

- the selected capability hypothesis and its exact applicability limit (Preview-only versus Production-domain behavior);
- a separately approved isolated project/resource plan, with no existing USD Impact domain binding or connection to application/customer databases;
- an authenticated owner control path that can inspect active/draft settings, make only the reviewed change, and verify exact restoration;
- the baseline configuration/version, complete proposed diff, cleanup procedure, named operator and stop conditions;
- the applicable dependency/traffic findings and every remaining UNKNOWN;
- current canonical Production identity/availability as an unchanged control.

Project-wide Deployment Protection on `usd-impact-site` must not be called Preview-only. If a safe target requires a paid add-on, real domain/DNS change, repository clone, application secrets, database access or wider permission, stop: none is authorized here. Do not relax #615's pinned project/branch/runtime checks to run the full candidate in a disposable project.

## Bounded platform acceptance matrix - not executed

Use only synthetic static marker content in a future separately authorized platform-only test. No actual article, generation endpoint, webhook, customer data or email is needed. Only exercise the chosen design, not a combined exception-and-WAF experiment.

| Stage | Required observation | Reject / stop condition |
| --- | --- | --- |
| Baseline | Record fresh anonymous final URL, redirect chain, status, marker absence/presence and relevant cache headers for each approved test host. | A login page returning 200 is not marker access; no share/bypass credential in the anonymous client. |
| Exact change | Review/apply only the approved isolated setting and capture its applied version. | Additional draft changes, unclear scope, drift, unsupported API semantics or uncertain result: stop without repeating or discarding others' work. |
| Intended public host | Exact marker available only where intended; preserve unrelated test controls. | Do not generalize Preview-domain success to Production-domain applicability. |
| Restricted host | Marker unavailable on each selected restricted host with the expected protection/denial semantics. | Missing observations are UNKNOWN, not PASS. A failed network request alone does not identify the blocking layer. |
| Warm client | A previously warmed restricted URL is checked again after the reviewed policy transition; cache/status/bytes are recorded. | No stale marker leakage; for a hostname-denial design, no IP-persistent denial of the otherwise allowed control host. |
| Restoration | Reverse only the approved test change, verify original behavior with fresh requests, then remove only newly created test resources and verify final inventory. | Uncertain cleanup blocks progression; expiry is not cleanup proof. Existing Production identity/settings/availability must remain unchanged. |

Successful platform tests establish only the tested capability, environment and settings. They do not authorize a Production change or close #558.

## Separate application acceptance gates

After an explicitly reviewed application integration exists, the later end-to-end test packet must bind each result to its actual source/deployment and test data:

- real authenticated authority/least-privilege reader integration, verified TLS, current revision and fail-closed handling of missing/stale/drifting evidence;
- durable admission, one-use witness challenge and the required origin/deployment/path/body-bound v2 receipt; neither a mocked receipt nor a Function finish event bootstraps public history;
- a preview valid before the official deadline but held open until the deadline or later must not become a new current publication through any permitted release/serving path, including old deployments, alternate hosts, raw aliases and rollback;
- unchanged legitimate pre-event archives remain identifiable and available under the archive contract; current aggregates exclude expired previews; a passed calendar clock alone never verifies an outcome;
- homepage, news composite, dated article, catalyst route, latest JSON, feed and sitemap behavior; cold/warm cache, render-time clock crossing, authority/history drift, outage and recovery;
- exact-head/base full-scope quality/review, independently evidenced cleanup, separate release approval and post-release Production verification.

The witness and route documents contain component contracts, not current live proof. Check their status against later governing records before planning another migration or credential action.

## Resume and authorization boundary

Read-only traffic/control evidence and design review may continue under the existing review authorization. The single next gate is the effective-host-policy evidence/design decision, not another Log publication or general Preview check. When access evidence is unavailable, preserve the HOLD and saved checkpoint rather than manufacture traffic or claim completion.

No authorization here to merge/mark ready, deploy/promote/rollback, change protection/firewall/domains/DNS, create resources/credentials, mutate hosted SQL, create authorizations/admissions/receipts, dispatch/rerun workflows, generate or edit publication content, send email or alter scheduled tasks. Any such increment needs its own exact scope and approval. Keep #558 open and #615 draft/unmerged.

## Primary references (provider documentation, not account-state evidence)

- [Deployment Protection and project scope](https://vercel.com/docs/deployment-protection)
- [Preview-domain exception scope](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions)
- [September 9, 2026 availability/pricing announcement](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan)
- [Custom-rule Log behavior and review/publication](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules)

Where older documentation and a later dated announcement differ on pricing, do not use the older statement as an upgrade requirement. Account eligibility, authenticated management capability and actual access behavior still require their own evidence.
