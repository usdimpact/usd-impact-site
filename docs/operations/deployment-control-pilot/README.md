# USD Impact no-deployment control — isolated offline pilot

**Status (6 Nov 2026): DRAFT / OFFLINE ONLY / NO PRODUCTION CHANGE.** This pilot does not implement deploy-free merges into `main`. It gives a reproducible read-only staging check for PR #1199 and an explicitly blocked future cutover gate.

## Why it exists

Vercel's Git integration deploys commits to the configured Production branch. The site's existing `apps/web/vercel.json` disables deployment for `agent/*` branches but **does not** disable deployments for `main`. The previous docs-only merge #1197 produced a Production deployment. `Ignored Build Step` creates a canceled deployment record and does not satisfy a strict requirement of zero deployment records.

Documented sources:

- https://vercel.com/docs/git
- https://vercel.com/docs/project-configuration/git-configuration
- https://vercel.com/docs/project-configuration/project-settings
- https://vercel.com/kb/guide/can-you-deploy-based-on-tags-releases-on-vercel

## What is operational now

1. Keep PR #1199 **Draft / unmerged** at the independently inspected exact HEAD.
2. Read GitHub's PR state, branch, exact HEAD and base, changed-file list and every required check.
3. Read the repo's **exact** `apps/web/vercel.json` blob and Vercel deployment records scoped to the exact PR SHA; do not infer absence from the most recent deployment list alone.
4. Independently inspect all source timestamps; gather a fresh, non-sensitive snapshot (`snapshot.template.json` is intentionally invalid/stale until completed).
5. Run `node docs/operations/deployment-control-pilot/no-deploy-control.mjs /path/to/verified-snapshot.json` (Node builtin APIs; no install, network, token, or write). `ADVISORY_STAGE_OK` means **leave the Draft staged**; it NEVER means merge or deploy.
6. Run negative tests with `node --test docs/operations/deployment-control-pilot/no-deploy-control.test.mjs`. Failing check, unknown path, SHA drift, changed Vercel config, non-`agent/*` branch, stale observations, or nonzero deployment count must return HOLD.
7. Record evidence and holds in Master and Fundraising trackers. Do not dispatch Claude or authorize an additional paid call.

### Snapshot boundaries

This tool cannot independently authenticate evidence. All snapshot fields are observations, not authorization. Recheck immediately before using it; the evaluator rejects observations older than 15 minutes or from the future. It pins the exact PR #1199, single guide path, six known CI checks, Production Vercel project, and current Vercel config blob. Any material change requires review and a newly versioned policy. Keep credentials, tokens, customer information, and issue bodies OUT of snapshots.

The evaluator writes nothing and never contacts Vercel or GitHub. It has no merge, deployment, promotion, cancel, project creation, workflow dispatch, or budget capability. A zero count for the **wrong** SHA is not proof.

## Future architecture — explicitly not installed

To support real no-deployment merges into `main` later, Vercel documents `git.deploymentEnabled.main=false` (or disabling all automatic Git deployments) coupled to an owner-gated manual Production release path. This alters the site's publishing architecture. It is **not** a per-PR exemption and must not be applied to the current Production project as a pilot.

An isolated non-Production project/repository test should separately prove that a `main` push with Git deploy disabled creates **zero** deployments, while an owner-authorized release of a pinned SHA is possible through a manual mechanism. Protect any test environment from custom Production domains and data/secret integrations. No connected Production project setting, domains, or credentials may be copied implicitly.

Before an eventual Production cutover, independently prove replacements for Daily auto-publication, urgent security fixes, Vercel Cron execution, rollbacks, audit logging, permission/billing holds, and owner authorization. The repo's Daily publication path can merge to `main`; disabling automatic main deployments with no replacement would break release timeliness. Do not treat a mock test as a live Vercel guarantee.

The `assessArchitecture` helper **always returns HOLD**, even with every simulated prerequisite met: separate exact-scope owner cutover approval and real independent evidence are mandatory.

## Current pinned evidence (historical snapshot, revalidate on each use)

- PR #1199: https://github.com/usdimpact/usd-impact-site/pull/1199
- PR HEAD `3124453043b7c511f3cb1c7c93f91d592e798d84`; main `64626a7325eb180d829455d9446b90d7336f173f` at pilot creation.
- Production project `prj_ZoLLM35ksI6wk17PcfS2xYknaVl7`; Vercel config blob `ffe227d65f476417394d1008a0a12f3b44d55989`.
- Prior docs-only Production deployment `dpl_5BoHj1Aw6VVyrW6ewyrkhwi7fvuF`.
- Operating runbook: https://docs.google.com/document/d/1BX9jBVHI-sBODkYFkpp-VWqjFXHnxmzm2EYdkAeNVtM/edit

## Stop conditions

Stop and requalify if any observed SHA, branch, file list, check, project, policy blob, deployment record, or release/paid-usage hold changes. Neither this PR nor #1199 is a release authorization. Do not merge either PR, edit `apps/web/vercel.json`, change Vercel settings, trigger a Preview/Production deployment, or alter Daily publishing while conducting this offline pilot.