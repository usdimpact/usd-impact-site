#!/usr/bin/env python3
"""Review-only integrity test for plain, version-controlled D2 fixtures.

Every archived source was promoted to a reviewable git file. A self-test
must reject individual file corruption, missing members, and unexpected files.
No network, connected database or customer data is used.
"""
import hashlib
import os
from pathlib import Path
import re
import shutil
import tempfile

ROOT = Path(os.environ.get('GITHUB_WORKSPACE', Path.cwd())).resolve()
MANIFEST = ROOT / 'docs/operations/research-d2-pg17-fixture-sha256.txt'
SQL_DIR = 'docs/operations/research-d2-pg17'
RUNNER = 'scripts/run_research_d2_pg17_review.py'
ARCHIVE = ROOT / 'docs/operations/research-d2-pg17-review-fixtures.tar.xz.b64'


def parse_manifest(path=MANIFEST):
    rows = []
    for line in path.read_text(encoding='utf-8').splitlines():
        match = re.fullmatch(r'([0-9a-f]{64})  ([A-Za-z0-9_./-]+)', line)
        assert match, 'Invalid checksum record'
        digest, path = match.groups()
        assert '..' not in Path(path).parts and not path.startswith('/'), 'Unsafe manifest path'
        rows.append((digest, path))
    assert len(rows) == 12 and len({p for _, p in rows}) == 12
    assert RUNNER in {p for _, p in rows}
    assert sum(p.startswith(SQL_DIR + '/') for _, p in rows) == 11
    return rows


def verify(root, rows):
    expected = {p for _, p in rows}
    sql_dir = root / SQL_DIR
    actual = {p.relative_to(root).as_posix() for p in sql_dir.glob('*') if p.is_file()}
    if (root / RUNNER).is_file():
        actual.add(RUNNER)
    assert actual == expected, f'Unexpected/missing review members: {sorted(expected ^ actual)}'
    for digest, path in rows:
        real = root / path
        assert real.is_file(), f'Missing fixture: {path}'
        assert hashlib.sha256(real.read_bytes()).hexdigest() == digest, f'Checksum mismatch: {path}'


def main():
    assert not ARCHIVE.exists(), 'Opaque base64 review archive must not be committed'
    rows = parse_manifest()
    verify(ROOT, rows)
    with tempfile.TemporaryDirectory(prefix='d2-integrity-') as tmp:
        isolated = Path(tmp)
        for _, path in rows:
            to = isolated / path
            to.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / path, to)
        verify(isolated, rows)
        for _, path in rows:
            victim = isolated / path
            original = victim.read_bytes()
            assert original, f'Empty fixture: {path}'
            victim.write_bytes(bytes((original[0] ^ 1,)) + original[1:])
            try:
                verify(isolated, rows)
            except AssertionError:
                pass
            else:
                raise AssertionError(f'Corrupted fixture went undetected: {path}')
            victim.write_bytes(original)
            verify(isolated, rows)
        victim = isolated / rows[0][1]
        original = victim.read_bytes()
        victim.unlink()
        try:
            verify(isolated, rows)
        except AssertionError:
            pass
        else:
            raise AssertionError('Missing fixture went undetected')
        victim.write_bytes(original)
        unexpected = isolated / SQL_DIR / 'unexpected.sql'
        unexpected.write_text('select 1;\n', encoding='utf-8')
        try:
            verify(isolated, rows)
        except AssertionError:
            pass
        else:
            raise AssertionError('Unexpected fixture went undetected')
        unexpected.unlink()
        verify(isolated, rows)

        # A syntactically valid changed manifest hash must fail, not merely changed source bytes.
        first_digest = rows[0][0]
        mutated_digest = ('0' if first_digest[0] != '0' else '1') + first_digest[1:]
        tampered_manifest = isolated / 'manifest-line-tampered.txt'
        tampered_manifest.write_text(
            MANIFEST.read_text(encoding='utf-8').replace(first_digest, mutated_digest, 1),
            encoding='utf-8'
        )
        try:
            verify(isolated, parse_manifest(tampered_manifest))
        except AssertionError:
            pass
        else:
            raise AssertionError('Modified manifest hash line went undetected')
        tampered_manifest.unlink()
        verify(isolated, rows)
    print('PASS 12 plain source SHA256 checks, 12/12 corruption negatives, missing/extra member and manifest-line tamper negatives', flush=True)


if __name__ == '__main__':
    main()
