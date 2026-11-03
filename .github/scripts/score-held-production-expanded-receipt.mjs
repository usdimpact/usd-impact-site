// Additional engineering-only SHA receipt from pinned Production main.
// No source text, provider data or HTML is printed. This PR-owned receipt is
// NOT the trusted F2 check or any release/rights authorization.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ORIGINAL='d1740214f5737996f321a037efe3f2f7d21ecd64';
const roots={original:path.resolve('qa-pinned-main/apps/web'),candidate:path.resolve('apps/web')};
const ledger=JSON.parse(fs.readFileSync(path.join(roots.candidate,'scripts/score-held-report-source-baseline.json'),'utf8'));
const names=Object.keys(ledger.existing_reports??{}).map(source=>{
  const m=/^(weekly|monthly)-reports\/(\d{4}-\d{2}-\d{2})\.md$/.exec(source);
  assert.ok(m,'unknown historical Score source');
  return 'reports/'+m[1]+'/'+m[2];
}).sort();
assert.equal(names.length,16,'exactly 13 Weekly and 3 Monthly routes expected');
const weeklyDates=Object.keys(ledger.existing_reports).map(s=>/^weekly-reports\/(\d{4}-\d{2}-\d{2})\.md$/.exec(s)?.[1]).filter(Boolean).sort();
assert.equal(weeklyDates.length,13);
const newsletterNames=weeklyDates.flatMap(d=>['newsletter/weekly/'+d+'.json','newsletter/progress/'+d+'.json']).sort();
const sha=s=>createHash('sha256').update(s).digest('hex');

function regularFile(file){
  const stat=fs.lstatSync(file);
  assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'receipt input must be a regular file');
  assert.ok(stat.size<=16*1024*1024,'oversized receipt input');
  return fs.readFileSync(file);
}
// Normalize ONLY volatile CSP nonce and integrity attribute values.
// Preserve presence, tag position, content, all nonvolatile attributes and text.
function normalizeHtml(html){
  return html.replace(/<[a-z][^>]*>/gi,tag=>tag
    .replace(/(\snonce\s*=\s*)(?:"[^"]*"|'[^']*')/gi,'$1"__CSP_NONCE__"')
    .replace(/(\sintegrity\s*=\s*)(?:"[^"]*"|'[^']*')/gi,'$1"__SRI_VALUE__"'));
}
function one(matches,name,route){
  assert.equal(matches.length,1,'expected one '+name+' in '+route);
  return matches[0];
}
function attributes(tag){
  const fields=new Map();
  for(const x of tag.matchAll(/([a-z][a-z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)){
    const n=x[1].toLowerCase();
    if(fields.has(n))throw Error('Duplicate HTML attribute '+n);
    fields.set(n,x[2]??x[3]??'');
  }
  return fields;
}
function reportDigest(root,route){
  const html=regularFile(path.join(root,'dist',route,'index.html')).toString('utf8');
  const body=one([...html.matchAll(/<body\b[^>]*>[\s\S]*?<\/body\s*>/gi)],'body',route)[0];
  const head=one([...html.matchAll(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi)],'head',route)[0];
  const hero=one([...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section\s*>/gi)]
    .map(m=>m[0]).filter(v=>/^<section\b[^>]*class\s*=\s*(?:"[^"]*reports-hero[^"]*"|'[^']*reports-hero[^']*')/i.test(v)),
    'historical report hero',route);
  const title=one([...html.matchAll(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi)],'title',route)[0];
  const metas=[...html.matchAll(/<meta\b[^>]*>/gi)]
    .map(v=>v[0]).filter(v=>attributes(v).get('name')?.toLowerCase()==='description');
  const desc=one(metas,'meta description',route);
  const jsonld=[...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)]
    .map(v=>v[0]).filter(v=>{
      const m=/^<script\b[^>]*>/i.exec(v);
      return m&&attributes(m[0]).get('type')?.toLowerCase()==='application/ld+json';
    }).map(v=>normalizeHtml(v));
  return {
    body:sha(normalizeHtml(body)),
    head:sha(normalizeHtml(head)),
    hero:sha(normalizeHtml(hero)),
    title:sha(normalizeHtml(title)),
    meta_description:sha(normalizeHtml(desc)),
    jsonld:sha(JSON.stringify(jsonld)),
    jsonld_count:jsonld.length,
  };
}
function allDigest(root){
  const reports=Object.fromEntries(names.map(n=>[n,reportDigest(root,n)]));
  const json={};
  for(const family of ['weekly','progress']){
    const folder=path.join(root,'dist','newsletter',family);
    const actual=fs.readdirSync(folder).sort();
    const expected=weeklyDates.map(d=>d+'.json').sort();
    assert.deepEqual(actual,expected,'newsletter '+family+' original dates must not change');
  }
  for(const p of newsletterNames)json[p]=sha(regularFile(path.join(root,'dist',p)));
  return {reports,newsletter:json};
}
const original=allDigest(roots.original),candidate=allDigest(roots.candidate);
const differences=[];
for(const route of names){
  const a=original.reports[route],b=candidate.reports[route];
  for(const key of Object.keys(a))if(a[key]!==b[key])differences.push({path:route,field:key});
}
for(const p of newsletterNames)if(original.newsletter[p]!==candidate.newsletter[p])
  differences.push({path:p,field:'json'});
const output={
  version:1,
  status:'DRAFT_EVIDENCE_NOT_F2',
  original_main_sha:ORIGINAL,
  normalization:'HTML_ATTR_NONCE_INTEGRITY_VALUE_ONLY_V1',
  historical_reports:names.length,
  newsletter_json:newsletterNames.length,
  differences,
  original_sha256:original,
  candidate_body_sha256:Object.fromEntries(
    Object.entries(candidate.reports).map(([name,regions])=>[name,regions.body])),
  candidate_head_sha256:Object.fromEntries(
    Object.entries(candidate.reports).map(([name,regions])=>[name,regions.head])),
  classified_mode:process.env.VERCEL_ENV??'unspecified',
  original_whole_body_unapproved_deltas:differences.filter(d=>d.field==='body').length,
};
console.log('SCORE_EXPANDED_RENDER_RECEIPT_JSON='+JSON.stringify(output));
if(process.env.GITHUB_STEP_SUMMARY){
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '\n## Additional Score whole-body/metadata/newsletter SHA receipt — HOLD\n\n'+
    'Pinned main: '+ORIGINAL+'; reports='+names.length+
    '; newsletter JSON='+newsletterNames.length+'; differences='+differences.length+
    '. F2, legal and release HOLD unchanged.\n');
}
const acceptedScopeDifferences=differences.filter(d=>d.field!=='body');
console.log('SCORE_ORIGINAL_FULL_BODY_OWNER_HOLD='+output.original_whole_body_unapproved_deltas+
  ' mode='+output.classified_mode+' (not public release; current integration body differs from original main)');
if(acceptedScopeDifferences.length)process.exitCode=1;
