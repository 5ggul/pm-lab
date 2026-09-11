import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const v32=JSON.parse(await fs.readFile(path.join(out,'v11-32-category-rankings.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-33-category-distribution.json'),'utf8'));
const html=await fs.readFile(path.join(out,'rankings/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const errors=[];
const fail=m=>errors.push(m);
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);

if(report.uiVersion!=='11.33'||report.schemaVersion!==1)fail('v11.33 report missing or stale');
if(v32.uiVersion!=='11.32'||v32.visibleRankingRows!==20)fail('v11.32 prerequisite stale');
if(snap.brand_count!==136||report.trustedBrands!==136)fail(`trusted brand count ${snap.brand_count}/${report.trustedBrands}`);
if(snap.category_count!==20||report.categoryCount!==20)fail(`category count ${snap.category_count}/${report.categoryCount}`);
if(candidates.length!==184||report.productionCandidateCount!==184||!candidates.includes('/rankings/'))fail(`candidate set ${candidates.length}/${report.productionCandidateCount}/${candidates.includes('/rankings/')}`);
if(report.visibleTopRows!==5||report.visibleDistributionRows!==20||report.distributionCells!==60||report.rangeBars!==20)fail(`distribution counts ${report.visibleTopRows}/${report.visibleDistributionRows}/${report.distributionCells}/${report.rangeBars}`);
if(JSON.stringify(report.distributionParts)!==JSON.stringify(['p25','median','p75']))fail(`distribution parts ${JSON.stringify(report.distributionParts)}`);
if(JSON.stringify(report.mobileVisibleParts)!==JSON.stringify(['median','range']))fail(`mobile visible parts ${JSON.stringify(report.mobileVisibleParts)}`);
if(report.v30MetricCellsPreserved!==80||(html.match(/data-v30-metric="/g)||[]).length!==80)fail('v11.30 metric cells changed');
if(!report.policy.includes('CATEGORY_DISTRIBUTION_FROM_TRUSTED_SNAPSHOT')||!report.policy.includes('NO_NEW_ROUTE')||!report.policy.includes('NO_CANDIDATE_CHANGE')||!report.policy.includes('NO_INDEX_CHANGE')||!report.policy.includes('NO_PRODUCTION_DEPLOY'))fail('v11.33 release guard missing');
if(!report.previewNoindex||!/<meta name="robots" content="noindex,nofollow/.test(html))fail('preview noindex missing');
if(!html.includes('data-v33-category-distribution="1"')||!html.includes('id="category-leaders"'))fail('v11.33 section missing');
if(!html.includes('<h2>업종순위</h2>'))fail('compact heading missing');
if(!html.includes('data-v31-category-sort="1"')||!html.includes('data-v31-ranking-sort'))fail('v11.31 interaction lost');
if(!html.includes('data-v32-ranking-faq'))fail('v11.32 FAQ structured data lost');

const categories=Object.values(snap.categories||{}).map(c=>({slug:c.slug,name:c.name,cost:stats(c.cost),stores:stats(c.stores),sales:stats(c.sales),area:stats(c.salesPerArea)}));
if(categories.length!==20)fail(`snapshot categories ${categories.length}`);
for(const c of categories)for(const key of ['cost','stores','sales','area'])for(const part of ['p25','median','p75'])if(c[key][part]===null)fail(`missing ${key}.${part}: ${c.slug}`);
const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
const rank=(key,dir)=>[...categories].sort((a,b)=>{const d=a[key].median-b[key].median;if(d!==0)return dir==='asc'?d:-d;return collator.compare(a.name,b.name)});
const expected={cost:rank('cost','asc'),stores:rank('stores','desc'),sales:rank('sales','desc'),area:rank('area','desc')};

for(const key of ['cost','stores','sales','area']){
  const re=new RegExp(`<tr data-v33-row="${key}" data-v33-rank="(\\d+)" data-v33-slug="([^"]+)" data-v33-p25="([^"]+)" data-v33-median="([^"]+)" data-v33-p75="([^"]+)">`,'g');
  const rows=[];let m;while((m=re.exec(html)))rows.push({rank:Number(m[1]),slug:m[2],p25:Number(m[3]),median:Number(m[4]),p75:Number(m[5])});
  if(rows.length!==5){fail(`${key} rows ${rows.length}/5`);continue}
  const top=expected[key].slice(0,5);
  for(let i=0;i<5;i++){
    if(rows[i].rank!==i+1)fail(`${key} row ${i} rank ${rows[i].rank}/${i+1}`);
    if(rows[i].slug!==top[i].slug)fail(`${key} row ${i} slug ${rows[i].slug}/${top[i].slug}`);
    for(const part of ['p25','median','p75'])if(rows[i][part]!==top[i][key][part])fail(`${key} row ${i} ${part} ${rows[i][part]}/${top[i][key][part]}`);
    if(!(rows[i].p25<=rows[i].median&&rows[i].median<=rows[i].p75))fail(`${key} row ${i} percentile order invalid`);
  }
}
if((html.match(/data-v33-row="/g)||[]).length!==20)fail('v11.33 total visible rows not 20');
if((html.match(/data-v33-metric="/g)||[]).length!==4)fail('v11.33 metric groups not 4');
if((html.match(/class="v33-range"/g)||[]).length!==20)fail('v11.33 range bars not 20');
if((html.match(/class="v33-band"/g)||[]).length!==20||(html.match(/class="v33-mid"/g)||[]).length!==20)fail('v11.33 range components missing');
if((html.match(/data-v33-p25="/g)||[]).length!==20||(html.match(/data-v33-median="/g)||[]).length!==20||(html.match(/data-v33-p75="/g)||[]).length!==20)fail('v11.33 percentile data attributes missing');

const section=html.match(/data-v33-category-distribution="1"[\s\S]*?<\/section>/)?.[0]||'';
if(!section)fail('v11.33 section extraction failed');
if(/[?&](sort|metric|category)=/.test(section))fail('query fanout found');
if(/추천 브랜드|베스트|안전한 창업|예상 수익|한눈에|쉽고 빠르게|신뢰 비교/.test(section))fail('marketing/recommendation copy found');
if(!section.includes('<th class="num">P25</th>')||!section.includes('<th class="num">중앙</th>')||!section.includes('<th class="num">P75</th>')||!section.includes('<th>분포</th>'))fail('distribution headers missing');

if(countMarker(css,'/* v11.33 category distribution */')!==1||countMarker(css,'/* v11.33 category distribution end */')!==1)fail('v11.33 CSS block count mismatch');
if(!css.includes('.v33-band{')||!css.includes('.v33-mid{')||!css.includes('.v33-axis{'))fail('distribution visual CSS missing');
if(!css.includes('.v33-table th:nth-child(3),.v33-table td:nth-child(3),.v33-table th:nth-child(5),.v33-table td:nth-child(5){display:none}'))fail('mobile percentile compression missing');
if(!css.includes('.v33-range{width:96px}'))fail('mobile range width missing');

if(errors.length){console.error(JSON.stringify({v11_33CategoryDistributionValidation:'FAIL',errorCount:errors.length,errors:errors.slice(0,50)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_33CategoryDistributionValidation:'PASS',productionCandidates:184,trustedBrands:136,categories:20,visibleDistributionRows:20,distributionCells:60,rangeBars:20,v30MetricCells:80,previewNoindex:true,productionDeployed:false},null,2));

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`}
function num(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null}
function stats(v){return {p25:num(v?.p25),median:num(v?.median),p75:num(v?.p75)}}
function countMarker(text,needle){return text.split(needle).length-1}
