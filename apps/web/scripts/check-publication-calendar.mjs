import { pathToFileURL } from 'node:url';
import { digest, verifyPublicationCalendar } from '../src/lib/publication-calendar.js';
import { readVerifiedLocalFile } from '../src/lib/verified-local-file.js';

/** Read-only candidate diagnostic. Deliberately not an import, merge or deployment command. */
export async function runCalendarCheck(args, {
  write = (text) => process.stdout.write(text),
  readVerified,
  // Test-only content seam retained for synthetic CLI fixtures. Production never
  // validates a pathname and then reopens it: real files use one verified descriptor.
  read,
  verify = verifyPublicationCalendar,
} = {}) {
  if (args.length !== 1 || args[0].startsWith('-')) {
    write('Usage: node scripts/check-publication-calendar.mjs <candidate.json>\nNo clock, evidence-file, publish or bypass flags are accepted.\n');
    return 2;
  }
  try {
    let raw;
    if (readVerified) {
      raw = await readVerified(args[0], 65536);
    } else if (read) {
      raw = await read(args[0], 'utf8');
      if (typeof raw !== 'string' || Buffer.byteLength(raw) > 65536) throw new Error('invalid input');
    } else {
      raw = readVerifiedLocalFile(args[0], 65536);
    }
    const input = JSON.parse(raw);
    const result = await verify(input);
    write(`${JSON.stringify({ ...result, inputSha256: digest(raw), scope: 'structured-candidate-diagnostic; not a publication authorization' }, null, 2)}\n`);
    return result.decision === 'PASS' ? 0 : 2;
  } catch {
    write(`${JSON.stringify({ decision: 'HOLD_INVALID_INPUT', reason: 'A bounded readable JSON candidate file is required.', publicationAttempted: false, publicationAuthorized: false })}\n`);
    return 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await runCalendarCheck(process.argv.slice(2));
