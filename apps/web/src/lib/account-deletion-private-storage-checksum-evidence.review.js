// Issue #950 - purely structural evidence checker, NOT a byte downloader.
// The caller must independently prove that observed SHA-256 values were
// streamed from real private object bytes in a security-approved runner.
// This module NEVER accesses Supabase, keys, S3, network, local files or Auth.
import {privateAudiobookTracks,PRIVATE_AUDIOBOOK_BUCKET} from './private-audiobook.js';
import {privateBookDocument,PRIVATE_BOOK_BUCKET} from './private-book.js';

export const ISSUE950_STORAGE_EXPECTED_COUNT=21;
export const ISSUE950_STORAGE_EXPECTED_BYTES=374929235;
export const ISSUE950_STORAGE_ORIGIN='ycstrcvshdluovtuasjc';
export const ISSUE950_STORAGE_DESTINATION='movnekagnxgcyenczfoc';
export const ISSUE950_STORAGE_EVIDENCE_KIND='streamed_object_bytes_sha256';

export class Issue950StorageChecksumHold extends Error {
  constructor(code){super(code);this.name='Issue950StorageChecksumHold';this.code=code;}
}
function hold(code){throw new Issue950StorageChecksumHold(code);}
const expected=new Map();
for(const t of privateAudiobookTracks){
  expected.set(PRIVATE_AUDIOBOOK_BUCKET+'\n'+t.objectPath,
    Object.freeze({bytes:t.size,sha256:t.sha256}));
}
expected.set(PRIVATE_BOOK_BUCKET+'\n'+privateBookDocument.objectPath,
  Object.freeze({bytes:privateBookDocument.size,sha256:privateBookDocument.sha256}));
if(expected.size!==ISSUE950_STORAGE_EXPECTED_COUNT
  || [...expected.values()].reduce((s,x)=>s+x.bytes,0)!==ISSUE950_STORAGE_EXPECTED_BYTES
  || [...expected.values()].some(x=>!/^[a-f0-9]{64}$/.test(x.sha256))){
  hold('ISSUE950_AUTHORITATIVE_MANIFEST_CHANGED');
}
function checkSide(records,evidenceKind){
  if(evidenceKind!==ISSUE950_STORAGE_EVIDENCE_KIND)
    hold('ISSUE950_NOT_BYTE_HASH_EVIDENCE');
  if(!Array.isArray(records)||records.length!==ISSUE950_STORAGE_EXPECTED_COUNT)
    hold('ISSUE950_OBJECT_COUNT_MISMATCH');
  const seen=new Set();
  let totalBytes=0;
  for(const record of records){
    if(!record||typeof record!=='object'
      ||typeof record.bucket!=='string'
      ||typeof record.objectPath!=='string'){
      hold('ISSUE950_INVALID_OBSERVATION');
    }
    const key=record.bucket+'\n'+record.objectPath;
    if(seen.has(key))hold('ISSUE950_DUPLICATE_OBJECT');
    seen.add(key);
    const authoritative=expected.get(key);
    if(!authoritative)hold('ISSUE950_OBJECT_NOT_IN_MANIFEST');
    if(!Number.isSafeInteger(record.bytes)||record.bytes!==authoritative.bytes)
      hold('ISSUE950_OBJECT_BYTE_LENGTH_MISMATCH');
    if(typeof record.sha256!=='string'
      ||!/^[a-f0-9]{64}$/.test(record.sha256)
      ||record.sha256!==authoritative.sha256){
      hold('ISSUE950_OBJECT_SHA256_NOT_AUTHORITATIVE');
    }
    totalBytes+=record.bytes;
  }
  if(seen.size!==expected.size||totalBytes!==ISSUE950_STORAGE_EXPECTED_BYTES)
    hold('ISSUE950_INCOMPLETE_AUTHORITATIVE_MANIFEST');
}
export function reviewIssue950PrivateStorageChecksumEvidence({
  sourceRef,destinationRef,sourceRecords,destinationRecords,
  sourceEvidenceKind,destinationEvidenceKind,
}={}){
  if(sourceRef!==ISSUE950_STORAGE_ORIGIN
    ||destinationRef!==ISSUE950_STORAGE_DESTINATION
    ||sourceRef===destinationRef)
    hold('ISSUE950_PROJECT_MISMATCH');
  checkSide(sourceRecords,sourceEvidenceKind);
  checkSide(destinationRecords,destinationEvidenceKind);
  // Pure object validation cannot establish that a protected runner actually
  // streamed the bytes. This intentionally never reports release readiness.
  return Object.freeze({
    mode:'STRUCTURAL_EVIDENCE_CONSISTENCY_ONLY',
    authoritativeManifestHashClaimsMatch:true,
    totalObjects:ISSUE950_STORAGE_EXPECTED_COUNT,
    totalExpectedBytes:ISSUE950_STORAGE_EXPECTED_BYTES,
    realObjectBytesReadByThisFunction:false,
    independentRunnerProvenanceVerified:false,
    productionReleaseAuthorized:false,
    s3TransferAuthorized:false,
    rawObjectPathsOrHashesReturned:false,
  });
}
