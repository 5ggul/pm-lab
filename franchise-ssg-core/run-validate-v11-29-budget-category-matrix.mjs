import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const thresholds=[5000,7000,10000,15000,20000];
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-29-budget-category-matrix.json'),'utf8'));
const html=await fs.readFile(path.join(out,'explore/index.html'),'utf8');
const app=await fs.readFile(path.join(out,'assets/app.js'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const errors=[];
const fail=m=>errors.push(m);

const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
if(report.uiVersion!=='11.29'||report.schemaVersion!==1)fail('v11.29 report missing or stale');
if(snap.brand_count!==136||report.trustedBrands!==136)fail(`trusted brand count ${snap.brand_count}/${report.trustedBrands}`);
if(snap.category_count!==20||report.categoryCount!==20)fail(`category count ${snap.category_count}/${report.categoryCount}`);
if(candidates.length!==184||report.productionCandidateCount!==184||!candidates.includes('/explore/'))fail(`candidate set ${candidates.length}/${report.productionCandidateCount}/${candidates.includes('/explore/')}`);
if(report.matrixCells!==100)fail(`matrix cells ${report.matrixCells}`);
if(JSON.stringify(report.thresholds)!==JSON.stringify(thresholds))fail(`thresholds ${JSON.stringify(report.thresholds)}`);
if(!report.policy.includes('NO_QUERY_LINK_FANOUT')||!report.policy.includes('NO_INDEX_CHANGE')||!report.policy.includes('NO_PRODUCTION_DEPLOY'))fail('v11.29 release guard missing');
if(!report.previewNoindex||!/<meta name="robots" content="noindex,nofollow/.test(html))fail('preview noindex missing');
if(!html.includes('data-v29-budget-category="1"')||!html.includes('id="budget-by-category"')||!html.includes('data-v29-budget-matrix="1"'))fail('v11.29 explore markers missing');
if(html.includes('id="category-under-100m"'))fail('legacy one-budget category section still present');
if(!html.includes('<title>프랜차이즈 창업비용 예산별 찾기 | 업종별 5천·7천·1억 비교</title>'))fail('v11.29 title missing');
if(!html.includes('20개 업종×5개 예산 기준'))fail('v11.29 description missing matrix scope');

const matrixSection=sectionRange(html,'budget-by-category');
if(!matrixSection)fail('matrix section unreadable');
else {
  if((matrixSection.text.match(/data-v29-count="/g)||[]).length!==100)fail('matrix cell DOM count is not 100');
  if(/href="[^"]*\?[^"#]*"/.test(matrixSection.text))fail('query-string link fanout found in matrix');
  if(!matrixSection.text.includes('<h2>예산×업종</h2>'))fail('compact matrix heading missing');
  if(!matrixSection.text.includes('<summary>기준</summary>'))fail('matrix basis details missing');
}

const expectedBySlug=new Map();
for(const c of Object.values(snap.categories||{})){
  const brands=snap.brands.filter(b=>b.categorySlug===c.slug);
  expectedBySlug.set(c.slug,{total:brands.length,counts:thresholds.map(limit=>brands.filter(b=>finite(b.cost)&&Number(b.cost)<=limit).length)});
}
if(expectedBySlug.size!==20)fail(`expected category map ${expectedBySlug.size}`);
const seen=new Set();
const rowRe=/<tr data-v29-cat-row data-v29-cat="([^"]+)" data-v29-total="(\d+)" data-v29-counts="([^"]+)">/g;
let m;
while((m=rowRe.exec(html))){
  const slug=m[1],total=Number(m[2]),counts=m[3].split(',').map(Number),expected=expectedBySlug.get(slug);
  if(!expected){fail(`unknown matrix category ${slug}`);continue}
  seen.add(slug);
  if(total!==expected.total)fail(`${slug} total ${total}/${expected.total}`);
  if(JSON.stringify(counts)!==JSON.stringify(expected.counts))fail(`${slug} counts ${counts.join(',')}/${expected.counts.join(',')}`);
}
if(seen.size!==20)fail(`matrix category rows ${seen.size}/20`);
const expectedTotals=thresholds.map((_,i)=>[...expectedBySlug.values()].reduce((sum,row)=>sum+row.counts[i],0));
if(JSON.stringify(report.thresholdTotals)!==JSON.stringify(expectedTotals))fail(`threshold totals ${report.thresholdTotals}/${expectedTotals}`);
const positiveCells=[...expectedBySlug.values()].reduce((sum,row)=>sum+row.counts.filter(x=>x>0).length,0);
if(report.interactiveCells!==positiveCells||report.zeroCells!==100-positiveCells)fail(`interactive/zero cells ${report.interactiveCells}/${report.zeroCells} expected ${positiveCells}/${100-positiveCells}`);
if((html.match(/class="v29-matrix-filter"/g)||[]).length!==positiveCells)fail('interactive matrix button count mismatch');

const jsonMatch=html.match(/<script type="application\/ld\+json" data-v11-budget-dataset>([\s\S]*?)<\/script>/);
if(!jsonMatch)fail('budget Dataset JSON-LD missing');
else {
  try{
    const data=JSON.parse(jsonMatch[1]);
    if(data.name!=='프랜차이즈 창업비용 예산·업종 교차 데이터')fail('Dataset name not updated');
    const props=Array.isArray(data.variableMeasured)?data.variableMeasured:[];
    const byName=new Map(props.map(x=>[x?.name,x?.value]));
    if(Number(byName.get('업종 수'))!==20)fail('Dataset category count missing');
    if(Number(byName.get('예산×업종 교차 셀'))!==100)fail('Dataset matrix cell count missing');
    thresholds.forEach((limit,i)=>{if(Number(byName.get(`공개 창업비용 ${limit}만원 이하 브랜드 수`))!==expectedTotals[i])fail(`Dataset threshold mismatch ${limit}`)});
  }catch(e){fail(`Dataset JSON-LD parse: ${e.message}`)}
}

if(countMarker(app,'/* v11.29 budget-category matrix */')!==1||countMarker(app,'/* v11.29 budget-category matrix end */')!==1)fail('v11.29 app block count mismatch');
if(!app.includes("[data-v29-budget][data-v29-cat]")||!app.includes("form.elements.cat.value=btn.dataset.v29Cat")||!app.includes("form.elements.budget.dispatchEvent(new Event('input'"))fail('v11.29 matrix interaction missing');
if(countMarker(css,'/* v11.29 budget-category matrix */')!==1||countMarker(css,'/* v11.29 budget-category matrix end */')!==1)fail('v11.29 CSS block count mismatch');
if(!css.includes('.v29-matrix-filter{')||!css.includes('.v29-budget-matrix table{min-width:760px}'))fail('v11.29 matrix CSS missing');

if(errors.length){console.error(JSON.stringify({v11_29BudgetCategoryMatrixValidation:'FAIL',errorCount:errors.length,errors:errors.slice(0,30)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_29BudgetCategoryMatrixValidation:'PASS',productionCandidates:184,trustedBrands:136,categories:20,matrixCells:100,interactiveCells:positiveCells,thresholdTotals:expectedTotals,previewNoindex:true,productionDeployed:false},null,2));

function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function normalizeRoute(r){return r==='/'?'/':`/${String(r).split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`}
function countMarker(text,needle){return text.split(needle).length-1}
function sectionRange(raw,id){const at=raw.indexOf(`id="${id}"`);if(at<0)return null;const start=raw.lastIndexOf('<section',at),endAt=raw.indexOf('</section>',at);if(start<0||endAt<0)return null;return {start,end:endAt+10,text:raw.slice(start,endAt+10)}}
