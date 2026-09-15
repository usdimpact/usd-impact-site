import { verifyCalendarReleasePreflight } from '../src/lib/publication-calendar-release.js';

// No publication, clock override, fallback baseline file, credential write or promotion option.
const allowed = new Set(['expected-main', 'expected-head', 'deployment']);
const args = new Map();
for (const argument of process.argv.slice(2)) {
  const match = argument.match(/^--([a-z-]+)=(.+)$/);
  if (!match || !allowed.has(match[1]) || args.has(match[1])) {
    console.error('Usage: node scripts/check-publication-calendar-release.mjs --expected-main=<sha> --expected-head=<sha> --deployment=<staged-production-id>');
    process.exit(2);
  }
  args.set(match[1], match[2]);
}
const result = await verifyCalendarReleasePreflight({
  expectedMain: args.get('expected-main'), expectedHead: args.get('expected-head'), deploymentId: args.get('deployment'),
});
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.decision === 'PASS_READ_ONLY_PREFLIGHT' ? 0 : 2;
