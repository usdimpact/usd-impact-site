#!/usr/bin/env bash
# Verify a <=256-byte inline command on a synthetic Git commit whose tree
# contains EXACT reviewed Git blob identities. No external source is needed.
set -euo pipefail
root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
cd "$root"
git init -q -b main
git config user.name 'F1 synthetic QA'
git config user.email 'f1-inline@invalid.example'
mkdir -p apps/web
printf 'unchanged application\n' > apps/web/index.txt
git add . && git commit -qm baseline
base="$(git rev-parse HEAD)"
entries=(
'.github/scripts/check-supabase-production-intake.mjs:0f6d8f4ec591025afb9e5c0e6f137101aef9f179'
'.github/scripts/test-supabase-production-intake.mjs:f1f605a757d2d9565fd98bb513740169db81895c'
'.github/workflows/supabase-production-intake-guard.yml:032369eadc17f28ced2c4f3d438199269853f6cd'
'docs/operations/ui02-ui34-production-migration-intake-guard-2026-11-01.draft.md:16ec3a48ce15789001619bafaa4f74cd55586d59'
)
for entry in "${entries[@]}"; do
  path="${entry%:*}"
  blob="${entry##*:}"
  git update-index --add --cacheinfo "100644,$blob,$path"
done
tree="$(git write-tree --missing-ok)"
commit="$(printf 'F1 synthetic exact Git tree\n' | git commit-tree "$tree" -p "$base")"
git update-ref refs/heads/main "$commit"
expected_diff_hash='8f2bdca5f1a38cb4fec5fd66ec09db431fee0286'
observed="$(git diff --raw --no-abbrev HEAD^ HEAD | git hash-object --stdin)"
[[ "$observed" == "$expected_diff_hash" ]] || { echo "FAIL unexpected raw diff hash: $observed"; exit 1; }

# Exact proposed <=256-char Vercel Project Ignored Build Step expression.
# Replace only the pinned parent with local synthetic first-parent for testing.
cmd='[ "$VERCEL_ENV:$VERCEL_GIT_COMMIT_REF" = production:main ] && [ "$(git rev-parse HEAD^)" = 4221668716c2214012e4dd26a1dae8ee050f728a ] && [ "$(git diff --raw --no-abbrev HEAD^ HEAD | git hash-object --stdin)" = 8f2bdca5f1a38cb4fec5fd66ec09db431fee0286 ]'
[[ "${#cmd}" -le 256 ]] || { echo "FAIL command too long ${#cmd}"; exit 1; }
cmd_test="${cmd//4221668716c2214012e4dd26a1dae8ee050f728a/$base}"
count=0
check() {
  local status="$1" label="$2"
  shift 2
  local got
  if "$@" >/dev/null 2>&1; then got=0; else got=$?; fi
  [[ "$got" -eq "$status" ]] || { echo "FAIL $label (got $got wanted $status)"; exit 1; }
  count=$((count+1))
  echo "PASS $label: $got"
}
run() { env VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=main bash -c "$cmd_test"; }
check 0 'full-reviewed object ids: skip' run
check 1 'preview: do not skip' env VERCEL_ENV=preview VERCEL_GIT_COMMIT_REF=main bash -c "$cmd_test"
check 1 'other branch: do not skip' env VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=dev bash -c "$cmd_test"
check 1 'missing environment variables: do not skip' env -u VERCEL_ENV -u VERCEL_GIT_COMMIT_REF bash -c "$cmd_test"
check 0 'works from apps/web project root' bash -c 'cd apps/web; env VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=main bash -c "$1"' _ "$cmd_test"
# An incorrect protected-main parent must not authorize the skip.
cmd_wrong="${cmd_test//$base/1111111111111111111111111111111111111111}"
check 1 'main base mismatch: do not skip' env VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=main bash -c "$cmd_wrong"
# Appends change to synthetic Git tree via index, without checking out missing blobs.
printf 'unexpected app change\n' >> apps/web/index.txt
git add apps/web/index.txt
newtree="$(git write-tree --missing-ok)"
newcommit="$(printf 'app and CI source changed\n' | git commit-tree "$newtree" -p "$base")"
git update-ref refs/heads/main "$newcommit"
check 1 'new app object changes raw diff: do not skip' run
printf 'PASS inline candidate raw-diff SHA: %s\n' "$expected_diff_hash"
printf 'RESULT: %s/%s cases passed, exact command length %s chars, no network\n' "$count" "$count" "${#cmd}"
