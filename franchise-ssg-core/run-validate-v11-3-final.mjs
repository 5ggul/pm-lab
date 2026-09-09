import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-validate-v11-2-final.mjs?v113=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const BASE='/pm-lab/franchise-ssg-preview';
const route='/tools/disclosure-decoder/';
const errors=[];

const decoder=await fs.readFile(path.join(out,'tools/disclosure-decoder/index.html'),'utf8');
for(const marker of ['data-v11-tool="disclosure-decoder"','data-tool="disclosure-decoder"','name="franchise"','name="education"','name="deposit"','name="etc"','name="interior"','data-total','data-largest','data-reset'])if(!decoder.includes(marker))errors.push(`decoder missing ${marker}`);
if(decoder.includes('이 프리뷰에서는 계산 구조와 검색용 문서를 먼저 검수합니다'))errors.push('decoder still contains preview-only implementation copy');
if(!decoder.includes('입력 합계 = 가맹비 + 교육비 + 보증금 + 기타비용 + 인테리어 입력액'))errors.push('decoder formula not updated');
if(!decoder.includes('입력값은 브라우저 안에서만 계산'))errors.push('decoder client-only data handling notice missing');
if(PREVIEW&&!decoder.includes('noindex,nofollow,noarchive,nosnippet'))errors.push('preview decoder must remain noindex');

for(const rel of ['index.html','tools/index.html']){
  const html=await fs.readFile(path.join(out,rel),'utf8');
  if(!html.includes(`${BASE}${route}`))errors.push(`${rel}: disclosure decoder link missing`);
}

const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
if(String(manifest.uiVersion)!=='11.3')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(!manifest.v11_3?.liveDisclosureDecoder)errors.push('manifest liveDisclosureDecoder missing');
if(!(manifest.indexPolicy?.productionCandidateUrls||[]).includes(route))errors.push('manifest production candidates missing disclosure decoder');

const report=JSON.parse(await fs.readFile(path.join(out,'v11-3-quality-report.json'),'utf8'));
if(report.uiVersion!=='11.3')errors.push('v11.3 quality report missing/wrong');
if((report.productionTools||[]).length!==3)errors.push(`expected 3 production tools, got ${(report.productionTools||[]).length}`);
if(!report.disclosureDecoder?.live||!report.disclosureDecoder?.clientOnly)errors.push('decoder live/client-only report flags missing');
if(Number(report.operatorOpeningCostCoverage)<4)errors.push('operator opening-cost coverage regressed below 4');

const pkg=JSON.parse(await fs.readFile(path.join(here,'package.json'),'utf8'));
if(!String(pkg.scripts?.build||'').includes('run-generate-v11-3-final.mjs'))errors.push('package build does not use v11.3 generator');
if(!String(pkg.scripts?.build||'').includes('run-validate-v11-3-final.mjs'))errors.push('package build does not use v11.3 validator');

if(errors.length){console.error(JSON.stringify({v11_3Validation:'FAIL',errors},null,2));process.exit(1)}
console.log(JSON.stringify({v11_3Validation:'PASS',productionCandidates:report.productionCandidates,productionTools:report.productionTools.length,operatorOpeningCostCoverage:report.operatorOpeningCostCoverage},null,2));
