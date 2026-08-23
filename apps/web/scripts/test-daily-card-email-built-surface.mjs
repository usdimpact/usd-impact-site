import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const learnHtml = readFileSync(new URL('../dist/learn/index.html', import.meta.url), 'utf8');
assert.match(learnHtml, /Learn one dollar-system concept each day\./);
assert.match(learnHtml, /Get the daily card/);
assert.match(learnHtml, /data-daily-learning-form/);
assert.match(learnHtml, /\/api\/waitlist\?action=daily-learning/);
assert.match(learnHtml, /This subscription is separate from the book waitlist/);
assert.match(learnHtml, /name="consent"[^>]*type="checkbox"/);
assert.doesNotMatch(learnHtml, /name="consent"[^>]*checked/);
assert.match(learnHtml, /href="\/privacy\/"/);

console.log('Built Daily Learning signup surface: PASS');
