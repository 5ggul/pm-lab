import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const v31=JSON.parse(await fs.readFile(path.join(out,'v11-31-ranking-ux.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-32-category-rankings.json'),'utf8'));
const html=await fs.readFile(path.join(out,'rankings/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const errors=[];
const fail=m=>errors.push(m);
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);

if(report.uiVersion!=='11.32'||report.schemaVersion!==1)fail('v11.32 report missing or stale');
if(snap.brand_count!==136||report.trustedBrands!==136)fail(`trusted brand count ${snap.brand_count}/${report.trustedBrands}`);
if(snap.category_count!==20||report.categoryCount!==20)fail(`category count ${snap.category_count}/${report.categoryCount}`);
if(candidates.length!==184||report.productionCandidateCount!==184||!candidates.includes('/rankings/'))fail(`candidate set ${candidates.length}/${report.productionCandidateCount}/${candidates.includes('/rankings/')}`);
if(report.visibleTopRows!==5||report.visibleRankingRows!==20)fail(`visible ranking rows ${report.visibleTopRows}/${report.visibleRankingRows}`);
if(report.faqCount!==4)fail(`FAQ count ${report.faqCount}`);
if(JSON.stringify(report.rankingMetrics)!==JSON.stringify(['costMedianAsc','storesMedianDesc','salesMedianDesc','salesPerAreaMedianDesc']))fail(`metric list ${JSON.stringify(report.rankingMetrics)}`);
if(JSON.stringify(report.navigationTargets)!==JSON.stringify(['category-leaders','category-metrics','per-area-ranking','cost-ranking','store-ranking','sales-ranking']))fail(`navigation targets ${JSON.stringify(report.navigationTargets)}`);
if(!report.policy.includes('CATEGORY_MEDIANS_ONLY')||!report.policy.includes('NO_NEW_ROUTE')||!report.policy.includes('NO_CANDIDATE_CHANGE')||!report.policy.includes('NO_INDEX_CHANGE')||!report.policy.includes('NO_PRODUCTION_DEPLOY'))fail('v11.32 release guard missing');
if(!report.previewNoindex||!/<meta name="robots" content="noindex,nofollow/.test(html))fail('preview noindex missing');
if(!html.includes('data-v32-category-leaders="1"')||!html.includes('id="category-leaders"'))fail('v11.32 section missing');
if(!html.includes('<h2>업종순위</h2>'))fail('compact v11.32 heading missing');
if((html.match(/data-v30-category="/g)||[]).length!==20||(html.match(/data-v30-metric="/g)||[]).length!==80)fail('v11.30 metric DOM changed');
if(!html.includes('data-v31-category-sort="1"')||!html.includes('data-v31-ranking-sort'))fail('v11.31 interactions lost');

const categories=Object.values(snap.categories||{}).map(c=>({slug:c.slug,name:c.name,count:Number(c.count),cost:num(c.cost?.median),stores:num(c.stores?.median),sales:num(c.sales?.median),area:num(c.salesPerArea?.median)}));
if(categories.length!==20)fail(`snapshot categories ${categories.length}`);
for(const c of categories)for(const key of ['cost','stores','sales','area'])if(c[key]===null)fail(`missing ${key} median: ${c.slug}`);
const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
const rank=(key,dir)=>[...categories].sort((a,b)=>{const d=a[key]-b[key];if(d!==0)return dir==='asc'?d:-d;return collator.compare(a.name,b.name)});
const expected={cost:rank('cost','asc'),stores:rank('stores','desc'),sales:rank('sales','desc'),area:rank('area','desc')};

for(const key of ['cost','stores','sales','area']){
  const re=new RegExp(`<tr data-v32-row="${key}" data-v32-rank="(\\d+)" data-v32-slug="([^"]+)" data-v32-value="([^"]+)">`,'g');
  const rows=[];let m;while((m=re.exec(html)))rows.push({rank:Number(m[1]),slug:m[2],value:Number(m[3])});
  if(rows.length!==5){fail(`${key} visible rows ${rows.length}/5`);continue}
  const top=expected[key].slice(0,5);
  for(let i=0;i<5;i++){
    if(rows[i].rank!==i+1)fail(`${key} row ${i} rank ${rows[i].rank}/${i+1}`);
    if(rows[i].slug!==top[i].slug)fail(`${key} row ${i} slug ${rows[i].slug}/${top[i].slug}`);
    if(rows[i].value!==top[i][key])fail(`${key} row ${i} value ${rows[i].value}/${top[i][key]}`);
  }
  const leader=report.leaders?.[key];
  if(!leader||leader.slug!==top[0].slug||Number(leader.value)!==top[0][key])fail(`${key} report leader mismatch`);
}
if((html.match(/data-v32-row="/g)||[]).length!==20)fail('v11.32 total visible ranking rows not 20');
if((html.match(/data-v32-metric="/g)||[]).length!==4)fail('v11.32 metric groups not 4');

const navMatch=html.match(/<!-- v11\.31 ranking nav -->([\s\S]*?)<!-- v11\.31 ranking nav end -->/);
if(!navMatch)fail('v11.32 nav block missing');
else for(const id of report.navigationTargets)if(!navMatch[1].includes(`href="#${id}"`))fail(`nav target missing ${id}`);

const faqMatch=html.match(/<script type="application\/ld\+json" data-v32-ranking-faq>([\s\S]*?)<\/script>/);
if(!faqMatch)fail('v11.32 FAQ JSON-LD missing');
else {
  try{
    const faq=JSON.parse(faqMatch[1]);
    if(faq['@type']!=='FAQPage'||!Array.isArray(faq.mainEntity)||faq.mainEntity.length!==4)fail('v11.32 FAQ shape invalid');
    const qs=faq.mainEntity.map(x=>x?.name||'');
    for(const term of ['창업비용 중앙값','가맹점 수 중앙값','평균매출 중앙값','3.3㎡당 평균매출 중앙값'])if(!qs.some(q=>q.includes(term)))fail(`FAQ intent missing ${term}`);
    const answers=faq.mainEntity.map(x=>x?.acceptedAnswer?.text||'').join(' ');
    for(const key of ['cost','stores','sales','area'])if(!answers.includes(expected[key][0].name))fail(`FAQ leader missing ${key}`);
  }catch(e){fail(`FAQ JSON-LD parse ${e.message}`)}
}

const datasetMatch=html.match(/<script type="application\/ld\+json" data-v11-ranking-dataset>([\s\S]*?)<\/script>/);
if(!datasetMatch)fail('ranking Dataset JSON-LD missing');
else {
  try{
    const data=JSON.parse(datasetMatch[1]);
    const props=Array.isArray(data.variableMeasured)?data.variableMeasured:[];
    const names=new Set(props.map(x=>x?.name));
    for(const n of ['창업비용 중앙값 최저 업종','가맹점 중앙값 최대 업종','평균매출 중앙값 최대 업종','3.3㎡당매출 중앙값 최대 업종'])if(!names.has(n))fail(`Dataset ranking property missing ${n}`);
  }catch(e){fail(`Dataset JSON-LD parse ${e.message}`)}
}

if(countMarker(css,'/* v11.32 category rankings */')!==1||countMarker(css,'/* v11.32 category rankings end */')!==1)fail('v11.32 CSS block count mismatch');
if(!css.includes('.v32-rank-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))')||!css.includes('@media(max-width:700px){.v32-rank-grid{grid-template-columns:1fr}'))fail('v11.32 responsive CSS missing');
if(/[?&](sort|metric|category)=/.test(html.match(/data-v32-category-leaders="1"[\s\S]*?<\/section>/)?.[0]||''))fail('v11.32 query fanout found');
if(/추천 브랜드|베스트|안전한 창업|예상 수익/.test(html.match(/data-v32-category-leaders="1"[\s\S]*?<\/section>/)?.[0]||''))fail('recommendation-style visible copy found');

if(errors.length){console.error(JSON.stringify({v11_32CategoryRankingsValidation:'FAIL',errorCount:errors.length,errors:errors.slice(0,50)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_32CategoryRankingsValidation:'PASS',productionCandidates:184,trustedBrands:136,categories:20,visibleRankingRows:20,faqCount:4,navigationTargets:6,previewNoindex:true,productionDeployed:false},null,2));

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`}
function num(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null}
function countMarker(text,needle){return text.split(needle).length-1}
