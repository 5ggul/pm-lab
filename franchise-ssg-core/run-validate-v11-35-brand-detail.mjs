import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-35-brand-detail.json'),'utf8'));
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(norm);
const errors=[];const fail=m=>errors.push(m);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const same=(a,b)=>a===null||b===null?a===b:Math.abs(Number(a)-Number(b))<1e-6;
const dataNum=v=>finite(v)?Number(v):null;

if(report.schemaVersion!==1||report.uiVersion!=='11.35')fail('report version');
if(snap.brand_count!==136||report.trustedBrands!==136)fail(`trusted ${snap.brand_count}/${report.trustedBrands}`);
if(snap.category_count!==20||report.categoryCount!==20)fail(`categories ${snap.category_count}/${report.categoryCount}`);
if(candidates.length!==184||report.productionCandidateCount!==184)fail(`candidates ${candidates.length}/${report.productionCandidateCount}`);
if(report.brandPages!==136||report.coreKpisPerBrand!==5||report.componentsPerBrand!==4||report.benchmarksPerBrand!==4||report.benchmarkTracks!==544)fail('report dimensions');
if(!report.previewNoindex||report.productionDeployed!==false)fail('safety report');
for(const term of ['TRUSTED_SNAPSHOT_ONLY','RAW_ZERO_RETAINED','POSITIVE_ONLY_AREA_BENCHMARK','NO_RECOMMENDATION_SCORE','NO_NEW_ROUTE','NO_CANDIDATE_CHANGE','NO_INDEX_CHANGE','NO_PRODUCTION_DEPLOY'])if(!report.policy?.includes(term))fail(`policy ${term}`);

let pages=0,kpis=0,components=0,benchmarks=0,historyCards=0,sourceSections=0,operatorSections=0,zeroAreaBrands=0;
for(const b of snap.brands){
  const file=path.join(out,...String(b.route).split('/').filter(Boolean),'index.html');
  const html=await fs.readFile(file,'utf8');pages++;
  if(!/<meta name="robots" content="noindex,nofollow/.test(html))fail(`noindex ${b.slug}`);
  if(count(html,`data-v35-brand="${b.slug}"`)!==1)fail(`workspace ${b.slug}`);
  if(count(html,'<!-- v11.35 brand workspace -->')!==1||count(html,'<!-- v11.35 brand workspace end -->')!==1)fail(`markers ${b.slug}`);
  if(!html.includes('v35-brand-detail'))fail(`body class ${b.slug}`);
  for(const id of ['cost','benchmark','stores','raw-data'])if(count(html,`id="${id}"`)!==1)fail(`id ${b.slug}/${id}`);
  if(/<section class="block" id="(?:cost|stores|benchmark)"/.test(html)||/<section class="block brand-position" id="position"/.test(html))fail(`legacy core section ${b.slug}`);
  for(const old of ['class="v25-brandtop"','class="v26-brand-area"','class="v25-brandgrid"'])if(html.includes(old))fail(`legacy ${b.slug} ${old}`);
  if(/추천 브랜드|종합점수|추천점수|예상 수익/.test(block(html,'<!-- v11.35 brand workspace -->','<!-- v11.35 brand workspace end -->')||''))fail(`forbidden copy ${b.slug}`);

  const ks=parseKpis(html);if(ks.length!==5)fail(`kpis ${b.slug} ${ks.length}`);kpis+=ks.length;
  const expectedK={cost:b.cost,stores:b.stores,sales:b.sales,salesPerArea:b.salesPerArea,growth:b.growth};
  for(const row of ks)if(!same(row.value,dataNum(expectedK[row.key])))fail(`kpi ${b.slug}/${row.key} ${row.value}/${expectedK[row.key]}`);

  const cs=parseComponents(html);if(cs.length!==4)fail(`components ${b.slug} ${cs.length}`);components+=cs.length;
  for(const row of cs){const expected=dataNum(b.components?.[row.key]);if(!same(row.value,expected))fail(`component ${b.slug}/${row.key} ${row.value}/${expected}`)}

  const c=snap.categories?.[b.categorySlug];if(!c){fail(`category missing ${b.slug}`);continue}
  const bs=parseBenchmarks(html);if(bs.length!==4)fail(`benchmarks ${b.slug} ${bs.length}`);benchmarks+=bs.length;
  const defs={cost:[b.cost,c.cost,false],stores:[b.stores,c.stores,false],sales:[b.sales,c.sales,false],salesPerArea:[b.salesPerArea,c.salesPerArea,true]};
  for(const row of bs){const d=defs[row.key];if(!d){fail(`benchmark key ${b.slug}/${row.key}`);continue}const [value,m,positiveOnly]=d;for(const [name,actual,expected] of [['value',row.value,dataNum(value)],['p25',row.p25,dataNum(m?.p25)],['median',row.median,dataNum(m?.median)],['p75',row.p75,dataNum(m?.p75)],['min',row.min,dataNum(m?.min)],['max',row.max,dataNum(m?.max)]])if(!same(actual,expected))fail(`benchmark ${b.slug}/${row.key}/${name} ${actual}/${expected}`);const eligible=(positiveOnly?positive(value):finite(value))&&m&&finite(m.min)&&finite(m.max)&&Number(m.max)>Number(m.min);if(row.eligible!==(eligible?1:0))fail(`eligible ${b.slug}/${row.key} ${row.eligible}/${eligible?1:0}`)}
  if(finite(b.salesPerArea)&&!positive(b.salesPerArea)){zeroAreaBrands++;const area=bs.find(x=>x.key==='salesPerArea');if(!area||area.value!==0||area.eligible!==0||!html.includes('공개값 0 · 양수 분포 계산에서 제외'))fail(`raw zero area ${b.slug}`)}

  const hs=parseHistory(html),expectedH=(b.history||[]).filter(x=>finite(x.year)&&finite(x.stores)).slice(-3);if(hs.length!==expectedH.length)fail(`history count ${b.slug} ${hs.length}/${expectedH.length}`);historyCards+=hs.length;
  for(let i=0;i<Math.min(hs.length,expectedH.length);i++){const a=hs[i],e=expectedH[i];if(a.year!==Number(e.year)||!same(a.stores,dataNum(e.stores))||!same(a.newStores,dataNum(e.newStores))||!same(a.end,dataNum(e.contractEnd))||!same(a.cancel,dataNum(e.contractCancel)))fail(`history ${b.slug}/${e.year}`)}

  if(count(html,'id="source"')===1)sourceSections++;else fail(`source ${b.slug}`);
  if(count(html,'id="official-current-cost"')===1)operatorSections++;
  for(const href of ['#answer','#cost','#benchmark','#stores','#raw-data','#source'])if(!html.includes(`href="${href}"`))fail(`toc ${b.slug}/${href}`);
}
if(pages!==136||kpis!==680||components!==544||benchmarks!==544)fail(`aggregate ${pages}/${kpis}/${components}/${benchmarks}`);
if(historyCards!==report.historyCards)fail(`history aggregate ${historyCards}/${report.historyCards}`);
if(zeroAreaBrands!==report.zeroAreaBrands)fail(`zero area aggregate ${zeroAreaBrands}/${report.zeroAreaBrands}`);
if(sourceSections!==136||report.sourceSectionsPreserved!==136)fail(`sources ${sourceSections}/${report.sourceSectionsPreserved}`);
if(operatorSections!==report.operatorCostPreserved)fail(`operator preserved ${operatorSections}/${report.operatorCostPreserved}`);
if(report.removedLegacySections!==136*4)fail(`legacy removal ${report.removedLegacySections}/544`);

if(count(css,'/* v11.35 brand detail */')!==1||count(css,'/* v11.35 brand detail end */')!==1)fail('css markers');
const cssBlock=block(css,'/* v11.35 brand detail */','/* v11.35 brand detail end */')||'';
for(const needle of ['.v35-kpis{display:grid','.v35-benchmarks{display:grid','.v35-track{height:18px;position:relative','.v35-year-list{display:grid','.v35-raw-grid{display:grid','@media(max-width:760px)'])if(!cssBlock.includes(needle))fail(`css ${needle}`);
if(/linear-gradient|radial-gradient|box-shadow/.test(cssBlock))fail('decorative gradient/shadow');

if(errors.length){console.error(JSON.stringify({v11_35BrandDetailValidation:'FAIL',errorCount:errors.length,errors:errors.slice(0,100)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_35BrandDetailValidation:'PASS',productionCandidates:184,trustedBrands:136,brandPages:pages,kpis,components,benchmarks,historyCards,zeroAreaBrands,operatorSections,sourceSections,previewNoindex:true,productionDeployed:false},null,2));

function norm(r){let s=String(r||'').split(/[?#]/)[0];try{s=decodeURIComponent(s)}catch{}return s==='/'?'/':`/${s.replace(/^\/+|\/+$/g,'')}/`}
function count(text,needle){return text.split(needle).length-1}
function block(text,start,end){const a=text.indexOf(start);if(a<0)return null;const b=text.indexOf(end,a);if(b<0)return null;return text.slice(a,b+end.length)}
function parseKpis(html){const re=/<div data-v35-kpi="([^"]+)" data-v35-value="([^"]+)">/g;const out=[];let m;while((m=re.exec(html)))out.push({key:m[1],value:m[2]==='null'?null:Number(m[2])});return out}
function parseComponents(html){const re=/<div class="v35-comp-row" data-v35-component="([^"]+)" data-v35-value="([^"]+)" data-v35-share="([^"]+)">/g;const out=[];let m;while((m=re.exec(html)))out.push({key:m[1],value:m[2]==='null'?null:Number(m[2]),share:m[3]==='null'?null:Number(m[3])});return out}
function parseBenchmarks(html){const re=/<div class="v35-benchmark" data-v35-benchmark="([^"]+)" data-v35-value="([^"]+)" data-v35-p25="([^"]+)" data-v35-median="([^"]+)" data-v35-p75="([^"]+)" data-v35-min="([^"]+)" data-v35-max="([^"]+)" data-v35-eligible="([01])">/g;const out=[];let m;while((m=re.exec(html)))out.push({key:m[1],value:val(m[2]),p25:val(m[3]),median:val(m[4]),p75:val(m[5]),min:val(m[6]),max:val(m[7]),eligible:Number(m[8])});return out}
function parseHistory(html){const re=/<div class="v35-year" data-v35-year="([^"]+)" data-v35-stores="([^"]+)" data-v35-new="([^"]+)" data-v35-end="([^"]+)" data-v35-cancel="([^"]+)">/g;const out=[];let m;while((m=re.exec(html)))out.push({year:Number(m[1]),stores:val(m[2]),newStores:val(m[3]),end:val(m[4]),cancel:val(m[5])});return out}
function val(v){return v==='null'?null:Number(v)}
