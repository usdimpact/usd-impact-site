import fs from 'node:fs';
import path from 'node:path';
const slugs = ['/'];
for (const dir of ['pages','products','frameworks','lead-magnets','benchmark-modules']) {
  const p = path.resolve('src/content', dir);
  for (const file of fs.readdirSync(p).filter((x) => x.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(p, file), 'utf8');
    const m = text.match(/^slug:\s+"([^"]+)"/m);
    if (m) slugs.push(m[1]);
  }
}
const xml = ['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',...slugs.map((s) => `  <url><loc>https://usd-impact.com${s === '/' ? '/' : s + '/'}</loc></url>`),'</urlset>'].join('\n');
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/sitemap.xml', xml);
console.log(`sitemap generated for ${slugs.length} URLs`);
