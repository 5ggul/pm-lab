import fs from 'node:fs';
import path from 'node:path';

const BASE='/pm-lab/franchise-ssg-preview';
const START='<!-- v11.52 brand evidence: start -->';
const END='<!-- v11.52 brand evidence: end -->';

function requireRoot(root){if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('Explicit absolute preview root required');}
function esc(v){return String(v??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));}
function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function positive(v){return finite(v)&&Number(v)>0}
function clamp(v){return Math.max(0,Math.min(100,Number(v)))}
function won(v){return finite(v)?new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(Number(v))+'만원':'—'}
function count(v){return finite(v)?new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}).format(Number(v))+'개':'—'}
function signed(v,unit,dec=1){if(!finite(v))return '—';const n=Number(v),sign=n>0?'+':'';return sign+new Intl.NumberFormat('ko-KR',{maximumFractionDigits:dec}).format(n)+unit}
function rel(v,m){return finite(v)&&finite(m)&&Number(m)!==0?(Number(v)-Number(m))/Math.abs(Number(m))*100:null}
function fileFor(root,route){return path.join(root,...String(route).split('/').filter(Boolean),'index.html')}
function ensureStyle(html){
  const tag=`<link rel="stylesheet" href="${BASE}/assets/brand-evidence.css" data-v52-brand-evidence-style>`;
  if(!html.includes('/assets/brand-evidence.css'))html=html.replace('</head>',tag+'</head>');
  return html;
}
function replaceMarked(html,block){
  const a=html.indexOf(START),b=html.indexOf(END);
  if((a<0)!=(b<0))throw new Error('Incomplete brand evidence marker');
  if(a<0)return null;if(b<a)throw new Error('Reversed brand evidence marker');
  return html.slice(0,a)+block+html.slice(b+END.length);
}
function metricRow({key,label,value,median,percentile,unit,positiveOnly=false}){
  const valid=positiveOnly?positive(value):finite(value);
  const p=finite(percentile)?clamp(percentile):null;
  if(!valid||p===null){
    const why=positiveOnly?'양수 공개값이 없어 업종 백분위 비교에서 제외':'비교 가능한 공개값 없음';
    return `<div class="v52-evidence-metric is-missing" data-v52-evidence-metric="${esc(key)}"><strong>${esc(label)}</strong><div><span class="v52-evidence-metric-line"><i style="--v52-p:0%"></i></span><small>${esc(why)}</small></div><em>비교값 없음</em></div>`;
  }
  const v=Number(value),m=finite(median)?Number(median):null,d=m===null?null:v-median,r=m===null?null:rel(v,m);
  const valueText=unit==='개'?count(v):won(v);
  const medianText=m===null?'업종 중앙값 없음':(unit==='개'?count(m):won(m));
  const diffText=d===null?'중앙 차이 계산 불가':`중앙 대비 ${signed(d,unit,unit==='개'?0:1)}${finite(r)?` (${signed(r,'%',1)})`:''}`;
  return `<div class="v52-evidence-metric" data-v52-evidence-metric="${esc(key)}" data-percentile="${p.toFixed(1)}"><strong>${esc(label)}</strong><div><span class="v52-evidence-metric-line"><i style="--v52-p:${p.toFixed(1)}%"></i></span><small>${esc(valueText)} · ${esc(medianText)} · ${esc(diffText)}</small></div><em>${p.toFixed(1)}백분위</em></div>`;
}
function costParts(b){
  const defs=[['가맹비','franchise'],['교육비','education'],['보증금','deposit'],['기타','etc']];
  const vals=defs.map(([label,key])=>({label,key,value:finite(b.components?.[key])?Number(b.components[key]):0}));
  const total=vals.reduce((s,x)=>s+x.value,0);
  if(!(total>0))throw new Error(`Brand evidence component total invalid ${b.slug}`);
  return vals.map(x=>({...x,share:x.value/total*100,total}));
}
function flowOf(b){
  const rows=(Array.isArray(b.history)?b.history:[]).filter(x=>finite(x?.year)&&finite(x?.stores)).sort((a,z)=>Number(a.year)-Number(z.year));
  if(rows.length<2)throw new Error(`Brand evidence history <2 ${b.slug}`);
  const prev=rows.at(-2),latest=rows.at(-1);
  for(const k of ['newStores','contractEnd','contractCancel'])if(!finite(latest?.[k]))throw new Error(`Brand evidence flow missing ${k} ${b.slug}`);
  return{prev,latest,delta:Number(latest.stores)-Number(prev.stores)};
}
function blockFor(b){
  const c=b.category||{};
  const metrics=[
    metricRow({key:'cost',label:'공개 창업비용',value:b.cost,median:c.costMedian,percentile:c.costPercentile,unit:'만원'}),
    metricRow({key:'stores',label:'가맹점 수',value:b.stores,median:c.storesMedian,percentile:c.storesPercentile,unit:'개'}),
    metricRow({key:'sales',label:'연평균매출 공개값',value:b.sales,median:c.salesMedian,percentile:c.salesPercentile,unit:'만원',positiveOnly:true}),
    metricRow({key:'sales-area',label:'3.3㎡당 평균매출',value:b.salesPerArea,median:c.salesPerAreaMedian,percentile:c.salesPerAreaPercentile,unit:'만원',positiveOnly:true})
  ].join('');
  const parts=costParts(b);
  const partHtml=parts.map(x=>`<div class="v52-cost-part" data-v52-cost-part="${esc(x.key)}"><b>${esc(x.label)}</b><div><i style="--v52-share:${x.share.toFixed(1)}%"></i></div><span>${esc(won(x.value))} · ${x.share.toFixed(1)}%</span></div>`).join('');
  const flow=flowOf(b),deltaText=signed(flow.delta,'개',0);
  const sample=finite(c.count)?`업종 분석 브랜드 ${Number(c.count)}개`:'업종 유효 공개값';
  const areaSample=finite(c.salesPerAreaSample)?`3.3㎡당매출 표본 ${Number(c.salesPerAreaSample)}개`:'3.3㎡당매출 유효 공개값';
  return `${START}<section class="v52-brand-evidence" data-v52-brand-evidence="1" data-brand-slug="${esc(b.slug)}" aria-labelledby="v52-brand-evidence-title"><div class="v52-brand-evidence-head"><div><small>공개 원자료 + 자체 계산</small><h2 id="v52-brand-evidence-title">자체 계산 근거</h2></div><span>${esc(b.categoryName)} · ${esc(b.sourceYear)} 기준</span></div><div class="v52-brand-evidence-grid"><div><h3>업종 안에서 숫자 위치</h3><div class="v52-evidence-metrics">${metrics}</div></div><div class="v52-evidence-side"><div class="v52-cost-parts"><h3>공개 창업비용 구성</h3>${partHtml}</div><div class="v52-store-flow" data-v52-store-flow="1"><h3>최근 공개연도 점포 흐름</h3><div class="v52-flow-main"><strong>${esc(flow.prev.year)} → ${esc(flow.latest.year)}</strong><b>가맹점 ${esc(deltaText)}</b><small>${esc(count(flow.prev.stores))} → ${esc(count(flow.latest.stores))}</small></div><div class="v52-flow-counts"><span>신규점<b>${esc(count(flow.latest.newStores))}</b></span><span>계약종료<b>${esc(count(flow.latest.contractEnd))}</b></span><span>계약해지<b>${esc(count(flow.latest.contractCancel))}</b></span></div></div></div></div><p class="v52-brand-evidence-note">백분위는 해당 지표의 유효 공개값을 낮은 값부터 정렬한 위치입니다. 비용·점포·매출의 높은 백분위가 더 좋은 브랜드라는 뜻은 아닙니다. ${esc(sample)} · ${esc(areaSample)}. 신규점·계약종료·계약해지는 서로 다른 공개 항목이며 이 세 값만으로 가맹점 수 증감을 완전히 재구성할 수 있다고 단정하지 않습니다. 0원 공개항목도 무료·면제로 해석하지 않습니다.</p><div class="v52-brand-evidence-links"><a href="${BASE}/methodology/">백분위·누락값 계산 기준</a><a href="${BASE}/guides/how-to-read-open-close-store-counts/">점포 증감 숫자 읽는 법</a></div></section>${END}`;
}
function candidateRoutes(root){
  const quality=JSON.parse(fs.readFileSync(path.join(root,'v11-quality-report.json'),'utf8'));
  return new Set(quality.indexPolicy?.productionCandidateUrls||[]);
}
export function applyBrandEvidence(root,coreDir){
  requireRoot(root);if(typeof coreDir!=='string'||!path.isAbsolute(coreDir))throw new Error('Explicit absolute core dir required');
  const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data-snapshot-v11-26.json'),'utf8'));
  if(snapshot.brand_count!==136||snapshot.brands?.length!==136)throw new Error(`Brand evidence baseline ${snapshot.brand_count}/${snapshot.brands?.length}`);
  const candidates=candidateRoutes(root);
  fs.copyFileSync(path.join(coreDir,'brand-evidence.css'),path.join(root,'assets/brand-evidence.css'));
  let changed=0;
  for(const b of snapshot.brands){
    if(!candidates.has(b.route))throw new Error(`Trusted brand not production candidate ${b.route}`);
    const file=fileFor(root,b.route);let html=fs.readFileSync(file,'utf8'),before=html,block=blockFor(b);
    const replaced=replaceMarked(html,block);
    if(replaced!==null)html=replaced;
    else{
      const anchor='<!-- v11.52 contextual guides: end -->';
      if(!html.includes(anchor))throw new Error(`Brand evidence insertion point missing ${b.route}`);
      html=html.replace(anchor,anchor+block);
    }
    html=ensureStyle(html);
    if(html!==before){fs.writeFileSync(file,html);changed++}
  }
  return{changed,...validateBrandEvidence(root),productionDeploy:false,indexPolicyChanged:false,dataSemanticsChanged:false,candidateSetChanged:false};
}
export function validateBrandEvidence(root){
  requireRoot(root);
  const snapshot=JSON.parse(fs.readFileSync(path.join(root,'data-snapshot-v11-26.json'),'utf8'));
  const trusted=new Set(snapshot.brands.map(b=>b.route));
  const candidates=candidateRoutes(root);
  let pages=0,metricRows=0,costPartRows=0,flowRows=0,missingSalesRows=0,missingAreaRows=0;
  for(const b of snapshot.brands){
    if(!candidates.has(b.route))throw new Error(`Brand evidence candidate drift ${b.route}`);
    const html=fs.readFileSync(fileFor(root,b.route),'utf8');
    if((html.match(/data-v52-brand-evidence="1"/g)||[]).length!==1)throw new Error(`Brand evidence missing ${b.route}`);
    if(!html.includes('/assets/brand-evidence.css'))throw new Error(`Brand evidence style missing ${b.route}`);
    const metrics=(html.match(/data-v52-evidence-metric="/g)||[]).length;if(metrics!==4)throw new Error(`Brand evidence metrics ${b.route} ${metrics}/4`);metricRows+=metrics;
    const parts=(html.match(/data-v52-cost-part="/g)||[]).length;if(parts!==4)throw new Error(`Brand evidence cost parts ${b.route} ${parts}/4`);costPartRows+=parts;
    const flows=(html.match(/data-v52-store-flow="1"/g)||[]).length;if(flows!==1)throw new Error(`Brand evidence flow ${b.route} ${flows}/1`);flowRows+=flows;
    if(!positive(b.sales)){missingSalesRows++;if(!html.includes('data-v52-evidence-metric="sales"')||!html.includes('양수 공개값이 없어 업종 백분위 비교에서 제외'))throw new Error(`Brand evidence missing-sales semantics ${b.route}`)}
    if(!positive(b.salesPerArea)){missingAreaRows++;if(!html.includes('data-v52-evidence-metric="sales-area"')||!html.includes('양수 공개값이 없어 업종 백분위 비교에서 제외'))throw new Error(`Brand evidence missing-area semantics ${b.route}`)}
    for(const token of ['백분위·누락값 계산 기준','점포 증감 숫자 읽는 법','높은 백분위가 더 좋은 브랜드라는 뜻은 아닙니다','0원 공개항목도 무료·면제로 해석하지 않습니다'])if(!html.includes(token))throw new Error(`Brand evidence disclosure missing ${token} ${b.route}`);
    pages++;
  }
  const brandsDir=path.join(root,'brands');
  for(const e of fs.readdirSync(brandsDir,{withFileTypes:true})){
    if(!e.isDirectory())continue;
    const route=`/brands/${e.name}/`,file=path.join(brandsDir,e.name,'index.html');if(!fs.existsSync(file)||trusted.has(route))continue;
    const html=fs.readFileSync(file,'utf8');if(html.includes('data-v52-brand-evidence='))throw new Error(`Non-trusted brand received evidence ${route}`);
  }
  if(!fs.existsSync(path.join(root,'assets/brand-evidence.css')))throw new Error('Brand evidence css missing');
  return{brandEvidence:true,pages,metricRows,costPartRows,flowRows,missingSalesRows,missingAreaRows,candidateOnly:true};
}
