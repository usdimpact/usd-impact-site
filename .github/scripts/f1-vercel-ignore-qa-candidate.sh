#!/usr/bin/env bash
# F1 Draft-only candidate (NOT configured in Vercel).
# Vercel Ignored Build Step: 0 -> ignore build; 1 -> build normally.
# This script is not a no-deployment guarantee: if it fails, Vercel builds.
set -uo pipefail

deny_skip() {
  printf '%s\n' "F1 SKIP DENIED: $1. Vercel should build normally." >&2
  exit 1
}

[[ "${VERCEL_ENV:-}" == "production" ]] || deny_skip 'not Production'
[[ "${VERCEL_GIT_COMMIT_REF:-}" == "main" ]] || deny_skip 'not main'

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || deny_skip 'missing Git repository'
cd "$repo_root" || deny_skip 'cannot enter repository'

# Pin original protected-main parent. Any concurrent main merge invalidates this proposal.
expected_parent='4221668716c2214012e4dd26a1dae8ee050f728a'
parent="$(git rev-parse --verify 'HEAD^1' 2>/dev/null)" || deny_skip 'first parent unavailable'
[[ "$parent" == "$expected_parent" ]] || deny_skip 'main first-parent changed'

# The squash commit has one parent; a normal merge has two. Refuse exotic history.
parents_line="$(git rev-list --parents -n1 HEAD 2>/dev/null)" || deny_skip 'cannot read ancestry'
read -r -a commit_parents <<< "$parents_line"
[[ ${#commit_parents[@]} -eq 2 || ${#commit_parents[@]} -eq 3 ]] || deny_skip 'unexpected number of parents'

# Require the entire first-parent change set to consist of exactly the four
# reviewed CI and documentation files; never match application-file changes.
expected_paths="$(printf '%s\n' \
  '.github/scripts/check-supabase-production-intake.mjs' \
  '.github/scripts/test-supabase-production-intake.mjs' \
  '.github/workflows/supabase-production-intake-guard.yml' \
  'docs/operations/ui02-ui34-production-migration-intake-guard-2026-11-01.draft.md' | LC_ALL=C sort)"
actual_paths="$(git -c core.quotepath=true diff --no-ext-diff --no-renames --name-only "$parent" HEAD -- | LC_ALL=C sort)" || deny_skip 'cannot diff parents'
[[ "$actual_paths" == "$expected_paths" ]] || deny_skip 'unexpected paths'

# Exact blob identities from independently checked PR #1042 at HEAD
# fc9f0d912cfaad2d289d417ad4593143e357bf99. Require normal file modes.
while read -r path approved_blob; do
  actual_blob="$(git rev-parse "HEAD:$path" 2>/dev/null)" || deny_skip 'file missing'
  [[ "$actual_blob" == "$approved_blob" ]] || deny_skip "blob mismatch $path"
  file_mode="$(git ls-tree HEAD -- "$path" | awk '{print $1}')" || deny_skip 'mode unavailable'
  [[ "$file_mode" == '100644' ]] || deny_skip "mode mismatch $path"
done <<'APPROVED_BLOBS'
.github/scripts/check-supabase-production-intake.mjs 0f6d8f4ec591025afb9e5c0e6f137101aef9f179
.github/scripts/test-supabase-production-intake.mjs f1f605a757d2d9565fd98bb513740169db81895c
.github/workflows/supabase-production-intake-guard.yml 032369eadc17f28ced2c4f3d438199269853f6cd
docs/operations/ui02-ui34-production-migration-intake-guard-2026-11-01.draft.md 16ec3a48ce15789001619bafaa4f74cd55586d59
APPROVED_BLOBS

printf '%s\n' 'F1: exact CI/docs-only four-file merge recognized; request IGNORE build'
exit 0
