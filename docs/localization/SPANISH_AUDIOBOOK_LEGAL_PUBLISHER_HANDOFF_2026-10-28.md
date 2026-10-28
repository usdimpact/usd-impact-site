# Spanish audiobook — legal / publisher decision handoff — 2026-10-28

Status: **FOR COUNSEL / PUBLISHER DECISION — NO LEGAL CONCLUSION / NO RELEASE AUTHORITY**

This handoff isolates the remaining legal/publisher questions for the Spanish audiobook of *Read the Dollar First*. Engineering, transcript, acoustic and private-delivery-format work is substantially complete. This document does not authorize public distribution, member delivery, storage upload, entitlement changes or Production release.

## 1. Current factual product state

Operator/publisher context:
- USD Impact operator: KELA LEADS S.R.L.
- product: Library Pass digital learning library;
- Spanish audiobook is intended as a localized Library Pass asset, not a separate entitlement;
- public/member Spanish audiobook delivery is currently disabled;
- current-main localization state remains `releaseStatus=private_hold` and `audiobookMemberDelivery=false`.

Content / QA:
- source authority: Spanish Edition 1.3 Candidate 1;
- selected narration: 20 private tracks;
- owner-reported full-track listening: **20/20 PASS**;
- selected transcript/source coverage and Track 00 legal/compliance passages have been checked;
- 19 exact selected WAV exports pass objective audio QA;
- a conservative 192 kbps MP3 private delivery profile has been technically validated;
- no Spanish audiobook file has been uploaded to Production member storage.

Current protected English audiobook precedent:
- member-only access;
- private signed asset URLs after Library Pass entitlement verification;
- native browser audio controls;
- progress stored locally in the browser;
- page copy states: **“AI-generated speech with human quality review.”**

Spanish narration provider record:
- provider used for production: HeyGen;
- paid plan recorded during production: Creator;
- selected voice: `Narrator Mateo`;
- historical voice ID: `626ca51acb2e496f8dcee8d7591fda3c`;
- current 2026-10-28 HeyGen public/private model-audio API inventories do not return that historical voice ID, so current catalog presence must not be inferred from the historical ID.

## 2. AI Act — factual source position

Primary source:
https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02024R1689-20260727

The current consolidated Artificial Intelligence Act, Article 50, distinguishes at least two relevant obligations:

### Provider-side synthetic-content marking

Article 50(2) applies to **providers of AI systems** generating synthetic audio, image, video or text and requires machine-readable/detectable marking of outputs, subject to the provision's limits and exceptions.

This is structurally a provider obligation. The audiobook publisher should not silently assume that a visible end-user disclosure substitutes for any provider-side technical marking duty.

### Deployer-side deep-fake disclosure

Article 50(4) requires deployers to disclose artificially generated/manipulated audio when the content constitutes a **deep fake**.

The Regulation defines a deep fake as AI-generated/manipulated image, audio or video that resembles existing persons, objects, places, entities or events and would falsely appear authentic or truthful.

The current record does **not** establish that Narrator Mateo represents or imitates a specific real person. Therefore this document does not classify the audiobook as a deep fake.

If a deployer disclosure is required, Article 50(5) requires the information to be clear and distinguishable no later than first exposure and to conform to applicable accessibility requirements.

### Practical existing control

USD Impact already uses a conservative disclosure on the English audiobook:

**AI-generated speech with human quality review.**

Engineering recommendation, independent of the final legal classification:
- preserve an equivalent clear Spanish disclosure at the player/byline level if the Spanish audiobook is released;
- do not bury it only in legal terms;
- do not state or imply that the narration is entirely human-recorded.

### Counsel decision A

Please state:
1. whether this Spanish synthetic narration is subject to any deployer disclosure obligation under Article 50(4);
2. whether it is properly classified as, or outside, the statutory “deep fake” definition;
3. whether the proposed visible Spanish equivalent of “AI-generated speech with human quality review” is sufficient in wording and placement;
4. whether any separate operator record/evidence should be retained regarding Article 50(2) provider-side marking.

## 3. HeyGen commercial-output / voice rights

Current HeyGen terms:
https://www.heygen.com/terms

Current terms state, for Creator/Pro/Business users, that as between HeyGen and the user, the user owns User Output and HeyGen does not restrict use of User Output for the user's own purposes, including commercial purposes, while placing responsibility on the user for third-party rights and lawful use.

Current terms also prohibit misleading distribution of AI output and require disclosure where applicable law requires it.

HeyGen's current public materials describe commercial use of HeyGen Voice outputs, but the historical Narrator Mateo ID is not returned by the current model-audio catalogs.

### Production-window account evidence

The private production branch contains contemporaneous HeyGen account-state records from **2026-10-07** showing:
- `billing_type=subscription`;
- plan: **Creator**;
- premium credits remaining: **2** at the recorded checkpoint;
- no add-on credits available.

Separate repository-key Developer API wallet evidence was recorded during Appendix B production; that wallet is a different balance mechanism and should not be conflated with Creator subscription credits.

Fresh 2026-10-28 checks add two clarifications:
- the currently connected HeyGen account now reports plan **Free**; this is current state only and must **not** be used to rewrite the historical production-window plan record;
- Gmail contains a HeyGen render-complete notification dated **2026-10-07 19:06 UTC** for `USD Impact — Spanish Audiobook Mateo — Intro Fallback Test`, which corroborates active HeyGen production during the relevant window.

A targeted Gmail search found **no HeyGen invoice/receipt/subscription billing email** for the searched September–October 2026 window. Absence from the connected inbox is not proof that no invoice or billing record exists elsewhere.

### Important evidence limitation

The production record establishes a HeyGen Creator account and the exact historical voice ID used, but this handoff does **not** prove:
- what catalog/source classification applied to that voice on each generation date;
- that today's HeyGen terms are byte-for-byte the same terms that governed every October 2026 generation;
- whether any separate third-party voice-provider terms applied behind that historical catalog voice.

### Counsel / publisher decision B

Please state whether the existing evidence is sufficient for commercial Library Pass distribution, or whether the file should additionally retain:
- a generation-date HeyGen terms snapshot;
- account/plan invoice or plan evidence;
- voice-catalog/provider provenance;
- any additional consent/licence evidence for Narrator Mateo.

Do not infer a missing third-party right merely because the voice is no longer in today's catalog; equally, do not infer current catalog licensing from the old ID.

## 4. European Accessibility Act

Primary source:
https://eur-lex.europa.eu/eli/dir/2019/882/oj

The Directive applies, from the national implementation date, to specified consumer services including:
- e-books and dedicated software;
- e-commerce services.

Article 4(5) provides a service-side exemption for **microenterprises providing services**, subject to the Directive/national transposition framework.

Annex I contains:
- general accessibility requirements for covered service websites/mobile services;
- e-book-specific requirements;
- e-commerce-specific requirements.

For e-books, Annex I includes requirements concerning accessible navigation/interoperability and, when an e-book contains audio in addition to text, synchronised text and audio.

The current Spanish audiobook is planned as a **separate protected audio edition**, not an EPUB/e-book file containing an embedded synchronized audio layer. The Library Pass sales/member experience is nevertheless an online consumer/e-commerce service.

### Current product evidence

The existing player architecture already includes:
- native `<audio controls>`;
- keyboard-operable controls;
- labels/track titles;
- `aria-live` playback/status text;
- separate browser-local progress key;
- an existing public accessibility page;
- no forced autoplay.

The print/ebook Table of Contents and page-numbered analytical index are not narrated in the selected 20-track programme. The current editorial record treats that as a potential format adaptation requiring publisher approval, with navigation preserved through track titles/player metadata and written editions.

### Counsel decision C

Please determine:
1. whether KELA qualifies for the service-side microenterprise exemption under the applicable national implementation(s);
2. whether the standalone audiobook itself should be treated as an “e-book” service for the specific Annex I e-book requirements;
3. regardless of that classification, what accessibility obligations apply to the Library Pass e-commerce/member/player journey;
4. whether omission of printed page-number navigation aids from spoken narration is acceptable when accessible written navigation and structured track navigation remain available;
5. whether an accessibility statement/product description must be updated specifically for the Spanish audiobook.

Do not treat the Directive-level microenterprise exemption as self-executing proof without checking the applicable national transposition and factual enterprise classification.

## 5. Consumer digital-content information / conformity

Primary sources:
- Consumer Rights Directive 2011/83/EU, current consolidated text:
  https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02011L0083-20260927
- Digital Content Directive (EU) 2019/770:
  https://eur-lex.europa.eu/eli/dir/2019/770/oj/eng

Directive 2011/83 Article 6 includes pre-contract information requirements for digital content, including functionality and relevant interoperability/compatibility information.

Directive 2019/770's conformity framework includes, where applicable, functionality, compatibility, interoperability, accessibility, continuity and security, and conformity with descriptions/public statements.

### Current proposed delivery facts

If released under the current blueprint:
- browser-streamed MP3 audio;
- Library Pass sign-in/active entitlement required;
- short-lived private signed URLs;
- no public permanent asset URL;
- ordinary modern browser audio support required;
- listening position stored locally in the browser;
- Spanish edition does not replace the English audiobook.

### Counsel / commercial decision D

Please state whether any Library Pass landing page, terms, refund/withdrawal copy, accessibility page or member help copy must be amended before adding the Spanish audiobook, specifically for:
- streaming-only / signed-access functionality;
- browser/device compatibility;
- entitlement/access duration;
- AI-generated narration;
- language/version/edition description;
- consumer expectations created by existing Library Pass marketing.

## 6. Copyright / publisher wording decisions

The authoritative Spanish manuscript begins with a standard copyright notice. The selected spoken Track 00 deliberately uses an adapted spoken opening:

Printed label:
`Copyright © 2026`

Selected spoken form:
`USD Impact. 2026. Todos los derechos reservados.`

The subsequent reproduction-restriction passage and educational/non-advice disclaimer have been reconciled against the manuscript at normalized token level.

### Open publisher decisions

#### E1 — spoken rights label
Approve the selected spoken adaptation, or provide exact replacement wording.

#### E2 — rights-scope grammar
The manuscript and narration contain the same existing rights-exception grammar. An alternate wording was prepared historically but not approved. Decide whether the frozen source remains acceptable or requires a controlled manuscript/audio revision.

#### E3 — edition/candidate metadata
The selected narration contains Edition 1.3 / candidate-era metadata tied to August 2026 and an April 2026 data cutoff. Decide whether this is intentionally historical edition provenance or whether release-facing metadata must be revised before publication.

Any required spoken change would reopen scoped private synthesis/listening only for the affected passage.

#### E4 — print navigation adaptation
Approve or reject omission of the page-numbered printed Contents and Analytical Index from literal narration. If approved, preserve equivalent navigation via track titles/player structure and the accessible written edition/companion.

## 7. Final counsel / publisher response requested

Please return a compact decision matrix:

| Decision | PASS / EDIT / PROCESS / HOLD | Exact requirement if not PASS |
|---|---|---|
| A. AI narration disclosure / Article 50 | | |
| B. HeyGen / Narrator Mateo commercial-rights evidence | | |
| C. Accessibility / EAA / microenterprise scope | | |
| D. Consumer digital-content / pre-contract wording | | |
| E1. Spoken rights label | | |
| E2. Rights-scope grammar | | |
| E3. Edition/candidate metadata | | |
| E4. Printed navigation adaptation | | |
| Final Spanish audiobook publisher release | | |

Also state:
- any mandatory exact wording change;
- whether any new audio must be generated;
- whether existing owner/editorial QA may be relied upon after the legal wording decisions;
- whether the current visible AI disclosure approach is sufficient;
- any mandatory pre-release filing/notice/record retention.

## 8. Release boundary

Until the matrix above is resolved:
- Spanish audiobook member delivery remains OFF;
- no Production audio storage upload;
- no public/member Spanish audiobook route;
- no entitlement change;
- no wholesale merge of historical PR #797;
- private encoded candidates remain QA assets only;
- current English audiobook remains unchanged.

This handoff is evidence and question framing only, not legal advice or a legal conclusion.
