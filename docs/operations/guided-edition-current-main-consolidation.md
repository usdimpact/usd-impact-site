# Guided Edition current-main consolidation control

Status: release candidate preparation only. Public checkout remains disabled.

## Purpose

This control records the narrow current-main consolidation introduced by #235/#236 so the historical stacked PRs are never treated as deployable release candidates.

## Current implementation boundary

The current-main candidate provides:

- entitlement-first access to `/guided-edition/`;
- server-side catalog reads for published Guided content;
- 13-chapter reader support from the existing `guided_content_releases` catalog;
- protected supplement/reference reads from `guided_supplement_releases`;
- account-scoped progress reads;
- server-mediated progress writes through `record_guided_learning_progress`;
- server-owned mastery scoring with answer keys stripped from browser payloads;
- content-version-aware progress reset behavior;
- account entry back into the protected Guided library;
- existing protected audiobook and 51-film Video Library dispatch preserved.

No payment-provider adapter, checkout activation, entitlement grant, customer fixture, Production data mutation, lifecycle-email send, or scheduler activation is part of this candidate.

## Required release invariants

Before #236 can be considered merge-ready:

1. exact-head Web Quality succeeds;
2. exact-head Vercel Preview reaches READY;
3. no unresolved GitHub review threads;
4. no unresolved Vercel toolbar threads for the branch;
5. anonymous access redirects to sign-in before any protected catalog read;
6. missing, suspended, disputed, refunded, charged-back, revoked, expired, and deletion-pending access fails closed;
7. active entitlement can render the protected library, chapter reader, and reference pages;
8. HEAD responses do not leak protected body content;
9. mastery answer keys and corrective source fields are not present in rendered browser payloads;
10. progress/mastery mutations reject cross-site JSON requests;
11. audiobook and Video Library protected routes remain functional;
12. no new Production schema is required.

## Integrated #54 rehearsal matrix

After a provider candidate is approved and #53 reaches a verified integration candidate, #54 must exercise at minimum:

| State | Guided library | Chapter/reference | Audiobook/video | Progress/mastery |
| --- | --- | --- | --- | --- |
| Anonymous | sign-in redirect | sign-in redirect | sign-in redirect | 401 |
| Signed in, unpaid | denied | denied | denied | 403 |
| Active Library Pass | allowed | allowed | allowed | allowed |
| Refunded/revoked | denied | denied | denied | 403 |
| Disputed/charged back | denied | denied | denied | 403 |
| Deletion pending | denied | denied | denied | 403 |

## Historical-stack rule

PR #94 and its branches remain historical source material only. They contain obsolete architecture relative to current main and must not be merged directly. Once #236 is independently verified and merged, #94 can be closed as superseded.
