// N1b review-only classifier for newly added or edited News/Catalyst Markdown.
// No publication hook, provider licence, semantic completeness or trusted F2 status.
// Compare protected-base content to an untrusted candidate as READ-ONLY DATA.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';

export const COLLECTIONS=Object.freeze(['news','catalyst-briefs']);
const MAX_BYTES=1024*1024;
const ORIGINAL_SCORE=/(?:\busd[\s-]*impact(?:['’]s)?\s+(?:weekly\s+)?score\b|\boriginal\s+(?:weekly\s+)?score\b|\bour\s+(?:weekly\s+)?score\b|\bproprietary\s+(?:weekly\s+)?score\b|\bweekly\s+score\b)/giu;
const THREE_DIALS=/\b(?:three\s+dials?|3\s+dials?|tres\s+diales)\b/giu;
const NUMERIC_SIGNAL=String.raw`(?:[0-9]{1,3}(?:\.[0-9]{1,2})?(?:\s*\/\s*(?:5|10|100))?|bullish|bearish|neutral|risk[\s-]?on|risk[\s-]?off|alcista|bajista)`;
const SCORE_VALUATION=new RegExp('^\\s*(?:(?::|=|→|—|–|->|\\bis\\b|\\bwas\\b|\\breads?\\b|\\breading\\b|\\bvalue\\b|\\blevel\\b|\\bstands?\\s+at\\b|\\breached\\b|\\bregistered\\b|\\bof\\b|\\bat\\b|\\bnow\\b|\\bto\\b|\\bturned\\b)\\s*){1,6}('+NUMERIC_SIGNAL+')(?![\\d])','iu');
const DIALS_VALUATION=new RegExp('^\\s*(?:(?::|=|→|—|–|->|\\breading\\b|\\breads?\\b|\\bregime\\b|\\bscore\\b|\\bsignal\\b|\\bnow\\b|\\bis\\b|\\bwas\\b|\\bshows?\\b)\\s*){1,6}('+NUMERIC_SIGNAL+')(?![\\d])','iu');
const DIRECT_DERIVATIVE=/(?:\/|^)(?:data\/(?:usd_impact_score_v2|weekly_input_latest)(?:\.(?:json|csv))?|data\/research\/score_v2_(?:point_in_time_latest|robustness_latest|vintage_comparison_latest)(?:\.(?:json|csv|html))?)(?=$|[\s)"'\]}?#])/iu;
const SHA256=bytes=>createHash('sha256').update(bytes).digest('hex');

export function reviewText(text){
  if(typeof text!=='string')throw Error('N1b review expects decoded UTF-8 text');
  const holds=[],reviews=[];
  const normalized=text.normalize('NFKC')
    .replace(/[\u200b-\u200d\u2060\ufeff]/gu,'')
    .replace(/\u00a0/gu,' ')
    .replace(/\r\n?/gu,'\n');
  for(const [index,original] of normalized.split('\n').entries()){
    const line=original.slice(0,4096);
    if(!line.trim())continue;
    if(DIRECT_DERIVATIVE.test(line)){
      holds.push({line:index+1,rule:'held_score_derived_file_link'});
      continue;
    }
    if(/^\s*impactScore\s*:/iu.test(line))continue; // Catalyst impact importance 1..5, not original Score
    let blocked=false;
    for(const match of line.matchAll(ORIGINAL_SCORE)){
      const after=line.slice(match.index+match[0].length,match.index+match[0].length+125);
      if(SCORE_VALUATION.test(after)){
        holds.push({line:index+1,rule:'original_weekly_score_value_or_regime'});
        blocked=true;
        break;
      }
    }
    if(blocked)continue;
    for(const match of line.matchAll(THREE_DIALS)){
      const after=line.slice(match.index+match[0].length,match.index+match[0].length+125);
      if(DIALS_VALUATION.test(after)){
        holds.push({line:index+1,rule:'unverified_three_dials_numeric_or_regime'});
        blocked=true;
        break;
      }
    }
    if(blocked)continue;
    if(/\b(?:weekly\s+score|original\s+score|three\s+dials?|tres\s+diales)\b/iu.test(line)
      && /\d(?:[\d.,/]*\d)?/u.test(line)){
      reviews.push({line:index+1,rule:'manual_score_context_review'});
    }
  }
  return {holds,reviews};
}

function readRegularUTF8(file){
  const mode=fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK;
  const fd=fs.openSync(file,mode);
  try{
    const stat=fs.fstatSync(fd);
    if(!stat.isFile()||stat.size>MAX_BYTES||stat.size===0)throw Error('File is not a nonempty regular Markdown under size limit');
    const contents=fs.readFileSync(fd);
    return {hash:SHA256(contents),text:new TextDecoder('utf-8',{fatal:true}).decode(contents)};
  }finally{fs.closeSync(fd);}
}
function validRoot(root){
  if(typeof root!=='string'||!path.isAbsolute(root))throw Error('Absolute web-root path required');
  const resolved=path.resolve(root),stat=fs.lstatSync(resolved);
  if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Web root must be a real directory');
  return resolved;
}
export function loadCorpus(webRoot){
  const root=validRoot(webRoot),files=new Map();
  for(const folder of COLLECTIONS){
    const directory=path.join(root,'src/content',folder),stat=fs.lstatSync(directory);
    if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Invalid dynamic content directory: '+folder);
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      if(entry.name==='.gitkeep')continue;
      if(!entry.name.endsWith('.md')||!entry.isFile()||entry.isSymbolicLink()){
        throw Error('Unsupported dynamic content entry: '+folder+'/'+entry.name);
      }
      const name=folder+'/'+entry.name;
      files.set(name,readRegularUTF8(path.join(directory,entry.name)));
    }
  }
  return files;
}
export function compareCorpora(baseRoot,candidateRoot,options={}){
  const original=loadCorpus(baseRoot),candidate=loadCorpus(candidateRoot);
  const changed=[],deleted=[],holds=[],reviews=[];
  for(const [name,entry] of candidate){
    if(original.get(name)?.hash===entry.hash)continue;
    changed.push(name);
    const findings=reviewText(entry.text);
    for(const issue of findings.holds)holds.push({file:name,...issue});
    for(const issue of findings.reviews)reviews.push({file:name,...issue});
  }
  for(const name of original.keys())if(!candidate.has(name))deleted.push(name);
  return {schema:1,mode:'DRAFT_ONLY_REVIEW_NOT_PUBLICATION_GATE',
    base_count:original.size,candidate_count:candidate.size,
    changed:changed.sort(),deleted:deleted.sort(),holds,reviews,
    pass:holds.length===0&&(!options.expectChanges||changed.length>0)};
}
function args(argv){
  const indexed=new Map();
  for(let i=0;i<argv.length;i++){
    const word=argv[i];
    if(word==='--expect-changes'){indexed.set(word,true);continue;}
    if(word==='--base'||word==='--candidate'){
      if(indexed.has(word)||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('N1b duplicated or missing '+word);
      indexed.set(word,argv[++i]);continue;
    }
    throw Error('Unknown N1b argument: '+word);
  }
  if(!indexed.get('--base')||!indexed.get('--candidate'))throw Error('Both --base and --candidate web roots required');
  return indexed;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const opts=args(process.argv.slice(2));
    const result=compareCorpora(path.resolve(opts.get('--base')),path.resolve(opts.get('--candidate')),
      {expectChanges:opts.get('--expect-changes')===true});
    console.log('N1B_REVIEW_JSON='+JSON.stringify(result));
    console.log('N1b candidate review '+(result.pass?'DRAFT PASS':'DRAFT HOLD')+
      ' changed='+result.changed.length+' holds='+result.holds.length+' manual='+result.reviews.length+
      ' (not a rights licence, independent F2 or release check)');
    if(!result.pass)process.exitCode=1;
  }catch(error){
    console.error('N1b scan failed closed: '+String(error?.message||error));
    process.exitCode=1;
  }
}
