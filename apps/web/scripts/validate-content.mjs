import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/content');
const required = ['title:', 'metaTitle:', 'metaDescription:', 'slug:', 'status:', 'complianceNote:'];
let failures = [];
for (const dir of ['pages','products','frameworks','lead-magnets','benchmark-modules']) {
  const p = path.join(root, dir);
  for (const file of fs.readdirSync(p).filter((x) => x.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(p, file), 'utf8');
    for (const key of required) {
      if (!text.includes(key)) failures.push(`${dir}/${file} missing ${key}`);
    }
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('content validation pass');
