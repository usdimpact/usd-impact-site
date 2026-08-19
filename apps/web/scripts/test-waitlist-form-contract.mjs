import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/components/WaitlistForm.astro', import.meta.url),
  'utf8',
);

assert.match(source, /let pendingSubmissionId = '';/);
assert.match(
  source,
  /form\.addEventListener\('input', \(\) => \{\s*pendingSubmissionId = '';\s*\}\);/s,
);
assert.match(source, /pendingSubmissionId \|\|= crypto\.randomUUID\(\);/);
assert.match(source, /submissionId:\s*pendingSubmissionId/);

const generateIndex = source.indexOf('pendingSubmissionId ||= crypto.randomUUID();');
const fetchIndex = source.indexOf("fetch('/api/waitlist'", generateIndex);
const responseCheckIndex = source.indexOf('if (!response.ok)', fetchIndex);
const successResetIndex = source.indexOf("pendingSubmissionId = '';", responseCheckIndex);
const catchIndex = source.indexOf('} catch (error) {', responseCheckIndex);
const finallyIndex = source.indexOf('} finally {', catchIndex);

assert.ok(generateIndex >= 0, 'The submission ID must be generated before the request.');
assert.ok(fetchIndex > generateIndex, 'The request must use the generated submission ID.');
assert.ok(responseCheckIndex > fetchIndex, 'Provider failure must be checked before resetting identity.');
assert.ok(successResetIndex > responseCheckIndex, 'Submission identity must reset only after success.');
assert.ok(catchIndex > successResetIndex, 'The success reset must precede the failure handler.');
assert.ok(finallyIndex > catchIndex, 'The failure handler must retain identity through finally.');
assert.doesNotMatch(
  source.slice(catchIndex, finallyIndex),
  /pendingSubmissionId\s*=\s*''/,
  'A failed request must retain the same submission ID for a safe retry.',
);

console.log('Waitlist form submission identity contract tests passed.');
