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
// These are not replacements for FTC disclosure values. They are a separate current
// franchisor-publication layer and must carry their own date, basis and VAT metadata.
const requiredOperatorBrands={
  '메가MGC커피':{slug:'mega-mgc-coffee',host:'frien79plus.cafe24.com',rows:1},
  '빽다방':{slug:'paiks-coffee',host:'start.theborn.co.kr',rows:1,amounts:[65530000]},
  '이디야커피':{slug:'ediya-coffee',host:'www.ediya.com',rows:2},
  '교촌치킨':{slug:'kyochon-chicken',host:'www.kyochonfnb.com',rows:5},
  '굽네치킨':{slug:'goobne-chicken',host:'www.goobne.co.kr',rows:2,amounts:[0,29700000]},
  '더벤티':{slug:'the-venti',host:'www.theventi.co.kr',rows:2},
  '한솥':{slug:'hansot',host:'franchise.hsd.co.kr',rows:1,amounts:[85960000]},
  '프랭크버거':{slug:'frank-burger',host:'frankburger.co.kr',rows:1,amounts:[18000000]},
  '설빙':{slug:'sulbing',host:'sulbing.com',rows:2,amounts:[18000000,185200000]},
  'CU':{slug:'cu',host:'cuopen.bgfretail.com',rows:4,amounts:[22000000,22000000,22000000,22000000]},
  'GS25':{slug:'gs25',host:'gs25.gsretail.com',rows:4},
  '이마트24':{slug:'이마트24',host:'emart24.co.kr',rows:1,amounts:[24200000]}
};
const operatorCosts=JSON.parse(await fs.readFile(path.join(here,'operator-opening-costs.json'),'utf8'));
if(operatorCosts.policy!=="Only values directly visible on the franchisor's own public pages are included. Missing brands are omitted rather than estimated.")errors.push('operator opening-cost first-party/no-estimate policy changed');
if(!/^\d{4}-\d{2}-\d{2}$/.test(String(operatorCosts.generatedAt||'')))errors.push('operator opening-cost generatedAt missing');
const generatedMs=Date.parse(`${operatorCosts.generatedAt}T00:00:00Z`);
if(!Number.isFinite(generatedMs))errors.push('operator opening-cost generatedAt invalid');
for(const [name,meta] of Object.entries(requiredOperatorBrands)){
  const entry=operatorCosts.brands?.[name];
  if(!entry){errors.push(`operator opening cost missing ${name}`);continue}
  let url=null;try{url=new URL(entry.sourceUrl)}catch{}
  if(!url||url.protocol!=='https:'||url.hostname!==meta.host)errors.push(`${name}: source must be exact franchisor HTTPS domain`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.checkedOn||'')))errors.push(`${name}: checkedOn missing or invalid`);
  const checkedMs=Date.parse(`${entry.checkedOn}T00:00:00Z`);
  const ageDays=(generatedMs-checkedMs)/86400000;
  if(!Number.isFinite(checkedMs)||ageDays<0||ageDays>45)errors.push(`${name}: source check is outside 45-day freshness gate`);
  if(!Array.isArray(entry.rows)||entry.rows.length!==meta.rows)errors.push(`${name}: expected ${meta.rows} directly published cost rows`);
  for(const row of entry.rows||[]){
    const amount=Number(row.totalWon);
    const explicitZero=amount===0&&row.amountSemantics==='published_zero';
    if(!Number.isFinite(amount)||amount<0||(amount===0&&!explicitZero))errors.push(`${name}: invalid published amount semantics`);
    if(row.amountSemantics&&row.amountSemantics!=='published_zero')errors.push(`${name}: unsupported amount semantics ${row.amountSemantics}`);
    if(!String(row.label||'').trim()||!String(row.basis||'').trim()||!String(row.vat||'').trim())errors.push(`${name}: row label/basis/VAT metadata incomplete`);
  }
  if(meta.amounts&&JSON.stringify((entry.rows||[]).map(x=>Number(x.totalWon)))!==JSON.stringify(meta.amounts))errors.push(`${name}: verified published amount changed`);
  if(!Array.isArray(entry.excluded)||entry.excluded.length<1||entry.excluded.some(x=>!String(x||'').trim()))errors.push(`${name}: separate/excluded cost notes missing`);
  const page=await fs.readFile(path.join(out,'brands',meta.slug,'index.html'),'utf8');
  if(!page.includes('id="official-current-cost"'))errors.push(`${name}: current franchisor cost block missing from detail page`);
  if(!page.includes(entry.sourceUrl))errors.push(`${name}: franchisor source link missing from detail page`);
  if(!page.includes(`확인일 ${entry.checkedOn}`))errors.push(`${name}: checkedOn not visible on detail page`);
  for(const row of entry.rows||[])if(!page.includes(`${Math.round(Number(row.totalWon)).toLocaleString('ko-KR')}원`))errors.push(`${name}: published amount not visible on detail page`);
}
if(Object.keys(operatorCosts.brands||{}).length!==12)errors.push(`operator opening-cost evidence expected 12 brands, got ${Object.keys(operatorCosts.brands||{}).length}`);
if(!operatorCosts.brands?.['굽네치킨']?.excluded?.some(x=>x.includes('3,310만원')&&x.includes('2,970만원')))errors.push('goobne official subtotal inconsistency caveat missing');
if(operatorCosts.brands?.['굽네치킨']?.rows?.[0]?.amountSemantics!=='published_zero')errors.push('goobne explicit zero semantics missing');
if(!operatorCosts.brands?.['프랭크버거']?.excluded?.some(x=>x.includes('2023년 2월 8일')))errors.push('frank burger source-vintage caveat missing');

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
if(Number(report.operatorOpeningCostCoverage)!==12)errors.push(`operator opening-cost coverage expected 12, got ${report.operatorOpeningCostCoverage}`);

const pkg=JSON.parse(await fs.readFile(path.join(here,'package.json'),'utf8'));
if(!String(pkg.scripts?.build||'').includes('run-generate-v11-3-final.mjs'))errors.push('package build does not use v11.3 generator');
if(!String(pkg.scripts?.build||'').includes('run-validate-v11-3-final.mjs'))errors.push('package build does not use v11.3 validator');

if(errors.length){console.error(JSON.stringify({v11_3Validation:'FAIL',errors},null,2));process.exit(1)}
console.log(JSON.stringify({v11_3Validation:'PASS',productionCandidates:report.productionCandidates,productionTools:report.productionTools.length,operatorOpeningCostCoverage:report.operatorOpeningCostCoverage,operatorFreshnessGateDays:45,explicitPublishedZero:true},null,2));
