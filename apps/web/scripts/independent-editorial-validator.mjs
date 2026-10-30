// OFFLINE DRAFT VALIDATION ONLY. No imports, files, network, clocks, Score engines or publish actions.
// Synthetic structural checks NEVER establish source rights or a production release.
const WEEKLY_VERSION="independent-weekly-editorial-v0-draft";
const MONTHLY_VERSION="independent-monthly-editorial-v0-draft";
const SERIES="independent-editorial";
function record(v){return v!==null&&typeof v==="object"&&!Array.isArray(v)}

function textField(v){return typeof v==="string"&&v.trim().length>0}

function dayMs(v){if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return NaN;const t=Date.parse(v+"T12:00:00Z");return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v?t:NaN}

function instantMs(v){if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)||!Number.isFinite(dayMs(v.slice(0,10))))return NaN;const n=Date.parse(v);return Number.isFinite(n)?n:NaN}

function dayPlus(v,n){const m=dayMs(v);return Number.isFinite(m)?new Date(m+n*86400000).toISOString().slice(0,10):null}

function exactKeys(obj,keys,errors,path){if(!record(obj)){errors.push(path+":not_object");return false}const expected=new Set(keys);for(const k of Object.keys(obj))if(!expected.has(k))errors.push(path+":unexpected_"+k);for(const k of expected)if(!Object.hasOwn(obj,k))errors.push(path+":missing_"+k);return true}

function legacyScan(x,errors,path="root"){
 const banned=new Set(["score","scorepath","regime","zscore","zscores","contribution","contributions","normalizationmoments","weeklyinput","providerderivedvalues"]);
 if(Array.isArray(x)){x.forEach((v,i)=>legacyScan(v,errors,path+"["+i+"]"));return}
 if(record(x)){for(const [k,v] of Object.entries(x)){if(banned.has(k.replace(/[_-]/g,"").toLowerCase()))errors.push(path+":legacy_key_"+k);legacyScan(v,errors,path+"."+k)}return}
 if(typeof x==="string"&&/(?:score\.usd-impact\.com|usd_impact_score_v2|weekly_input(?:_latest)?|\/reports\/(?:weekly|monthly)\/)/i.test(x))errors.push(path+":legacy_source_pointer");
}

function approvalErrors(x,status,errors,path){
 if(!exactKeys(x,["sourceRightsDecisionReceipt","editorialApprovalReceipt","productionApprovalReceipt"],errors,path))return;
 for(const k of ["sourceRightsDecisionReceipt","editorialApprovalReceipt","productionApprovalReceipt"]){
  if(status==="published"&&!textField(x[k]))errors.push(path+":missing_"+k);
  if(x[k]!==null&&x[k]!==undefined&&!textField(x[k]))errors.push(path+":invalid_"+k);
 }
}

function validateIndependentWeekly(x,opts={}){
 const errors=[];const asOf=instantMs(opts.asOfUtc);
 if(!Number.isFinite(asOf))errors.push("missing_or_invalid_explicit_as_of_utc");
 if(!exactKeys(x,["contractVersion","series","status","id","periodStart","periodEnd","slug","editorialAsOfUtc","sourceDailyEditions","claimLineage","themes","approvals","complianceNote"],errors,"weekly"))return {structurallyValid:false,errors,releaseAuthorized:false};
 legacyScan(x,errors);
 if(x.contractVersion!==WEEKLY_VERSION)errors.push("weekly:wrong_contract");
 if(x.series!==SERIES)errors.push("weekly:wrong_series");
 if(!["draft","published"].includes(x.status))errors.push("weekly:wrong_status");
 const start=dayMs(x.periodStart),end=dayMs(x.periodEnd),cutoff=instantMs(x.editorialAsOfUtc);
 if(!Number.isFinite(start)||new Date(start).getUTCDay()!==1)errors.push("weekly:period_start_not_monday");
 if(!Number.isFinite(end)||new Date(end).getUTCDay()!==5)errors.push("weekly:period_end_not_friday");
 if(Number.isFinite(start)&&Number.isFinite(end)&&end-start!==4*86400000)errors.push("weekly:must_span_one_monday_friday");
 if(!textField(x.id)||x.id!=="independent-weekly-"+x.periodEnd)errors.push("weekly:wrong_id");
 if(x.slug!=="/independent/weekly/"+x.periodEnd)errors.push("weekly:wrong_independent_slug");
 if(!Number.isFinite(cutoff)||cutoff<end||Number.isFinite(asOf)&&cutoff>asOf)errors.push("weekly:as_of_invalid_or_future");
 if(!Array.isArray(x.sourceDailyEditions)||x.sourceDailyEditions.length<1||x.sourceDailyEditions.length>5)errors.push("weekly:source_dailies_count");
 const days=new Map();
 for(const [i,d] of (Array.isArray(x.sourceDailyEditions)?x.sourceDailyEditions:[]).entries()){
  if(!exactKeys(d,["date","url","status","generatedAtUtc","reviewedAtUtc"],errors,"daily["+i+"]"))continue;
  if(!Number.isFinite(dayMs(d.date))||d.date<x.periodStart||d.date>x.periodEnd)errors.push("daily["+i+"]:outside_week");
  if(d.url!=="/news/"+d.date||d.status!=="published")errors.push("daily["+i+"]:not_a_published_daily");
  if(days.has(d.date))errors.push("daily:duplicate_date");else days.set(d.date,d);
  const gen=instantMs(d.generatedAtUtc),rev=instantMs(d.reviewedAtUtc);
  if(!Number.isFinite(gen)||!Number.isFinite(rev)||rev<gen||Number.isFinite(cutoff)&&rev>cutoff)errors.push("daily["+i+"]:invalid_timeline");
 }
 if(!Array.isArray(x.claimLineage)||x.claimLineage.length===0)errors.push("weekly:missing_claim_lineage");
 const claims=new Set();
 for(const [i,c] of (Array.isArray(x.claimLineage)?x.claimLineage:[]).entries()){
  if(!exactKeys(c,["id","dailyDate","sourceId","issuerName","sourceUrl","sourcePublishedAtUtc","reviewedAtUtc","postReleaseReviewReceipt"],errors,"claim["+i+"]"))continue;
  if(!textField(c.id)||claims.has(c.id))errors.push("claim["+i+"]:missing_or_duplicate_id");else claims.add(c.id);
  if(!days.has(c.dailyDate))errors.push("claim["+i+"]:daily_lineage_missing");
  if(!textField(c.sourceId)||!textField(c.issuerName))errors.push("claim["+i+"]:issuer_identity_missing");
  if(typeof c.sourceUrl!=="string"||!/^https:\/\/[^/\s]+\//.test(c.sourceUrl))errors.push("claim["+i+"]:invalid_source_url");
  const pub=instantMs(c.sourcePublishedAtUtc),rev=instantMs(c.reviewedAtUtc);
  if(!Number.isFinite(pub)||!Number.isFinite(rev)||rev<pub||Number.isFinite(cutoff)&&rev>cutoff)errors.push("claim["+i+"]:unverified_or_future_issuer_release");
  const daily=days.get(c.dailyDate);
  if(daily&&Number.isFinite(pub)&&instantMs(daily.generatedAtUtc)<pub){
   if(!textField(c.postReleaseReviewReceipt)||rev<pub||instantMs(daily.reviewedAtUtc)<pub)errors.push("claim["+i+"]:missing_post_release_receipt");
  } else if(c.postReleaseReviewReceipt!==null&&c.postReleaseReviewReceipt!==undefined&&!textField(c.postReleaseReviewReceipt))errors.push("claim["+i+"]:bad_post_release_receipt");
 }
 if(!Array.isArray(x.themes)||x.themes.length<1||x.themes.length>6)errors.push("weekly:themes_count");
 for(const [i,t] of (Array.isArray(x.themes)?x.themes:[]).entries()){
  if(!exactKeys(t,["title","claimIds"],errors,"theme["+i+"]"))continue;
  if(!textField(t.title)||!Array.isArray(t.claimIds)||t.claimIds.length===0||t.claimIds.some(id=>!claims.has(id)))errors.push("theme["+i+"]:unresolved_claim_reference");
 }
 approvalErrors(x.approvals,x.status,errors,"weekly_approvals");
 if(!textField(x.complianceNote)||!/educational/i.test(x.complianceNote)||!/not (?:investment|financial|trading)/i.test(x.complianceNote))errors.push("weekly:compliance_note_missing");
 return {structurallyValid:errors.length===0,errors:[...new Set(errors)],releaseAuthorized:false};
}

function validateIndependentMonthly(monthly,sourceWeeklies,opts={}){
 const errors=[],asOf=instantMs(opts.asOfUtc);
 if(!Number.isFinite(asOf))errors.push("missing_or_invalid_explicit_as_of_utc");
 if(!exactKeys(monthly,["contractVersion","series","status","id","periodStart","periodEnd","slug","editorialAsOfUtc","sourceWeeklyReports","themes","approvals","complianceNote"],errors,"monthly"))return {structurallyValid:false,errors,releaseAuthorized:false};
 legacyScan(monthly,errors);
 if(monthly.contractVersion!==MONTHLY_VERSION||monthly.series!==SERIES)errors.push("monthly:wrong_contract_or_series");
 if(!["draft","published"].includes(monthly.status))errors.push("monthly:wrong_status");
 if(!Number.isFinite(dayMs(monthly.periodEnd))||new Date(dayMs(monthly.periodEnd)).getUTCDay()!==5)errors.push("monthly:period_end_not_friday");
 if(monthly.id!=="independent-monthly-"+monthly.periodEnd||monthly.slug!=="/independent/four-weeks/"+monthly.periodEnd)errors.push("monthly:wrong_id_or_slug");
 const cutoff=instantMs(monthly.editorialAsOfUtc);
 if(!Number.isFinite(cutoff)||cutoff<dayMs(monthly.periodEnd)||Number.isFinite(asOf)&&cutoff>asOf)errors.push("monthly:as_of_invalid_or_future");
 if(!Array.isArray(monthly.sourceWeeklyReports)||monthly.sourceWeeklyReports.length!==4)errors.push("monthly:exactly_four_weeklies_required");
 const refs=Array.isArray(monthly.sourceWeeklyReports)?monthly.sourceWeeklyReports:[];
 const sourceIds=new Set(),sourceDates=new Set();
 const sourceById=new Map((Array.isArray(sourceWeeklies)?sourceWeeklies:[]).filter(record).map(w=>[w.id,w]));
 if(!Array.isArray(sourceWeeklies))errors.push("monthly:missing_weekly_collection");
 for(let i=0;i<refs.length;i++){
  const s=refs[i];
  if(!exactKeys(s,["id","periodEnd","slug"],errors,"monthly_source["+i+"]"))continue;
  if(sourceIds.has(s.id)||sourceDates.has(s.periodEnd))errors.push("monthly:duplicate_source_weekly");
  sourceIds.add(s.id);sourceDates.add(s.periodEnd);
  if(s.id!=="independent-weekly-"+s.periodEnd||s.slug!=="/independent/weekly/"+s.periodEnd)errors.push("monthly:source_not_independent");
  if(!Number.isFinite(dayMs(s.periodEnd))||new Date(dayMs(s.periodEnd)).getUTCDay()!==5)errors.push("monthly:non_friday_source");
  if(i>0&&dayMs(s.periodEnd)-dayMs(refs[i-1]?.periodEnd)!==7*86400000)errors.push("monthly:not_four_consecutive_fridays");
  const w=sourceById.get(s.id);
  if(!w||w.periodEnd!==s.periodEnd||w.slug!==s.slug||w.status!=="published")errors.push("monthly:missing_unpublished_or_mismatched_source_"+i);
  else{
   const r=validateIndependentWeekly(w,{asOfUtc:opts.asOfUtc});
   if(!r.structurallyValid)errors.push("monthly:invalid_source_weekly_"+i);
  }
 }
 if(refs.length===4){
  const first=sourceById.get(refs[0]?.id);
  if(!first||monthly.periodStart!==first.periodStart||monthly.periodEnd!==refs[3]?.periodEnd)errors.push("monthly:period_does_not_match_sources");
 }
 if(!Array.isArray(monthly.themes)||monthly.themes.length<3||monthly.themes.length>6)errors.push("monthly:themes_count");
 for(const [i,t] of (Array.isArray(monthly.themes)?monthly.themes:[]).entries()){
  if(!exactKeys(t,["title","weeklyDates"],errors,"monthly_theme["+i+"]"))continue;
  if(!textField(t.title)||!Array.isArray(t.weeklyDates)||t.weeklyDates.length<1||t.weeklyDates.some(d=>!sourceDates.has(d)))errors.push("monthly_theme["+i+"]:unresolved_weekly_reference");
 }
 approvalErrors(monthly.approvals,monthly.status,errors,"monthly_approvals");
 if(!textField(monthly.complianceNote)||!/educational/i.test(monthly.complianceNote)||!/not (?:investment|financial|trading)/i.test(monthly.complianceNote))errors.push("monthly:compliance_note_missing");
 return {structurallyValid:errors.length===0,errors:[...new Set(errors)],releaseAuthorized:false};
}

function independentMonthlyEligibility(weeklyReports,monthlyReports,opts={}){
 const errors=[],asOf=instantMs(opts.asOfUtc);
 if(!Number.isFinite(asOf))return {progress:0,ready:false,inputs:[],nextExpectedFriday:null,errors:["missing_or_invalid_explicit_as_of_utc"],releaseAuthorized:false};
 const last=(Array.isArray(monthlyReports)?monthlyReports:[]).filter(m=>record(m)&&m.series===SERIES&&m.contractVersion===MONTHLY_VERSION&&m.status==="published"&&Number.isFinite(dayMs(m.periodEnd))).sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd)).at(-1);
 const lastEnd=last?.periodEnd??null;
 const eligible=(Array.isArray(weeklyReports)?weeklyReports:[]).filter(w=>record(w)&&w.series===SERIES&&w.contractVersion===WEEKLY_VERSION&&w.status==="published"&&Number.isFinite(dayMs(w.periodEnd))&&(!lastEnd||w.periodEnd>lastEnd)).sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd));
 let expected=lastEnd?dayPlus(lastEnd,7):eligible[0]?.periodEnd??null;const inputs=[];
 if(!expected)return {progress:0,ready:false,inputs,latestPublishedIndependentMonthlyEnd:lastEnd,nextExpectedFriday:null,errors,releaseAuthorized:false};
 for(let i=0;i<4;i++){
  const matches=eligible.filter(w=>w.periodEnd===expected);
  if(matches.length!==1){errors.push(matches.length===0?"missing_expected_friday_"+expected:"duplicate_expected_friday_"+expected);break}
  const check=validateIndependentWeekly(matches[0],{asOfUtc:opts.asOfUtc});
  if(!check.structurallyValid){errors.push("invalid_independent_weekly_"+expected);break}
  inputs.push(matches[0].id);expected=dayPlus(expected,7);
 }
 return {progress:inputs.length,ready:inputs.length===4,inputs,latestPublishedIndependentMonthlyEnd:lastEnd,nextExpectedFriday:inputs.length<4?expected:null,errors,releaseAuthorized:false};
}
export {WEEKLY_VERSION,MONTHLY_VERSION,SERIES,validateIndependentWeekly,validateIndependentMonthly,independentMonthlyEligibility};
