import fs from 'node:fs';
import path from 'node:path';
const contentRoot = path.resolve('src/content');
const slugs = new Set(['/']);
for (const dir of ['pages','products','frameworks','lead-magnets','benchmark-modules','weekly-reports','monthly-reports']) {
  const p = path.join(contentRoot, dir);
  for (const file of fs.readdirSync(p).filter((x) => x.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(p, file), 'utf8');
    const m = text.match(/^slug:\s+"([^"]+)"/m);
    if (m) slugs.add(m[1]);
  }
}
const requiredLinks = ['/start-here','/book/read-the-dollar-first','/lead-magnets/weekly-dollar-regime-checklist','/benchmark/usd-impact-benchmark-dashboard'];
const missing = requiredLinks.filter((l) => !slugs.has(l));
if (missing.length) { console.error('Missing internal slugs: ' + missing.join(', ')); process.exit(1); }
console.log('internal link slug check pass');
