// Review-only regression for the already-published independent Oct 30 Weekly.
// No network, provider or deployment access. Does not alter publication state.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL(
  '../src/pages/macro-reviews/weekly/2026-10-30/index.astro', import.meta.url,
));
const original = readFileSync(path, 'utf8');
const links = src => src.split('href="https://').slice(1).map(s => s.split('"')[0]);
const luminance = hex => {
  const rgb = hex.slice(1).match(/.{2}/g).map(x => parseInt(x,16)/255);
  const [r,g,b] = rgb.map(x => x <= 0.04045 ? x/12.92 : ((x+0.055)/1.055)**2.4);
  return 0.2126*r + 0.7152*g + 0.0722*b;
};
const contrast = (a,b) => {
  const values = [luminance(a),luminance(b)].sort((x,y)=>x-y);
  return (values[1]+0.05)/(values[0]+0.05);
};
function verify(src) {
  assert.ok(src.includes('data-period-end="2026-10-30"'), 'Must preserve exact historical date');
  assert.ok(src.includes('a:focus-visible { outline: 3px solid var(--navy);'), 'Dark focus ring for light background');
  assert.ok(src.includes('.hero a:focus-visible, .site-header a:focus-visible { outline-color: #f4e2bc; }'), 'Light focus ring for dark backgrounds');
  assert.ok(src.includes('--navy: #071a33;') && src.includes('--gold: #c9a35b;'));
  assert.ok(!src.includes('a:focus-visible { outline: 3px solid var(--gold);'), 'Remove former low-contrast gold-on-light focus ring');
  assert.ok(src.includes('noindex,nofollow,noarchive,nosnippet'), 'Existing first-release index policy unchanged');
  for (const [ring,bg] of [
    ['#071a33','#ffffff'],
    ['#071a33','#f7f8fa'],
    ['#f4e2bc','#071a33'],
    ['#f4e2bc','#020a14'],
  ]) assert.ok(contrast(ring,bg)>=3, 'Keyboard focus visibility should exceed 3:1');
  return true;
}
assert.equal(verify(original),true);
const negative = [
  ['old gold-on-light ring', original.replace('a:focus-visible { outline: 3px solid var(--navy);','a:focus-visible { outline: 3px solid var(--gold);')],
  ['lost dark-background ring', original.replace('.hero a:focus-visible, .site-header a:focus-visible { outline-color: #f4e2bc; }','')],
  ['changed historical date', original.replace('data-period-end="2026-10-30"','data-period-end="2026-11-06"')],
];
for (const [name,mutated] of negative) {
  assert.notEqual(mutated,original,'Fixture must change source: '+name);
  assert.throws(()=>verify(mutated),{name:'AssertionError'},'Must reject '+name);
}
assert.ok(links(original).length>0,'Keep original external citations');
console.log('Oct 30 independent Weekly keyboard focus contrast contract PASS: 1 positive, 3 negatives');
