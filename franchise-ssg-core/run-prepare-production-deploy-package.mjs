import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {buildFileManifest,copyTree,packageDigest,resolveRollbackContract} from './deployment-package.mjs';
import {computeCandidateTree,digestSealCore} from './release-provenance.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const preview=path.join(repo,'docs/franchise-ssg-preview');
const TEST_MODE=String(process.env.SSG_RELEASE_TEST_MODE||'').toLowerCase()==='true';
const defaultReport=TEST_MODE?path.join(preview,'production-candidate-contract-test.json'):path.join(repo,'build/franchise-production-candidate-report.json');
const reportPath=path.resolve(process.env.SSG_PRODUCTION_CANDIDATE_REPORT||defaultReport);
const defaultSeal=TEST_MODE?path.join(os.tmpdir(),'franchise-production-candidate-seal.json'):path.join(repo,'build/franchise-production-candidate-seal.json');
const sealPath=path.resolve(process.env.SSG_PRODUCTION_SEAL||defaultSeal);
const defaultPackage=TEST_MODE?path.join(os.tmpdir(),'franchise-production-deploy-package'):path.join(repo,'build/franchise-production-deploy-package');
const packageRoot=path.resolve(process.env.SSG_PRODUCTION_DEPLOY_PACKAGE||defaultPackage);

const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
const seal=JSON.parse(await fs.readFile(sealPath,'utf8'));
const output=path.resolve(process.env.SSG_PRODUCTION_OUTPUT||report.outputPath||path.join(repo,'build/franchise-production-candidate'));
const {sealDigest,...withTimestamp}=seal;const {sealedAt,...sealCore}=withTimestamp;
const integrity=[];
if(digestSealCore(sealCore)!==sealDigest)integrity.push('SEAL_DIGEST_MISMATCH');
if(report.validation?.status!=='PASS'||report.seoAudit?.status!=='PASS')integrity.push('CANDIDATE_NOT_VALIDATED');
if(report.outputHash!==seal.candidateTreeHash)integrity.push('REPORT_SEAL_HASH_DRIFT');
const tree=await computeCandidateTree(output);
if(tree.digest!==seal.candidateTreeHash)integrity.push('CANDIDATE_BYTES_CHANGED_AFTER_SEAL');
if(String(report.sourceHead)!==String(seal.sourceHead))integrity.push('SOURCE_HEAD_DRIFT');
if(String(report.releaseInputFingerprint)!==String(seal.releaseInputFingerprint))integrity.push('RELEASE_INPUT_FINGERPRINT_DRIFT');
if(integrity.length){console.error(JSON.stringify({productionDeployPackage:'BLOCKED_INTEGRITY',integrity,productionDeploy:false},null,2));process.exit(1)}

const rollback=await resolveRollbackContract({testMode:TEST_MODE,env:process.env});
if(!rollback.ready){console.error(JSON.stringify({productionDeployPackage:'BLOCKED_ROLLBACK_CONTRACT',rollback,productionDeploy:false},null,2));process.exit(2)}

if(path.resolve(packageRoot)===path.resolve(output)||path.resolve(packageRoot).startsWith(path.resolve(output)+path.sep)){throw new Error('Deploy package root must be separate from candidate output')}
await fs.rm(packageRoot,{recursive:true,force:true});
await fs.mkdir(packageRoot,{recursive:true});
const siteRoot=path.join(packageRoot,'site');
await copyTree(output,siteRoot);
const packagedTree=await computeCandidateTree(siteRoot);
if(packagedTree.digest!==seal.candidateTreeHash)throw new Error('Packaged site bytes differ from sealed candidate');
const files=await buildFileManifest(siteRoot);
const manifest={
  schemaVersion:1,
  kind:'franchise-production-deploy-package',
  generatedAt:new Date().toISOString(),
  testMode:TEST_MODE,
  sourceHead:seal.sourceHead,
  sealDigest:seal.sealDigest,
  releaseInputFingerprint:seal.releaseInputFingerprint,
  candidateTreeHash:seal.candidateTreeHash,
  productionSite:seal.productionSite,
  rollback,
  site:{path:'site',fileCount:files.fileCount,totalBytes:files.totalBytes,fileManifestDigest:files.digest},
  deploymentPolicy:{packageOnly:true,deployPerformed:false,secondApprovalRequired:true,postDeployVerificationRequired:true},
  files:files.entries
};
manifest.packageDigest=packageDigest(manifest);
await fs.writeFile(path.join(packageRoot,'deployment-manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
await fs.writeFile(path.join(packageRoot,'checksums.sha256'),files.entries.map(x=>`${x.sha256}  ${x.path}`).join('\n')+'\n','utf8');
console.log(JSON.stringify({productionDeployPackage:'PASS',testMode:TEST_MODE,packageRoot:path.relative(repo,packageRoot).replace(/\\/g,'/'),sourceHead:manifest.sourceHead,sealDigest:manifest.sealDigest,packageDigest:manifest.packageDigest,candidateTreeHash:manifest.candidateTreeHash,fileCount:files.fileCount,totalBytes:files.totalBytes,rollbackMode:rollback.mode,productionDeploy:false},null,2));
