import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {computeCandidateTree,digestSealCore} from './release-provenance.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const preview=path.join(repo,'docs/franchise-ssg-preview');
const TEST_MODE=String(process.env.SSG_RELEASE_TEST_MODE||'').toLowerCase()==='true';
const defaultReport=TEST_MODE?path.join(preview,'production-candidate-contract-test.json'):path.join(repo,'build/franchise-production-candidate-report.json');
const reportPath=path.resolve(process.env.SSG_PRODUCTION_CANDIDATE_REPORT||defaultReport);
const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
const output=path.resolve(process.env.SSG_PRODUCTION_OUTPUT||report.outputPath||path.join(repo,'build/franchise-production-candidate'));
const defaultSeal=TEST_MODE?path.join(os.tmpdir(),'franchise-production-candidate-seal.json'):path.join(repo,'build/franchise-production-candidate-seal.json');
const sealPath=path.resolve(process.env.SSG_PRODUCTION_SEAL||defaultSeal);

const fail=[];
if(report.decision!=='PRODUCTION_CANDIDATE_BUILT_NOT_DEPLOYED')fail.push('BUILD_DECISION_NOT_SEALABLE');
if(report.indexPolicyFinalized!==true)fail.push('INDEX_POLICY_NOT_FINALIZED');
if(report.seoAudit?.status!=='PASS')fail.push('SEO_AUDIT_NOT_PASS');
if(report.validation?.status!=='PASS')fail.push('STATIC_VALIDATION_NOT_PASS');
if(report.previewUnchanged!==true||report.validation?.previewUnchanged!==true)fail.push('PREVIEW_IMMUTABILITY_NOT_PROVEN');
if(!/^[0-9a-f]{40}$/i.test(String(report.sourceHead||'')))fail.push('SOURCE_HEAD_MISSING');
if(!/^[0-9a-f]{64}$/i.test(String(report.releaseInputFingerprint||'')))fail.push('RELEASE_INPUT_FINGERPRINT_MISSING');
const tree=await computeCandidateTree(output);
if(tree.digest!==report.outputHash)fail.push('CANDIDATE_TREE_HASH_MISMATCH');
if(fail.length){
  console.error(JSON.stringify({productionCandidateSeal:'BLOCKED',reasons:fail,computedTreeHash:tree.digest,reportOutputHash:report.outputHash||null},null,2));
  process.exit(1);
}

const core={
  schemaVersion:1,
  kind:'franchise-production-candidate-seal',
  testMode:TEST_MODE,
  sourceHead:String(report.sourceHead).toLowerCase(),
  releaseInputFingerprint:String(report.releaseInputFingerprint).toLowerCase(),
  productionSite:report.productionSite,
  candidateTreeHash:tree.digest,
  candidateFileCount:tree.fileCount,
  candidateBytes:tree.totalBytes,
  requestedCandidateCount:report.requestedCandidateCount,
  effectiveCandidateCount:report.candidateCount,
  nonCandidateCount:report.nonCandidateCount,
  htmlCount:report.htmlCount,
  sitemapUrlCount:report.sitemapUrlCount,
  canonicalAliasDemotionCount:(report.canonicalAliasDemotions||[]).length,
  indexPolicyFinalizedAt:report.indexPolicyFinalizedAt,
  seoAuditStatus:report.seoAudit?.status,
  staticValidationStatus:report.validation?.status,
  staticValidatedAt:report.validation?.validatedAt,
  reportOutputHash:report.outputHash,
  deploymentPolicy:{
    secondApprovalRequired:true,
    requiredSignals:['SSG_PRODUCTION_DEPLOY_APPROVED=YES','SSG_PRODUCTION_DEPLOY_DIGEST=<sealDigest>','SSG_PRODUCTION_DEPLOY_SOURCE_SHA=<sourceHead>'],
    deployPerformed:false
  }
};
const seal={...core,sealedAt:new Date().toISOString(),sealDigest:digestSealCore(core)};
await fs.mkdir(path.dirname(sealPath),{recursive:true});
await fs.writeFile(sealPath,JSON.stringify(seal,null,2)+'\n','utf8');
console.log(JSON.stringify({productionCandidateSeal:'PASS',testMode:TEST_MODE,sealPath:path.relative(repo,sealPath).replace(/\\/g,'/'),sourceHead:seal.sourceHead,candidateTreeHash:seal.candidateTreeHash,sealDigest:seal.sealDigest,fileCount:seal.candidateFileCount,productionDeploy:false},null,2));
