import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(norm);
if(snap.brand_count!==136||candidates.length!==184)throw new Error(`v11.35 SEO baseline ${snap.brand_count}/${candidates.length}`);

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const won=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'정보 없음';
const data=v=>finite(v)?String(Number(v)):'null';
const absWon=v=>finite(v)?`${Math.round(Math.abs(Number(v))).toLocaleString('ko-KR')}만원`:'정보 없음';
const compLabels={franchise:'가맹비',education:'교육비',deposit:'보증금',etc:'기타 공개비용'};
const captionNeedle='<p class="v35-caption">공정위 공개비용 구성 · 실제 임대보증금·권리금·별도공사는 포함 범위를 따로 확인</p>';

let inserted=0,factualComparisons=0,missingComparisons=0,largestComponentRows=0;
for(const b of snap.brands){
  const file=path.join(out,...String(b.route).split('/').filter(Boolean),'index.html');
  let html=await fs.readFile(file,'utf8');
  html=html.replace(/<p class="v35-caption v35-contract-check"[\s\S]*?<\/p>/g,'');
  if(!html.includes(captionNeedle))throw new Error(`v11.35 cost caption missing ${b.slug}`);
  const category=snap.categories?.[b.categorySlug];
  const median=category?.cost?.median;
  const cost=finite(b.cost)?Number(b.cost):null;
  const med=finite(median)?Number(median):null;
  const gap=cost!==null&&med!==null?cost-med:null;
  let direction='missing',comparison='업종 중앙 비교 정보 없음';
  if(gap!==null){
    factualComparisons++;
    if(Math.abs(gap)<1e-9){direction='same';comparison=`${esc(b.categoryName)} 중앙 ${won(med)}과 같음`}
    else if(gap<0){direction='below';comparison=`${esc(b.categoryName)} 중앙 ${won(med)}보다 ${absWon(gap)} 낮음`}
    else{direction='above';comparison=`${esc(b.categoryName)} 중앙 ${won(med)}보다 ${absWon(gap)} 높음`}
  }else missingComparisons++;

  const comps=Object.entries(b.components||{}).filter(([k,v])=>compLabels[k]&&finite(v)).map(([key,value])=>({key,value:Number(value)}));
  const total=comps.reduce((s,x)=>s+x.value,0);
  comps.sort((a,z)=>z.value-a.value);
  const largest=comps[0]||null;
  const share=largest&&total>0?largest.value/total*100:null;
  const componentText=largest?`최대 구성 ${compLabels[largest.key]} ${won(largest.value)}${share!==null?` (${share.toFixed(1)}%)`:''}`:'비용 구성 정보 없음';
  if(largest)largestComponentRows++;

  const paragraph=`<p class="v35-caption v35-contract-check" data-v35-contract-check="1" data-v35-cost="${data(cost)}" data-v35-cost-median="${data(med)}" data-v35-cost-gap="${data(gap)}" data-v35-gap-direction="${direction}" data-v35-largest-component="${largest?.key||'missing'}" data-v35-largest-value="${data(largest?.value)}">공개비용 ${won(cost)} · ${comparison}. ${componentText}. 계약 전 임대보증금·권리금·철거·전기증설·냉난방·외부공사·추가장비·초기운전자금의 별도 부담 여부 확인.</p>`;
  html=html.replace(captionNeedle,captionNeedle+paragraph);
  await fs.writeFile(file,html,'utf8');
  inserted++;
}

const report={schemaVersion:1,uiVersion:'11.35',generatedAt:new Date().toISOString(),snapshot:snap.snapshot_id,productionCandidateCount:candidates.length,brandPages:snap.brands.length,inserted,factualComparisons,missingComparisons,largestComponentRows,previewNoindex:true,productionDeployed:false,policy:'TRUSTED_SNAPSHOT_ONLY;BRAND_SPECIFIC_COST_MEDIAN_CONTEXT;LARGEST_COMPONENT_CONTEXT;CONTRACT_SCOPE_CHECKLIST;NO_FILLER;NO_RECOMMENDATION;NO_NEW_ROUTE;NO_CANDIDATE_CHANGE;NO_INDEX_CHANGE;NO_PRODUCTION_DEPLOY'};
await fs.writeFile(path.join(out,'v11-35-seo-depth.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_35SeoDepth:'PASS',...report},null,2));

function norm(r){let s=String(r||'').split(/[?#]/)[0];try{s=decodeURIComponent(s)}catch{}return s==='/'?'/':`/${s.replace(/^\/+|\/+$/g,'')}/`}
