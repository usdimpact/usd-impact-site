# USD Impact Integrity-Layer Hardening (Preview Only)

Status: **ISOLATED / NON-PRODUCTION / DO NOT MERGE WITHOUT EXPLICIT OWNER APPROVAL**

Branch: `hardening/integrity-layer-2026-10-23`
Baseline production commit: `b980b8fbcc5a297731a74228409d5282e5422768`

## Purpose

Add operational, security, provenance, and reproducibility hardening around the existing USD Impact application and Score methodology without changing current public behavior or methodology outputs.

## Non-regression invariants

This hardening work MUST NOT change:

- production branch `main` unless separately and explicitly approved;
- Production Vercel configuration, domains, DNS, deployment aliases, or environment values;
- Production Supabase schema/data/RLS/policies/functions/storage/auth configuration;
- Production Resend keys, webhooks, domains, recipients, or sending behavior;
- commerce truth, entitlements, account state, paid-content access, or consent records;
- published Daily/Weekly/Report content or historical archives;
- Score v2 formula;
- signed component directions;
- component weights;
- normalization semantics;
- clipping rule;
- thresholds/regime bands;
- descriptive/non-predictive status;
- historical score fixtures, published score values, or source-date semantics.

Any detected difference in these fields is a STOP condition and must be classified as a methodology/product change, not hardening.

## Allowed in this branch

- documentation and control manifests;
- additive tests and shadow checks;
- read-only metadata inventory;
- Preview-only telemetry and CSP Report-Only experiments;
- isolated development Supabase authorization tests;
- shadow methodology certificate generation;
- SBOM/provenance generation that does not gate releases;
- configuration-drift detection in report-only mode;
- Preview-only bounded abuse/rate-limit experiments;
- rollback rehearsal against Preview/development resources.

## Explicitly prohibited

- direct commits or pushes to `main`;
- merge or auto-merge;
- Production deployment promotion;
- Production database writes or migrations;
- secret rotation/revocation;
- live email sends;
- live commerce/payment tests;
- DNS/domain changes;
- production WAF/CSP enforcement;
- load testing, credential stuffing, broad fuzzing, webhook replay storms, or destructive SQL.

## First-pass hardening sequence

1. Capture current branch baseline and existing CI/Preview behavior.
2. Add non-regression assertions for Score claim boundary and methodology constants.
3. Add a machine-readable control manifest for expected GitHub/Vercel/Supabase/Resend metadata (names/scopes only; never values).
4. Add shadow methodology certificate generation and compare against current published fixtures.
5. Add RLS negative-access tests against isolated development resources only.
6. Add Preview CSP Report-Only and route-abuse observation only after baseline comparison.
7. Add monitoring for Daily background terminal-success/fail-closed states without changing publication behavior.
8. Run existing validation, dependency review, CodeQL, and Vercel Preview.
9. Compare branch output to baseline. Any unexplained difference stops the work.
10. Keep the PR draft. No merge or production enforcement without explicit owner approval.

## Promotion gate

A future production-bound change is eligible for review only if all of the following are true:

- exact scope is documented;
- baseline hashes/configuration are captured;
- existing validation suite passes;
- new control-specific tests pass;
- public page/API behavior is unchanged except for an explicitly approved security boundary;
- methodology outputs remain equivalent;
- auth, checkout, email consent, paid access, and publication paths remain valid;
- Vercel Preview is READY;
- rollback target is identified;
- security-sensitive change has independent review;
- owner explicitly approves promotion.

Until then, this branch is an evidence and Preview hardening workspace only.
