import { mkdir, readFile, readdir, copyFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contentRoot = path.join(root, 'src', 'content');
const publicRoot = path.join(root, 'public');
const outRoot = path.join(root, 'dist-offline-preview');

function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) return [{}, raw];
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return [{}, raw];
  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).trim();
  const data = {};
  let currentKey = null;
  for (const line of fm.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const list = line.match(/^\s+-\s+"?(.*?)"?\s*$/);
    if (list && currentKey) {
      data[currentKey] ??= [];
      data[currentKey].push(list[1]);
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (m) {
      const [, key, rawValue] = m;
      currentKey = key;
      let value = rawValue.trim();
      if (value === '') { data[key] = []; continue; }
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (value === 'true') data[key] = true;
      else if (value === 'false') data[key] = false;
      else data[key] = value;
    }
  }
  return [data, body];
}

function mdToHtml(md) {
  return md
    .split(/\r?\n/)
    .map(line => {
      if (line.startsWith('## ')) return `<h2>${esc(line.slice(3))}</h2>`;
      if (line.startsWith('# ')) return `<h1>${esc(line.slice(2))}</h1>`;
      if (line.startsWith('- ')) return `<li>${esc(line.slice(2))}</li>`;
      if (/^\d+\.\s/.test(line)) return `<li>${esc(line.replace(/^\d+\.\s/, ''))}</li>`;
      if (!line.trim()) return '';
      return `<p>${esc(line)}</p>`;
    })
    .join('\n')
    .replace(/(<li>.*?<\/li>\n?)+/gs, m => `<ul>\n${m}\n</ul>`);
}

function esc(s) { return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(p));
    else if (e.name.endsWith('.md')) files.push(p);
  }
  return files;
}

async function copyDir(src, dest) {
  if (!existsSync(src)) return;
  await mkdir(dest, { recursive: true });
  for (const e of await readdir(src, { withFileTypes: true })) {
    const s = path.join(src, e.name); const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await copyFile(s, d);
  }
}

const files = await walk(contentRoot);
const pages = [];
for (const f of files) {
  const raw = await readFile(f, 'utf8');
  const [data, body] = parseFrontmatter(raw);
  if (!data.slug) continue;
  pages.push({ data, body, file: path.relative(root, f) });
}
await mkdir(outRoot, { recursive: true });
await copyDir(path.join(publicRoot, 'assets'), path.join(outRoot, 'assets'));
await copyDir(path.join(publicRoot, 'downloads'), path.join(outRoot, 'downloads'));

const nav = pages.map(p => `<li><a href="${p.data.slug}/index.html">${esc(p.data.title || p.data.slug)}</a></li>`).join('\n');
for (const p of pages) {
  const slugPath = p.data.slug.replace(/^\//, '');
  const outDir = path.join(outRoot, slugPath);
  await mkdir(outDir, { recursive: true });
  const visual = p.data.visual ? `<img src="${p.data.visual}" alt="${esc(p.data.title || '')}" style="max-width:100%;height:auto;border:1px solid #C6CCD4;border-radius:12px;"/>` : '';
  const download = p.data.downloadPath ? `<p><a class="button" href="${p.data.downloadPath}">Download PDF</a></p>` : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.data.metaTitle || p.data.title || 'USD Impact')}</title><meta name="description" content="${esc(p.data.metaDescription || '')}"><style>body{font-family:Inter,Arial,sans-serif;margin:0;background:#F8F9FB;color:#161A1F}header,main,footer{max-width:980px;margin:auto;padding:24px}header{background:#071A33;color:white}a{color:#071A33}.hero{font-size:1.25rem;color:#5A6472}.button{display:inline-block;background:#071A33;color:white;padding:12px 16px;border-radius:8px;text-decoration:none}.note{border-left:4px solid #C9A35B;padding:12px;background:white}main{background:white}</style></head><body><header><strong>USD Impact</strong><p>Offline preview snapshot - not an Astro build.</p></header><main><h1>${esc(p.data.title || '')}</h1><p class="hero">${esc(p.data.hero || p.data.definition || '')}</p>${visual}${download}${mdToHtml(p.body)}<div class="note"><strong>Compliance note:</strong> ${esc(p.data.complianceNote || 'Educational only. Not investment advice.')}</div><h2>Preview navigation</h2><ul>${nav}</ul></main><footer><p>USD Impact - Session 16B offline content preview.</p></footer></body></html>`;
  await writeFile(path.join(outDir, 'index.html'), html, 'utf8');
}
await writeFile(path.join(outRoot, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>USD Impact Offline Preview</title></head><body><h1>USD Impact Offline Preview</h1><p>This snapshot is generated for content review only. It is not an Astro build.</p><ul>${nav}</ul></body></html>`, 'utf8');
console.log(JSON.stringify({pages: pages.length, outRoot}, null, 2));
