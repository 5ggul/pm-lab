import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-30-category-metric-table.json'),'utf8'));
const html=await fs.readFile(path.join(out,'rankings/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const errors=[];
const fail=m=>errors.push(m);
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);

if(report.uiVersion!=='11.30'||report.schemaVersion!==1)fail('v11.30 report missing or stale');
if(snap.brand_count!==136||report.trustedBrands!==136)fail(`trusted brand count ${snap.brand_count}/${report.trustedBrands}`);
if(snap.category_count!==20||report.categoryCount!==20)fail(`category count ${snap.category_count}/${report.categoryCount}`);
if(candidates.length!==184||report.productionCandidateCount!==184||!candidates.includes('/rankings/'))fail(`candidate set ${candidates.length}/${report.productionCandidateCount}/${candidates.includes('/rankings/')}`);
if(report.metricCells!==80)fail(`metric cells ${report.metricCells}`);
if(JSON.stringify(report.metrics)!==JSON.stringify(['costMin','storesMax','salesMax','salesPerAreaMax']))fail(`metric list ${JSON.stringify(report.metrics)}`);
if(!report.policy.includes('TRUSTED_SNAPSHOT_EXTREMES_ONLY')||!report.policy.includes('TIES_PRESERVED')||!report.policy.includes('NO_RECOMMENDATION_SCORE')||!report.policy.includes('NO_INDEX_CHANGE')||!report.policy.includes('NO_PRODUCTION_DEPLOY'))fail('v11.30 release guard missing');
if(!report.previewNoindex||!/<meta name="robots" content="noindex,nofollow/.test(html))fail('preview noindex missing');
if(!html.includes('data-v30-category-metrics="1"')||!html.includes('id="category-metrics"'))fail('v11.30 ranking markers missing');
if(!html.includes('<h2>업종지표</h2>'))fail('compact category metric heading missing');
if(!html.includes('비용최저')||!html.includes('가맹점최대')||!html.includes('평균매출최대')||!html.includes('3.3㎡최대'))fail('metric headers missing');
if(/추천 브랜드|베스트|안전한 창업|예상 수익/.test(sectionRange(html,'category-metrics')?.text||''))fail('recommendation-style copy found in v11.30 section');

const categories=Object.values(snap.categories||{}).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko'));
const expected=new Map();
for(const c of categories){
  const brands=snap.brands.filter(b=>b.categorySlug===c.slug);
  if(brands.length!==Number(c.count))fail(`snapshot category count mismatch ${c.slug}: ${brands.length}/${c.count}`);
  expected.set(c.slug,{count:brands.length,cost:extreme(brands,'cost','min'),stores:extreme(brands,'stores','max'),sales:extreme(brands,'sales','max'),area:extreme(brands,'salesPerArea','max',{positiveOnly:true})});
}
if(expected.size!==20)fail(`expected category map ${expected.size}`);

const seen=new Set();
let observedMetricCells=0;
let observedTies=0;
let observedMissing=0;
const rowRe=/<tr data-v30-category="([^"]+)" data-v30-count="(\d+)" data-v30-cost-value="([^"]*)" data-v30-cost-routes="([^"]*)" data-v30-stores-value="([^"]*)" data-v30-stores-routes="([^"]*)" data-v30-sales-value="([^"]*)" data-v30-sales-routes="([^"]*)" data-v30-area-value="([^"]*)" data-v30-area-routes="([^"]*)">/g;
let m;
while((m=rowRe.exec(html))){
  const slug=m[1],count=Number(m[2]),row=expected.get(slug);
  if(!row){fail(`unknown v11.30 category ${slug}`);continue}
  seen.add(slug);
  if(count!==row.count)fail(`${slug} count ${count}/${row.count}`);
  const attrs={cost:[m[3],m[4]],stores:[m[5],m[6]],sales:[m[7],m[8]],area:[m[9],m[10]]};
  for(const key of ['cost','stores','sales','area']){
    observedMetricCells+=1;
    const [valueText,routesText]=attrs[key],exp=row[key];
    const actualValue=valueText===''?null:Number(valueText);
    const actualRoutes=routesText?routesText.split(',').sort():[];
    const expectedRoutes=exp.brands.map(b=>normalizeRoute(b.route)).sort();
    if(exp.value===null){observedMissing+=1;if(actualValue!==null||actualRoutes.length)fail(`${slug} ${key} expected missing`)}
    else if(actualValue!==exp.value)fail(`${slug} ${key} value ${actualValue}/${exp.value}`);
    if(JSON.stringify(actualRoutes)!==JSON.stringify(expectedRoutes))fail(`${slug} ${key} routes ${actualRoutes.join('|')}/${expectedRoutes.join('|')}`);
    if(expectedRoutes.length>1)observedTies+=1;
  }
}
if(seen.size!==20)fail(`v11.30 category rows ${seen.size}/20`);
if(observedMetricCells!==80)fail(`observed metric cells ${observedMetricCells}/80`);
if(report.tiedMetricCells!==observedTies)fail(`tie cells ${report.tiedMetricCells}/${observedTies}`);
if(report.missingMetricCells!==observedMissing)fail(`missing cells ${report.missingMetricCells}/${observedMissing}`);

const section=sectionRange(html,'category-metrics');
if(!section)fail('v11.30 section unreadable');
else {
  if((section.text.match(/data-v30-metric="/g)||[]).length!==80)fail('v11.30 metric cell DOM count is not 80');
  if((section.text.match(/data-v30-category="/g)||[]).length!==20)fail('v11.30 category row DOM count is not 20');
  if(!section.text.includes('<summary>기준</summary>'))fail('v11.30 basis details missing');
}

const jsonMatch=html.match(/<script type="application\/ld\+json" data-v11-ranking-dataset>([\s\S]*?)<\/script>/);
if(!jsonMatch)fail('ranking Dataset JSON-LD missing');
else {
  try{
    const data=JSON.parse(jsonMatch[1]);
    if(data.name!=='프랜차이즈 전체·업종별 공개지표 정렬 데이터')fail('Dataset name not updated');
    const props=Array.isArray(data.variableMeasured)?data.variableMeasured:[];
    const byName=new Map(props.map(x=>[x?.name,x?.value]));
    if(Number(byName.get('업종별 지표 행'))!==20)fail('Dataset category rows missing');
    if(Number(byName.get('업종별 비교 지표'))!==4)fail('Dataset metric count missing');
  }catch(e){fail(`Dataset JSON-LD parse: ${e.message}`)}
}

if(countMarker(css,'/* v11.30 category metric table */')!==1||countMarker(css,'/* v11.30 category metric table end */')!==1)fail('v11.30 CSS block count mismatch');
if(!css.includes('.v30-category-metrics table{min-width:1080px}')||!css.includes('.v30-category-metrics th:first-child,.v30-category-metrics td:first-child{position:sticky'))fail('v11.30 table CSS missing');

if(errors.length){console.error(JSON.stringify({v11_30CategoryMetricTableValidation:'FAIL',errorCount:errors.length,errors:errors.slice(0,40)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_30CategoryMetricTableValidation:'PASS',productionCandidates:184,trustedBrands:136,categories:20,metricCells:80,tiedMetricCells:observedTies,missingMetricCells:observedMissing,previewNoindex:true,productionDeployed:false},null,2));

function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function normalizeRoute(r){return r==='/'?'/':`/${String(r).split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`}
function extreme(rows,key,mode,{positiveOnly=false}={}){const valid=rows.filter(row=>finite(row?.[key])&&(!positiveOnly||Number(row[key])>0));if(!valid.length)return {value:null,brands:[]};const values=valid.map(row=>Number(row[key]));const target=mode==='min'?Math.min(...values):Math.max(...values);return {value:target,brands:valid.filter(row=>Number(row[key])===target).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko'))}}
function sectionRange(raw,id){const at=raw.indexOf(`id="${id}"`);if(at<0)return null;const start=raw.lastIndexOf('<section',at),endAt=raw.indexOf('</section>',at);if(start<0||endAt<0)return null;return {start,end:endAt+10,text:raw.slice(start,endAt+10)}}
function countMarker(text,needle){return text.split(needle).length-1}
