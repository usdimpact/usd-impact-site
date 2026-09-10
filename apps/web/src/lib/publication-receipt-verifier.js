import { createHash, createPublicKey, verify } from 'node:crypto';

// Offline candidate only. No signer, key discovery, database writer, HTTP route or provider call.
export const SCOPE = Object.freeze({repository:'usdimpact/usd-impact-site',
  projectId:'prj_ZoLLM35ksI6wk17PcfS2xYknaVl7', teamId:'team_1LuMlacGuM198mRjoID4O3Ct'});
export const FIELDS = Object.freeze(['schema','keyId','audience','repository','projectId','teamId',
  'target','exposure','deploymentId','commitSha','artifactSha256','manifestSha256','approvalSha256',
  'path','sourceSha256','responseSha256','eventIdentity','phase','releaseAt','checkedAt','validUntil',
  'dispatchedAt','finishedAt','attemptId','surface','method','status','boundaryVersion']);
const BOUND = ['repository','projectId','teamId','target','exposure','deploymentId','commitSha',
  'artifactSha256','manifestSha256','approvalSha256','path','sourceSha256','responseSha256',
  'eventIdentity','phase','releaseAt','checkedAt','validUntil','attemptId','surface','method','status','boundaryVersion'];
const PREFIX = 'usd-impact/first-public-dispatch-receipt/v1\n';
const H=/^[a-f0-9]{64}$/; const SHA=/^[a-f0-9]{40}$/;
const PATH=/^\/news\/(?:[0-9]{4}-[0-9]{2}-[0-9]{2}|catalysts\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;
const error=(code)=>{throw Object.assign(new Error(code),{code});};
const requireThat=(ok,code)=>{if(!ok)error(code);};
const digest=(s)=>createHash('sha256').update(s).digest('hex');
function instant(s){
  requireThat(typeof s==='string' && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s),'HOLD_TIME');
  const n=Date.parse(s);requireThat(Number.isFinite(n)&&new Date(n).toISOString()===s,'HOLD_TIME');return n;
}
function exactKeys(o,keys){return o && typeof o==='object' && !Array.isArray(o)
  && Object.keys(o).length===keys.length && keys.every(k=>Object.hasOwn(o,k));}
function canonical(payload){
  requireThat(exactKeys(payload,FIELDS),'HOLD_SCHEMA');
  return JSON.stringify(Object.fromEntries(FIELDS.map(k=>[k,payload[k]])));
}
export function encodeReceiptPayload(payload){return canonical(payload);}
export function receiptSigningBytes(payloadText){return Buffer.from(PREFIX+payloadText,'utf8');}
function bytes(encoded,limit){
  requireThat(typeof encoded==='string'&&encoded.length>0&&encoded.length<=limit
    && /^[A-Za-z0-9_-]+$/.test(encoded),'HOLD_ENCODING');
  const b=Buffer.from(encoded,'base64url');requireThat(b.toString('base64url')===encoded,'HOLD_ENCODING');return b;
}
function payloadSchema(p){
  requireThat(p.schema==='first-public-dispatch/v1' && p.audience==='publication-history-recorder', 'HOLD_SCHEMA');
  requireThat(typeof p.keyId==='string'&&/^[a-z0-9-]{1,64}$/.test(p.keyId),'HOLD_KEY');
  requireThat(Object.entries(SCOPE).every(([k,v])=>p[k]===v),'HOLD_SCOPE');
  requireThat(p.target==='production'&&p.exposure==='public-approved','HOLD_PUBLIC_CONTEXT');
  requireThat(typeof p.deploymentId==='string'&&/^dpl_[A-Za-z0-9]{8,80}$/.test(p.deploymentId)
    && SHA.test(p.commitSha),'HOLD_BINDING');
  requireThat(['artifactSha256','manifestSha256','approvalSha256','sourceSha256','responseSha256'].every(k=>typeof p[k]==='string'&&H.test(p[k])),'HOLD_BINDING');
  requireThat(typeof p.path==='string'&&p.path.length<=240&&PATH.test(p.path),'HOLD_PATH');
  const daily=p.path.startsWith('/news/')&&!p.path.startsWith('/news/catalysts/');
  if(daily){const d=p.path.slice(6);requireThat(Number.isFinite(Date.parse(d+'T00:00:00.000Z'))&&new Date(d+'T00:00:00.000Z').toISOString().slice(0,10)===d,'HOLD_PATH');}
  requireThat(p.method==='GET'&&p.status===200&&p.surface==='article'&&p.boundaryVersion==='publication-dispatch/v1','HOLD_RESPONSE');
  requireThat(typeof p.attemptId==='string'&&/^[a-f0-9]{32}$/.test(p.attemptId),'HOLD_ATTEMPT');
  requireThat(['preview','outcome','none'].includes(p.phase),'HOLD_PHASE');
  if(p.phase==='none')requireThat(daily&&p.eventIdentity===null&&p.releaseAt===null,'HOLD_EVENT');
  else {
    requireThat(typeof p.eventIdentity==='string'&&/^BLS:(CPI|PPI|EMPSIT):20\d{2}-(0[1-9]|1[0-2]):initial$/.test(p.eventIdentity),'HOLD_EVENT');
    instant(p.releaseAt);
    // A single-event receipt must not certify a multi-event Daily bundle.
    requireThat(!daily,'HOLD_UNSUPPORTED_DAILY_CALENDAR');
  }
}
/** Trusted key snapshots and binding are supplied by protected server code, never a request body.
 * This authenticates the signer's assertion; it cannot prove the signer really dispatched publicly.
 * Caller must recheck fresh authority and consume exact attempt/receipt durably in one transaction.
 */
export function createReceiptVerifier({now=Date.now}={}){
  let highest=-1;
  function clock(){const n=now();requireThat(Number.isSafeInteger(n)&&n>=highest&&n>=0,'HOLD_CLOCK');highest=n;return n;}
  return function verifyCandidate(rawEnvelope,{keySnapshot,binding}={}){
    try{
      const n=clock();
      requireThat(typeof rawEnvelope==='string'&&Buffer.byteLength(rawEnvelope)<=24000,'HOLD_ENVELOPE');
      const e=JSON.parse(rawEnvelope);
      requireThat(exactKeys(e,['payload','signature'])&&rawEnvelope===JSON.stringify({payload:e.payload,signature:e.signature}),'HOLD_ENVELOPE');
      const payloadBytes=bytes(e.payload,16000), signature=bytes(e.signature,128);
      requireThat(signature.length===64,'HOLD_SIGNATURE');
      const text=new TextDecoder('utf-8',{fatal:true}).decode(payloadBytes);
      const p=JSON.parse(text);requireThat(text===canonical(p),'HOLD_NONCANONICAL');payloadSchema(p);
      requireThat(exactKeys(keySnapshot,['observedAt','validUntil','keys'])&&Array.isArray(keySnapshot.keys)
        && keySnapshot.keys.length>0&&keySnapshot.keys.length<=8,'HOLD_KEY_SNAPSHOT');
      const ks=instant(keySnapshot.observedAt), ke=instant(keySnapshot.validUntil);
      requireThat(ks<=n&&n<ke&&ke-ks<=15000,'HOLD_KEY_SNAPSHOT');
      const ids=keySnapshot.keys.map(k=>k?.keyId);requireThat(new Set(ids).size===ids.length,'HOLD_KEY_SNAPSHOT');
      const k=keySnapshot.keys.find(x=>x?.keyId===p.keyId);
      requireThat(k&&exactKeys(k,['keyId','publicKeyPem','notBefore','notAfter','revoked'])&&k.revoked===false,'HOLD_KEY');
      requireThat(typeof k.publicKeyPem==='string'&&k.publicKeyPem.length<1000&&k.publicKeyPem.startsWith('-----BEGIN PUBLIC KEY-----'),'HOLD_KEY');
      const publicKey=createPublicKey(k.publicKeyPem); requireThat(publicKey.type==='public'&&publicKey.asymmetricKeyType==='ed25519','HOLD_KEY');
      requireThat(verify(null,receiptSigningBytes(text),publicKey,signature),'HOLD_SIGNATURE');
      requireThat(exactKeys(binding,BOUND)&&BOUND.every(f=>binding[f]===p[f]),'HOLD_BINDING');
      const checked=instant(p.checkedAt), end=instant(p.validUntil), dispatched=instant(p.dispatchedAt), finished=instant(p.finishedAt);
      requireThat(checked<=dispatched&&dispatched<=finished&&finished<=n&&checked<end&&end-checked<=900000,'HOLD_TIME_ORDER');
      requireThat(n-finished<15000&&n<end,'HOLD_RECEIPT_EXPIRED');
      requireThat(instant(k.notBefore)<=dispatched&&n<instant(k.notAfter),'HOLD_KEY_LIFETIME');
      if(p.phase==='preview')requireThat(end<=instant(p.releaseAt)&&n<instant(p.releaseAt),'HOLD_PREVIEW_EXPIRED');
      if(p.phase==='outcome')requireThat(checked>=instant(p.releaseAt)&&dispatched>=instant(p.releaseAt),'HOLD_OUTCOME_NOT_RELEASED');
      const final=clock();requireThat(final<end&&final<ke&&final<instant(k.notAfter)&&final-finished<15000,'HOLD_RECEIPT_EXPIRED');
      return Object.freeze({decision:'VERIFIED_SIGNER_ASSERTION_ONLY',receiptSha256:digest(rawEnvelope),
        payloadSha256:digest(text),attemptId:p.attemptId,verifiedAt:new Date(final).toISOString(),
        recordDeadline:new Date(Math.min(end,ke,instant(k.notAfter),finished+15000)).toISOString(),
        publicationAuthorized:false,admissionRecorded:false,enforcementActive:false});
    }catch(e){return Object.freeze({decision:typeof e?.code==='string'&&/^HOLD_[A-Z_]+$/.test(e.code)?e.code:'HOLD_INVALID_RECEIPT',
      publicationAuthorized:false,admissionRecorded:false,enforcementActive:false});}
  };
}
