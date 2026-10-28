# Spanish audiobook — publisher/counsel decision-ready matrix — 2026-10-28

Status: **DECISION READY / RECOMMENDATIONS ONLY / RELEASE HOLD**

This document converts the remaining Spanish audiobook Gate B questions into explicit decisions. It does not provide legal advice and does not authorize distribution.

Authoritative supporting records:
- `SPANISH_AUDIOBOOK_LEGAL_PUBLISHER_HANDOFF_2026-10-28.md`;
- `SPANISH_AUDIOBOOK_LEGAL_SOURCE_VERIFICATION_2026-10-28.md`;
- `SPANISH_AUDIOBOOK_TRACK00_SOURCE_PROVENANCE_2026-10-28.md`;
- `SPANISH_AUDIOBOOK_RELEASE_BLUEPRINT_2026-10-28.md`.

## Recommended default posture

The conservative release posture is:

- disclose AI narration visibly even if counsel later concludes a particular statutory disclosure rule is not triggered;
- retain historical HeyGen Creator-plan production evidence and do not infer historical rights from the current Free-plan state;
- do not claim an EAA microenterprise exemption until applicable national-law/business-status analysis confirms it;
- disclose actual product functionality and technical restrictions accurately;
- preserve the accepted Spanish Edition 1.3 Candidate 1 provenance unless publisher explicitly revises the edition designation;
- preserve the existing 20-track narration programme and avoid regeneration unless a legal/editorial decision requires changed spoken wording;
- keep member delivery OFF until the matrix below is returned and Track 00 exact bytes are frozen.

## Decision A — AI narration disclosure

### Recommended publisher/editorial default

Visible Spanish wording:

**“Narración generada por IA, con revisión humana de calidad.”**

English reference:

**“AI-generated narration with human quality review.”**

Recommended placement:
- member audiobook landing/player page before first playback;
- product/help/accessibility information where audiobook characteristics are described.

### Counsel decision required

Return one:
- **PASS** — wording/placement sufficient;
- **EDIT** — provide exact replacement wording and placement;
- **PROCESS** — additional provider marking/technical evidence must be retained;
- **HOLD** — do not distribute until a specified legal question is resolved.

Do not require re-synthesis unless counsel expressly requires a spoken disclosure rather than visible disclosure.

## Decision B — HeyGen / Narrator Mateo commercial-rights evidence

Current evidence:
- historical production records identify Creator-plan use during the relevant production period;
- current HeyGen terms give Creator/Pro/Business users commercial-use rights in User Output subject to the terms and third-party-right responsibilities;
- current connected plan is Free and must not rewrite historical production state;
- current connected voice inventory does not by itself establish the historical voice-rights status;
- no invoice/receipt was found in the connected Gmail searches performed to date.

### Recommended disposition

**PROCESS / COUNSEL-PUBLISHER REVIEW.**

Counsel/publisher should state whether the retained evidence is sufficient or require one or more of:
- generation-date HeyGen terms snapshot;
- historical invoice/plan receipt;
- voice catalog/source evidence;
- explicit provider confirmation.

Do not infer a PASS merely from current terms.

## Decision C — accessibility / EAA scope

Current product facts:
- protected browser-based member player;
- 20 structured tracks;
- written Spanish edition remains available separately;
- no promise of synchronized text/audio;
- no public download;
- access requires sign-in + Library Pass entitlement.

### Recommended disposition

**PROCESS.**

Counsel should determine:
- applicable national transposition;
- whether KELA qualifies for the relevant microenterprise service exemption;
- whether the standalone audiobook/player is treated under e-book requirements;
- whether a specific accessibility statement or companion treatment is required.

Regardless of exemption analysis, retain:
- keyboard/semantic player controls;
- clear track labels;
- written product characteristics;
- non-audio access to the written edition/navigation context.

## Decision D — consumer digital-content/pre-contract wording

### Recommended product facts to disclose before access/purchase reliance

- Spanish-language audiobook of *Read the Dollar First*;
- Library Pass entitlement required;
- browser-streamed private audio;
- ordinary modern browser audio capability required;
- no offline download promised;
- short-lived signed media access;
- 20-track structure;
- listening progress stored locally in the browser;
- AI-generated narration with human quality review;
- Spanish audiobook is separate from, and does not replace, the English audiobook;
- printed navigation aids/page numbering are not narrated literally;
- support/contact path;
- edition/version/data-cutoff provenance.

### Recommended disposition

**EDIT BEFORE RELEASE / THEN COUNSEL PASS.**

Engineering can implement accurate facts after exact wording is approved. Do not overstate compatibility or accessibility.

## Decision E1 — spoken rights label

Current accepted Track 00 contains the governed spoken adaptation:

**“USD Impact. 2026. Todos los derechos reservados.”**

### Recommended disposition

**PASS unless counsel requires exact alternative wording.**

Any required spoken change reopens only the affected Track 00 audio/QA path, not the whole book.

## Decision E2 — rights-scope grammar

### Recommended disposition

**COUNSEL REVIEW.**

If current manuscript wording is legally/grammatically acceptable, preserve the accepted audio. If not, provide the exact replacement sentence and identify the affected track/time scope.

No blanket regeneration.

## Decision E3 — edition/candidate metadata

Current production authority:
**Spanish Edition 1.3 Candidate 1.**

### Recommended disposition

**OWNER/PUBLISHER DECISION.**

Preferred conservative choice:
- retain truthful 1.3 Candidate 1 provenance in internal/release records;
- use consumer-facing “Spanish audiobook edition” wording only if it does not falsely imply a manuscript edition change;
- preserve date/data-cutoff facts.

If publisher wants a new final edition designation, update the authoritative manuscript metadata first and explicitly assess whether any spoken metadata needs replacement.

## Decision E4 — printed navigation adaptation

Current narration intentionally does not read literal printed URLs/page navigation line-by-line.

### Recommended disposition

**PASS subject to accessibility review.**

Preserve:
- structured track navigation;
- clear track titles;
- access to the written edition/companion material;
- any accessibility information required by Decision C.

Do not regenerate literal URLs/page numbers unless there is a concrete accessibility/legal requirement.

## Final distribution decision

Final publisher/counsel response must state one of:

- **AUTHORIZED FOR PRIVATE MEMBER RELEASE** — with any exact conditions;
- **AUTHORIZED AFTER LISTED EDITS** — list exact changes;
- **HOLD** — identify unresolved condition.

Even an authorized Gate B decision does not by itself perform release.

Engineering release still requires:
1. exact Track 00 binary materialization + SHA-256;
2. final 20-track MP3 freeze/checksums;
3. private storage upload verification;
4. fresh current-main locale-aware runtime PR;
5. exact-head CI/CodeQL/Preview;
6. separate explicit Production/member-delivery authorization.

## Return format

| Decision | PASS / EDIT / PROCESS / HOLD | Exact wording/action required |
|---|---|---|
| A. AI narration disclosure | | |
| B. HeyGen / Narrator Mateo commercial rights | | |
| C. Accessibility / EAA scope | | |
| D. Consumer digital-content wording | | |
| E1. Spoken rights label | | |
| E2. Rights-scope grammar | | |
| E3. Edition/candidate metadata | | |
| E4. Printed navigation adaptation | | |
| Final private member distribution | | |

No blank row may be interpreted as approval.
