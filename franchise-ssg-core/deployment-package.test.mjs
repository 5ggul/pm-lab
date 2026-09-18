import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildFileManifest,copyTree,packageDigest,resolveRollbackContract,verifyDeployPackage} from './deployment-package.mjs';
import {computeCandidateTree} from './release-provenance.mjs';

test('deploy package file manifest detects missing changed and renamed files',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'franchise-package-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const src=path.join(root,'src'),pkg=path.join(root,'pkg'),site=path.join(pkg,'site');
  await fs.mkdir(path.join(src,'a'),{recursive:true});
  await fs.writeFile(path.join(src,'index.html'),'home');
  await fs.writeFile(path.join(src,'a','x.txt'),'x');
  await copyTree(src,site);
  const files=await buildFileManifest(site);
  const manifest={schemaVersion:1,kind:'franchise-production-deploy-package',testMode:true,sourceHead:'a'.repeat(40),sealDigest:'b'.repeat(64),releaseInputFingerprint:'c'.repeat(64),candidateTreeHash:(await computeCandidateTree(site)).digest,productionSite:'RESERVED_TEST_ORIGIN'};
  manifest.rollback={ready:true,mode:'TEST_MODE_NOT_APPLICABLE',previousSeal:null};
  manifest.site={path:'site',fileCount:files.fileCount,totalBytes:files.totalBytes,fileManifestDigest:files.digest};
  manifest.deploymentPolicy={packageOnly:true,deployPerformed:false,postDeployVerificationRequired:true};
  manifest.files=files.entries;
  manifest.packageDigest=packageDigest(manifest);
  await fs.mkdir(pkg,{recursive:true});
  await fs.writeFile(path.join(pkg,'deployment-manifest.json'),JSON.stringify(manifest));
  await fs.writeFile(path.join(pkg,'checksums.sha256'),files.entries.map(x=>`${x.sha256}  ${x.path}`).join('\n')+'\n');
  assert.equal((await verifyDeployPackage(pkg)).ready,true);
  await fs.writeFile(path.join(site,'a','x.txt'),'changed');
  assert.equal((await verifyDeployPackage(pkg)).ready,false);
});

test('real deploy package requires an explicit rollback mode',async t=>{
  assert.equal((await resolveRollbackContract({testMode:false,env:{}})).ready,false);
  assert.deepEqual(await resolveRollbackContract({testMode:false,env:{SSG_PRODUCTION_ROLLBACK_MODE:'FIRST_DEPLOYMENT'}}),{ready:true,mode:'FIRST_DEPLOYMENT',previousSeal:null});
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'franchise-previous-seal-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const sealPath=path.join(dir,'seal.json');
  await fs.writeFile(sealPath,JSON.stringify({kind:'franchise-production-candidate-seal',sealDigest:'d'.repeat(64),sourceHead:'e'.repeat(40),candidateTreeHash:'f'.repeat(64),productionSite:'https://service.kr'}));
  const previous=await resolveRollbackContract({testMode:false,env:{SSG_PRODUCTION_ROLLBACK_MODE:'PREVIOUS_SEAL',SSG_PREVIOUS_PRODUCTION_SEAL:sealPath}});
  assert.equal(previous.ready,true);
  assert.equal(previous.previousSeal.sealDigest,'d'.repeat(64));
});
