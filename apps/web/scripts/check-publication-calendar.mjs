import { pathToFileURL } from 'node:url';
import { digest, verifyPublicationCalendar } from '../src/lib/publication-calendar.js';
import { readVerifiedLocalFile } from '../src/lib/verified-local-file.js';

/** Read-only candidate diagnostic. Deliberately not an import, merge or deployment command. */
export async function runCalendarCheck(args, { write = (text) => process.stdout.write(text), readVerified = readVerifiedLocalFile, verify = verifyPublicationCalendar } = {}) {
  if (args.length !== 1 || args[0].startsWith('-')) {
    write('Usage: node scripts/check-publication-calendar.mjs <candidate.json>\nNo clock, evidence-file, publish or bypass flags are accepted.\n');
    return 2;
  }
  try {
    const raw = readVerified(args[0], 65536);
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
