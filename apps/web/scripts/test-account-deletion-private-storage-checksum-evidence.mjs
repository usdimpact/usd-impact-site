// Issue #950: immutable 21-file code manifest vs synthetic claimed SHA-256
// records. NO actual byte fetching or trust in mocked provenance.
import assert from 'node:assert/strict';
import {
  ISSUE950_STORAGE_EXPECTED_COUNT,ISSUE950_STORAGE_EXPECTED_BYTES,
  ISSUE950_STORAGE_ORIGIN,ISSUE950_STORAGE_DESTINATION,
  ISSUE950_STORAGE_EVIDENCE_KIND,Issue950StorageChecksumHold,
  reviewIssue950PrivateStorageChecksumEvidence,
} from '../src/lib/account-deletion-private-storage-checksum-evidence.review.js';
import {privateAudiobookTracks,PRIVATE_AUDIOBOOK_BUCKET} from '../src/lib/private-audiobook.js';
import {privateBookDocument,PRIVATE_BOOK_BUCKET} from '../src/lib/private-book.js';

const fixture=[
  ...privateAudiobookTracks.map(t=>({
    bucket:PRIVATE_AUDIOBOOK_BUCKET,objectPath:t.objectPath,
    bytes:t.size,sha256:t.sha256,
  })),
  {bucket:PRIVATE_BOOK_BUCKET,objectPath:privateBookDocument.objectPath,
    bytes:privateBookDocument.size,sha256:privateBookDocument.sha256},
];
assert.equal(fixture.length,21);
assert.equal(fixture.reduce((sum,r)=>sum+r.bytes,0),374929235);
assert.equal(new Set(fixture.map(r=>r.bucket+'\n'+r.objectPath)).size,21);
let tests=3;
const valid={
  sourceRef:ISSUE950_STORAGE_ORIGIN,
  destinationRef:ISSUE950_STORAGE_DESTINATION,
  sourceRecords:fixture.map(x=>({...x})),
  destinationRecords:fixture.map(x=>({...x})),
  sourceEvidenceKind:ISSUE950_STORAGE_EVIDENCE_KIND,
  destinationEvidenceKind:ISSUE950_STORAGE_EVIDENCE_KIND,
};
const result=reviewIssue950PrivateStorageChecksumEvidence(valid);
assert.equal(result.mode,'STRUCTURAL_EVIDENCE_CONSISTENCY_ONLY');
assert.equal(result.authoritativeManifestHashClaimsMatch,true);
assert.equal(result.totalObjects,ISSUE950_STORAGE_EXPECTED_COUNT);
assert.equal(result.totalExpectedBytes,ISSUE950_STORAGE_EXPECTED_BYTES);
assert.equal(result.realObjectBytesReadByThisFunction,false);
assert.equal(result.independentRunnerProvenanceVerified,false);
assert.equal(result.productionReleaseAuthorized,false);
assert.equal(result.s3TransferAuthorized,false);
assert.equal(result.rawObjectPathsOrHashesReturned,false);
assert.equal(Object.isFrozen(result),true);
tests+=10;
const output=JSON.stringify(result);
assert.equal(output.includes(privateBookDocument.objectPath),false);
assert.equal(output.includes(privateBookDocument.sha256),false);
assert.equal(output.includes(ISSUE950_STORAGE_ORIGIN),false);
assert.equal(output.includes(ISSUE950_STORAGE_DESTINATION),false);
tests+=4;
function rejected(override,code){
  assert.throws(()=>reviewIssue950PrivateStorageChecksumEvidence({
    ...valid,...override,
  }),e=>e instanceof Issue950StorageChecksumHold&&e.code===code,code);
  tests++;
}
const changed=(records,index,change)=>records.map((r,i)=>i===index?{...r,...change}:r);
for(const [change,code] of [
  [{sourceRef:'gjzetjugmnwanvjkchux'},'ISSUE950_PROJECT_MISMATCH'],
  [{destinationRef:'gjzetjugmnwanvjkchux'},'ISSUE950_PROJECT_MISMATCH'],
  [{sourceRef:ISSUE950_STORAGE_DESTINATION},'ISSUE950_PROJECT_MISMATCH'],
  [{destinationRef:ISSUE950_STORAGE_ORIGIN},'ISSUE950_PROJECT_MISMATCH'],
  [{sourceEvidenceKind:'sql_metadata_hash'},'ISSUE950_NOT_BYTE_HASH_EVIDENCE'],
  [{destinationEvidenceKind:'etag'},'ISSUE950_NOT_BYTE_HASH_EVIDENCE'],
  [{sourceRecords:valid.sourceRecords.slice(1)},'ISSUE950_OBJECT_COUNT_MISMATCH'],
  [{destinationRecords:[...valid.destinationRecords,valid.destinationRecords[0]]},'ISSUE950_OBJECT_COUNT_MISMATCH'],
  [{sourceRecords:changed(valid.sourceRecords,0,{sha256:'0'.repeat(64)})},'ISSUE950_OBJECT_SHA256_NOT_AUTHORITATIVE'],
  [{destinationRecords:changed(valid.destinationRecords,20,{bytes:1})},'ISSUE950_OBJECT_BYTE_LENGTH_MISMATCH'],
  [{sourceRecords:changed(valid.sourceRecords,0,{sha256:'NOT_SHA_256'})},'ISSUE950_OBJECT_SHA256_NOT_AUTHORITATIVE'],
  [{sourceRecords:changed(valid.sourceRecords,0,{bytes:1.5})},'ISSUE950_OBJECT_BYTE_LENGTH_MISMATCH'],
  [{sourceRecords:changed(valid.sourceRecords,0,{objectPath:'unknown.mp3'})},'ISSUE950_OBJECT_NOT_IN_MANIFEST'],
  [{destinationRecords:changed(valid.destinationRecords,20,{bucket:PRIVATE_AUDIOBOOK_BUCKET})},'ISSUE950_OBJECT_NOT_IN_MANIFEST'],
  [{sourceRecords:changed(valid.sourceRecords,0,{objectPath:valid.sourceRecords[1].objectPath})},'ISSUE950_DUPLICATE_OBJECT'],
  [{sourceRecords:changed(valid.sourceRecords,0,{bucket:null})},'ISSUE950_INVALID_OBSERVATION'],
  // Equal corrupted source/restore evidence must STILL fail the
  // independently committed SHA-256 for that file.
  [{
    sourceRecords:changed(valid.sourceRecords,3,{sha256:'f'.repeat(64)}),
    destinationRecords:changed(valid.destinationRecords,3,{sha256:'f'.repeat(64)}),
  },'ISSUE950_OBJECT_SHA256_NOT_AUTHORITATIVE'],
]){
  rejected(change,code);
}
assert.deepEqual(
  valid.sourceRecords.map(r=>r.sha256),
  valid.destinationRecords.map(r=>r.sha256));
tests++;
console.log('Issue #950 authoritative 21-object SHA256 evidence STRUCTURE: '+tests+
  ' synthetic assertions PASS. NOT actual file-byte verification or transfer approval.');
