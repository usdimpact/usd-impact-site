import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';

const assets = [
  {
    source: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
    destination: '../public/assets/fonts/inter-latin-wght-normal.woff2',
    sha256: '3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62',
  },
  {
    source: '../node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2',
    destination: '../public/assets/fonts/inter-latin-ext-wght-normal.woff2',
    sha256: '34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956',
  },
  {
    source: '../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2',
    destination: '../public/assets/fonts/playfair-display-latin-wght-normal.woff2',
    sha256: 'e0c764a8e9e1cce92163c55bac4b2ad6cd4cf8c696ce2289ab5c41565e65b7e2',
  },
  {
    source: '../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-ext-wght-normal.woff2',
    destination: '../public/assets/fonts/playfair-display-latin-ext-wght-normal.woff2',
    sha256: '42898ad49a6b23f32b109243e1df596edf831015ed685f429e4dafbb181d599d',
  },
  {
    source: '../node_modules/@fontsource-variable/inter/LICENSE',
    destination: '../public/assets/fonts/inter-OFL-1.1.txt',
    sha256: '3b0a5fca3d17942cde889069889dedbbbd075e9b599968c82a95f4d944e9b345',
  },
  {
    source: '../node_modules/@fontsource-variable/playfair-display/LICENSE',
    destination: '../public/assets/fonts/playfair-display-OFL-1.1.txt',
    sha256: 'c052aafd2a71e90bcee6e69f475029d430a10d548c08ffcae350171f0e9668b1',
  },
];

const digest = (buffer) => createHash('sha256').update(buffer).digest('hex');

await mkdir(new URL('../public/assets/fonts/', import.meta.url), { recursive: true });

for (const asset of assets) {
  const source = new URL(asset.source, import.meta.url);
  const destination = new URL(asset.destination, import.meta.url);
  const contents = await readFile(source);
  const actualSha256 = digest(contents);

  if (actualSha256 !== asset.sha256) {
    throw new Error(`Font integrity mismatch for ${source.pathname}: expected ${asset.sha256}, received ${actualSha256}.`);
  }

  await copyFile(source, destination);
}

console.log(`Prepared ${assets.length} self-hosted font and license assets.`);
