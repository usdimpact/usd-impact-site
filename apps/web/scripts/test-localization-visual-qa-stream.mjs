import assert from 'node:assert/strict';
import { handleLocalizationVisualQaStream } from '../src/lib/localization-visual-qa-stream.js';

const PREVIEW = {
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_REF: 'feature/spanish-localization-foundation',
};

function req(url, method='GET'){ return { url, method, headers:{} }; }
function res(){
  const headers=new Map();
  return {
    statusCode:200, body:'',
    setHeader(k,v){ headers.set(String(k).toLowerCase(),String(v)); },
    getHeader(k){ return headers.get(String(k).toLowerCase()); },
    end(v=''){ this.body+=String(v??''); return this; }
  };
}

const resolveUid = slug => slug === 'known' ? '0123456789abcdef0123456789abcdef' : null;
const createToken = async ({videoUid}) => {
  assert.equal(videoUid,'0123456789abcdef0123456789abcdef');
  return 'aaa.bbb.ccc';
};

{
  let called=false;
  const response=res();
  await handleLocalizationVisualQaStream(req('/api/guided-edition?action=localization-visual-qa-stream&slug=known'),response,{
    environment:{...PREVIEW,VERCEL_ENV:'production'}, resolveUid,
    createToken:async()=>{ called=true; return 'aaa.bbb.ccc'; },
    customerCode:'customer'
  });
  assert.equal(response.statusCode,404);
  assert.equal(called,false);
}
{
  let called=false;
  const response=res();
  await handleLocalizationVisualQaStream(req('/api/guided-edition?action=localization-visual-qa-stream&slug=known','POST'),response,{
    environment:PREVIEW, resolveUid,
    createToken:async()=>{ called=true; return 'aaa.bbb.ccc'; },
    customerCode:'customer'
  });
  assert.equal(response.statusCode,404);
  assert.equal(called,false);
}
{
  const response=res();
  await handleLocalizationVisualQaStream(req('/api/guided-edition?action=localization-visual-qa-stream&slug=unknown'),response,{
    environment:PREVIEW, resolveUid, createToken, customerCode:'customer'
  });
  assert.equal(response.statusCode,404);
}
{
  const response=res();
  await handleLocalizationVisualQaStream(req('/api/guided-edition?action=localization-visual-qa-stream&slug=known'),response,{
    environment:PREVIEW, resolveUid, createToken, customerCode:'customer'
  });
  assert.equal(response.statusCode,200);
  assert.equal(response.getHeader('cache-control'),'private, no-store, max-age=0');
  assert.equal(response.getHeader('x-robots-tag'),'noindex, nofollow');
  const body=JSON.parse(response.body);
  assert.equal(body.slug,'known');
  assert.match(body.playerUrl,/^https:\/\/customer-customer\.cloudflarestream\.com\/aaa\.bbb\.ccc\/iframe\?/);
  assert.equal(response.body.includes('CLOUDFLARE'),false);
}

{
  const response=res();
  await handleLocalizationVisualQaStream(
    req('/api/guided-edition?action=localization-visual-qa-stream&slug=known&mode=thumbnail&time=12.5'),
    response,
    {
      environment:PREVIEW,
      resolveUid,
      createToken,
      customerCode:'customer',
      fetchImpl:async (url) => {
        assert.match(String(url), /\/thumbnails\/thumbnail\.jpg\?time=12\.5s/);
        return new Response(Buffer.from([0xff,0xd8,0xff,0xd9]), {
          status:200,
          headers:{'content-type':'image/jpeg'}
        });
      }
    }
  );
  assert.equal(response.statusCode,200);
  const body=JSON.parse(response.body);
  assert.equal(body.time,12.5);
  assert.match(body.dataUrl,/^data:image\/jpeg;base64,/);
}

console.log('preview-only localization visual QA player: PASS');
