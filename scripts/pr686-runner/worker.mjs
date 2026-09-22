import {createHmac,randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline';
import {pathToFileURL} from 'node:url';
const lines=createInterface({input:process.stdin})[Symbol.asyncIterator]();
const read=async()=>JSON.parse((await lines.next()).value);
const settings=await read();
const source=settings.baseline?'baseline-resend-webhook-handler.js':'resend-webhook-handler.js';
const {handleResendWebhook}=await import(pathToFileURL('/packet/canonical/'+source));
const key=randomBytes(32);
const origin='http://localhost:3000';
const synthetic='sb_secret_pr686_synthetic_local_only_not_a_provider_key';
const environment={SUPABASE_URL:origin,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_pr686_synthetic_local_only',SUPABASE_SECRET_KEY:synthetic,RESEND_WEBHOOK_ENABLED:'true',RESEND_WEBHOOK_SECRET:'whsec_'+key.toString('base64')};
const emit=async(value)=>{process.stdout.write(JSON.stringify(value)+'\n');const ack=await read();if(ack.action!=='go')throw Error('BAD_BARRIER_ACK');};
let requests=0;
const fetchImpl=async(value,options={})=>{
  const url=new URL(value);
  if(url.origin!==origin||!['/rest/v1/notification_outbox','/rest/v1/webhook_receipts'].includes(url.pathname))throw Error('NONLOCAL_TARGET');
  if(options.headers.apikey!==synthetic||options.headers.Authorization!=='Bearer '+synthetic)throw Error('NONFIXTURE_KEY');
  if(++requests>30)throw Error('REQUEST_CAP');
  const record={method:options.method||'GET',path:url.pathname,query:url.search,body:options.body?JSON.parse(options.body):null,prefer:options.headers.Prefer||null};
  await emit({phase:'before',...record});
  const headers={...options.headers,Authorization:'Bearer '+settings.jwt};delete headers.apikey;
  // Explicit local auth/path adapter only. Actual HTTP status and database body are retained.
  const response=await fetch('http://127.0.0.1:3000'+url.pathname.slice('/rest/v1'.length)+url.search,{...options,headers,redirect:'error',signal:AbortSignal.timeout(5000)});
  const text=await response.clone().text();
  await emit({phase:'after',...record,status:response.status,result:text?JSON.parse(text):null});
  return response;
};
const nowMs=settings.nowMs;
const id=settings.eventId;
const rawBody=JSON.stringify({type:settings.type,created_at:new Date(nowMs-1000).toISOString(),data:{email_id:settings.emailId,from:'Fixture <fixture@example.invalid>',to:['reader@example.invalid'],subject:'Synthetic storage pilot'}});
const timestamp=String(Math.floor(nowMs/1000));
const signature=createHmac('sha256',key).update(`${id}.${timestamp}.${rawBody}`).digest('base64');
const request={method:'POST',rawBody,headers:{'content-type':'application/json','svix-id':id,'svix-timestamp':timestamp,'svix-signature':'v1,'+signature}};
const response={statusCode:200,headers:{},setHeader(name,value){this.headers[name.toLowerCase()]=String(value);},end(body){this.body=JSON.parse(body);}};
try{await handleResendWebhook(request,response,{environment,fetchImpl,nowMs});process.stdout.write(JSON.stringify({phase:'done',status:response.statusCode,body:response.body,requests})+'\n');process.exit(0);}catch(error){process.stdout.write(JSON.stringify({phase:'error',error:String(error)})+'\n');process.exit(1);}
