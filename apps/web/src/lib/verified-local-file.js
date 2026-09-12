import {
  closeSync, constants, fstatSync, lstatSync, openSync, readSync,
} from 'node:fs';

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameSnapshot(left, right) {
  return sameIdentity(left, right)
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function boundedRead(fd, maxBytes) {
  const output = Buffer.allocUnsafe(maxBytes + 1);
  let offset = 0;
  while (offset < output.length) {
    const count = readSync(fd, output, offset, output.length - offset, offset);
    if (count === 0) break;
    offset += count;
  }
  if (offset > maxBytes) throw new Error('file exceeds bound');
  return output.subarray(0, offset);
}

/**
 * Read a local regular file through one atomically opened no-follow descriptor.
 *
 * File bytes are read only from the descriptor returned by O_NOFOLLOW open.
 * Two positioned reads plus descriptor snapshots and a post-read pathname
 * identity check fail closed on replacement, symlink, growth, truncation or
 * in-place mutation without validating one pathname object and reopening it.
 */
export function readVerifiedLocalFile(pathname, maxBytes, { afterFirstRead } = {}) {
  if (typeof pathname !== 'string' || pathname.length === 0 || pathname.length > 4096) {
    throw new Error('invalid pathname');
  }
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 1024 * 1024) {
    throw new Error('invalid size bound');
  }
  if (typeof constants.O_NOFOLLOW !== 'number') {
    throw new Error('no-follow file open is unavailable');
  }

  const fd = openSync(pathname, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (!opened.isFile() || opened.size > BigInt(maxBytes)) {
      throw new Error('unsupported file');
    }

    const first = boundedRead(fd, maxBytes);
    afterFirstRead?.();
    const second = boundedRead(fd, maxBytes);
    const afterRead = fstatSync(fd, { bigint: true });
    const finalPath = lstatSync(pathname, { bigint: true });

    if (!first.equals(second)
        || !sameSnapshot(opened, afterRead)
        || !sameIdentity(afterRead, finalPath)
        || finalPath.isSymbolicLink()
        || BigInt(first.byteLength) !== afterRead.size) {
      throw new Error('file changed during read');
    }

    return new TextDecoder('utf-8', { fatal: true }).decode(first);
  } finally {
    closeSync(fd);
  }
}
