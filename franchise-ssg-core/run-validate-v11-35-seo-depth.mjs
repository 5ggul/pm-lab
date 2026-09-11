import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-35-seo-depth.json'),'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(norm);
const errors=[];const fail=m=>errors.push(m);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const same=(a,b)=>a===null||b===null?a===b:Math.abs(Number(a)-Number(b))<1e-6;
const data=v=>finite(v)?Number(v):null;
const labels={franchise:'가맹비',education:'교육비',deposit:'보증금',etc:'기타 공개비용'};

if(report.schemaVersion!==1||report.uiVersion!=='11.35')fail('report version');
if(report.productionCandidateCount!==184||candidates.length!==184)fail(`candidate count ${report.productionCandidateCount}/${candidates.length}`);
if(report.brandPages!==136||report.inserted!==136)fail(`brand insert ${report.brandPages}/${report.inserted}`);
if(!report.previewNoindex||report.productionDeployed!==false)fail('safety report');
for(const term of ['TRUSTED_SNAPSHOT_ONLY','BRAND_SPECIFIC_COST_MEDIAN_CONTEXT','LARGEST_COMPONENT_CONTEXT','CONTRACT_SCOPE_CHECKLIST','NO_FILLER','NO_RECOMMENDATION','NO_NEW_ROUTE','NO_CANDIDATE_CHANGE','NO_INDEX_CHANGE','NO_PRODUCTION_DEPLOY'])if(!report.policy?.includes(term))fail(`policy ${term}`);

let checked=0,factual=0,missing=0,largestRows=0;
for(const b of snap.brands){
  const file=path.join(out,...String(b.route).split('/').filter(Boolean),'index.html');
  const html=await fs.readFile(file,'utf8');
  if(!/<meta name="robots" content="noindex,nofollow/.test(html))fail(`noindex ${b.slug}`);
  const rows=parse(html);
  if(rows.length!==1){fail(`marker count ${b.slug} ${rows.length}`);continue}
  checked++;
  const row=rows[0],cat=snap.categories?.[b.categorySlug];
  const cost=data(b.cost),median=data(cat?.cost?.median),gap=cost!==null&&median!==null?cost-median:null;
  let direction='missing';
  if(gap!==null){factual++;direction=Math.abs(gap)<1e-9?'same':gap<0?'below':'above'}else missing++;
  if(!same(row.cost,cost)||!same(row.median,median)||!same(row.gap,gap)||row.direction!==direction)fail(`cost context ${b.slug}`);

  const comps=Object.entries(b.components||{}).filter(([k,v])=>labels[k]&&finite(v)).map(([key,value])=>({key,value:Number(value)})).sort((a,z)=>z.value-a.value);
  const largest=comps[0]||null;
  if(largest){largestRows++;if(row.largest!==largest.key||!same(row.largestValue,largest.value))fail(`largest component ${b.slug}`)}
  else if(row.largest!=='missing'||row.largestValue!==null)fail(`largest missing ${b.slug}`);

  const text=row.text;
  for(const token of ['공개비용','중앙','임대보증금','권리금','철거','전기증설','냉난방','외부공사','추가장비','초기운전자금','별도 부담 여부 확인'])if(!text.includes(token))fail(`useful copy ${b.slug}/${token}`);
  if(cost!==null&&!text.includes(`${Math.round(cost).toLocaleString('ko-KR')}만원`))fail(`visible cost ${b.slug}`);
  if(median!==null&&!text.includes(`${Math.round(median).toLocaleString('ko-KR')}만원`))fail(`visible median ${b.slug}`);
  if(largest&&!text.includes(labels[largest.key]))fail(`visible largest ${b.slug}`);
  if(text.length<105)fail(`copy too shallow ${b.slug} ${text.length}`);
  if(/추천|유리(?:함|하다|한|합니다)?|베스트|수익\s*보장|안전한\s*창업/.test(text))fail(`judgment copy ${b.slug}`);
}
if(checked!==136||factual!==report.factualComparisons||missing!==report.missingComparisons||largestRows!==report.largestComponentRows)fail(`totals ${checked}/${factual}/${missing}/${largestRows}`);
if(report.factualComparisons+report.missingComparisons!==136)fail('comparison total');

if(errors.length){console.error(JSON.stringify({v11_35SeoDepthValidation:'FAIL',errorCount:errors.length,errors:errors.slice(0,100)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_35SeoDepthValidation:'PASS',brands:checked,factualComparisons:factual,missingComparisons:missing,largestComponentRows:largestRows,productionCandidates:184,previewNoindex:true,productionDeployed:false},null,2));

function norm(r){let s=String(r||'').split(/[?#]/)[0];try{s=decodeURIComponent(s)}catch{}return s==='/'?'/':`/${s.replace(/^\/+|\/+$/g,'')}/`}
function val(v){return v==='null'?null:Number(v)}
function stripTags(s){return String(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
function parse(html){const re=/<p class="v35-caption v35-contract-check" data-v35-contract-check="1" data-v35-cost="([^"]+)" data-v35-cost-median="([^"]+)" data-v35-cost-gap="([^"]+)" data-v35-gap-direction="([^"]+)" data-v35-largest-component="([^"]+)" data-v35-largest-value="([^"]+)">([\s\S]*?)<\/p>/g;const out=[];let m;while((m=re.exec(html)))out.push({cost:val(m[1]),median:val(m[2]),gap:val(m[3]),direction:m[4],largest:m[5],largestValue:val(m[6]),text:stripTags(m[7])});return out}
