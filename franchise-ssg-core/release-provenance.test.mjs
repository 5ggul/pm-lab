import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {computeCandidateTree,digestSealCore,evaluateDeployApproval,fingerprintReleaseInputs,resolveSourceHead} from './release-provenance.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));

async function legalFixture(root,name,body){
  const p=path.join(root,name);
  await fs.writeFile(p,body.repeat(10),'utf8');
  return p;
}

function config(privacy,terms){
  return {
    schemaVersion:1,
    productionSiteUrl:'https://service.kr',
    operator:{displayName:'창업데이터랩',legalName:'운영주체',businessDisclosure:'사업자 고지',address:'공개 주소'},
    contact:{email:'contact@service.kr'},
    legal:{privacyPolicySource:privacy,termsSource:terms},
    ads:{adsTxtLine:''},
    releasePolicy:{indexOnlyProductionCandidates:true,keepNonCandidatesNoindex:true,requireManualApprovalBeforeDeploy:true,deployFromDryRun:false}
  };
}

test('candidate tree digest changes for byte or path mutation',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'franchise-provenance-tree-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'a'),{recursive:true});
  await fs.writeFile(path.join(root,'a','x.txt'),'one');
  const first=await computeCandidateTree(root);
  await fs.writeFile(path.join(root,'a','x.txt'),'two');
  const second=await computeCandidateTree(root);
  assert.notEqual(first.digest,second.digest);
  await fs.rename(path.join(root,'a','x.txt'),path.join(root,'a','y.txt'));
  const third=await computeCandidateTree(root);
  assert.notEqual(second.digest,third.digest);
});

test('release-input fingerprint follows values and legal bytes, not temporary legal paths',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'franchise-provenance-input-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const p1=await legalFixture(root,'privacy-a.md','# 개인정보처리방침\n개인정보 처리와 수집 및 이용을 설명합니다.\n');
  const t1=await legalFixture(root,'terms-a.md','# 이용약관\n서비스 이용 조건을 설명합니다.\n');
  const p2=await legalFixture(root,'privacy-b.md','# 개인정보처리방침\n개인정보 처리와 수집 및 이용을 설명합니다.\n');
  const t2=await legalFixture(root,'terms-b.md','# 이용약관\n서비스 이용 조건을 설명합니다.\n');
  const a=await fingerprintReleaseInputs(config(p1,t1),{repoRoot:root});
  const b=await fingerprintReleaseInputs(config(p2,t2),{repoRoot:root});
  assert.equal(a.fingerprint,b.fingerprint);
  await fs.appendFile(p2,'변경');
  const c=await fingerprintReleaseInputs(config(p2,t2),{repoRoot:root});
  assert.notEqual(a.fingerprint,c.fingerprint);
});

test('seal digest changes when provenance core changes',()=>{
  const core={sourceHead:'a'.repeat(40),candidateTreeHash:'b'.repeat(64),releaseInputFingerprint:'c'.repeat(64)};
  const first=digestSealCore(core);
  const second=digestSealCore({...core,candidateTreeHash:'d'.repeat(64)});
  assert.notEqual(first,second);
});

test('second approval requires exact seal digest and exact source SHA',()=>{
  const sealDigest='a'.repeat(64),sourceHead='b'.repeat(40);
  const blocked=evaluateDeployApproval({testMode:false,sealDigest,sourceHead,env:{}});
  assert.equal(blocked.ready,false);
  assert.equal(blocked.decision,'BLOCKED_SECOND_APPROVAL_REQUIRED');
  const mismatch=evaluateDeployApproval({testMode:false,sealDigest,sourceHead,env:{SSG_PRODUCTION_DEPLOY_APPROVED:'YES',SSG_PRODUCTION_DEPLOY_DIGEST:'c'.repeat(64),SSG_PRODUCTION_DEPLOY_SOURCE_SHA:sourceHead}});
  assert.ok(mismatch.blockers.includes('DEPLOY_DIGEST_MISMATCH'));
  const ready=evaluateDeployApproval({testMode:false,sealDigest,sourceHead,env:{SSG_PRODUCTION_DEPLOY_APPROVED:'YES',SSG_PRODUCTION_DEPLOY_DIGEST:sealDigest,SSG_PRODUCTION_DEPLOY_SOURCE_SHA:sourceHead}});
  assert.deepEqual(ready,{ready:true,decision:'READY_FOR_EXPLICIT_HOST_DEPLOY',blockers:[]});
  const testMode=evaluateDeployApproval({testMode:true,sealDigest,sourceHead,env:{SSG_PRODUCTION_DEPLOY_APPROVED:'YES',SSG_PRODUCTION_DEPLOY_DIGEST:sealDigest,SSG_PRODUCTION_DEPLOY_SOURCE_SHA:sourceHead}});
  assert.equal(testMode.decision,'BLOCKED_TEST_MODE_NEVER_DEPLOYS');
  assert.equal(testMode.ready,false);
});


test('source provenance prefers actual checked-out git HEAD over generic GITHUB_SHA fallback',()=>{
  const beforeRelease=process.env.SSG_RELEASE_SOURCE_SHA;
  const beforeQa=process.env.SSG_QA_SOURCE_SHA;
  const beforeGithub=process.env.GITHUB_SHA;
  try{
    delete process.env.SSG_RELEASE_SOURCE_SHA;
    delete process.env.SSG_QA_SOURCE_SHA;
    process.env.GITHUB_SHA='f'.repeat(40);
    const actual=resolveSourceHead({repoRoot:path.resolve(here,'..')});
    assert.match(actual,/^[0-9a-f]{40}$/);
    assert.notEqual(actual,'f'.repeat(40));
  }finally{
    if(beforeRelease===undefined)delete process.env.SSG_RELEASE_SOURCE_SHA;else process.env.SSG_RELEASE_SOURCE_SHA=beforeRelease;
    if(beforeQa===undefined)delete process.env.SSG_QA_SOURCE_SHA;else process.env.SSG_QA_SOURCE_SHA=beforeQa;
    if(beforeGithub===undefined)delete process.env.GITHUB_SHA;else process.env.GITHUB_SHA=beforeGithub;
  }
});
