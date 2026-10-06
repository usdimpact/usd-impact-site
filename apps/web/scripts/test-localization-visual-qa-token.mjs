import assert from 'node:assert/strict';
import { handleLocalizationVisualQaToken } from '../src/lib/localization-visual-qa-token.js';

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

{
  let called=false; const response=res();
  await handleLocalizationVisualQaToken(req('/api/guided-edition?action=localization-visual-qa-token&slug=known'),response,{
    environment:{...PREVIEW,VERCEL_ENV:'production'},
    resolveUid:()=> 'uid',
    createToken:async()=>{called=true; return 'a.b.c';},
    customerCode:'code'
  });
  assert.equal(response.statusCode,404); assert.equal(called,false);
}
{
  let called=false; const response=res();
  await handleLocalizationVisualQaToken(req('/api/guided-edition?action=localization-visual-qa-token&slug=known'),response,{
    environment:{...PREVIEW,VERCEL_GIT_COMMIT_REF:'main'},
    resolveUid:()=> 'uid',
    createToken:async()=>{called=true; return 'a.b.c';},
    customerCode:'code'
  });
  assert.equal(response.statusCode,404); assert.equal(called,false);
}
{
  const response=res();
  await handleLocalizationVisualQaToken(req('/api/guided-edition?action=localization-visual-qa-token&slug=known','POST'),response,{
    environment:PREVIEW, resolveUid:()=> 'uid', createToken:async()=> 'a.b.c', customerCode:'code'
  });
  assert.equal(response.statusCode,405);
}
{
  let called=false; const response=res();
  await handleLocalizationVisualQaToken(req('/api/guided-edition?action=localization-visual-qa-token&slug=unknown'),response,{
    environment:PREVIEW, resolveUid:()=> null,
    createToken:async()=>{called=true;return 'a.b.c';}, customerCode:'code'
  });
  assert.equal(response.statusCode,404); assert.equal(called,false);
}
{
  const response=res();
  await handleLocalizationVisualQaToken(req('/api/guided-edition?action=localization-visual-qa-token&slug=known'),response,{
    environment:PREVIEW, resolveUid:()=> 'uid',
    createToken:async({videoUid})=>{assert.equal(videoUid,'uid'); return 'aaa.bbb.ccc';},
    customerCode:'customer-test'
  });
  assert.equal(response.statusCode,200);
  assert.equal(response.getHeader('cache-control'),'private, no-store, max-age=0');
  assert.equal(response.getHeader('x-robots-tag'),'noindex, nofollow');
  assert.deepEqual(JSON.parse(response.body),{
    slug:'known',customerCode:'customer-test',token:'aaa.bbb.ccc'
  });
}
console.log('preview-only visual QA token helper: PASS');
