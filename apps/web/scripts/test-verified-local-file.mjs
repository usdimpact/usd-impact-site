import assert from 'node:assert/strict';
import {
  mkdtempSync, renameSync, rmSync, symlinkSync, truncateSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readVerifiedLocalFile } from '../src/lib/verified-local-file.js';

let tests = 0;
const test = (name, fn) => { fn(); tests += 1; };
const directory = mkdtempSync(join(tmpdir(), 'verified-local-file-'));
try {
  const stable = join(directory, 'stable.json');
  writeFileSync(stable, '{"ok":true}\n');
  test('stable bounded regular file reads', () => {
    assert.equal(readVerifiedLocalFile(stable, 1024), '{"ok":true}\n');
  });

  const link = join(directory, 'link.json');
  symlinkSync(stable, link);
  test('symlink input is rejected', () => {
    assert.throws(() => readVerifiedLocalFile(link, 1024));
  });

  const replacement = join(directory, 'replacement.json');
  writeFileSync(replacement, '{"first":1}\n');
  test('pathname replacement during read is rejected', () => {
    assert.throws(() => readVerifiedLocalFile(replacement, 1024, {
      afterFirstRead: () => {
        const next = join(directory, 'replacement-next.json');
        writeFileSync(next, '{"second":2}\n');
        renameSync(next, replacement);
      },
    }));
  });

  const growth = join(directory, 'growth.json');
  writeFileSync(growth, '{"a":1}\n');
  test('growth during read is rejected', () => {
    assert.throws(() => readVerifiedLocalFile(growth, 1024, {
      afterFirstRead: () => writeFileSync(growth, '{"a":123456789}\n'),
    }));
  });

  const mutation = join(directory, 'mutation.json');
  writeFileSync(mutation, '{"a":1}\n');
  test('same-size in-place mutation is rejected', () => {
    assert.throws(() => readVerifiedLocalFile(mutation, 1024, {
      afterFirstRead: () => writeFileSync(mutation, '{"b":2}\n'),
    }));
  });

  const truncation = join(directory, 'truncation.json');
  writeFileSync(truncation, '{"abcdef":1}\n');
  test('truncation during read is rejected', () => {
    assert.throws(() => readVerifiedLocalFile(truncation, 1024, {
      afterFirstRead: () => truncateSync(truncation, 2),
    }));
  });

  const oversized = join(directory, 'oversized.json');
  writeFileSync(oversized, 'x'.repeat(1025));
  test('oversized file is rejected before acceptance', () => {
    assert.throws(() => readVerifiedLocalFile(oversized, 1024));
  });
} finally {
  rmSync(directory, { recursive: true, force: true });
}

console.log(`Verified local file reader: ${tests} regression groups passed.`);
