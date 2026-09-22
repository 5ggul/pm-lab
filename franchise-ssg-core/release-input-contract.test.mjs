import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectProductionOrigin,validateReleaseConfig} from './release-input-contract.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');

async function fixture(){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'franchise-release-input-'));
  const privacy=path.join(dir,'privacy.md');
  const terms=path.join(dir,'terms.md');
  await fs.writeFile(privacy,('# 개인정보처리방침\n개인정보 처리 목적과 수집 항목, 이용 목적, 보유 기간, 파기 절차, 이용자 권리, 안전성 조치, 문의 방법을 설명합니다.\n').repeat(8),'utf8');
  await fs.writeFile(terms,('# 이용약관\n서비스 이용 조건, 이용자의 권리와 의무, 금지 행위, 지식재산, 책임 범위, 서비스 변경, 분쟁 처리 기준을 설명합니다.\n').repeat(8),'utf8');
  return {dir,privacy,terms};
}

function baseConfig(privacy,terms){
  return {
    schemaVersion:1,
    productionSiteUrl:'https://franchise.example.kr',
    operator:{displayName:'창업데이터랩',legalName:'테스트 운영주체',businessDisclosure:'사업자 및 운영자 정보 고지',address:'서울특별시 예시로 1'},
    contact:{email:'contact@franchise.example.kr'},
    legal:{privacyPolicySource:privacy,termsSource:terms},
    ads:{adsTxtLine:''},
    releasePolicy:{indexOnlyProductionCandidates:true,keepNonCandidatesNoindex:true,requireManualApprovalBeforeDeploy:true,deployFromDryRun:false}
  };
}

test('exact production origin contract rejects path query hash credentials and reserved hosts',()=>{
  for(const value of [
    'http://service.kr',
    'https://service.kr/path',
    'https://service.kr/?q=1',
    'https://service.kr/#x',
    'https://user:pass@service.kr',
    'https://localhost',
    'https://127.0.0.1',
    'https://preview.github.io',
    'https://release.invalid',
    'https://example.com'
  ])assert.equal(inspectProductionOrigin(value).valid,false,value);
  assert.deepEqual(inspectProductionOrigin('https://service.kr'),{configured:true,valid:true,value:'https://service.kr',reasons:[]});
  assert.equal(inspectProductionOrigin('https://service.kr/').valid,true);
});

test('final release config with legal sources passes and optional ads may stay empty',async t=>{
  const fx=await fixture();t.after(()=>fs.rm(fx.dir,{recursive:true,force:true}));
  const result=await validateReleaseConfig(baseConfig(fx.privacy,fx.terms),{repoRoot:repo});
  assert.equal(result.ready,true);
  assert.deepEqual(result.missing,[]);
  assert.equal(result.ads.configured,false);
  assert.ok(result.warnings.includes('ADS_TXT_NOT_CONFIGURED_YET'));
});

test('example placeholders remain blocked on the eight real release inputs',async()=>{
  const example=JSON.parse(await fs.readFile(path.join(here,'release-config.example.json'),'utf8'));
  const result=await validateReleaseConfig(example,{repoRoot:repo});
  const expected=['productionSiteUrl','operator.displayName','operator.legalName','operator.businessDisclosure','operator.address','contact.email','legal.privacyPolicySource','legal.termsSource'];
  for(const field of expected)assert.ok(result.missing.includes(field),field);
  assert.equal(result.ready,false);
  assert.equal(result.missing.includes('schemaVersion'),false);
});

test('legal placeholders, policy drift and malformed configured ads are blocking',async t=>{
  const fx=await fixture();t.after(()=>fs.rm(fx.dir,{recursive:true,force:true}));
  await fs.writeFile(fx.privacy,'# 개인정보처리방침\nTODO 추후 반영 '.repeat(40),'utf8');
  const config=baseConfig(fx.privacy,fx.terms);
  config.releasePolicy.deployFromDryRun=true;
  config.ads.adsTxtLine='google.com, publisher, MAYBE';
  const result=await validateReleaseConfig(config,{repoRoot:repo});
  assert.equal(result.ready,false);
  assert.ok(result.missing.includes('legal.privacyPolicySource'));
  assert.ok(result.missing.includes('releasePolicy.deployFromDryRun'));
  assert.ok(result.missing.includes('ads.adsTxtLine'));
});

test('documented safe builder runs strict contract before the internal builder',async()=>{
  const wrapper=await fs.readFile(path.join(here,'run-build-production-candidate-v11-24.mjs'),'utf8');
  const handoff=await fs.readFile(path.join(here,'PRODUCTION-HANDOFF.md'),'utf8');
  assert.ok(wrapper.includes("from './release-input-contract.mjs'"));
  assert.ok(wrapper.includes('validateReleaseConfig'));
  assert.ok(wrapper.indexOf('validateReleaseConfig')<wrapper.indexOf('run-build-production-candidate.mjs?v1124wrap='));
  assert.ok(handoff.includes('run-validate-release-inputs.mjs'));
  assert.ok(handoff.includes('run-build-production-candidate-v11-24.mjs'));
});
