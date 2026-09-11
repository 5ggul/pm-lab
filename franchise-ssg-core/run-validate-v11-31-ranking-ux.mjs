import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const v30=JSON.parse(await fs.readFile(path.join(out,'v11-30-category-metric-table.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-31-ranking-ux.json'),'utf8'));
const html=await fs.readFile(path.join(out,'rankings/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const errors=[];
const fail=m=>errors.push(m);
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);

if(report.uiVersion!=='11.31'||report.schemaVersion!==1)fail('v11.31 report missing or stale');
if(snap.brand_count!==136||report.trustedBrands!==136)fail(`trusted brand count ${snap.brand_count}/${report.trustedBrands}`);
if(snap.category_count!==20||report.categoryCount!==20)fail(`category count ${snap.category_count}/${report.categoryCount}`);
if(v30.uiVersion!=='11.30'||v30.metricCells!==80||report.metricCells!==80)fail(`v11.30 handoff ${v30.uiVersion}/${v30.metricCells}/${report.metricCells}`);
if(candidates.length!==184||report.productionCandidateCount!==184||!candidates.includes('/rankings/'))fail(`candidate set ${candidates.length}/${report.productionCandidateCount}/${candidates.includes('/rankings/')}`);
if(!report.previewNoindex||!/<meta name="robots" content="noindex,nofollow/.test(html))fail('preview noindex missing');
if(!report.clientSideSortOnly||!report.mobileStickyHeader||report.mobileTableMaxHeight!=='68vh')fail('v11.31 interaction flags missing');
if(JSON.stringify(report.metricSortKeys)!==JSON.stringify(['cost','stores','sales','area']))fail(`metric sort keys ${JSON.stringify(report.metricSortKeys)}`);
if(JSON.stringify(report.auxiliarySortKeys)!==JSON.stringify(['category','count']))fail(`aux sort keys ${JSON.stringify(report.auxiliarySortKeys)}`);
if(report.defaultSort!=='category:asc')fail(`default sort ${report.defaultSort}`);
if(!report.policy.includes('CLIENT_SIDE_SORT_ONLY')||!report.policy.includes('NO_QUERY_FANOUT')||!report.policy.includes('MOBILE_STICKY_TABLE')||!report.policy.includes('NO_CANDIDATE_CHANGE')||!report.policy.includes('NO_INDEX_CHANGE')||!report.policy.includes('NO_PRODUCTION_DEPLOY'))fail('v11.31 release guard missing');

const navTargets=['category-metrics','per-area-ranking','cost-ranking','store-ranking','sales-ranking'];
if(JSON.stringify(report.navigationTargets)!==JSON.stringify(navTargets))fail(`navigation target report ${JSON.stringify(report.navigationTargets)}`);
if(countMarker(html,'<!-- v11.31 ranking nav -->')!==1||countMarker(html,'<!-- v11.31 ranking nav end -->')!==1)fail('v11.31 nav marker count mismatch');
if(!html.includes('data-v31-ranking-nav="1"'))fail('v11.31 nav marker missing');
for(const id of navTargets){
  if(!html.includes(`href="#${id}"`))fail(`nav link missing ${id}`);
  if(!html.includes(`id="${id}"`))fail(`nav target missing ${id}`);
}
const navBlock=between(html,'<!-- v11.31 ranking nav -->','<!-- v11.31 ranking nav end -->');
if(!navBlock)fail('v11.31 nav unreadable');
else if(/\?[^"']*(sort|metric|ranking)=/i.test(navBlock))fail('query fanout found in v11.31 nav');

const section=sectionRange(html,'category-metrics');
if(!section)fail('category metrics section unreadable');
else {
  if(!section.text.includes('data-v31-category-sort="1"')||!section.text.includes('data-v31-sort-table="1"'))fail('sortable table markers missing');
  if((section.text.match(/data-v30-category="/g)||[]).length!==20)fail('category row count changed from 20');
  if((section.text.match(/data-v30-metric="/g)||[]).length!==80)fail('metric cell count changed from 80');
  const keys=[...section.text.matchAll(/data-v31-sort="([^"]+)"/g)].map(m=>m[1]);
  if(JSON.stringify(keys)!==JSON.stringify(['category','count','cost','stores','sales','area']))fail(`sort controls ${JSON.stringify(keys)}`);
  if((section.text.match(/aria-sort="ascending"/g)||[]).length!==1)fail('initial aria-sort state must be unique');
  if(!section.text.includes('data-v31-head="category" aria-sort="ascending"'))fail('default category ascending header missing');
}

if(countMarker(html,'<!-- v11.31 rankings interaction -->')!==1||countMarker(html,'<!-- v11.31 rankings interaction end -->')!==1)fail('v11.31 script marker count mismatch');
const script=between(html,'<!-- v11.31 rankings interaction -->','<!-- v11.31 rankings interaction end -->');
if(!script)fail('v11.31 script unreadable');
else {
  for(const token of ['data-v31-ranking-sort','Intl.Collator','DocumentFragment','data-v31-sort','activeKey','activeDir'])if(!script.includes(token))fail(`v11.31 sort script token missing: ${token}`);
  if(/history\.|location\.search|URLSearchParams/.test(script))fail('v11.31 sort script must not mutate URL state');
}

if(countMarker(css,'/* v11.31 rankings interaction */')!==1||countMarker(css,'/* v11.31 rankings interaction end */')!==1)fail('v11.31 CSS marker count mismatch');
for(const token of ['.v31-ranking-nav{','max-height:68vh','overflow:auto','position:sticky;top:0'])if(!css.includes(token))fail(`v11.31 CSS token missing: ${token}`);
if(!css.includes('.v31-sort-table thead th{position:sticky;top:0;z-index:4'))fail('mobile sticky header CSS missing');
if(!css.includes('.v31-sort-table thead th:first-child{left:0;z-index:6'))fail('sticky corner cell CSS missing');

const categories=Object.values(snap.categories||{}).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko'));
const expected=new Map();
for(const c of categories){
  const brands=snap.brands.filter(b=>b.categorySlug===c.slug);
  expected.set(c.slug,{count:brands.length,cost:extreme(brands,'cost','min'),stores:extreme(brands,'stores','max'),sales:extreme(brands,'sales','max'),area:extreme(brands,'salesPerArea','max',{positiveOnly:true})});
}
const rowRe=/<tr data-v30-category="([^"]+)" data-v30-count="(\d+)" data-v30-cost-value="([^"]*)" data-v30-cost-routes="([^"]*)" data-v30-stores-value="([^"]*)" data-v30-stores-routes="([^"]*)" data-v30-sales-value="([^"]*)" data-v30-sales-routes="([^"]*)" data-v30-area-value="([^"]*)" data-v30-area-routes="([^"]*)">/g;
const seen=new Set();let m;
while((m=rowRe.exec(html))){
  const slug=m[1],exp=expected.get(slug);if(!exp){fail(`unknown category ${slug}`);continue}seen.add(slug);
  if(Number(m[2])!==exp.count)fail(`${slug} count changed ${m[2]}/${exp.count}`);
  const attrs={cost:[m[3],m[4]],stores:[m[5],m[6]],sales:[m[7],m[8]],area:[m[9],m[10]]};
  for(const key of ['cost','stores','sales','area']){
    const [valueText,routesText]=attrs[key],want=exp[key];
    const actualValue=valueText===''?null:Number(valueText);
    const actualRoutes=routesText?routesText.split(',').sort():[];
    const expectedRoutes=want.brands.map(b=>normalizeRoute(b.route)).sort();
    if(want.value===null){if(actualValue!==null||actualRoutes.length)fail(`${slug} ${key} missing value changed`)}
    else if(actualValue!==want.value)fail(`${slug} ${key} value changed ${actualValue}/${want.value}`);
    if(JSON.stringify(actualRoutes)!==JSON.stringify(expectedRoutes))fail(`${slug} ${key} routes changed`);
  }
}
if(seen.size!==20)fail(`validated category rows ${seen.size}/20`);

if(errors.length){console.error(JSON.stringify({v11_31RankingUxValidation:'FAIL',errorCount:errors.length,errors:errors.slice(0,50)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_31RankingUxValidation:'PASS',productionCandidates:184,trustedBrands:136,categories:20,metricCells:80,navigationTargets:5,sortControls:6,clientSideSortOnly:true,mobileStickyHeader:true,previewNoindex:true,productionDeployed:false},null,2));

function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function normalizeRoute(r){return r==='/'?'/':`/${String(r).split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`}
function extreme(rows,key,mode,{positiveOnly=false}={}){const valid=rows.filter(row=>finite(row?.[key])&&(!positiveOnly||Number(row[key])>0));if(!valid.length)return {value:null,brands:[]};const values=valid.map(row=>Number(row[key]));const target=mode==='min'?Math.min(...values):Math.max(...values);return {value:target,brands:valid.filter(row=>Number(row[key])===target).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko'))}}
function sectionRange(raw,id){const at=raw.indexOf(`id="${id}"`);if(at<0)return null;const start=raw.lastIndexOf('<section',at),endAt=raw.indexOf('</section>',at);if(start<0||endAt<0)return null;return {start,end:endAt+10,text:raw.slice(start,endAt+10)}}
function countMarker(text,needle){return text.split(needle).length-1}
function between(text,start,end){const a=text.indexOf(start),b=text.indexOf(end);return a>=0&&b>a?text.slice(a,b+end.length):null}
