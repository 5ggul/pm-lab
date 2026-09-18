import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {computeCandidateTree,digestSealCore,evaluateDeployApproval} from './release-provenance.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const preview=path.join(repo,'docs/franchise-ssg-preview');
const TEST_MODE=String(process.env.SSG_RELEASE_TEST_MODE||'').toLowerCase()==='true';
const defaultReport=TEST_MODE?path.join(preview,'production-candidate-contract-test.json'):path.join(repo,'build/franchise-production-candidate-report.json');
const reportPath=path.resolve(process.env.SSG_PRODUCTION_CANDIDATE_REPORT||defaultReport);
const defaultSeal=TEST_MODE?path.join(os.tmpdir(),'franchise-production-candidate-seal.json'):path.join(repo,'build/franchise-production-candidate-seal.json');
const sealPath=path.resolve(process.env.SSG_PRODUCTION_SEAL||defaultSeal);

let report,seal;
try{report=JSON.parse(await fs.readFile(reportPath,'utf8'));seal=JSON.parse(await fs.readFile(sealPath,'utf8'))}
catch(error){
  console.error(JSON.stringify({productionDeployGate:'BLOCKED_INTEGRITY',reason:'REPORT_OR_SEAL_MISSING',error:error.message,productionDeploy:false},null,2));
  process.exit(1);
}
const output=path.resolve(process.env.SSG_PRODUCTION_OUTPUT||report.outputPath||path.join(repo,'build/franchise-production-candidate'));
const integrity=[];
const {sealDigest,...withTimestamp}=seal;
const {sealedAt,...core}=withTimestamp;
const expectedSealDigest=digestSealCore(core);
if(sealDigest!==expectedSealDigest)integrity.push('SEAL_DIGEST_MISMATCH');
if(seal.kind!=='franchise-production-candidate-seal'||seal.schemaVersion!==1)integrity.push('SEAL_SCHEMA_MISMATCH');
if(Boolean(seal.testMode)!==TEST_MODE||Boolean(report.testMode)!==TEST_MODE)integrity.push('TEST_MODE_MISMATCH');
if(report.decision!=='PRODUCTION_CANDIDATE_BUILT_NOT_DEPLOYED')integrity.push('BUILD_DECISION_CHANGED');
if(report.indexPolicyFinalized!==true)integrity.push('INDEX_POLICY_NOT_FINALIZED');
if(report.seoAudit?.status!=='PASS')integrity.push('SEO_AUDIT_NOT_PASS');
if(report.validation?.status!=='PASS')integrity.push('STATIC_VALIDATION_NOT_PASS');
if(String(report.sourceHead||'').toLowerCase()!==String(seal.sourceHead||'').toLowerCase())integrity.push('SOURCE_HEAD_DRIFT');
if(String(report.releaseInputFingerprint||'').toLowerCase()!==String(seal.releaseInputFingerprint||'').toLowerCase())integrity.push('RELEASE_INPUT_FINGERPRINT_DRIFT');
if(report.productionSite!==seal.productionSite)integrity.push('PRODUCTION_SITE_DRIFT');
if(report.outputHash!==seal.candidateTreeHash||report.outputHash!==seal.reportOutputHash)integrity.push('REPORT_TREE_HASH_DRIFT');
let tree=null;
try{tree=await computeCandidateTree(output)}catch(error){integrity.push('CANDIDATE_OUTPUT_MISSING')}
if(tree&&tree.digest!==seal.candidateTreeHash)integrity.push('CANDIDATE_BYTES_CHANGED_AFTER_SEAL');
if(tree&&tree.fileCount!==seal.candidateFileCount)integrity.push('CANDIDATE_FILE_COUNT_CHANGED_AFTER_SEAL');

if(integrity.length){
  console.error(JSON.stringify({productionDeployGate:'BLOCKED_INTEGRITY',integrity,sealDigest:seal.sealDigest,sourceHead:seal.sourceHead,candidateTreeHash:tree?.digest||null,sealedTreeHash:seal.candidateTreeHash,productionDeploy:false},null,2));
  process.exit(1);
}

const approval=evaluateDeployApproval({testMode:TEST_MODE,sealDigest:seal.sealDigest,sourceHead:seal.sourceHead,env:process.env});
const summary={
  productionDeployGate:approval.decision,
  integrity:'PASS',
  testMode:TEST_MODE,
  sourceHead:seal.sourceHead,
  candidateTreeHash:seal.candidateTreeHash,
  sealDigest:seal.sealDigest,
  blockers:approval.blockers,
  readyForExplicitHostDeploy:approval.ready,
  productionDeploy:false
};
console.log(JSON.stringify(summary,null,2));
if(!approval.ready)process.exit(2);
