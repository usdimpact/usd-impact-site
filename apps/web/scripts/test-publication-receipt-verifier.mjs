import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,randomBytes} from 'node:crypto';
import {FIELDS,SCOPE,encodeReceiptPayload,receiptSigningBytes,createReceiptVerifier} from '../src/lib/publication-receipt-verifier.js';
const key=generateKeyPairSync('ed25519'), other=generateKeyPairSync('ed25519');
const pem=key.publicKey.export({type:'spki',format:'pem'});
const NOW=Date.parse('2026-09-11T12:29:50.000Z'); const iso=d=>new Date(NOW+d).toISOString();
const base={schema:'first-public-dispatch/v1',keyId:'fixture-only-key',audience:'publication-history-recorder',...SCOPE,
 target:'production',exposure:'public-approved',deploymentId:'dpl_ReceiptFixtureOnly',commitSha:'a'.repeat(40),
 artifactSha256:'b'.repeat(64),manifestSha256:'c'.repeat(64),approvalSha256:'d'.repeat(64),
 path:'/news/catalysts/fixture-cpi-preview',sourceSha256:'e'.repeat(64),responseSha256:'f'.repeat(64),
 eventIdentity:'BLS:CPI:2026-08:initial',phase:'preview',releaseAt:iso(10000),checkedAt:iso(-10000),validUntil:iso(10000),
 dispatchedAt:iso(-2000),finishedAt:iso(-1000),attemptId:'1'.repeat(32),surface:'article',method:'GET',status:200,boundaryVersion:'publication-dispatch/v1'};
const binding=p=>Object.fromEntries(FIELDS.filter(k=>!['schema','keyId','audience','dispatchedAt','finishedAt'].includes(k)).map(k=>[k,p[k]]));
const snapshot=()=>({observedAt:iso(-1000),validUntil:iso(10000),keys:[{keyId:base.keyId,publicKeyPem:pem,notBefore:iso(-100000),notAfter:iso(100000),revoked:false}]});
function signed(p=base,{text=encodeReceiptPayload(p),pair=key,prefix=true}={}){
 return JSON.stringify({payload:Buffer.from(text).toString('base64url'),signature:sign(null,prefix?receiptSigningBytes(text):Buffer.from(text),pair.privateKey).toString('base64url')});
}
const tests=[];
function test(name,f){f();tests.push(name);}
function run({p=base,raw=signed(p),ks=snapshot(),b=binding(p),now=()=>NOW}={}){return createReceiptVerifier({now})(raw,{keySnapshot:ks,binding:b});}
function held(r,code){assert.match(r.decision,code??/^HOLD_/);assert.equal(r.admissionRecorded,false);assert.equal(r.publicationAuthorized,false);}
test('valid fixed-key signature yields assertion only',()=>{const r=run();assert.equal(r.decision,'VERIFIED_SIGNER_ASSERTION_ONLY');assert.equal(r.admissionRecorded,false);assert.equal(r.enforcementActive,false);});
for(const f of ['repository','projectId','teamId','target','exposure','deploymentId','commitSha','artifactSha256','manifestSha256','approvalSha256','path','sourceSha256','responseSha256','eventIdentity','phase','releaseAt','checkedAt','validUntil','attemptId','surface','method','status','boundaryVersion']){
 test('protected binding mismatch '+f,()=>{const b=binding(base);b[f]=f==='status'?201:'different';held(run({b}),/^HOLD_BINDING$/);});
}
for(const [name,patch] of [
 ['private Preview',{target:'preview'}],['private context',{exposure:'private-preview'}],['wrong project',{projectId:'other'}],
 ['expired preview',{releaseAt:iso(0),validUntil:iso(0)}],['expiry beyond release',{validUntil:iso(11000)}],
 ['future dispatch',{dispatchedAt:iso(1000),finishedAt:iso(2000)}],['finish before dispatch',{finishedAt:iso(-3000)}],
 ['old receipt',{dispatchedAt:iso(-18000),finishedAt:iso(-17000),checkedAt:iso(-20000)}],
 ['future evidence',{checkedAt:iso(1000)}],['overlong evidence',{checkedAt:iso(-1000000)}],
 ['outcome before release',{phase:'outcome'}],['missing month',{eventIdentity:'BLS:CPI:2026:initial'}],
 ['unsupported event',{eventIdentity:'BEA:PCE:2026-08:initial'}],['calendar Daily not implemented',{path:'/news/2026-09-10'}],
 ['HEAD cannot establish first body',{method:'HEAD'}],['aggregate cannot establish first body',{surface:'feed'}],
 ['non-success response',{status:503}],['not-modified response',{status:304}],['redirect',{status:302}],['partial response',{status:206}],
 ['wrong audience',{audience:'other'}],['bad receipt ID',{attemptId:'known-nonce'}],['wrong protocol',{boundaryVersion:'v2'}],
 ['encoded route',{path:'/news/catalysts/%66ixture'}],['double slash',{path:'/news//catalysts/fixture'}],
 ['noncanonical time',{dispatchedAt:'2026-09-11T12:29:48Z'}],['invalid date',{checkedAt:'2026-02-31T12:00:00.000Z'}],
]) test(name,()=>held(run({p:{...base,...patch}})));
test('exact receipt age deadline rejected',()=>held(run({p:{...base,checkedAt:iso(-30000),dispatchedAt:iso(-16000),finishedAt:iso(-15000)}}),/^HOLD_RECEIPT_EXPIRED$/));
test('one millisecond before receipt age deadline eligible for assertion',()=>assert.equal(run({p:{...base,checkedAt:iso(-30000),dispatchedAt:iso(-16000),finishedAt:iso(-14999)}}).decision,'VERIFIED_SIGNER_ASSERTION_ONLY'));
test('valid outcome requires past verified release',()=>assert.equal(run({p:{...base,phase:'outcome',releaseAt:iso(-20000)}}).decision,'VERIFIED_SIGNER_ASSERTION_ONLY'));
test('no-calendar Daily remains separate receipt mode',()=>assert.equal(run({p:{...base,path:'/news/2026-09-10',phase:'none',eventIdentity:null,releaseAt:null}}).decision,'VERIFIED_SIGNER_ASSERTION_ONLY'));
test('invalid Daily date is refused',()=>held(run({p:{...base,path:'/news/2026-02-31',phase:'none',eventIdentity:null,releaseAt:null}})));
test('different private key cannot sign',()=>held(run({raw:signed(base,{pair:other})}),/^HOLD_SIGNATURE$/));
test('domain-separated signature required',()=>held(run({raw:signed(base,{prefix:false})}),/^HOLD_SIGNATURE$/));
test('tampered signed body rejected',()=>{const e=JSON.parse(signed());e.payload=Buffer.from(encodeReceiptPayload({...base,path:'/news/catalysts/tampered'})).toString('base64url');held(run({raw:JSON.stringify(e)}),/^HOLD_SIGNATURE$/);});
test('duplicate payload key rejected before trust',()=>{const text=encodeReceiptPayload(base).replace('{','{"phase":"outcome",');held(run({raw:signed(base,{text})}),/^HOLD_NONCANONICAL$/);});
test('unknown payload field rejected',()=>{const text=JSON.stringify({...base,verified:true});held(run({raw:signed(base,{text})}));});
test('envelope duplicate key rejected',()=>{const raw=signed().replace('{','{"payload":"anything",');held(run({raw}),/^HOLD_ENVELOPE$/);});
test('payload whitespace rejected',()=>held(run({raw:signed(base,{text:' '+encodeReceiptPayload(base)})}),/^HOLD_NONCANONICAL$/));
test('algorithm override rejected',()=>{const e={...JSON.parse(signed()),alg:'none'};held(run({raw:JSON.stringify(e)}));});
test('key URL not accepted',()=>{const e={...JSON.parse(signed()),jku:'https://invalid.example/key'};held(run({raw:JSON.stringify(e)}));});
test('empty signature rejected',()=>{const e=JSON.parse(signed());e.signature='';held(run({raw:JSON.stringify(e)}));});
test('padded base64 rejected',()=>{const e=JSON.parse(signed());e.payload+='=';held(run({raw:JSON.stringify(e)}));});
test('invalid UTF8 rejected',()=>{const e=JSON.parse(signed());e.payload=Buffer.from([255,254]).toString('base64url');held(run({raw:JSON.stringify(e)}));});
test('oversized envelope rejected',()=>held(run({raw:'x'.repeat(25000)})));
test('unknown key ID rejected',()=>{const ks=snapshot();ks.keys[0].keyId='different';held(run({ks}),/^HOLD_KEY$/);});
test('revoked key rejected',()=>{const ks=snapshot();ks.keys[0].revoked=true;held(run({ks}),/^HOLD_KEY$/);});
test('duplicate key IDs rejected',()=>{const ks=snapshot();ks.keys.push({...ks.keys[0]});held(run({ks}),/^HOLD_KEY_SNAPSHOT$/);});
test('stale key snapshot rejected',()=>{const ks=snapshot();ks.validUntil=iso(0);held(run({ks}),/^HOLD_KEY_SNAPSHOT$/);});
test('overlong key snapshot rejected',()=>{const ks=snapshot();ks.validUntil=iso(60000);held(run({ks}),/^HOLD_KEY_SNAPSHOT$/);});
test('future key snapshot rejected',()=>{const ks=snapshot();ks.observedAt=iso(1);held(run({ks}),/^HOLD_KEY_SNAPSHOT$/);});
test('pre-activation signature rejected',()=>{const ks=snapshot();ks.keys[0].notBefore=iso(-1000);held(run({ks}),/^HOLD_KEY_LIFETIME$/);});
test('expired key rejected',()=>{const ks=snapshot();ks.keys[0].notAfter=iso(0);held(run({ks}),/^HOLD_KEY_LIFETIME$/);});
test('wrong key algorithm rejected',()=>{const ks=snapshot(),ec=generateKeyPairSync('ec',{namedCurve:'prime256v1'});ks.keys[0].publicKeyPem=ec.publicKey.export({type:'spki',format:'pem'});held(run({ks}),/^HOLD_KEY$/);});
test('clock crossing final receipt deadline rejected',()=>{let i=0;held(run({now:()=>++i===1?NOW:NOW+10000}),/^HOLD_RECEIPT_EXPIRED$/);});
test('backwards trusted clock rejected',()=>{let i=0;held(run({now:()=>++i===1?NOW:NOW-1}),/^HOLD_CLOCK$/);});
test('invalid clock rejected',()=>held(run({now:()=>NaN}),/^HOLD_CLOCK$/));
test('reverification creates no durable replay claim',()=>{const verifier=createReceiptVerifier({now:()=>NOW}),raw=signed();const a=verifier(raw,{keySnapshot:snapshot(),binding:binding(base)});const b=verifier(raw,{keySnapshot:snapshot(),binding:binding(base)});assert.equal(a.receiptSha256,b.receiptSha256);assert.equal(b.admissionRecorded,false);});
test('key assertions do not authenticate live public exposure',()=>{const r=run();assert.equal(r.decision,'VERIFIED_SIGNER_ASSERTION_ONLY');assert.equal(r.publicationAuthorized,false);});
console.log('Receipt contract: '+tests.length+' tests passed; ephemeral test keys; no live signing, database or publication.');
