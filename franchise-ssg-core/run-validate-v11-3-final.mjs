import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// v11.3 supersedes v11.2 manifest/package version markers, so inherit only the
// version-agnostic v11.1 checks and re-run the v11.2 quality assertions below.
await import(`./run-validate-v11-1-final.mjs?v113=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const BASE='/pm-lab/franchise-ssg-preview';
const route='/tools/disclosure-decoder/';
const errors=[];

// v11.2 home quality rules remain required.
const home=await fs.readFile(path.join(out,'index.html'),'utf8');
for(const href of ['/tools/brand-filter/','/areas/'])if(home.includes(`${BASE}${href}`))errors.push(`home still promotes non-production shortcut ${href}`);
if(home.includes('/brands/paris-baguette/'))errors.push('home still features strict-gate-ineligible Paris Baguette');
for(const href of ['/tools/startup-cost/','/tools/monthly-profit-simulator/',route])if(!home.includes(`${BASE}${href}`))errors.push(`home missing production-ready tool ${href}`);

// Expanded franchisor evidence must survive generation and remain first-party only.
const requiredOperatorBrands={
  '메가MGC커피':{slug:'mega-mgc-coffee',host:'frien79plus.cafe24.com'},
  '이디야커피':{slug:'ediya-coffee',host:'www.ediya.com'},
  '교촌치킨':{slug:'kyochon-chicken',host:'www.kyochonfnb.com'},
  '더벤티':{slug:'the-venti',host:'www.theventi.co.kr'},
  'GS25':{slug:'gs25',host:'gs25.gsretail.com'}
};
const operatorCosts=JSON.parse(await fs.readFile(path.join(here,'operator-opening-costs.json'),'utf8'));
for(const [name,meta] of Object.entries(requiredOperatorBrands)){
  const entry=operatorCosts.brands?.[name];
  if(!entry){errors.push(`operator opening cost missing ${name}`);continue}
  if(!entry.sourceUrl?.includes(meta.host))errors.push(`${name}: source must be franchisor domain`);
  if(!Array.isArray(entry.rows)||entry.rows.length<1)errors.push(`${name}: no directly published cost rows`);
  for(const row of entry.rows||[])if(!Number.isFinite(Number(row.totalWon))||Number(row.totalWon)<=0)errors.push(`${name}: invalid published amount`);
  const page=await fs.readFile(path.join(out,'brands',meta.slug,'index.html'),'utf8');
  if(!page.includes('id="official-current-cost"'))errors.push(`${name}: current franchisor cost block missing from detail page`);
  if(!page.includes(entry.sourceUrl))errors.push(`${name}: franchisor source link missing from detail page`);
}

// v11.3 live disclosure decoder.
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
if(Number(report.operatorOpeningCostCoverage)<5)errors.push('operator opening-cost coverage regressed below 5');

const pkg=JSON.parse(await fs.readFile(path.join(here,'package.json'),'utf8'));
if(!String(pkg.scripts?.build||'').includes('run-generate-v11-3-final.mjs'))errors.push('package build does not use v11.3 generator');
if(!String(pkg.scripts?.build||'').includes('run-validate-v11-3-final.mjs'))errors.push('package build does not use v11.3 validator');

if(errors.length){console.error(JSON.stringify({v11_3Validation:'FAIL',errors},null,2));process.exit(1)}
console.log(JSON.stringify({v11_3Validation:'PASS',productionCandidates:report.productionCandidates,productionTools:report.productionTools.length,operatorOpeningCostCoverage:report.operatorOpeningCostCoverage},null,2));
