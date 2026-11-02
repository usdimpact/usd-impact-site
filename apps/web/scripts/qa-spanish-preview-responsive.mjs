import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {spawn, execFileSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {parseChromeDebugPort, chromeDebugHttpUrl, chromeDebugWebSocketUrl} from './qa-chrome-debug-endpoint.mjs';

const root = path.resolve('dist');
const output = path.resolve('spanish-preview-qa');
const routes = ['/es/news/','/es/score/','/es/reports/','/es/video-library/'];
const widths = [320,390,768,1440];
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.svg':'image/svg+xml'};
function chromeBinary() { for(const n of ['google-chrome-stable','google-chrome','chromium','chromium-browser']) {try{return execFileSync('which',[n],{encoding:'utf8'}).trim();}catch{}}throw Error('Chrome not installed; exact browser QA unavailable'); }
async function poll(fn) {for(let i=0;i<160;i++){try{let v=await fn();if(v)return v;}catch{}await sleep(75);}throw Error('Browser timeout');}
async function cdp(url) {const ws=new WebSocket(url);await new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});});let id=0;const awaiting=new Map();ws.addEventListener('message',e=>{const x=JSON.parse(String(e.data));if(!x.id||!awaiting.has(x.id))return;const p=awaiting.get(x.id);awaiting.delete(x.id);if(x.error)p.reject(Error(JSON.stringify(x.error)));else p.resolve(x.result);});return {async call(method,params={}){return new Promise((resolve,reject)=>{const n=++id;awaiting.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));setTimeout(()=>{if(awaiting.has(n)){awaiting.delete(n);reject(Error('CDP timeout '+method));}},15000).unref();});},close(){ws.close();}};}
async function main(){
 for(const r of routes)if(!fs.existsSync(path.join(root,r,'index.html')))throw Error('Missing built Preview route '+r);
 fs.mkdirSync(output,{recursive:true});
 const server=http.createServer((req,res)=>{let p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');if(!fs.existsSync(p)){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const port=server.address().port;
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'usd-preview-qa-'));
 const chrome=spawn(chromeBinary(),['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+temp,'about:blank'],{stdio:'ignore'});
 let browser,page;
 try{
  const active=await poll(()=>fs.existsSync(path.join(temp,'DevToolsActivePort'))&&fs.readFileSync(path.join(temp,'DevToolsActivePort'),'utf8'));
  const debugPort=parseChromeDebugPort(active);const ver=await poll(async()=>{let r=await fetch(chromeDebugHttpUrl(debugPort,'/json/version'));return r.ok?r.json():null;});
  browser=await cdp(chromeDebugWebSocketUrl(ver.webSocketDebuggerUrl,debugPort,'browser'))
  const t=await browser.call('Target.createTarget',{url:'about:blank'});
  const wsUrl=await poll(async()=>{let r=await fetch(chromeDebugHttpUrl(debugPort,'/json/list'));let a=await r.json();return a.find(x=>x.id===t.targetId)?.webSocketDebuggerUrl;});
  page=await cdp(chromeDebugWebSocketUrl(wsUrl,debugPort,'page'))await page.call('Page.enable');await page.call('Runtime.enable');
  const results=[],failures=[];
  for(const route of routes)for(const width of widths){
   await page.call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
   const url='http://127.0.0.1:'+port+route;await page.call('Page.navigate',{url});
   await poll(async()=>{let v=await page.call('Runtime.evaluate',{expression:'document.readyState==="complete"&&location.href==='+JSON.stringify(url),returnByValue:true});return v.result?.value;});
   await sleep(125);
   const expr='(() => {const d=document.documentElement,b=document.body;return {width:innerWidth,htmlWidth:d.scrollWidth,bodyWidth:b.scrollWidth,h1:document.querySelectorAll("h1").length,lang:d.lang,robots:document.querySelector("meta[name=robots]")?.content,hasMain:!!document.querySelector("#main-content"),hasSkip:!!document.querySelector("a[href=\\"#main-content\\"]"),ai:(b.innerText||"").includes("Transparencia sobre IA:"),gatedLinks:document.querySelectorAll("a[href^=\\"/guided-edition/video-library/\\"]").length};})()';
   let data=await page.call('Runtime.evaluate',{expression:expr,returnByValue:true});let check=data.result?.value;
   if(!check)throw Error('Cannot evaluate page '+route);
   const entry={route,requested:width,...check};results.push(entry);
   if(check.width!==width||check.htmlWidth>width+1||check.bodyWidth>width+1||check.h1!==1||check.lang!=='es'||!check.robots?.includes('noindex')||!check.hasMain||!check.hasSkip||!check.ai||(route==='/es/video-library/'&&check.gatedLinks!==51))failures.push(entry);
   if((route==='/es/reports/'||route==='/es/video-library/')&&(width===320||width===1440)){
    let shot=await page.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(output,route.split('/')[2]+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
   }
  }
  const summary={testedAt:new Date().toISOString(),exactBranch:'agent/monthly-es-preview-integration-20261102',method:'Chrome on locally served Preview static build',results,failures,limitations:'Not a physical mobile device or assistive technology certification'};
  fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify({testCount:results.length,pages:routes,widths,failures}));
  if(failures.length)process.exitCode=1;
 }finally{
   page?.close();
   browser?.close();
   // Wait for Chromium to stop writing its temporary profile before removing it.
   // This must not mask a failed viewport assertion or falsely mark it as PASS.
   if (chrome.exitCode === null && chrome.signalCode === null) {
     const exited = new Promise(resolve => chrome.once('exit', resolve));
     chrome.kill('SIGTERM');
     await Promise.race([exited, sleep(2000)]);
     if (chrome.exitCode === null && chrome.signalCode === null) {
       chrome.kill('SIGKILL');
       await Promise.race([exited, sleep(1000)]);
     }
   }
   await new Promise(resolve => server.close(resolve));
   fs.rmSync(temp,{recursive:true,force:true,maxRetries:12,retryDelay:150});
 }
}
await main();
