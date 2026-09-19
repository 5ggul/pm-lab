import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {validateReleaseConfig} from './release-input-contract.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const TEST_MODE=String(process.env.SSG_RELEASE_TEST_MODE||'').toLowerCase()==='true';

if(!TEST_MODE){
  const raw=String(process.env.SSG_RELEASE_CONFIG||'').trim();
  if(!raw){
    console.error(JSON.stringify({releaseCandidatePreflight:'BLOCKED',reason:'SSG_RELEASE_CONFIG_REQUIRED'},null,2));
    process.exit(2);
  }
  const configPath=path.isAbsolute(raw)?raw:path.resolve(repo,raw);
  let config=null;
  try{config=JSON.parse(await fs.readFile(configPath,'utf8'))}catch(error){
    console.error(JSON.stringify({releaseCandidatePreflight:'BLOCKED',reason:'RELEASE_CONFIG_READ_OR_JSON_FAILED',error:error.message},null,2));
    process.exit(2);
  }
  const inputValidation=await validateReleaseConfig(config,{repoRoot:repo});
  if(!inputValidation.ready){
    console.error(JSON.stringify({releaseCandidatePreflight:'BLOCKED',blockers:inputValidation.blockers,warnings:inputValidation.warnings},null,2));
    process.exit(2);
  }
  console.log(JSON.stringify({releaseCandidatePreflight:'PASS',productionOrigin:inputValidation.productionSite.value,legal:{privacy:inputValidation.legal.privacy.final,terms:inputValidation.legal.terms.final},adsConfigured:inputValidation.ads.configured},null,2));
}

await import(`./run-build-production-candidate.mjs?v1124wrap=${Date.now()}`);

const defaultOutput=TEST_MODE?path.join(os.tmpdir(),'franchise-production-candidate-contract'):path.join(repo,'build/franchise-production-candidate');
const output=path.resolve(process.env.SSG_PRODUCTION_OUTPUT||defaultOutput);
const contactFile=path.join(output,'contact/index.html');

let html=await fs.readFile(contactFile,'utf8');
const marker='data-production-v11-24-contact="1"';
if(!html.includes(marker)){
  const guidance=`<div ${marker}><h2>오류 제보에 포함하면 좋은 정보</h2><p>확인한 페이지 또는 브랜드명, 문제가 의심되는 지표와 표시값, 해당 값의 기준년도, 확인 가능한 원문 출처를 함께 알려주면 같은 레코드를 빠르게 대조할 수 있습니다. 같은 이름의 브랜드가 여럿이면 정보공개서상의 영업표지나 가맹본부명도 구분에 도움이 됩니다.</p><h2>문의 범위</h2><p>공개자료의 출처·정규화·명칭 매칭·계산식과 사이트 표시 오류를 확인하는 용도입니다. 개별 점포의 수익 보장, 특정 브랜드 추천, 계약 또는 법률 판단을 대신하지 않으며 실제 계약 조건은 최신 정보공개서와 가맹본부 자료에서 확인해야 합니다.</p></div>`;
  if(!html.includes('<h2>연락처</h2>'))throw new Error('Production contact template no longer contains the expected contact heading');
  html=html.replace('<h2>연락처</h2>',`${guidance}<h2>연락처</h2>`);
  await fs.writeFile(contactFile,html,'utf8');
}

console.log(JSON.stringify({productionV11_24ContactPolish:'PASS',testMode:TEST_MODE,output,contactGuidancePreserved:true},null,2));
