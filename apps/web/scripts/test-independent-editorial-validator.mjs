// Draft-only, invented 2099 fixtures. No network, real issuer numbers or production integration.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
 WEEKLY_VERSION, MONTHLY_VERSION, SERIES,
 validateIndependentWeekly, validateIndependentMonthly, independentMonthlyEligibility,
} from "./independent-editorial-validator.mjs";
const AS_OF="2099-02-02T12:00:00Z";
const dates=["2099-01-09","2099-01-16","2099-01-23","2099-01-30"];
function plus(date,days){return new Date(Date.parse(date+"T12:00:00Z")+days*86400000).toISOString().slice(0,10)}
function weekly(end){
 const monday=plus(end,-4),newsAt=monday+"T09:00:00Z",officialAt=monday+"T12:00:00Z",reviewAt=monday+"T14:00:00Z";
 return {
  contractVersion:WEEKLY_VERSION,series:SERIES,status:"published",
  id:"independent-weekly-"+end,periodStart:monday,periodEnd:end,
  slug:"/independent/weekly/"+end,editorialAsOfUtc:plus(end,1)+"T12:00:00Z",
  sourceDailyEditions:[{date:monday,url:"/news/"+monday,status:"published",generatedAtUtc:newsAt,reviewedAtUtc:reviewAt}],
  claimLineage:[{id:"claim-1",dailyDate:monday,sourceId:"INVENTED",issuerName:"INVENTED ISSUER",sourceUrl:"https://fixtures.example.test/agency/2099",
   sourcePublishedAtUtc:officialAt,reviewedAtUtc:reviewAt,postReleaseReviewReceipt:"SYNTHETIC-NOT-A-REAL-APPROVAL"}],
  themes:[{title:"Invented chronology",claimIds:["claim-1"]}],
  approvals:{sourceRightsDecisionReceipt:"SYNTHETIC-FAKE-RIGHTS",editorialApprovalReceipt:"SYNTHETIC-FAKE-EDITORIAL",productionApprovalReceipt:"SYNTHETIC-FAKE-PRODUCTION"},
  complianceNote:"Educational only; not investment advice."
 };
}
function monthly(weeks){
 const end=weeks.at(-1).periodEnd;
 return {
  contractVersion:MONTHLY_VERSION,series:SERIES,status:"published",
  id:"independent-monthly-"+end,periodStart:weeks[0].periodStart,periodEnd:end,
  slug:"/independent/four-weeks/"+end,editorialAsOfUtc:plus(end,2)+"T12:00:00Z",
  sourceWeeklyReports:weeks.map(w=>({id:w.id,periodEnd:w.periodEnd,slug:w.slug})),
  themes:[{title:"Invented period one",weeklyDates:[weeks[0].periodEnd]},{title:"Invented period two",weeklyDates:[weeks[1].periodEnd]},{title:"Invented period three",weeklyDates:[weeks[2].periodEnd,weeks[3].periodEnd]}],
  approvals:{sourceRightsDecisionReceipt:"SYNTHETIC-FAKE-RIGHTS",editorialApprovalReceipt:"SYNTHETIC-FAKE-EDITORIAL",productionApprovalReceipt:"SYNTHETIC-FAKE-PRODUCTION"},
  complianceNote:"Educational only; not investment advice."
 };
}
const weeks=dates.map(weekly);
function changed(base,transform){const x=structuredClone(base);transform(x);return x}
function failsWeekly(w,reason){const r=validateIndependentWeekly(w,{asOfUtc:AS_OF});assert.equal(r.structurallyValid,false);assert.equal(r.releaseAuthorized,false);if(reason)assert.ok(r.errors.some(e=>e.includes(reason)),JSON.stringify(r.errors))}
function failsMonthly(m,source=weeks,reason){const r=validateIndependentMonthly(m,source,{asOfUtc:AS_OF});assert.equal(r.structurallyValid,false);assert.equal(r.releaseAuthorized,false);if(reason)assert.ok(r.errors.some(e=>e.includes(reason)),JSON.stringify(r.errors))}

test("four invented Weeklies structurally validate but never authorize production",()=>{
 for(const w of weeks){const r=validateIndependentWeekly(w,{asOfUtc:AS_OF});assert.deepEqual(r.errors,[]);assert.equal(r.structurallyValid,true);assert.equal(r.releaseAuthorized,false)}
});
test("invented four-week Monthly validates but never authorizes production",()=>{
 const r=validateIndependentMonthly(monthly(weeks),weeks,{asOfUtc:AS_OF});assert.deepEqual(r.errors,[]);assert.equal(r.structurallyValid,true);assert.equal(r.releaseAuthorized,false);
});
test("four consecutive independent Weeklies satisfy structural eligibility only",()=>{
 const r=independentMonthlyEligibility(weeks,[],{asOfUtc:AS_OF});assert.equal(r.progress,4);assert.equal(r.ready,true);assert.equal(r.releaseAuthorized,false);
});
test("zero independent Weeklies have zero eligibility, not old Score weekly count",()=>{
 const r=independentMonthlyEligibility([],[],{asOfUtc:AS_OF});assert.equal(r.progress,0);assert.equal(r.ready,false);
});
test("missing second Friday blocks later Weeklies",()=>{
 const r=independentMonthlyEligibility([weeks[0],weeks[2],weeks[3]],[],{asOfUtc:AS_OF});
 assert.equal(r.progress,1);assert.equal(r.ready,false);assert.ok(r.errors.some(e=>e.includes("missing_expected_friday_2099-01-16")));
});
test("duplicate Friday blocks eligibility",()=>{const r=independentMonthlyEligibility([weeks[0],weeks[0],...weeks.slice(1)],[],{asOfUtc:AS_OF});assert.equal(r.progress,0);assert.equal(r.ready,false)});
test("published previous independent Monthly prevents source-week reuse",()=>{
 const prior=monthly(weeks);const r=independentMonthlyEligibility(weeks,[prior],{asOfUtc:AS_OF});
 assert.equal(r.progress,0);assert.equal(r.ready,false);
});
test("not scored: original Score collection excluded from eligibility",()=>{
 const fake=changed(weeks[0],w=>{w.series="legacy-score";w.slug="/reports/weekly/"+w.periodEnd});
 assert.equal(independentMonthlyEligibility([fake],[],{asOfUtc:AS_OF}).progress,0);
});
test("reject missing explicit as-of",()=>assert.equal(validateIndependentWeekly(weeks[0]).structurallyValid,false));
test("reject impossible date",()=>failsWeekly(changed(weeks[0],w=>w.periodEnd="2099-02-30"),"period_end_not_friday"));
test("reject non-Friday",()=>failsWeekly(changed(weeks[0],w=>w.periodEnd="2099-01-08"),"period_end_not_friday"));
test("reject wrong Monday-to-Friday span",()=>failsWeekly(changed(weeks[0],w=>w.periodStart="2099-01-01"),"period_start_not_monday"));
test("reject legacy Score object field",()=>failsWeekly(changed(weeks[0],w=>w.scorePath=[{value:0.1}]),"legacy_key_scorePath"));
test("reject nested regime and z-scores",()=>failsWeekly(changed(weeks[0],w=>w.themes[0].regime="legacy"),"legacy_key_regime"));
test("reject Score public data URLs",()=>failsWeekly(changed(weeks[0],w=>w.claimLineage[0].sourceUrl="https://score.usd-impact.com/data/weekly_input_latest.json"),"legacy_source_pointer"));
test("reject historical legacy Weekly report reference",()=>failsWeekly(changed(weeks[0],w=>w.claimLineage[0].sourceUrl="https://www.usd-impact.com/reports/weekly/2099-01-09"),"legacy_source_pointer"));
test("reject missing Daily",()=>failsWeekly(changed(weeks[0],w=>w.sourceDailyEditions=[]),"source_dailies_count"));
test("reject duplicate Daily date",()=>failsWeekly(changed(weeks[0],w=>w.sourceDailyEditions.push({...w.sourceDailyEditions[0]})),"duplicate_date"));
test("reject unpublished Daily used as source",()=>failsWeekly(changed(weeks[0],w=>w.sourceDailyEditions[0].status="draft"),"not_a_published_daily"));
test("reject unknown Daily lineage",()=>failsWeekly(changed(weeks[0],w=>w.claimLineage[0].dailyDate="2099-01-06"),"daily_lineage_missing"));
test("reject duplicate claim id",()=>failsWeekly(changed(weeks[0],w=>w.claimLineage.push({...w.claimLineage[0]})),"duplicate_id"));
test("reject future official source",()=>failsWeekly(changed(weeks[0],w=>w.claimLineage[0].sourcePublishedAtUtc="2099-02-03T12:00:00Z"),"unverified_or_future"));
test("reject a source cited before its publication",()=>failsWeekly(changed(weeks[0],w=>w.claimLineage[0].reviewedAtUtc="2099-01-05T09:10:00Z"),"unverified_or_future"));
test("reject missing post-release correction evidence",()=>failsWeekly(changed(weeks[0],w=>w.claimLineage[0].postReleaseReviewReceipt=null),"missing_post_release_receipt"));
test("reject Daily review timestamp before official release",()=>failsWeekly(changed(weeks[0],w=>w.sourceDailyEditions[0].reviewedAtUtc="2099-01-05T10:00:00Z"),"missing_post_release_receipt"));
test("reject unpublished Friday after editorial cutoff",()=>failsWeekly(changed(weeks[0],w=>w.editorialAsOfUtc="2099-01-08T12:00:00Z"),"as_of_invalid_or_future"));
test("reject missing rights receipt on published source",()=>failsWeekly(changed(weeks[0],w=>w.approvals.sourceRightsDecisionReceipt=null),"missing_sourceRightsDecisionReceipt"));
test("reject missing editorial receipt on published source",()=>failsWeekly(changed(weeks[0],w=>w.approvals.editorialApprovalReceipt=null),"missing_editorialApprovalReceipt"));
test("reject unknown claims in weekly theme",()=>failsWeekly(changed(weeks[0],w=>w.themes[0].claimIds=["unreviewed"]),"unresolved_claim_reference"));
test("reject unsupported source URL scheme",()=>failsWeekly(changed(weeks[0],w=>w.claimLineage[0].sourceUrl="http://fixtures.example.test/"),"invalid_source_url"));
test("reject old Score-like monthly key",()=>failsMonthly(changed(monthly(weeks),m=>m.scorePath=[]),weeks,"legacy_key_scorePath"));
test("reject monthly with fewer than four sources",()=>failsMonthly(changed(monthly(weeks),m=>m.sourceWeeklyReports.pop()),weeks,"exactly_four_weeklies_required"));
test("reject skipping the second Friday",()=>failsMonthly(changed(monthly(weeks),m=>m.sourceWeeklyReports[1].periodEnd="2099-01-23"),weeks,"not_four_consecutive_fridays"));
test("reject monthly with duplicated weekly reference",()=>failsMonthly(changed(monthly(weeks),m=>m.sourceWeeklyReports[1]=m.sourceWeeklyReports[0]),weeks,"duplicate_source_weekly"));
test("reject monthly with a legacy source URL",()=>failsMonthly(changed(monthly(weeks),m=>m.sourceWeeklyReports[0].slug="/reports/weekly/2099-01-09"),weeks,"source_not_independent"));
test("reject missing published source",()=>failsMonthly(monthly(weeks),weeks.slice(1),"missing_unpublished_or_mismatched_source"));
test("reject invalid source Weekly within Monthly",()=>failsMonthly(monthly(weeks),[changed(weeks[0],w=>w.claimLineage[0].postReleaseReviewReceipt=null),...weeks.slice(1)],"invalid_source_weekly"));
test("reject monthly report bounds inconsistent with sources",()=>failsMonthly(changed(monthly(weeks),m=>m.periodStart="2099-01-12"),weeks,"period_does_not_match_sources"));
test("reject monthly theme referencing an unreviewed source period",()=>failsMonthly(changed(monthly(weeks),m=>m.themes[0].weeklyDates=["2099-02-06"]),weeks,"unresolved_weekly_reference"));
test("reject missing standalone Monthly production receipt",()=>failsMonthly(changed(monthly(weeks),m=>m.approvals.productionApprovalReceipt=null),weeks,"missing_productionApprovalReceipt"));
test("reject malformed as-of for Monthly",()=>assert.equal(validateIndependentMonthly(monthly(weeks),weeks,{asOfUtc:"2099-02-30T12:00:00Z"}).structurallyValid,false));
test("static exact-source rights ledger is entirely denied and release HOLD",()=>{
 const path=new URL("../../../governance/independent-editorial-source-rights-review-2026-10-30.json",import.meta.url);
 const ledger=JSON.parse(readFileSync(path,"utf8"));
 assert.equal(ledger.state,"HOLD_PENDING_EXACT_SOURCE_EDITORIAL_REVIEW");
 assert.equal(ledger.authorizedAdditionalMarketDataLicenseBudgetUsd,0);
 assert.equal(ledger.originalScoreRightsGateMustRemainHold,true);
 assert.equal(ledger.sources.length,7);
 for(const s of ledger.sources){assert.equal(s.privateLegalOrOwnerReceipt,null);assert.deepEqual(Object.keys(s.permissions),ledger.permissionDimensions);assert.ok(Object.values(s.permissions).every(v=>v===false))}
 assert.ok(Object.values(ledger.publicationGates).every(v=>v===false));
});
