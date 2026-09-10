import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {matchOfficialBrands} from './official-merge.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const generatedAt=new Date().toISOString();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const nfmt=v=>finite(v)?Math.round(Number(v)).toLocaleString('ko-KR'):'—';
const routeFile=r=>path.join(out,...r.split('/').filter(Boolean),'index.html');
async function loadClassic(file,expr){const code=await fs.readFile(file,'utf8');const ctx={console};vm.createContext(ctx);vm.runInContext(`${code}\n;globalThis.__X=${expr}`,ctx);return ctx.__X}
function stats(values){const a=values.filter(positive).map(Number).sort((a,b)=>a-b);if(!a.length)return {count:0,mean:null,median:null,p25:null,p75:null,min:null,max:null};const q=p=>{const x=(a.length-1)*p,l=Math.floor(x),h=Math.ceil(x);return l===h?a[l]:a[l]+(a[h]-a[l])*(x-l)};return {count:a.length,mean:a.reduce((s,v)=>s+v,0)/a.length,median:q(.5),p25:q(.25),p75:q(.75),min:a[0],max:a.at(-1)}}
function rank(rows,key,value,desc=true){if(!positive(value))return null;const a=rows.map(x=>x[key]).filter(positive).map(Number).sort((a,b)=>desc?b-a:a-b);const i=a.indexOf(Number(value));return i<0?null:i+1}
function percentile(rows,key,value){if(!positive(value))return null;const a=rows.map(x=>x[key]).filter(positive).map(Number).sort((a,b)=>a-b);if(a.length<2)return 50;const below=a.filter(v=>v<Number(value)).length,equal=a.filter(v=>v===Number(value)).length;return (below+(equal-1)/2)/(a.length-1)*100}

const snapshot25=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-25.json'),'utf8'));
const official=JSON.parse(await fs.readFile(path.join(repo,'data/franchise/official/brands-2025.json'),'utf8'));
const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,brands}');
const matched=matchOfficialBrands(catalog.brands,official);
const officialByBrand=new Map(matched.matches.map(x=>[x.brand.name,x.record]));
const brands=snapshot25.brands.map(b=>{
  const o=officialByBrand.get(b.name)||{};
  const raw=finite(o.averageSalesPerArea10k)?Number(o.averageSalesPerArea10k):null;
  const history=(b.history||[]).map(h=>{const oh=(o.storeHistory||[]).find(x=>Number(x.year)===Number(h.year));return {...h,averageSalesPerArea10k:finite(oh?.averageSalesPerArea10k)?Number(oh.averageSalesPerArea10k):null}});
  return {...b,salesPerArea:raw,history};
});
const categories=structuredClone(snapshot25.categories);
for(const [slug,c] of Object.entries(categories)){
  const rows=brands.filter(b=>b.categorySlug===slug);
  c.salesPerArea=stats(rows.map(b=>b.salesPerArea));
}
for(const b of brands){
  const peers=brands.filter(x=>x.categorySlug===b.categorySlug);
  const c=categories[b.categorySlug];
  b.category={...b.category,salesPerAreaMedian:c?.salesPerArea?.median??null,salesPerAreaP25:c?.salesPerArea?.p25??null,salesPerAreaP75:c?.salesPerArea?.p75??null,salesPerAreaSample:c?.salesPerArea?.count??0,salesPerAreaRank:rank(peers,'salesPerArea',b.salesPerArea,true),salesPerAreaPercentile:percentile(peers,'salesPerArea',b.salesPerArea)};
}
const snapshot={...snapshot25,schemaVersion:2,uiVersion:'11.26',generated_at:generatedAt,policy:'SINGLE_SNAPSHOT;NO_LOCAL_MEDIANS;NO_SYNTHETIC;MISSING_NEVER_ZERO;AREA_SALES_RAW_ZERO_RETAINED;AREA_SALES_BENCHMARK_POSITIVE_ONLY',metrics:{...(snapshot25.metrics||{}),salesPerArea:{label:'면적당매출',basis:'면적(3.3㎡)당 연간 평균매출액',sourceField:'averageSalesPerArea10k',sourceUnit:'천원',normalizedUnit:'만원',benchmark:'positive public values only; raw published zero remains zero'}},categories,brands};
await fs.writeFile(path.join(out,'data-snapshot-v11-26.json'),JSON.stringify(snapshot,null,2),'utf8');

const valid=brands.filter(b=>positive(b.salesPerArea));
const allStats=stats(valid.map(b=>b.salesPerArea));
const options=brands.map(b=>{const c=b.category||{};return `<option value="${esc(b.slug)}" data-name="${esc(b.name)}" data-category="${esc(b.categoryName)}" data-value="${finite(b.salesPerArea)?b.salesPerArea:''}" data-median="${finite(c.salesPerAreaMedian)?c.salesPerAreaMedian:''}" data-p25="${finite(c.salesPerAreaP25)?c.salesPerAreaP25:''}" data-p75="${finite(c.salesPerAreaP75)?c.salesPerAreaP75:''}" data-sample="${c.salesPerAreaSample||0}" data-rank="${c.salesPerAreaRank||''}" data-percentile="${finite(c.salesPerAreaPercentile)?c.salesPerAreaPercentile:''}">${esc(b.name)} · ${esc(b.categoryName)}</option>`}).join('');
const categoryRows=Object.values(categories).filter(c=>c.salesPerArea?.count>0).sort((a,b)=>b.salesPerArea.median-a.salesPerArea.median).map(c=>`<tr><td>${esc(c.name)}</td><td class="num">${c.salesPerArea.count}</td><td class="num">${nfmt(c.salesPerArea.p25)}</td><td class="num">${nfmt(c.salesPerArea.median)}</td><td class="num">${nfmt(c.salesPerArea.p75)}</td></tr>`).join('');

const medianFile=routeFile('/tools/category-median/');
let html=await fs.readFile(medianFile,'utf8');
html=html.replace(/<section id="sales-per-area"[\s\S]*?<\/section><!-- v11\.26 area-sales end -->/i,'');
const areaSection=`<section id="sales-per-area" class="v26-area" data-v26-area-sales="1"><header class="v26-section-head"><h2>면적당매출</h2><span>공정위 ${snapshot.source_year}</span></header><div class="v26-area-picker"><label>브랜드<select data-v26-area-pick><option value="">선택</option>${options}</select></label></div><div class="v26-area-result" aria-live="polite"><div class="v26-metric-rail"><div><span>공개값</span><strong data-v26-value>—</strong><small>만원/3.3㎡·연</small></div><div><span>업종중앙값</span><strong data-v26-median>—</strong></div><div><span>구간</span><strong data-v26-range>—</strong><small>P25–P75</small></div><div><span>업종위치</span><strong data-v26-rank>—</strong></div></div><div class="v26-bullet" aria-label="선택 브랜드 면적당매출과 업종 분포"><i><span data-v26-band></span><b data-v26-dot></b></i><div><span>P25</span><span>중앙값</span><span>P75</span></div></div><p class="v26-source" data-v26-source>공정거래위원회 가맹정보 · 기준 ${snapshot.source_year}</p></div><details class="v26-table"><summary>업종분포</summary><div class="table-scroll"><table class="data-table"><thead><tr><th>업종</th><th>표본</th><th>P25</th><th>중앙값</th><th>P75</th></tr></thead><tbody>${categoryRows}</tbody></table></div></details><div class="v26-method"><h3>기준</h3><p>정보공개서의 면적(3.3㎡)당 연간 평균매출 공개값을 만원 단위로 정규화합니다. 공개값 0은 원자료의 0으로 보존하고, 업종 분포·순위·백분위 계산에는 0보다 큰 공개값만 사용합니다. 매출은 이익이 아닙니다.</p></div><script>(()=>{const s=document.querySelector('[data-v26-area-pick]');if(!s)return;const q=x=>document.querySelector(x),fmt=v=>Number.isFinite(v)?Math.round(v).toLocaleString('ko-KR'):'—';function draw(){const o=s.selectedOptions[0];if(!o||!o.value){['[data-v26-value]','[data-v26-median]','[data-v26-range]','[data-v26-rank]'].forEach(x=>q(x).textContent='—');return}const v=Number(o.dataset.value),m=Number(o.dataset.median),p25=Number(o.dataset.p25),p75=Number(o.dataset.p75),n=Number(o.dataset.sample),r=o.dataset.rank,p=Number(o.dataset.percentile);q('[data-v26-value]').textContent=Number.isFinite(v)?fmt(v):'—';q('[data-v26-median]').textContent=Number.isFinite(m)?fmt(m):'—';q('[data-v26-range]').textContent=Number.isFinite(p25)&&Number.isFinite(p75)?`${fmt(p25)}–${fmt(p75)}`:'—';q('[data-v26-rank]').textContent=r?`${r}/${n}`:'—';q('[data-v26-source]').textContent=`공정거래위원회 가맹정보 ${snapshot.source_year} · ${o.dataset.category} · 산정표본 ${n}`;const band=q('[data-v26-band]'),dot=q('[data-v26-dot]');if(Number.isFinite(p)){dot.style.left=`${Math.max(0,Math.min(100,p))}%`;dot.hidden=false}else dot.hidden=true;if(Number.isFinite(p25)&&Number.isFinite(p75)&&Number.isFinite(m)){const max=Math.max(p75,m,v||0,1);band.style.left=`${Math.max(0,p25/max*100)}%`;band.style.width=`${Math.max(2,(p75-p25)/max*100)}%`} }s.addEventListener('change',draw);})();</script></section><!-- v11.26 area-sales end -->`;
const insertPoint=html.indexOf('<section class="block"><h2>자주 묻는 질문');
if(insertPoint>=0)html=html.slice(0,insertPoint)+areaSection+html.slice(insertPoint);else html=html.replace('</article>',areaSection+'</article>');
html=html.replace(/<body(?: class="([^"]*)")?>/i,(m,c)=>`<body class="${[c,'v26-data-tool'].filter(Boolean).join(' ')}">`);
await fs.writeFile(medianFile,html,'utf8');

const toolsFile=routeFile('/tools/');
let tools=await fs.readFile(toolsFile,'utf8');
tools=tools.replace(/<a[^>]+href="[^\"]*\/tools\/category-median\/#sales-per-area"[\s\S]*?<\/a>/i,'');
tools=tools.replace(/(<section class="v25-toolset"><h2>데이터<\/h2>)/,`$1<a href="${BASE}/tools/category-median/#sales-per-area" data-v26-area-link="1"><strong>면적당매출</strong><span>→</span></a>`);
tools=tools.replace(/<p>면적당매출·지역매출은 현재 정규화 스냅샷에 검증 필드가 연결되기 전까지 노출하지 않습니다\.<\/p>/,'<p>지역매출은 지역 단위 원자료가 단일 스냅샷에 병합되기 전까지 노출하지 않습니다.</p>');
await fs.writeFile(toolsFile,tools,'utf8');

const cssFile=path.join(out,'assets/site.css');
let css=await fs.readFile(cssFile,'utf8');
css=css.replace(/\/\* v11\.26 data-tool \*\/[\s\S]*?\/\* v11\.26 data-tool end \*\//g,'');
css+=`\n/* v11.26 data-tool */\n.v26-area{margin:42px 0 0;border-top:1px solid var(--line,#dfe3e8);padding-top:24px}.v26-section-head{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-bottom:18px}.v26-section-head h2{margin:0;font-size:1.2rem}.v26-section-head span,.v26-source,.v26-method{font-size:.84rem;color:var(--muted,#667085)}.v26-area-picker{position:sticky;top:0;z-index:3;background:var(--bg,#fff);padding:10px 0 14px;border-bottom:1px solid var(--line,#e5e7eb)}.v26-area-picker label{display:grid;grid-template-columns:70px minmax(0,420px);align-items:center;gap:12px;font-size:.82rem}.v26-area-picker select{min-height:44px;border:1px solid var(--line,#cfd5dc);border-radius:6px;background:transparent;padding:0 10px;font:inherit}.v26-metric-rail{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid var(--line,#e5e7eb)}.v26-metric-rail>div{padding:18px 18px 18px 0;border-right:1px solid var(--line,#e5e7eb)}.v26-metric-rail>div+div{padding-left:18px}.v26-metric-rail>div:last-child{border-right:0}.v26-metric-rail span,.v26-metric-rail small{display:block;color:var(--muted,#667085);font-size:.72rem}.v26-metric-rail strong{display:block;margin:4px 0;font-variant-numeric:tabular-nums;font-size:1.45rem}.v26-bullet{padding:26px 0 14px;max-width:720px}.v26-bullet>i{display:block;position:relative;height:4px;background:#e6e9ed}.v26-bullet>i span{position:absolute;height:4px;background:#9099a6}.v26-bullet>i b{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;background:#111827;transform:translate(-50%,-50%)}.v26-bullet>div{display:flex;justify-content:space-between;margin-top:8px;font-size:.7rem;color:var(--muted,#667085)}.v26-table{border-top:1px solid var(--line,#e5e7eb);margin-top:18px;padding-top:14px}.v26-table summary{cursor:pointer;font-weight:700;min-height:44px;display:flex;align-items:center}.v26-method{border-top:1px solid var(--line,#e5e7eb);margin-top:18px;padding-top:18px;max-width:820px}.v26-method h3{margin:0 0 8px;color:inherit;font-size:.86rem}.v26-method p{margin:0;line-height:1.75}.v25-compare .v25-pickers select{min-height:44px}.v25-compare .v25-pickers{position:sticky;top:0;z-index:4;background:var(--bg,#fff);border-bottom:1px solid var(--line,#e5e7eb);padding-bottom:10px}.v25-compare svg,.v25-compare canvas{max-width:100%;height:auto}.v25-home input,.v25-home button,.v25-tools a{min-height:44px}@media(max-width:700px){.v26-area-picker{top:0}.v26-area-picker label{grid-template-columns:1fr}.v26-metric-rail{display:flex;overflow-x:auto;scroll-snap-type:x mandatory}.v26-metric-rail>div{min-width:148px;scroll-snap-align:start}.v26-table .table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.v25-compare .v25-pickers{overflow-x:auto}.v25-compare .v25-pickers label{min-width:180px}.v25-rail{overflow-x:auto;scroll-snap-type:x mandatory}.v25-rail>div{min-width:112px;scroll-snap-align:start}}\n/* v11.26 data-tool end */\n`;
await fs.writeFile(cssFile,css,'utf8');

const report={schemaVersion:1,uiVersion:'11.26',generatedAt,productionCandidateCount:snapshot.production_candidate_count,brandCount:brands.length,categoryCount:Object.keys(categories).length,areaSales:{sourceField:'averageSalesPerArea10k',basis:'면적(3.3㎡)당 연간 평균매출액',rawFiniteCount:brands.filter(b=>finite(b.salesPerArea)).length,positiveBenchmarkCount:valid.length,globalPositiveMedian:allStats.median,categoryBenchmarkCount:Object.values(categories).filter(c=>c.salesPerArea?.count>0).length,route:'/tools/category-median/#sales-per-area'},regionalSales:{status:'DEFERRED_NOT_IN_CANONICAL_SNAPSHOT',reason:'Regional records require a separate official API ingestion and normalization pass; no empty or synthetic UI created.'},policy:'NO_NEW_HTML_ROUTE;NO_CANDIDATE_SET_CHANGE;NO_SYNTHETIC;PREVIEW_ONLY'};
await fs.writeFile(path.join(out,'v11-26-data-tool.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_26:'PASS',areaSales:report.areaSales,regionalSales:report.regionalSales,productionCandidates:report.productionCandidateCount},null,2));
