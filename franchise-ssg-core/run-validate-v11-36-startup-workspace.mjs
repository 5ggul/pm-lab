import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const html=await fs.readFile(path.join(out,'tools/startup-cost/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const app=await fs.readFile(path.join(out,'assets/app.js'),'utf8');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-36-startup-workspace.json'),'utf8'));
const errors=[];
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const mean=xs=>{const a=xs.filter(finite).map(Number);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null};
const near=(a,b,t=1e-7)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=t*Math.max(1,Math.abs(Number(a)),Math.abs(Number(b)));
const count=(re,s)=>[...s.matchAll(re)].length;

if(report.uiVersion!=='11.36'||report.schemaVersion!==1)errors.push('report version');
if(report.productionCandidateCount!==184||(quality.indexPolicy?.productionCandidateUrls||[]).length!==184)errors.push('candidate count');
if(report.trustedBrands!==136||snap.brand_count!==136)errors.push('trusted brand count');
if(!report.policy?.includes('MISSING_NOT_ZERO')||!report.policy?.includes('NO_PRODUCTION_DEPLOY'))errors.push('policy');
if(count(/data-v36-startup="1"/g,html)!==1)errors.push('startup marker');
if(/data-v25-startup="1"|data-v26-startup="1"/.test(html))errors.push('legacy startup listeners still enabled');
if(!/<meta name="robots" content="noindex/.test(html))errors.push('preview noindex');
if(!html.includes('<h2>입력</h2>')||!html.includes('<h2>공식값</h2>')||!html.includes('<h2>파생</h2>'))errors.push('three stages');
if(count(/data-v36-option="1"/g,html)!==136)errors.push(`brand options ${count(/data-v36-option="1"/g,html)}`);
for(const name of ['lease','premium','construction','inventory','working','profit'])if(!new RegExp(`name="${name}"`).test(html))errors.push(`input ${name}`);
for(const key of ['cost','sales','salesPerArea','stores','growth','costMedian'])if(!new RegExp(`data-v36-official="${key}"`).test(html))errors.push(`official ${key}`);
for(const key of ['prep','salesMultiple','meanDelta','recovery'])if(!new RegExp(`data-v36-derived="${key}"`).test(html))errors.push(`derived ${key}`);
if(!html.includes('공개비용 + 입력비용')||!html.includes('준비자금 ÷ 연평균매출 공개값')||!html.includes('월잉여 입력 가정 기준'))errors.push('derived basis labels');
if(/추천 브랜드|안전한 창업|예상 수익/.test(html))errors.push('prohibited advisory copy');
if(!html.includes('평균매출은 순이익이 아닙니다'))errors.push('sales limitation');
if(!html.includes('누락값을 0으로 바꾸지 않습니다'))errors.push('missing value policy copy');

const m=html.match(/<script type="application\/json" data-v36-startdata>([\s\S]*?)<\/script>/);
if(!m)errors.push('v36 data script');
let data={};
try{data=JSON.parse(m?.[1]||'{}')}catch{errors.push('v36 data json')}
if(Object.keys(data).length!==136)errors.push(`data brand count ${Object.keys(data).length}`);
const b=data['mega-mgc-coffee'],src=snap.brands.find(x=>x.slug==='mega-mgc-coffee');
if(!b||!src)errors.push('default mega missing');
else{
  for(const key of ['cost','sales','salesPerArea','stores','growth'])if(!near(b[key],src[key]))errors.push(`mega ${key} ${b[key]}/${src[key]}`);
  const cafe=snap.categories[src.categorySlug];
  const expectedMean=finite(cafe?.cost?.mean)?Number(cafe.cost.mean):mean(snap.brands.filter(x=>x.categorySlug===src.categorySlug).map(x=>x.cost));
  if(!near(b.category.costMean,expectedMean))errors.push(`category mean ${b.category.costMean}/${expectedMean}`);
  if(!near(b.category.costMedian,cafe.cost.median))errors.push('category median');
  const expectedMultiple=src.cost/src.sales,expectedDelta=(src.cost-expectedMean)/expectedMean*100;
  if(!near(report.defaultPrep,src.cost))errors.push('default prep');
  if(!near(report.defaultSalesMultiple,expectedMultiple))errors.push(`default sales multiple ${report.defaultSalesMultiple}/${expectedMultiple}`);
  if(!near(report.defaultMeanDelta,expectedDelta))errors.push(`default mean delta ${report.defaultMeanDelta}/${expectedDelta}`);
  for(const [attr,val] of [['data-v36-default-cost',src.cost],['data-v36-default-sales',src.sales],['data-v36-default-area',src.salesPerArea],['data-v36-default-stores',src.stores],['data-v36-default-growth',src.growth],['data-v36-default-category-mean',expectedMean],['data-v36-default-category-median',cafe.cost.median]]){
    const mm=html.match(new RegExp(`${attr}="([^"]+)"`));if(!mm||!near(mm[1],val))errors.push(`default attr ${attr}`);
  }
  if(!html.includes(`공정위 공개자료 ${src.sourceYear} · ${src.categoryName} 표본 ${cafe.count}개`))errors.push('source line');
}
if(count(/\/\* v11\.36 startup workspace \*\//g,css)!==1||count(/\/\* v11\.36 startup workspace end \*\//g,css)!==1)errors.push('css markers');
if(count(/\/\* v11\.36 startup workspace \*\//g,app)!==1||count(/\/\* v11\.36 startup workspace end \*\//g,app)!==1)errors.push('js markers');
const jsBlock=app.match(/\/\* v11\.36 startup workspace \*\*?\/[\s\S]*?\/\* v11\.36 startup workspace end \*\//)?.[0]||app.match(/\/\* v11\.36 startup workspace \*\/[\s\S]*?\/\* v11\.36 startup workspace end \*\//)?.[0]||'';
if(!jsBlock.includes("searchParams.set('brand'"))errors.push('brand query state');
for(const privateKey of ['lease','premium','construction','inventory','working','profit'])if(jsBlock.includes(`searchParams.set('${privateKey}'`))errors.push(`private input persisted ${privateKey}`);
if(!jsBlock.includes("total/profit")||!jsBlock.includes("total/+b.sales"))errors.push('derived formulas');

if(errors.length){console.error(JSON.stringify({v11_36StartupWorkspaceValidation:'FAIL',errorCount:errors.length,errors},null,2));process.exit(1)}
console.log(JSON.stringify({v11_36StartupWorkspaceValidation:'PASS',productionCandidates:184,trustedBrands:136,brandOptions:136,inputFields:6,officialMetrics:6,derivedMetrics:4,defaultBrand:'mega-mgc-coffee',previewNoindex:true,productionDeployed:false},null,2));
