import {
  O_NOFOLLOW, O_RDONLY, closeSync, fstatSync, lstatSync, openSync, readSync,
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
 * Read a local regular file through one verified descriptor.
 *
 * The path is inspected only to establish identity. File bytes are read from the
 * already-open descriptor, never by reopening the pathname after validation.
 * Two positioned reads plus pre/post descriptor and pathname snapshots fail
 * closed on replacement, symlink, growth, truncation or in-place mutation.
 */
export function readVerifiedLocalFile(pathname, maxBytes, { afterFirstRead } = {}) {
  if (typeof pathname !== 'string' || pathname.length === 0 || pathname.length > 4096) {
    throw new Error('invalid pathname');
  }
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 1024 * 1024) {
    throw new Error('invalid size bound');
  }

  const beforePath = lstatSync(pathname, { bigint: true });
  if (!beforePath.isFile() || beforePath.isSymbolicLink() || beforePath.size > BigInt(maxBytes)) {
    throw new Error('unsupported file');
  }

  const flags = O_RDONLY | (typeof O_NOFOLLOW === 'number' ? O_NOFOLLOW : 0);
  const fd = openSync(pathname, flags);
  try {
    const opened = fstatSync(fd, { bigint: true });
    const afterOpenPath = lstatSync(pathname, { bigint: true });
    if (!opened.isFile() || opened.size > BigInt(maxBytes)
        || !sameIdentity(beforePath, opened) || !sameIdentity(opened, afterOpenPath)
        || afterOpenPath.isSymbolicLink()) {
      throw new Error('file identity changed');
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
