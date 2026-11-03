import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_SOURCE_COMMIT,
  DYNAMIC_CONTENT_PREFIXES,
  GENERATED_FONT_SHA256,
  AUDIT_ONLY_EXCLUSIONS,
  collectWebBuildInputs,
  evaluatePinnedBuildInputs,
  verifyHeldBuildInputs, selectF2TrustedCandidateRoot,
} from './score-held-build-closure.mjs';

const site=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(new URL('./score-held-build-closure-baseline.json',import.meta.url),'utf8'));
assert.equal(manifest.source_commit,FROZEN_SOURCE_COMMIT);
assert.equal(Object.keys(manifest.pinned_files).length,775);
for(const filename of [
  'src/pages/reports/weekly/[date].astro',
  'src/pages/reports/monthly/[date].astro',
  'src/layouts/BaseLayout.astro',
  'astro.config.mjs',
  'middleware.js',
  'package.json',
  'package-lock.json',
  'vercel.json',
  'scripts/score-held-report-source-guard.mjs',
])assert.ok(manifest.pinned_files[filename],'missing pinned high-risk source: '+filename);
assert.deepEqual(verifyHeldBuildInputs(),[],'actual Draft site must match the pinned F1d input inventory');

// Production Vercel invokes these scripts; don't rely only on a PR-owned job.
const pkg=JSON.parse(fs.readFileSync(path.join(site,'package.json'),'utf8'));
const vercel=JSON.parse(fs.readFileSync(path.join(site,'vercel.json'),'utf8'));
assert.equal(vercel.buildCommand,'npm run validate && npm run build');
assert.match(pkg.scripts.validate,/^node scripts\/score-held-build-closure\.mjs && node scripts\/score-held-report-source-guard\.mjs && /);
assert.match(pkg.scripts.build,/^npm run prepare:fonts && node scripts\/score-held-build-closure\.mjs && /);
assert.match(pkg.scripts.build,/&& node scripts\/score-held-report-source-guard\.mjs --built$/);

const root=fs.mkdtempSync(path.join(os.tmpdir(),'f1d-build-closure-negative-'));
function put(filename,contents){
  const absolute=path.join(root,filename);
  fs.mkdirSync(path.dirname(absolute),{recursive:true});
  fs.writeFileSync(absolute,contents);
}
let fixture;
function inspect(){
  const scan=collectWebBuildInputs(root);
  return [...scan.failures,...evaluatePinnedBuildInputs(fixture,scan.files,{minimum:0})];
}
const weekly='src/pages/reports/weekly/[date].astro';
const monthly='src/pages/reports/monthly/[date].astro';
const hook='scripts/render-score.mjs';
const astro='astro.config.mjs';
try {
  put(weekly,'<main>original historical Score report</main>\n');
  put(monthly,'<main>original historical Monthly report</main>\n');
  put('src/layouts/BaseLayout.astro','<slot />\n');
  const evidenceComponent='src/components/FrameworkEvidenceChain.astro';
  const configImportedLib='src/lib/localization-policy.js';
  put(evidenceComponent,'<aside>Original verified evidence chain</aside>\n');
  put(configImportedLib,'export const heldPolicy = true;\n');
  put(hook,'export const render = () => "unchanged";\n');
  put(astro,"export default { output: 'static' };\n");
  put('package.json','{"scripts":{"build":"astro build"}}\n');
  put('vercel.json','{"buildCommand":"npm run validate && npm run build"}\n');
  const clean=collectWebBuildInputs(root);
  assert.deepEqual(clean.failures,[]);
  fixture={
    schema_version:1,
    disposition:'hold',
    source_commit:FROZEN_SOURCE_COMMIT,
    score_rights_issue:'https://github.com/usdimpact/usd-impact-pipeline/issues/155',
    dynamic_content_prefixes:[...DYNAMIC_CONTENT_PREFIXES],
    audit_only_exclusions:[...AUDIT_ONLY_EXCLUSIONS],
    pinned_files:{...clean.files},
  };
  assert.deepEqual(inspect(),[],'small clean fixture must pass');
  assert.equal(Object.keys(GENERATED_FONT_SHA256).length,6);
  const counterfeitFont='public/assets/fonts/inter-OFL-1.1.txt';
  put(counterfeitFont,'unapproved font license contents');
  assert.ok(inspect().some(s=>s.includes('Generated font digest mismatch: '+counterfeitFont)),
    'unknown generated font bytes must never be accepted');
  fs.unlinkSync(path.join(root,counterfeitFont));
  assert.deepEqual(inspect(),[],'generated font negative must recover');


  // E: same-date historical HTML changes via the existing page template.
  put(weekly,'<main>altered historical Score body on the same date</main>\n');
  assert.ok(inspect().some(s=>s.includes('Changed frozen build input: '+weekly)),
    'E: modified existing-date Score page template must fail');
  put(weekly,'<main>original historical Score report</main>\n');

  // E3: a new build hook can rewrite already-existing HTML after rendering.
  const evilHook='scripts/score-rewrite-postbuild.mjs';
  put(evilHook,'import fs from "node:fs"; /* rewrite existing reports */\n');
  assert.ok(inspect().some(s=>s.includes('New unreviewed build input: '+evilHook)),
    'E3: unreviewed postbuild output mutator must fail');
  fs.rmSync(path.join(root,evilHook));

  // E3 variant: mutation of a tracked hook is not allowed either.
  put(hook,'export const render = () => "tampered historical report";\n');
  assert.ok(inspect().some(s=>s.includes('Changed frozen build input: '+hook)),
    'E3: changed approved build script must fail');
  put(hook,'export const render = () => "unchanged";\n');

  // Claude QA6 E4/E5/E6/G2b/G3: guard build influencers beyond src/pages.
  // E5: imported component can alter all historical Weekly figures.
  put(evidenceComponent,'<aside>Changed Score figure +9.99</aside>\n');
  assert.ok(inspect().some(s=>s.includes('Changed frozen build input: '+evidenceComponent)),
    'E5: edited imported report component MUST fail');
  put(evidenceComponent,'<aside>Original verified evidence chain</aside>\n');

  // E6: report layout can alter history without touching the route itself.
  put('src/layouts/BaseLayout.astro','<slot />\n<!-- tampered historical Score -->\n');
  assert.ok(inspect().some(s=>s.includes('Changed frozen build input: src/layouts/BaseLayout.astro')),
    'E6: edited shared layout MUST fail');
  put('src/layouts/BaseLayout.astro','<slot />\n');

  // E4: an Astro-config imported helper can modify dist on process exit.
  put(configImportedLib,'export const heldPolicy = false; // exit hook hijack\n');
  assert.ok(inspect().some(s=>s.includes('Changed frozen build input: '+configImportedLib)),
    'E4: changed build-imported src/lib helper MUST fail');
  put(configImportedLib,'export const heldPolicy = true;\n');

  // G2b: public/ file is copied straight to dist, bypassing route inventories.
  const publicScore='public/data/score-archive/2026-11-06.json';
  put(publicScore,'{"date":"2026-11-06","score":9.99}\n');
  assert.ok(inspect().some(s=>s.includes('New unreviewed build input: '+publicScore)),
    'G2b: extra public Score JSON MUST fail');
  fs.rmSync(path.join(root,'public/data/score-archive'),{recursive:true,force:true});

  // G3: Vercel runtime rewrites could redirect reviewed report routes.
  put('vercel.json','{"buildCommand":"npm run validate && npm run build","rewrites":[{"source":"/reports/weekly/:d","destination":"/api/report/:d"}]}\n');
  assert.ok(inspect().some(s=>s.includes('Changed frozen build input: vercel.json')),
    'G3: Vercel rewrite targeting Score route MUST fail');
  put('vercel.json','{"buildCommand":"npm run validate && npm run build"}\n');

  // F: an alternate Astro srcDir makes the old collection guard scan the wrong tree.
  put(astro,"export default { srcDir: './alternate-src', output: 'static' };\n");
  assert.ok(inspect().some(s=>s.includes('Changed frozen build input: '+astro)),
    'F: changed Astro srcDir must fail');
  put(astro,"export default { output: 'static' };\n");

  // F variant: new unreviewed source tree is not a safe alternative.
  const altSource='alternate-src/content/weekly-reports/2026-10-23.md';
  put(altSource,'---\ntitle: Changed Score\n---\n');
  assert.ok(inspect().some(s=>s.includes('New unreviewed build input: '+altSource)),
    'F: unexpected alternate source directory must fail');
  fs.rmSync(path.join(root,'alternate-src'),{recursive:true,force:true});

  // G: an entirely new route outside /reports/weekly or /reports/monthly.
  const altRoute='src/pages/archivo/semanal/[date].astro';
  put(altRoute,'<main>new synthetic Score-derived report</main>\n');
  assert.ok(inspect().some(s=>s.includes('New unreviewed build input: '+altRoute)),
    'G: alternate Score-derived public route must fail');
  fs.rmSync(path.join(root,'src/pages/archivo'),{recursive:true,force:true});

  // In contrast, normal Daily News/Catalyst content still uses its own gates.
  put('src/content/news/2026-11-03.md','---\ntitle: News\n---\n');
  put('src/content/catalyst-briefs/2026-11-03-example-preview.md','---\ntitle: Event\n---\n');
  assert.deepEqual(inspect(),[],'ordinary content directories must remain outside this extra closure');

  // N3: reject committed or stale runtime build outputs before deployment.
  // These roots must not be skipped wholesale just because they look generated.
  for (const dir of ['.vercel','.astro','.cache','coverage']) {
    const file=dir==='.vercel'?'.vercel/output/functions/score.func/index.js':dir+'/qa7-injected.json';
    put(file,'{\"source\":\"untrusted Score payload\"}\\n');
    assert.ok(inspect().some(s=>s.includes('Forbidden pre-build runtime directory: '+dir)),
      'N3: staged '+dir+' tree MUST block before Astro build');
    fs.rmSync(path.join(root,dir),{recursive:true,force:true});
    assert.deepEqual(inspect(),[],'N3 '+dir+' removal must restore clean source');
  }

  // A symlink is never an allowed new build input.
  fs.symlinkSync(path.join(root,weekly),path.join(root,'src/pages/reports/weekly/alias.astro'));
  assert.ok(inspect().some(s=>s.includes('Symlink in held build input:')),
    'symlinked route must fail');
  fs.unlinkSync(path.join(root,'src/pages/reports/weekly/alias.astro'));

  // F2 N4 adversarial self-repin: PR-owned source and baseline can collude,
  // while a separately held base-branch evaluator + baseline rejects the edit.
  // This is a design fixture; no trusted GitHub required check was installed.
  const modifiedLayout='src/layouts/BaseLayout.astro';
  put(modifiedLayout,'<slot />\n<em>F2 N4 altered historical body</em>\n');
  const observedRepin=collectWebBuildInputs(root).files;
  const attackerRepin={...fixture,pinned_files:{
    ...fixture.pinned_files,
    [modifiedLayout]:observedRepin[modifiedLayout],
  }};
  assert.deepEqual(evaluatePinnedBuildInputs(attackerRepin,observedRepin,{minimum:0}),[],
    'a PR that edits its own pin is self-certifying without a trusted base');
  assert.ok(evaluatePinnedBuildInputs(fixture,observedRepin,{minimum:0})
      .some(x=>x.includes('Changed frozen build input: '+modifiedLayout)),
    'F2 trusted-base prior manifest MUST reject self-repinned historical layout');
  put(modifiedLayout,'<slot />\n');
  assert.deepEqual(inspect(),[],'F2 N4 fixture returns to original frozen source');

  assert.equal(selectF2TrustedCandidateRoot(['node','guard','--root',root],site),root,
    'trusted evaluator --root must select explicit untrusted candidate');
  assert.equal(selectF2TrustedCandidateRoot(['node','guard'],site),site,
    'unprivileged normal evaluation preserves its original working root');
  assert.throws(()=>selectF2TrustedCandidateRoot(['node','guard','--root','./relative'],site),
    /absolute candidate web path/,'trusted evaluator must reject relative --root');
  assert.throws(()=>selectF2TrustedCandidateRoot(['node','guard','--root',root,'--root',root],site),
    /only once/,'duplicate --root must fail closed');

  // A missing manifest item and an altered manifest SHA must fail.
  fs.unlinkSync(path.join(root,monthly));
  assert.ok(inspect().some(s=>s.includes('Missing frozen build input: '+monthly)),
    'deleted pinned template must fail');
  put(monthly,'<main>original historical Monthly report</main>\n');
  const corrupted={...fixture,pinned_files:{...fixture.pinned_files,[weekly]:'0'.repeat(40)}};
  const current=collectWebBuildInputs(root).files;
  assert.ok(evaluatePinnedBuildInputs(corrupted,current,{minimum:0})
    .some(s=>s.includes('Changed frozen build input: '+weekly)));
  assert.deepEqual(inspect(),[],'all negative cases must return to a clean pinned tree');
} finally {
  fs.rmSync(root,{recursive:true,force:true});
}
console.log('F1d PASS: real 775-file inventory; E/E3/F/G, srcDir, same-date source, alternate-route, symlink, deleted/edited inventory negatives; Daily/Catalyst unchanged');
