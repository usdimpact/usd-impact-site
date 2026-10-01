const UID='dadcee426a7d47159e9714602f741b62';
function send(res,status,payload){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex,nofollow');res.end(JSON.stringify(payload));}
export default async function handler(req,res){
  if(req.method!=='GET') return send(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  if(process.env.VERCEL_ENV!=='preview') return send(res,404,{ok:false,code:'PREVIEW_ONLY'});
  const accountId=String(process.env.CLOUDFLARE_ACCOUNT_ID||'').trim();
  const apiToken=String(process.env.CLOUDFLARE_STREAM_API_TOKEN||'').trim();
  const customerCode=String(process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE||'').trim();
  if(!/^[a-f0-9]{32}$/i.test(accountId)||apiToken.length<20||!customerCode) return send(res,503,{ok:false,code:'CONFIG_UNAVAILABLE'});
  const headers={Accept:'application/json',Authorization:'Bearer '+apiToken};
  const metaRes=await fetch('https://api.cloudflare.com/client/v4/accounts/'+accountId+'/stream/'+UID,{headers,cache:'no-store'});
  const meta=await metaRes.json().catch(()=>null);
  const tokenRes=await fetch('https://api.cloudflare.com/client/v4/accounts/'+accountId+'/stream/'+UID+'/token',{method:'POST',headers,cache:'no-store'});
  const tokenPayload=await tokenRes.json().catch(()=>null);
  const token=tokenPayload?.result?.token;
  let iframe={status:null,contentType:'',bodyPrefix:''}, manifest={status:null,contentType:'',isHls:false};
  if(typeof token==='string'){
    const iframeRes=await fetch('https://customer-'+customerCode+'.cloudflarestream.com/'+encodeURIComponent(token)+'/iframe',{cache:'no-store',redirect:'manual'});
    const iframeText=await iframeRes.text().catch(()=>'');
    iframe={status:iframeRes.status,contentType:String(iframeRes.headers.get('content-type')||''),bodyPrefix:iframeText.slice(0,80).replace(/\s+/g,' ')};
    const manRes=await fetch('https://customer-'+customerCode+'.cloudflarestream.com/'+encodeURIComponent(token)+'/manifest/video.m3u8',{cache:'no-store'});
    const manText=await manRes.text().catch(()=>'');
    manifest={status:manRes.status,contentType:String(manRes.headers.get('content-type')||''),isHls:manText.trimStart().startsWith('#EXTM3U')};
  }
  const v=meta?.result||{};
  return send(res,200,{
    ok:true,
    metadataStatus:metaRes.status,
    uidMatched:v.uid===UID,
    readyToStream:v.readyToStream===true,
    statusState:v.status?.state||null,
    requireSignedURLs:v.requireSignedURLs===true,
    allowedOrigins:Array.isArray(v.allowedOrigins)?v.allowedOrigins:null,
    duration:Number.isFinite(v.duration)?v.duration:null,
    inputType:v.input?.type||null,
    watermarkUid:v.watermark?.uid||null,
    tokenEndpointStatus:tokenRes.status,
    iframe,
    manifest
  });
}