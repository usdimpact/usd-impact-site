# Release control — 2026-08-22

## Purpose

Record the bounded deployment recovery check after Vercel's daily deployment quota blocked several otherwise-reviewed source changes.

## Verified state

- GitHub `main` source before this documentation-only branch: `c4e5f950c9f7b6c21987ba8007e13596d10abd9b`.
- The previous observed READY Production deployment was still on `2a79ab35d65a72debc9da97d559b229f5dbd6441`.
- A temporary draft QA PR proved the GitHub-to-Vercel Preview path is accepting deployments again.
- Preview deployment `dpl_6W6HvtXRzrYjjGsY4ukW9LaoLM2Q` reached READY after mandatory tests and the production-build verification passed.
- The temporary QA PR was closed without merge.

## Safety boundary

This release-control step does not enable checkout, select a payment provider, change commerce mode, mutate Supabase, activate lifecycle email, enable an account-deletion scheduler, modify customer data, grant entitlements, or change DNS.

The purpose of the next merge is only to force a normal reviewed `main` Production deployment so the deployed source catches up with the already-reviewed repository state.

## Post-deploy verification

After the merge-triggered Production deployment reaches READY:

1. verify the Production deployment commit matches the resulting `main` commit;
2. verify canonical domains remain assigned;
3. verify `/api/commerce-readiness` remains closed/fail-safe and does not expose secrets;
4. verify public checkout remains disabled;
5. review Production runtime errors;
6. continue provider selection and the remaining P0 release gates.
