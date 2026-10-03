import fs from 'node:fs';
import path from 'node:path';

const outputRoot = process.argv[2];
if (!outputRoot) throw new Error('Output directory argument is required');

const packagePath = path.resolve('package.json');
const lockPath = path.resolve('package-lock.json');
const vendorPackagePath = path.resolve('vendor/http-cache-semantics/package.json');

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const vendor = JSON.parse(fs.readFileSync(vendorPackagePath, 'utf8'));

const expectedLocalSpec = 'file:vendor/http-cache-semantics';
const expectedRegistryPackage = {
  version: '4.2.0',
  resolved: 'https://registry.npmjs.org/http-cache-semantics/-/http-cache-semantics-4.2.0.tgz',
  integrity: 'sha512-dTxcvPXqPvXBQpq5dUr6mEMJX4oIEFv6bwom3FDwKRDsuIjjJGANqhBuoAn9c1RQJIdAKav33ED65E2ys+87QQ==',
  license: 'BSD-2-Clause',
};

if (pkg.dependencies?.['http-cache-semantics'] !== expectedLocalSpec) {
  throw new Error('Root package is not pinned to the expected local http-cache-semantics fork');
}
if (vendor.name !== 'http-cache-semantics' || vendor.version !== '4.2.1') {
  throw new Error('Vendored package identity is not the expected patched fork');
}
if (vendor.license !== 'BSD-2-Clause') {
  throw new Error('Vendored package license must remain BSD-2-Clause');
}
if (vendor.usdImpactPatch?.advisory !== 'GHSA-ch52-4w7c-c8xp') {
  throw new Error('Vendored package advisory provenance is missing');
}
if (vendor.usdImpactPatch?.upstreamCommit !== 'f01112e954b83cfa8765b633ba880e5e980aa54c') {
  throw new Error('Vendored package upstream commit provenance changed unexpectedly');
}
if (lock.packages?.['']?.dependencies?.['http-cache-semantics'] !== expectedLocalSpec) {
  throw new Error('Lockfile root is not pinned to the expected local fork');
}
const linked = lock.packages?.['node_modules/http-cache-semantics'];
if (!linked || linked.resolved !== 'vendor/http-cache-semantics' || linked.link !== true) {
  throw new Error('Lockfile does not link node_modules/http-cache-semantics to the vendored fork');
}

const registryPackage = structuredClone(pkg);
delete registryPackage.dependencies['http-cache-semantics'];

const registryLock = structuredClone(lock);
delete registryLock.packages[''].dependencies['http-cache-semantics'];
registryLock.packages['node_modules/http-cache-semantics'] = expectedRegistryPackage;
delete registryLock.packages['vendor/http-cache-semantics'];

fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, 'package.json'), JSON.stringify(registryPackage, null, 2) + '\n');
fs.writeFileSync(path.join(outputRoot, 'package-lock.json'), JSON.stringify(registryLock, null, 2) + '\n');

console.log('registry-only signature audit manifests prepared');
