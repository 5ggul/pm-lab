import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const cssPath=path.join(out,'assets/site.css');
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(norm);
if(snap.brand_count!==136||snap.category_count!==20||candidates.length!==184)throw new Error(`v11.35 baseline ${snap.brand_count}/${snap.category_count}/${candidates.length}`);

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const positive=v=>finite(v)&&Number(v)>0;
const n=v=>finite(v)?Number(v):null;
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const won=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'—';
const num=v=>finite(v)?Math.round(Number(v)).toLocaleString('ko-KR'):'—';
const pct=v=>finite(v)?`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%`:'—';
const ratio=(v,t)=>finite(v)&&positive(t)?Number(v)/Number(t)*100:null;
const clamp=v=>Math.max(0,Math.min(100,v));
const fileFor=r=>path.join(out,...String(r).split('/').filter(Boolean),'index.html');

function norm(r){let s=String(r||'').split(/[?#]/)[0];try{s=decodeURIComponent(s)}catch{}return s==='/'?'/':`/${s.replace(/^\/+|\/+$/g,'')}/`}
function sectionRange(html,id){const at=html.indexOf(`id="${id}"`);if(at<0)return null;const start=html.lastIndexOf('<section',at),endAt=html.indexOf('</section>',at);if(start<0||endAt<0)return null;return {start,end:endAt+10,text:html.slice(start,endAt+10)}}
function removeSection(html,id){const r=sectionRange(html,id);return r?html.slice(0,r.start)+html.slice(r.end):html}
function replaceSection(html,id,next){const r=sectionRange(html,id);if(!r)throw new Error(`missing section ${id}`);return html.slice(0,r.start)+next+html.slice(r.end)}
function addBodyClass(html,c){return html.replace(/<body(?: class="([^"]*)")?>/i,(m,x)=>`<body class="${[x,c].filter(Boolean).join(' ')}">`)}
function distPos(v,min,max){if(!finite(v)||!finite(min)||!finite(max)||Number(max)<=Number(min))return null;return clamp((Number(v)-Number(min))/(Number(max)-Number(min))*100)}
function dataNum(v){return finite(v)?String(Number(v)):'null'}

function kpis(b){return `<div class="v35-kpis">${[
  ['공개비용',won(b.cost),'cost'],
  ['가맹점',`${num(b.stores)}개`,'stores'],
  ['평균매출',won(b.sales),'sales'],
  ['3.3㎡매출',won(b.salesPerArea),'salesPerArea'],
  ['점포변화',pct(b.growth),'growth']
].map(([label,value,key])=>`<div data-v35-kpi="${key}" data-v35-value="${dataNum(b[key])}"><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>`}

function components(b){
  const parts=[['가맹비','franchise',b.components?.franchise],['교육비','education',b.components?.education],['보증금','deposit',b.components?.deposit],['기타','etc',b.components?.etc]];
  const total=parts.reduce((s,x)=>s+(finite(x[2])?Number(x[2]):0),0);
  const seg=parts.map((x,i)=>`<i class="p${i+1}" style="width:${(ratio(x[2],total)??0).toFixed(2)}%"></i>`).join('');
  const rows=parts.map(([label,key,value],i)=>`<div class="v35-comp-row" data-v35-component="${key}" data-v35-value="${dataNum(value)}" data-v35-share="${finite(ratio(value,total))?ratio(value,total).toFixed(6):'null'}"><span><i class="p${i+1}"></i>${label}</span><strong>${won(value)}</strong><em>${finite(ratio(value,total))?`${ratio(value,total).toFixed(1)}%`:'—'}</em></div>`).join('');
  return `<section class="v35-panel" id="cost"><div class="v35-section-head"><h2>비용구성</h2><span>${won(total)}</span></div><div class="v35-cost-stack" aria-label="공개 창업비용 구성">${seg}</div><div class="v35-comp-list">${rows}</div><p class="v35-caption">공정위 공개비용 구성 · 실제 임대보증금·권리금·별도공사는 포함 범위를 따로 확인</p></section>`;
}

const metricDefs=[
  {key:'cost',label:'창업비용',brand:b=>b.cost,cat:c=>c.cost,format:won,eligible:v=>finite(v)},
  {key:'stores',label:'가맹점',brand:b=>b.stores,cat:c=>c.stores,format:v=>finite(v)?`${num(v)}개`:'—',eligible:v=>finite(v)},
  {key:'sales',label:'평균매출',brand:b=>b.sales,cat:c=>c.sales,format:won,eligible:v=>finite(v)},
  {key:'salesPerArea',label:'3.3㎡매출',brand:b=>b.salesPerArea,cat:c=>c.salesPerArea,format:won,eligible:v=>positive(v)}
];
function benchmarkTrack(b,c,d){
  const metric=d.cat(c),value=d.brand(b),eligible=d.eligible(value)&&metric&&finite(metric.min)&&finite(metric.max)&&metric.max>metric.min;
  const marker=eligible?distPos(value,metric.min,metric.max):null;
  const q1=metric?distPos(metric.p25,metric.min,metric.max):null,q2=metric?distPos(metric.median,metric.min,metric.max):null,q3=metric?distPos(metric.p75,metric.min,metric.max):null;
  const iqrLeft=finite(q1)?q1:0,iqrWidth=finite(q1)&&finite(q3)?Math.max(0,q3-q1):0;
  const sample=metric?.count??0;
  return `<div class="v35-benchmark" data-v35-benchmark="${d.key}" data-v35-value="${dataNum(value)}" data-v35-p25="${dataNum(metric?.p25)}" data-v35-median="${dataNum(metric?.median)}" data-v35-p75="${dataNum(metric?.p75)}" data-v35-min="${dataNum(metric?.min)}" data-v35-max="${dataNum(metric?.max)}" data-v35-eligible="${eligible?'1':'0'}"><div class="v35-benchmark-head"><span>${d.label}</span><strong>${d.format(value)}</strong><em>${b.category?.[`${d.key}Rank`]&&b.category?.[`${d.key}Percentile`]!==undefined?`${b.category[`${d.key}Rank`]}/${b.category.count} · ${Number(b.category[`${d.key}Percentile`]).toFixed(0)}%`:`n=${sample}`}</em></div><div class="v35-track"><i class="v35-iqr" style="left:${iqrLeft.toFixed(2)}%;width:${iqrWidth.toFixed(2)}%"></i>${finite(q2)?`<i class="v35-median" style="left:${q2.toFixed(2)}%"></i>`:''}${finite(marker)?`<b class="v35-marker" style="left:${marker.toFixed(2)}%"></b>`:''}</div><div class="v35-track-labels"><span>P25 ${d.format(metric?.p25)}</span><span>중앙 ${d.format(metric?.median)}</span><span>P75 ${d.format(metric?.p75)}</span></div>${d.key==='salesPerArea'&&finite(value)&&!positive(value)?'<small class="v35-zero-note">공개값 0 · 양수 분포 계산에서 제외</small>':''}</div>`;
}
function benchmarks(b){const c=snap.categories?.[b.categorySlug];if(!c)throw new Error(`missing category ${b.categorySlug}`);return `<section class="v35-panel" id="benchmark"><div class="v35-section-head"><h2>업종분포</h2><span>${esc(b.categoryName)} · ${c.count}개</span></div><div class="v35-benchmarks">${metricDefs.map(d=>benchmarkTrack(b,c,d)).join('')}</div><p class="v35-caption">막대는 업종 최소~최대 범위, 진한 구간은 P25~P75, 세로선은 중앙값, 점은 브랜드 공개값</p></section>`}

function history(b){
  const rows=(b.history||[]).filter(x=>finite(x.year)&&finite(x.stores)).slice(-3);
  if(!rows.length)return `<section class="v35-panel" id="stores"><div class="v35-section-head"><h2>점포추이</h2><span>공개 이력 없음</span></div></section>`;
  const values=rows.map(x=>Number(x.stores)),min=Math.min(...values),max=Math.max(...values),den=max-min||1;
  const pts=rows.map((x,i)=>`${60+(rows.length===1?0:i/(rows.length-1))*640},${122-(Number(x.stores)-min)/den*72}`).join(' ');
  const labels=rows.map((x,i)=>{const px=60+(rows.length===1?0:i/(rows.length-1))*640,py=122-(Number(x.stores)-min)/den*72;return `<circle cx="${px}" cy="${py}" r="4"></circle><text x="${px}" y="${Math.max(18,py-12)}" text-anchor="middle">${num(x.stores)}</text><text x="${px}" y="154" text-anchor="middle">${x.year}</text>`}).join('');
  const cards=rows.map(x=>`<div class="v35-year" data-v35-year="${x.year}" data-v35-stores="${dataNum(x.stores)}" data-v35-new="${dataNum(x.newStores)}" data-v35-end="${dataNum(x.contractEnd)}" data-v35-cancel="${dataNum(x.contractCancel)}"><strong>${x.year}</strong><span>가맹점 <b>${num(x.stores)}</b></span><span>신규 <b>${num(x.newStores)}</b></span><span>종료 <b>${num(x.contractEnd)}</b></span><span>해지 <b>${num(x.contractCancel)}</b></span></div>`).join('');
  return `<section class="v35-panel" id="stores"><div class="v35-section-head"><h2>점포추이</h2><span>${rows.length}개년 공개 이력</span></div><svg class="v35-history" viewBox="0 0 760 170" role="img" aria-label="${esc(b.name)} 가맹점 공개 이력"><polyline points="${pts}"></polyline>${labels}</svg><div class="v35-year-list">${cards}</div><p class="v35-caption">기준년도별 공개실적 · 한 구간의 변화만으로 향후 성장성이나 수익성을 판단하지 않음</p></section>`;
}

function raw(b){
  const rows=[['공정위 기준',b.sourceYear],['공개비용',won(b.cost)],['가맹점',`${num(b.stores)}개`],['평균매출',won(b.sales)],['3.3㎡매출',won(b.salesPerArea)],['점포변화',pct(b.growth)],['업종',b.categoryName],['업종 표본',`${b.category?.count??0}개`]];
  return `<section class="v35-panel v35-raw" id="raw-data"><div class="v35-section-head"><h2>원자료</h2><span>${esc(snap.snapshot_id)}</span></div><div class="v35-raw-grid">${rows.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div><p class="v35-caption">공정위·공공데이터 공개자료 정규화 · 상세 출처와 계산 기준은 아래 출처/기준 영역에서 확인</p></section>`;
}

function workspace(b){return `<section id="answer" class="v35-brand-workspace" data-v35-brand="${esc(b.slug)}"><!-- v11.35 brand workspace -->${kpis(b)}${components(b)}${benchmarks(b)}${history(b)}${raw(b)}<!-- v11.35 brand workspace end --></section>`}

let brandPages=0,operatorCostPreserved=0,sourceSectionsPreserved=0,removedLegacySections=0,historyCards=0,zeroAreaBrands=0;
for(const b of snap.brands){
  const file=fileFor(b.route);let html=await fs.readFile(file,'utf8');
  const hadOperator=Boolean(sectionRange(html,'official-current-cost'));
  const hadSource=Boolean(sectionRange(html,'source'));
  for(const id of ['cost','stores','benchmark','position']){if(sectionRange(html,id)){html=removeSection(html,id);removedLegacySections++}}
  html=replaceSection(html,'answer',workspace(b));
  const toc=`<div class="brand-toc"><nav><a href="#answer">지표</a><a href="#cost">비용</a><a href="#benchmark">업종분포</a><a href="#stores">점포추이</a><a href="#raw-data">원자료</a>${hadOperator?'<a href="#official-current-cost">본사 개설비</a>':''}<a href="#source">출처</a></nav></div>`;
  html=html.replace(/<div class="brand-toc"><nav>[\s\S]*?<\/nav><\/div>/,toc);
  html=addBodyClass(html,'v35-brand-detail');
  await fs.writeFile(file,html,'utf8');
  brandPages++;
  if(hadOperator&&sectionRange(html,'official-current-cost'))operatorCostPreserved++;
  if(hadSource&&sectionRange(html,'source'))sourceSectionsPreserved++;
  historyCards+=Math.min(3,(b.history||[]).filter(x=>finite(x.year)&&finite(x.stores)).length);
  if(finite(b.salesPerArea)&&!positive(b.salesPerArea))zeroAreaBrands++;
}

let css=await fs.readFile(cssPath,'utf8');
css=css.replace(/\/\* v11\.35 brand detail \*\/[\s\S]*?\/\* v11\.35 brand detail end \*\//g,'');
css+=`\n/* v11.35 brand detail */\n.v35-brand-workspace{margin-top:22px}.v35-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-top:2px solid var(--ink,#171717);border-bottom:1px solid var(--line,#d8d5cf)}.v35-kpis>div{padding:15px 14px;border-right:1px solid var(--line,#d8d5cf)}.v35-kpis>div:last-child{border-right:0}.v35-kpis span,.v35-caption,.v35-track-labels,.v35-zero-note{font-size:12px;color:var(--muted,#68655f)}.v35-kpis strong{display:block;margin-top:5px;font-size:21px;line-height:1.15;font-variant-numeric:tabular-nums}.v35-panel{padding:24px 0;border-bottom:1px solid var(--line,#d8d5cf)}.v35-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:16px}.v35-section-head h2{margin:0;font-size:19px}.v35-section-head>span{font-size:12px;color:var(--muted,#68655f);font-variant-numeric:tabular-nums}.v35-cost-stack{height:16px;display:flex;overflow:hidden;background:#ece9e4}.v35-cost-stack>i{display:block;height:100%}.v35-cost-stack .p1,.v35-comp-row i.p1{background:#202020}.v35-cost-stack .p2,.v35-comp-row i.p2{background:#65615a}.v35-cost-stack .p3,.v35-comp-row i.p3{background:#9d978e}.v35-cost-stack .p4,.v35-comp-row i.p4{background:#d5d0c8}.v35-comp-list{margin-top:10px}.v35-comp-row{display:grid;grid-template-columns:minmax(110px,1fr) auto 58px;gap:14px;align-items:center;min-height:38px;border-bottom:1px solid #ece9e4;font-variant-numeric:tabular-nums}.v35-comp-row>span{display:flex;align-items:center;gap:8px;font-size:13px}.v35-comp-row>span i{width:8px;height:8px;display:inline-block}.v35-comp-row strong{font-size:14px}.v35-comp-row em{font-style:normal;text-align:right;color:var(--muted,#68655f);font-size:12px}.v35-caption{margin:10px 0 0;line-height:1.6}.v35-benchmarks{display:grid;grid-template-columns:1fr 1fr;gap:0 28px}.v35-benchmark{padding:13px 0 18px;border-bottom:1px solid #ece9e4}.v35-benchmark-head{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:baseline}.v35-benchmark-head span{font-size:13px;font-weight:700}.v35-benchmark-head strong{font-size:16px;font-variant-numeric:tabular-nums}.v35-benchmark-head em{font-size:11px;font-style:normal;color:var(--muted,#68655f)}.v35-track{height:18px;position:relative;margin:12px 3px 6px}.v35-track:before{content:'';position:absolute;left:0;right:0;top:8px;height:2px;background:#dedad4}.v35-iqr{position:absolute;top:5px;height:8px;background:#a49e95}.v35-median{position:absolute;top:2px;width:2px;height:14px;background:#171717;transform:translateX(-1px)}.v35-marker{position:absolute;top:4px;width:10px;height:10px;border:2px solid #171717;background:#fff;border-radius:50%;transform:translateX(-5px)}.v35-track-labels{display:flex;justify-content:space-between;gap:8px;font-variant-numeric:tabular-nums}.v35-zero-note{display:block;margin-top:5px}.v35-history{display:block;width:100%;height:auto;max-height:210px;border-top:1px solid #ece9e4;border-bottom:1px solid #ece9e4}.v35-history polyline{fill:none;stroke:#202020;stroke-width:2}.v35-history circle{fill:#fff;stroke:#202020;stroke-width:2}.v35-history text{font-size:12px;fill:#595650;font-variant-numeric:tabular-nums}.v35-year-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-bottom:1px solid #ece9e4}.v35-year{padding:12px 14px;border-right:1px solid #ece9e4;display:grid;grid-template-columns:repeat(2,1fr);gap:6px 12px}.v35-year:last-child{border-right:0}.v35-year>strong{grid-column:1/-1;font-size:13px}.v35-year span{font-size:11px;color:var(--muted,#68655f)}.v35-year b{display:block;margin-top:2px;color:var(--ink,#171717);font-size:13px;font-variant-numeric:tabular-nums}.v35-raw-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid #bcb7af}.v35-raw-grid>div{padding:11px 12px;border-right:1px solid #ece9e4;border-bottom:1px solid #ece9e4}.v35-raw-grid>div:nth-child(4n){border-right:0}.v35-raw-grid span{display:block;font-size:11px;color:var(--muted,#68655f)}.v35-raw-grid strong{display:block;margin-top:4px;font-size:13px;font-variant-numeric:tabular-nums}.v35-brand-detail .brand-toc nav{gap:16px}.v35-brand-detail .brand-toc a{white-space:nowrap}\n@media(max-width:760px){.v35-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.v35-kpis>div{border-bottom:1px solid var(--line,#d8d5cf)}.v35-kpis>div:nth-child(2n){border-right:0}.v35-kpis>div:last-child{grid-column:1/-1;border-bottom:0}.v35-benchmarks{grid-template-columns:1fr}.v35-benchmark-head{grid-template-columns:1fr auto}.v35-benchmark-head em{grid-column:1/-1}.v35-track-labels{font-size:10px}.v35-year-list{display:flex;overflow-x:auto}.v35-year{min-width:210px}.v35-raw-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.v35-raw-grid>div:nth-child(4n){border-right:1px solid #ece9e4}.v35-raw-grid>div:nth-child(2n){border-right:0}.v35-brand-detail .brand-toc{overflow-x:auto}.v35-brand-detail .brand-toc nav{width:max-content}}\n/* v11.35 brand detail end */\n`;
await fs.writeFile(cssPath,css,'utf8');

const report={schemaVersion:1,uiVersion:'11.35',generatedAt:new Date().toISOString(),snapshot:snap.snapshot_id,productionCandidateCount:candidates.length,trustedBrands:snap.brands.length,categoryCount:Object.keys(snap.categories||{}).length,brandPages,coreKpisPerBrand:5,componentsPerBrand:4,benchmarksPerBrand:4,benchmarkTracks:brandPages*4,historyCards,zeroAreaBrands,operatorCostPreserved,sourceSectionsPreserved,removedLegacySections,previewNoindex:true,productionDeployed:false,policy:'PREVIEW_ONLY;SINGLE_BRAND_WORKSPACE;TRUSTED_SNAPSHOT_ONLY;RAW_ZERO_RETAINED;POSITIVE_ONLY_AREA_BENCHMARK;NO_RECOMMENDATION_SCORE;NO_NEW_ROUTE;NO_CANDIDATE_CHANGE;NO_INDEX_CHANGE;NO_PRODUCTION_DEPLOY'};
await fs.writeFile(path.join(out,'v11-35-brand-detail.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_35BrandDetail:'PASS',...report},null,2));
