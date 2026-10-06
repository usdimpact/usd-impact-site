import assert from 'node:assert/strict';
import { handleLocalizationVisualQaFrame } from '../src/lib/localization-visual-qa-token.js';

const PREVIEW = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'feature/spanish-localization-foundation',
};

function req(url, method='GET'){ return { url, method, headers:{} }; }
function res(){
  const h=new Map();
  return {
    statusCode:200, body:'',
    setHeader(k,v){h.set(String(k).toLowerCase(),String(v));},
    getHeader(k){return h.get(String(k).toLowerCase());},
    end(v=''){this.body+=String(v??''); return this;}
  };
}
const resolveUid = (slug) => slug === 'known' ? 'uid' : null;
const resolveVideo = (slug) => slug === 'known' ? { durationSeconds: 60 } : null;
const img = Buffer.from([0xff,0xd8,0xff,0xd9]);

{
  let called=false; const response=res();
  await handleLocalizationVisualQaFrame(req('/api/guided-edition?action=localization-visual-qa-frame&slug=known&time=10'),response,{
    environment:{...PREVIEW,VERCEL_ENV:'production'},resolveUid,resolveVideo,
    createToken:async()=>{called=true; return 'a.b.c';},customerCode:'code',
    fetchImpl:async()=>new Response(img,{status:200,headers:{'content-type':'image/jpeg'}})
  });
  assert.equal(response.statusCode,404); assert.equal(called,false);
}
{
  let called=false; const response=res();
  await handleLocalizationVisualQaFrame(req('/api/guided-edition?action=localization-visual-qa-frame&slug=known&time=10'),response,{
    environment:{...PREVIEW,VERCEL_GIT_COMMIT_REF:'main'},resolveUid,resolveVideo,
    createToken:async()=>{called=true; return 'a.b.c';},customerCode:'code',
    fetchImpl:async()=>new Response(img,{status:200,headers:{'content-type':'image/jpeg'}})
  });
  assert.equal(response.statusCode,404); assert.equal(called,false);
}
{
  const response=res();
  await handleLocalizationVisualQaFrame(req('/api/guided-edition?action=localization-visual-qa-frame&slug=known&time=10','POST'),response,{
    environment:PREVIEW,resolveUid,resolveVideo,createToken:async()=> 'a.b.c',customerCode:'code'
  });
  assert.equal(response.statusCode,405);
}
for (const url of [
  '/api/guided-edition?action=localization-visual-qa-frame&slug=unknown&time=10',
  '/api/guided-edition?action=localization-visual-qa-frame&slug=known&time=-1',
  '/api/guided-edition?action=localization-visual-qa-frame&slug=known&time=61',
  '/api/guided-edition?action=localization-visual-qa-frame&slug=known&time=not-a-number',
]) {
  const response=res();
  await handleLocalizationVisualQaFrame(req(url),response,{
    environment:PREVIEW,resolveUid,resolveVideo,createToken:async()=> 'a.b.c',customerCode:'code'
  });
  assert.ok([400,404].includes(response.statusCode));
}
{
  let fetchedUrl='';
  const response=res();
  await handleLocalizationVisualQaFrame(req('/api/guided-edition?action=localization-visual-qa-frame&slug=known&time=10.5'),response,{
    environment:PREVIEW,resolveUid,resolveVideo,
    createToken:async({videoUid})=>{assert.equal(videoUid,'uid'); return 'aaa.bbb.ccc';},
    customerCode:'customer-test',
    fetchImpl:async(url)=>{
      fetchedUrl=String(url);
      return new Response(img,{status:200,headers:{'content-type':'image/jpeg','content-length':String(img.length)}});
    }
  });
  assert.equal(response.statusCode,200);
  assert.equal(response.getHeader('cache-control'),'private, no-store, max-age=0');
  const payload=JSON.parse(response.body);
  assert.equal(payload.slug,'known');
  assert.equal(payload.time,10.5);
  assert.equal(payload.contentType,'image/jpeg');
  assert.equal(payload.dataBase64,img.toString('base64'));
  assert.match(fetchedUrl,/customer-customer-test/);
  assert.match(fetchedUrl,/aaa\.bbb\.ccc/);
  assert.match(fetchedUrl,/time=10\.5s/);
  assert.equal(response.body.includes('aaa.bbb.ccc'),false);
}
console.log('preview-only visual QA frame helper: PASS');
