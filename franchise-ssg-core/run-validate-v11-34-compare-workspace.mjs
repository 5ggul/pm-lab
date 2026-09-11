import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-34-compare-workspace.json'),'utf8'));
const hub=await fs.readFile(path.join(out,'compare/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const js=await fs.readFile(path.join(out,'assets/app.js'),'utf8');
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const brands=snap.brands||[];
const bySlug=new Map(brands.map(b=>[b.slug,b]));
const staticRoutes=candidates.filter(r=>r.startsWith('/compare/')&&r!=='/compare/');
const errors=[];const fail=m=>errors.push(m);
const globalSales=median(brands.map(b=>b.sales));
const globalArea=median(brands.map(b=>finite(b.salesPerArea)&&Number(b.salesPerArea)>0?Number(b.salesPerArea):null));

if(report.uiVersion!=='11.34'||report.schemaVersion!==1)fail('v11.34 report missing or stale');
if(snap.brand_count!==136||report.trustedBrands!==136)fail(`trusted brands ${snap.brand_count}/${report.trustedBrands}`);
if(snap.category_count!==20||report.categoryCount!==20)fail(`category count ${snap.category_count}/${report.categoryCount}`);
if(candidates.length!==184||report.productionCandidateCount!==184||!candidates.includes('/compare/'))fail(`candidate gate ${candidates.length}/${report.productionCandidateCount}`);
if(staticRoutes.length!==7||report.staticComparisons!==7||report.staticWorkspaces!==7)fail(`static compares ${staticRoutes.length}/${report.staticComparisons}/${report.staticWorkspaces}`);
if(report.hubSelectors!==4||report.coreMetrics!==4||report.componentParts!==4||report.benchmarkMetrics!==2||report.diffRows!==9)fail('v11.34 report dimensions invalid');
if(report.staticMetricBars!==56||report.staticRings!==14||report.staticBenchmarkTracks!==28||report.staticDiffRows!==63)fail('v11.34 static totals invalid');
if(Number(report.globalMedians?.sales)!==globalSales||Number(report.globalMedians?.salesPerArea)!==globalArea)fail('v11.34 global medians mismatch');
if(!report.duplicateTwoBrandBuilderRemoved||report.productionDeployed!==false||!report.previewNoindex)fail('v11.34 safety report invalid');
for(const term of ['TRUSTED_SNAPSHOT_ONLY','NO_RECOMMENDATION_SCORE','NO_NEW_ROUTE','NO_QUERY_FANOUT','NO_CANDIDATE_CHANGE','NO_INDEX_CHANGE','NO_PRODUCTION_DEPLOY'])if(!report.policy?.includes(term))fail(`policy missing ${term}`);

if(!/<meta name="robots" content="noindex,nofollow/.test(hub))fail('hub noindex missing');
if(count(hub,'data-v34-workspace="hub"')!==1)fail('hub workspace count');
if(count(hub,'data-v34-pick')!==4)fail(`hub selectors ${count(hub,'data-v34-pick')}/4`);
if(count(hub,'data-v34-bar="')!==8)fail(`hub initial bars ${count(hub,'data-v34-bar="')}/8`);
if(count(hub,'data-v34-ring="')!==2)fail(`hub initial rings ${count(hub,'data-v34-ring="')}/2`);
if(count(hub,'data-v34-benchmark="')!==4)fail(`hub initial benchmarks ${count(hub,'data-v34-benchmark="')}/4`);
if(count(hub,'data-v34-diff="')!==9)fail(`hub initial diff rows ${count(hub,'data-v34-diff="')}/9`);
if(hub.includes('data-v25-multi="1"'))fail('legacy v25 compare workspace still visible');
if(hub.includes('data-v11-22-compare-builder="1"'))fail('duplicate two-brand builder still visible');
for(const h of ['<h2>검증조합</h2>','<h2>기준</h2>','<h2>비교목록</h2>','<h2>주의</h2>','<h2>관련</h2>'])if(!hub.includes(h))fail(`compact hub heading missing ${h}`);
const hubBlock=block(hub,'<!-- v11.34 compare workspace -->','<!-- v11.34 compare workspace end -->');
if(!hubBlock)fail('hub marker block missing');
else if(/추천 브랜드|예상 수익|안전한 창업|베스트/.test(hubBlock))fail('forbidden hub copy');
if(/[?&](sort|metric|category|brand)=/.test(hubBlock||''))fail('hub query fanout');
const dataMatch=hub.match(/<script type="application\/json" data-v34-comparedata>([\s\S]*?)<\/script>/);
if(!dataMatch)fail('hub compare data missing');
else{try{const data=JSON.parse(dataMatch[1]);if(Object.keys(data.brands||{}).length!==136)fail('hub compare brand JSON count');if(Number(data.global?.sales)!==globalSales||Number(data.global?.salesPerArea)!==globalArea)fail('hub compare global JSON mismatch')}catch(e){fail(`hub compare JSON parse ${e.message}`)}}

let checkedBars=0,checkedBenchmarks=0,checkedRings=0;
for(const route of staticRoutes){
  const pair=pairFromRoute(route);if(!pair){fail(`bad pair route ${route}`);continue}
  const expected=pair.map(s=>bySlug.get(s));if(expected.some(b=>!b)){fail(`pair brand missing ${route}`);continue}
  const file=compareFile(route);const html=await fs.readFile(file,'utf8');
  if(!/<meta name="robots" content="noindex,nofollow/.test(html))fail(`static noindex ${route}`);
  if(count(html,'data-v34-workspace="static"')!==1||count(html,'data-v34-static="1"')!==1)fail(`static workspace marker ${route}`);
  if(count(html,'data-v34-bar="')!==8)fail(`static bars ${route} ${count(html,'data-v34-bar="')}/8`);
  if(count(html,'data-v34-ring="')!==2)fail(`static rings ${route} ${count(html,'data-v34-ring="')}/2`);
  if(count(html,'data-v34-benchmark="')!==4)fail(`static benchmarks ${route} ${count(html,'data-v34-benchmark="')}/4`);
  if(count(html,'data-v34-diff="')!==9)fail(`static diff rows ${route} ${count(html,'data-v34-diff="')}/9`);
  if(html.includes('class="answer-box"'))fail(`legacy answer box ${route}`);
  if(html.includes('class="mobile-compare"'))fail(`legacy mobile compare cards ${route}`);
  if(html.includes('공개 창업비용 항목은 어떻게 다른가요?'))fail(`legacy cost question heading ${route}`);
  for(const h of ['<h2>점포추이</h2>','<h2>확인사항</h2>','<h2>관련</h2>'])if(!html.includes(h))fail(`compact static heading missing ${route} ${h}`);
  if(!html.includes('<details class="v34-basis">')||!html.includes('<details class="v34-history">'))fail(`static collapsed basis/history missing ${route}`);
  const visible=block(html,'<!-- v11.34 compare workspace -->','<!-- v11.34 compare workspace end -->')||'';
  if(/추천 브랜드|예상 수익|안전한 창업|베스트/.test(visible))fail(`forbidden static copy ${route}`);
  const bars=parseBars(html);
  for(const row of bars){const b=bySlug.get(row.slug);if(!b){fail(`bar unknown slug ${route} ${row.slug}`);continue}const expectedValue=num(b[row.key]);if(!same(row.value,expectedValue))fail(`bar value ${route} ${row.slug}/${row.key} ${row.value}/${expectedValue}`);checkedBars++}
  const rings=parseRings(html);
  for(const row of rings){const b=bySlug.get(row.slug);if(!b){fail(`ring unknown slug ${route} ${row.slug}`);continue}const total=['franchise','education','deposit','etc'].reduce((s,k)=>s+(num(b.components?.[k])??0),0);if(!same(row.total,total))fail(`ring total ${route} ${row.slug} ${row.total}/${total}`);checkedRings++}
  const tracks=parseBenchmarks(html);
  for(const row of tracks){const b=bySlug.get(row.slug);if(!b){fail(`benchmark unknown slug ${route} ${row.slug}`);continue}const isArea=row.key==='salesPerArea';const value=isArea?num(b.salesPerArea):num(b.sales);const cat=isArea?num(b.category?.salesPerAreaMedian):num(b.category?.salesMedian);const global=isArea?globalArea:globalSales;if(!same(row.value,value)||!same(row.category,cat)||!same(row.global,global))fail(`benchmark values ${route} ${row.slug}/${row.key}`);checkedBenchmarks++}
  const barSlugs=new Set(bars.map(x=>x.slug));for(const b of expected)if(!barSlugs.has(b.slug))fail(`pair bar slug missing ${route} ${b.slug}`);
}
if(checkedBars!==56)fail(`checked bars ${checkedBars}/56`);
if(checkedRings!==14)fail(`checked rings ${checkedRings}/14`);
if(checkedBenchmarks!==28)fail(`checked benchmarks ${checkedBenchmarks}/28`);

if(count(css,'/* v11.34 compare workspace */')!==1||count(css,'/* v11.34 compare workspace end */')!==1)fail('v11.34 CSS marker count');
const cssBlock=block(css,'/* v11.34 compare workspace */','/* v11.34 compare workspace end */')||'';
for(const needle of ['.v34-rings{display:grid','.v34-benchmark-track{position:relative','.v34-bar-track.is-centered:after','@media(max-width:700px)'])if(!cssBlock.includes(needle))fail(`CSS missing ${needle}`);
if(/linear-gradient|radial-gradient/.test(cssBlock))fail('v11.34 gradient found');
if(count(js,'/* v11.34 compare workspace */')!==1||count(js,'/* v11.34 compare workspace end */')!==1)fail('v11.34 JS marker count');
const jsBlock=block(js,'/* v11.34 compare workspace */','/* v11.34 compare workspace end */')||'';
for(const needle of ["[data-v34-workspace=\"hub\"]",'[data-v34-pick]','data-v34-benchmark','data-v34-diff'])if(!jsBlock.includes(needle))fail(`JS missing ${needle}`);
if(/URLSearchParams|history\.pushState|history\.replaceState/.test(jsBlock))fail('v11.34 JS query fanout found');

if(errors.length){console.error(JSON.stringify({v11_34CompareWorkspaceValidation:'FAIL',errorCount:errors.length,errors:errors.slice(0,80)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_34CompareWorkspaceValidation:'PASS',productionCandidates:184,trustedBrands:136,staticComparisons:7,hubSelectors:4,coreMetrics:4,componentParts:4,benchmarkMetrics:2,diffRows:9,checkedStaticBars:checkedBars,checkedStaticRings:checkedRings,checkedStaticBenchmarks:checkedBenchmarks,duplicateTwoBrandBuilder:false,previewNoindex:true,productionDeployed:false},null,2));

function normalizeRoute(r){let s=String(r||'').split(/[?#]/)[0];try{s=decodeURIComponent(s)}catch{}return s==='/'?'/':`/${s.replace(/^\/+|\/+$/g,'')}/`}
function pairFromRoute(route){const base=route.replace(/^\/compare\//,'').replace(/\/$/,'');const [a,b]=base.split('-vs-');return a&&b?[a,b]:null}
function compareFile(route){return path.join(out,...route.split('/').filter(Boolean),'index.html')}
function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function num(v){return finite(v)?Number(v):null}
function median(values){const a=values.filter(finite).map(Number).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function same(a,b){if(a===null||b===null)return a===b;return Math.abs(Number(a)-Number(b))<1e-9}
function count(text,needle){return text.split(needle).length-1}
function block(text,start,end){const a=text.indexOf(start);if(a<0)return null;const b=text.indexOf(end,a);if(b<0)return null;return text.slice(a,b+end.length)}
function parseBars(html){const re=/<div class="v34-bar" data-v34-bar="([^"]+)" data-v34-slug="([^"]+)" data-v34-value="([^"]+)">/g;const rows=[];let m;while((m=re.exec(html)))rows.push({key:m[1],slug:m[2],value:m[3]==='null'?null:Number(m[3])});return rows}
function parseRings(html){const re=/<article class="v34-ring-card" data-v34-ring="([^"]+)" data-v34-total="([^"]+)">/g;const rows=[];let m;while((m=re.exec(html)))rows.push({slug:m[1],total:m[2]==='null'?null:Number(m[2])});return rows}
function parseBenchmarks(html){const re=/<div class="v34-benchmark" data-v34-benchmark="([^"]+)" data-v34-slug="([^"]+)" data-v34-value="([^"]+)" data-v34-category="([^"]+)" data-v34-global="([^"]+)">/g;const rows=[];let m;while((m=re.exec(html)))rows.push({key:m[1],slug:m[2],value:m[3]==='null'?null:Number(m[3]),category:m[4]==='null'?null:Number(m[4]),global:m[5]==='null'?null:Number(m[5])});return rows}
