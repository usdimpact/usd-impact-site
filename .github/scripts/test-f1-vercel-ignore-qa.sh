#!/usr/bin/env bash
# Synthetic, no-network, no-production self-test for F1 Vercel Ignore candidate.
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
cd "$root"
git init -q -b main
git config user.name 'F1 synthetic QA'
git config user.email 'f1-testing@invalid.example'
mkdir -p apps/web
printf 'baseline\n' > apps/web/index.txt
git add .
git commit -qm 'base protected main'
base="$(git rev-parse HEAD)"
cp "$script_dir/f1-vercel-ignore-qa-candidate.sh" "$root/gate.sh"
chmod 700 "$root/gate.sh"
sed -i "s/4221668716c2214012e4dd26a1dae8ee050f728a/$base/" "$root/gate.sh"

paths=(
  .github/scripts/check-supabase-production-intake.mjs
  .github/scripts/test-supabase-production-intake.mjs
  .github/workflows/supabase-production-intake-guard.yml
  docs/operations/ui02-ui34-production-migration-intake-guard-2026-11-01.draft.md
)
blobs=(
  0f6d8f4ec591025afb9e5c0e6f137101aef9f179
  f1f605a757d2d9565fd98bb513740169db81895c
  032369eadc17f28ced2c4f3d438199269853f6cd
  16ec3a48ce15789001619bafaa4f74cd55586d59
)
for i in 0 1 2 3; do
  mkdir -p "$(dirname "${paths[$i]}")"
  printf 'synthetic reviewed content %s\n' "$i" > "${paths[$i]}"
  blob="$(git hash-object "${paths[$i]}")"
  sed -i "s/${blobs[$i]}/$blob/" "$root/gate.sh"
done

populate_reviewed_files() {
  for i in 0 1 2 3; do
    mkdir -p "$(dirname "${paths[$i]}")"
    printf 'synthetic reviewed content %s\n' "$i" > "${paths[$i]}"
  done
}

pass_count=0
assert_status() {
  local expected="$1" message="$2"
  shift 2
  local actual
  if "$@" >/dev/null 2>&1; then actual=0; else actual=$?; fi
  if [[ "$actual" -ne "$expected" ]]; then
    printf 'FAIL %s: expected %s got %s\n' "$message" "$expected" "$actual" >&2
    exit 1
  fi
  pass_count=$((pass_count+1))
  printf 'PASS %-64s exit=%s\n' "$message" "$actual"
}
run() { env VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=main bash "$root/gate.sh"; }
run_from_web() { (cd "$root/apps/web" && run); }
run_from_shallow() { (cd "$root/shallow" && run); }

# Verify original first-parent four-file content, both from root and project subdir.
git add .github docs
git commit -qm 'squash: reviewed four CI and docs files'
assert_status 0 'squash merger accepts exact approved four-file diff' run
assert_status 1 'preview cannot skip' env VERCEL_ENV=preview VERCEL_GIT_COMMIT_REF=main bash "$root/gate.sh"
assert_status 1 'different branch cannot skip' env VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=dev bash "$root/gate.sh"
assert_status 1 'missing Vercel vars cannot skip' env -u VERCEL_ENV -u VERCEL_GIT_COMMIT_REF bash "$root/gate.sh"
assert_status 0 'works when executed with web app current directory' run_from_web

# A new commit must never skip, even when no app code changed (parent mismatch).
printf 'extra doc\n' >> README.md
git add README.md
git commit -qm 'unrelated docs change'
assert_status 1 'unrelated later commit cannot skip' run
git reset -q --hard HEAD^1

# When the base main changes, the allowlist cannot authorize the skip.
sed -i "s/$base/1111111111111111111111111111111111111111/" "$root/gate.sh"
assert_status 1 'main branch first parent mismatch cannot skip' run
sed -i "s/1111111111111111111111111111111111111111/$base/" "$root/gate.sh"

# Retained four file identities but changed mode must not skip.
git reset -q --hard "$base"
populate_reviewed_files
chmod +x "${paths[0]}"
git add .github docs
git commit -qm 'mode-changed reviewed files'
assert_status 1 'executable-mode change cannot skip' run
git reset -q --hard "$base"
populate_reviewed_files

# An unapproved app file included in the same merge must not skip.
printf 'code update\n' >> apps/web/index.txt
git add .github docs apps/web/index.txt
git commit -qm 'app changes and reviewed four files'
assert_status 1 'additional app file cannot skip' run
git reset -q --hard "$base"
populate_reviewed_files

# A modified CI blob cannot skip even if changed path list is identical.
printf 'tampered\n' >> "${paths[0]}"
git add .github docs
git commit -qm 'four files with tamper'
assert_status 1 'CI file blob modification cannot skip' run
git reset -q --hard "$base"
populate_reviewed_files

# A second parent merge is acceptable only with the original main first parent.
git switch -q -c feature
for path in "${paths[@]}"; do git add "$path"; done
git commit -qm 'reviewed four files on branch'
git switch -q main
git merge --no-ff -qm 'Merge PR 1042 four reviewed files' feature
assert_status 0 'two-parent merge accepts approved first parent change' run

# Test an unreachable parent (shallow clone) denies skip, irrespective of env.
mkdir -p "$root/shallow"
git clone -q --depth=1 "file://$root" "$root/shallow"
assert_status 1 'shallow checkout denies skip' run_from_shallow

printf 'RESULT: all %s synthetic tests passed, no Vercel or Supabase connection\n' "$pass_count"
