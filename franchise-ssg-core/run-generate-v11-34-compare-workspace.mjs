import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const brands=snap.brands||[];
const bySlug=new Map(brands.map(b=>[b.slug,b]));
const STATIC_ROUTES=candidates.filter(r=>r.startsWith('/compare/')&&r!=='/compare/');
const HTML_START='<!-- v11.34 compare workspace -->';
const HTML_END='<!-- v11.34 compare workspace end -->';
const JS_START='/* v11.34 compare workspace */';
const JS_END='/* v11.34 compare workspace end */';
const CSS_START='/* v11.34 compare workspace */';
const CSS_END='/* v11.34 compare workspace end */';

if(snap.uiVersion!=='11.26'||snap.brand_count!==136||snap.category_count!==20)throw new Error(`v11.34 snapshot gate ${snap.uiVersion}/${snap.brand_count}/${snap.category_count}`);
if(candidates.length!==184||!candidates.includes('/compare/'))throw new Error(`v11.34 candidate gate ${candidates.length}/${candidates.includes('/compare/')}`);
if(STATIC_ROUTES.length!==7)throw new Error(`v11.34 static compare gate ${STATIC_ROUTES.length}/7`);

function normalizeRoute(r){let s=String(r||'').split(/[?#]/)[0];try{s=decodeURIComponent(s)}catch{}return s==='/'?'/':`/${s.replace(/^\/+|\/+$/g,'')}/`}
function esc(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function finite(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function median(values){const a=values.filter(finite).map(Number).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function won(v){return finite(v)?`${Number(v).toLocaleString('ko-KR',{maximumFractionDigits:1})}만원`:'—'}
function cnt(v){return finite(v)?`${Number(v).toLocaleString('ko-KR',{maximumFractionDigits:1})}개`:'—'}
function pct(v){return finite(v)?`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%`:'—'}
function pp(v){return finite(v)?`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%p`:'—'}
function raw(v){return finite(v)?String(Number(v)):'null'}
function stripBlock(text,start,end){const a=text.indexOf(start);if(a<0)return text;const b=text.indexOf(end,a);if(b<0)return text;return text.slice(0,a)+text.slice(b+end.length).replace(/^\n/,'')}
function replaceMarkerBlock(text,start,end,next){const a=text.indexOf(start);if(a<0)return null;const b=text.indexOf(end,a);if(b<0)throw new Error(`marker end missing ${end}`);return text.slice(0,a)+next+text.slice(b+end.length)}
function pairFromRoute(route){const base=route.replace(/^\/compare\//,'').replace(/\/$/,'');const [a,b]=base.split('-vs-');if(!a||!b)return null;return [a,b]}
function compareFile(route){return path.join(out,...route.split('/').filter(Boolean),'index.html')}

const globalSales=median(brands.map(b=>b.sales));
const globalArea=median(brands.map(b=>finite(b.salesPerArea)&&Number(b.salesPerArea)>0?Number(b.salesPerArea):null));
if(!finite(globalSales)||!finite(globalArea))throw new Error('v11.34 global median gate');

const coreDefs=[
  ['cost','창업비용',won],
  ['stores','가맹점',cnt],
  ['sales','평균매출',won],
  ['growth','점포증감',pct]
];
const componentDefs=[['franchise','가맹비'],['education','교육비'],['deposit','보증금'],['etc','기타']];
const diffDefs=[
  ['franchise','가맹비',b=>b.components?.franchise,won,'won'],
  ['education','교육비',b=>b.components?.education,won,'won'],
  ['deposit','보증금',b=>b.components?.deposit,won,'won'],
  ['etc','기타',b=>b.components?.etc,won,'won'],
  ['cost','창업비용',b=>b.cost,won,'won'],
  ['stores','가맹점',b=>b.stores,cnt,'count'],
  ['sales','평균매출',b=>b.sales,won,'won'],
  ['salesPerArea','3.3㎡매출',b=>b.salesPerArea,won,'won'],
  ['growth','점포증감',b=>b.growth,pct,'pp']
];

function coreRows(selected){
  return coreDefs.map(([key,label,fmt])=>{
    const vals=selected.map(b=>finite(b[key])?Number(b[key]):null);
    const max=Math.max(...vals.filter(finite).map(v=>Math.abs(Number(v))),1);
    const rows=selected.map((b,i)=>{
      const v=vals[i];let left=0,width=0;
      if(v!==null){if(key==='growth'){width=Math.min(50,Math.abs(v)/max*50);left=v<0?50-width:50}else width=Math.max(1.5,Math.abs(v)/max*100)}
      return `<div class="v34-bar" data-v34-bar="${key}" data-v34-slug="${esc(b.slug)}" data-v34-value="${raw(v)}"><div class="v34-bar-label"><strong>${esc(b.name)}</strong><span>${fmt(v)}</span></div><div class="v34-bar-track${key==='growth'?' is-centered':''}"><i style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%"></i></div></div>`;
    }).join('');
    return `<div class="v34-core-metric" data-v34-core-metric="${key}"><h3>${label}</h3>${rows}</div>`;
  }).join('');
}

function ringFor(b){
  const parts=componentDefs.map(([key,label])=>({key,label,value:finite(b.components?.[key])?Number(b.components[key]):null}));
  const total=parts.reduce((s,p)=>s+(p.value??0),0);
  let offset=0;
  const circles=parts.map((p,i)=>{const share=total>0&&p.value!==null?p.value/total*100:0;const c=`<circle class="v34-ring-seg s${i+1}" cx="22" cy="22" r="15.9155" pathLength="100" stroke-dasharray="${share.toFixed(2)} ${(100-share).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;offset+=share;return c}).join('');
  const legend=parts.map(p=>{const share=total>0&&p.value!==null?p.value/total*100:0;return `<li><span>${p.label}</span><strong>${won(p.value)}</strong><em>${share.toFixed(1)}%</em></li>`}).join('');
  return `<article class="v34-ring-card" data-v34-ring="${esc(b.slug)}" data-v34-total="${raw(total)}"><header><strong>${esc(b.name)}</strong><span>${won(total)}</span></header><div class="v34-ring-body"><svg class="v34-ring" viewBox="0 0 44 44" role="img" aria-label="${esc(b.name)} 비용구성"><circle class="v34-ring-base" cx="22" cy="22" r="15.9155"/>${circles}</svg><ul>${legend}</ul></div></article>`;
}
function componentRows(selected){return `<div class="v34-rings">${selected.map(ringFor).join('')}</div>`}

function benchmarkTrack(b,key,label,value,category,global){
  const axis=Math.max(Number(value)||0,Number(category)||0,Number(global)||0,1)*1.08;
  const pos=v=>Math.max(0,Math.min(100,(Number(v)||0)/axis*100));
  return `<div class="v34-benchmark" data-v34-benchmark="${key}" data-v34-slug="${esc(b.slug)}" data-v34-value="${raw(value)}" data-v34-category="${raw(category)}" data-v34-global="${raw(global)}"><div class="v34-benchmark-title"><strong>${esc(b.name)}</strong><span>${won(value)}</span></div><div class="v34-benchmark-track"><i class="v34-global" style="left:${pos(global).toFixed(2)}%"></i><i class="v34-category" style="left:${pos(category).toFixed(2)}%"></i><b class="v34-selected-point" style="left:${pos(value).toFixed(2)}%"></b></div><div class="v34-benchmark-key"><span>브랜드 ${won(value)}</span><span>업종 ${won(category)}</span><span>전체 ${won(global)}</span></div></div>`;
}
function benchmarkRows(selected){
  const sales=selected.map(b=>benchmarkTrack(b,'sales','평균매출',b.sales,b.category?.salesMedian,globalSales)).join('');
  const area=selected.map(b=>benchmarkTrack(b,'salesPerArea','3.3㎡매출',b.salesPerArea,b.category?.salesPerAreaMedian,globalArea)).join('');
  return `<div class="v34-benchmark-group"><h3>평균매출</h3>${sales}</div><div class="v34-benchmark-group"><h3>3.3㎡매출</h3>${area}</div>`;
}

function deltaValue(vals,type){
  const finiteVals=vals.filter(finite).map(Number);if(finiteVals.length<2)return '—';
  if(vals.length===2){const d=Number(vals[0])-Number(vals[1]);if(type==='count')return `${d>=0?'+':''}${Math.round(d).toLocaleString('ko-KR')}개`;if(type==='pp')return pp(d);return `${d>=0?'+':''}${d.toLocaleString('ko-KR',{maximumFractionDigits:1})}만원`}
  const r=Math.max(...finiteVals)-Math.min(...finiteVals);if(type==='count')return `${Math.round(r).toLocaleString('ko-KR')}개`;if(type==='pp')return `${r.toFixed(1)}%p`;return `${r.toLocaleString('ko-KR',{maximumFractionDigits:1})}만원`;
}
function diffTable(selected){
  const heads=selected.map(b=>`<th>${esc(b.name)}</th>`).join('');
  const tail=selected.length===2?'A-B':'범위';
  const rows=diffDefs.map(([key,label,get,fmt,type])=>{const vals=selected.map(get);return `<tr data-v34-diff="${key}"><th>${label}</th>${vals.map(v=>`<td class="num">${fmt(v)}</td>`).join('')}<td class="num">${deltaValue(vals,type)}</td></tr>`}).join('');
  return `<div class="table-scroll v34-diff-scroll"><table class="data-table v34-diff"><thead><tr><th>지표</th>${heads}<th>${tail}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function workspace(selected,{kind='static',selectors=''}={}){
  return `${HTML_START}<section class="v34-workspace" data-v34-workspace="${kind}"${kind==='static'?` data-v34-static="1"`:''}><header class="v34-workspace-head"><h2>브랜드비교</h2>${kind==='hub'?'<span data-v34-count>2/4</span>':''}</header>${selectors}<section class="v34-zone"><h2>핵심지표</h2><div data-v34-core>${coreRows(selected)}</div></section><section class="v34-zone"><h2>비용구성</h2><div data-v34-components>${componentRows(selected)}</div></section><section class="v34-zone"><h2>매출위치</h2><div data-v34-benchmarks>${benchmarkRows(selected)}</div></section><section class="v34-zone"><h2>차이표</h2><div data-v34-diff-table>${diffTable(selected)}</div></section><div class="v34-source">공정위 공개자료 ${snap.source_year} · ${esc(snap.snapshot_id)}</div></section>${HTML_END}`;
}

const defaultA=bySlug.get('mega-mgc-coffee')||brands[0];
const defaultB=bySlug.get('compose-coffee')||brands[1];
const defaultSelected=[defaultA,defaultB];
const options=brands.map(b=>`<option value="${esc(b.slug)}">${esc(b.name)}</option>`).join('');
const selectors=`<div class="v34-pickers" data-v34-pickers>${[1,2,3,4].map((n,i)=>`<label>브랜드${n}<select data-v34-pick><option value="">선택</option>${options}</select></label>`).join('')}</div><div class="v34-status" data-v34-status></div><script type="application/json" data-v34-comparedata>${JSON.stringify({brands:Object.fromEntries(brands.map(b=>[b.slug,b])),global:{sales:globalSales,salesPerArea:globalArea}}).replace(/</g,'\\u003c')}</script>`;
const hubWorkspace=workspace(defaultSelected,{kind:'hub',selectors});

const hubPath=path.join(out,'compare/index.html');
let hub=await fs.readFile(hubPath,'utf8');
if(!/<meta name="robots" content="noindex,nofollow/.test(hub))throw new Error('v11.34 hub noindex gate');
const existing=replaceMarkerBlock(hub,HTML_START,HTML_END,hubWorkspace);
if(existing!==null)hub=existing;
else {
  const oldStart=hub.indexOf('<section class="v25-multi"');
  const builderStart=hub.indexOf('<section class="block compare-builder"');
  if(oldStart<0||builderStart<0||builderStart<=oldStart)throw new Error('v11.34 hub old workspace boundary missing');
  hub=hub.slice(0,oldStart)+hubWorkspace+hub.slice(builderStart);
}
const duplicateStart=hub.indexOf('<section class="block compare-builder"');
if(duplicateStart>=0){const next=hub.indexOf('<section class="block"><h2>현재 비교 가능한 조합</h2>',duplicateStart);if(next<0)throw new Error('v11.34 duplicate compare end boundary missing');hub=hub.slice(0,duplicateStart)+hub.slice(next)}
hub=hub.replace('<h2>현재 비교 가능한 조합</h2>','<h2>검증조합</h2>').replace('<h2>비교 페이지를 고르는 기준</h2>','<h2>기준</h2>').replace('<h2>대표 비교 바로 보기</h2>','<h2>비교목록</h2>').replace('<h2>숫자를 읽을 때 주의할 점</h2>','<h2>주의</h2>').replace('<h2>비교 다음 단계</h2>','<h2>관련</h2>');
await fs.writeFile(hubPath,hub,'utf8');

const staticPairs=[];
for(const route of STATIC_ROUTES){
  const pair=pairFromRoute(route);if(!pair)throw new Error(`v11.34 bad compare route ${route}`);
  const selected=pair.map(s=>bySlug.get(s));if(selected.some(b=>!b))throw new Error(`v11.34 pair brand missing ${route}`);
  staticPairs.push({route,a:pair[0],b:pair[1]});
  const file=compareFile(route);let html=await fs.readFile(file,'utf8');
  if(!/<meta name="robots" content="noindex,nofollow/.test(html))throw new Error(`v11.34 static noindex gate ${route}`);
  const ws=workspace(selected,{kind:'static'});
  const prev=replaceMarkerBlock(html,HTML_START,HTML_END,ws);
  if(prev!==null)html=prev;
  else {
    const first=html.indexOf('<section class="block"><h2>공개 창업비용 항목은 어떻게 다른가요?</h2>');
    const next=html.indexOf('<section class="block"><h2>가맹점 흐름은 어떻게 달랐나요?</h2>',first);
    if(first<0||next<0)throw new Error(`v11.34 static workspace boundary missing ${route}`);
    html=html.slice(0,first)+ws+html.slice(next);
  }
  html=html.replace(/<div class="answer-box">[\s\S]*?<\/div>/,'<details class="v34-basis"><summary>기준</summary><p>공정위 공개자료 '+snap.source_year+' · 동일 공개항목 기준 비교 · 실제 계약금액과 별도 비용은 원문·견적 확인</p></details>');
  html=html.replace(/<div class="compare-diff">[\s\S]*?<\/div><\/header>/,'</header>');
  html=html.replace(/<aside class="compare-trust-note"[^>]*><b>비교 이력 기준<\/b><p>([\s\S]*?)<\/p><\/aside>/,'<details class="v34-history"><summary>이력</summary><p>$1</p></details>');
  html=html.replace('<h2>가맹점 흐름은 어떻게 달랐나요?</h2>','<h2>점포추이</h2>').replace('<h2>이 비교가 틀릴 수 있는 조건</h2>','<h2>확인사항</h2>').replace('<h2>비교한 브랜드를 더 확인하려면</h2>','<h2>관련</h2>').replace(/>[^<]* 내 조건 계산<\/a>/,'>창업비용</a>').replace('>다른 브랜드 비교</a>','>브랜드비교</a>');
  await fs.writeFile(file,html,'utf8');
}

const client=`\n${JS_START}\n(()=>{\n  const box=document.querySelector('[data-v34-workspace="hub"]');if(!box)return;\n  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));\n  const n=v=>finite(v)?Number(v):null;\n  const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));\n  const won=v=>finite(v)?Number(v).toLocaleString('ko-KR',{maximumFractionDigits:1})+'만원':'—';\n  const cnt=v=>finite(v)?Number(v).toLocaleString('ko-KR',{maximumFractionDigits:1})+'개':'—';\n  const pct=v=>finite(v)?(Number(v)>=0?'+':'')+Number(v).toFixed(1)+'%':'—';\n  const pp=v=>finite(v)?(Number(v)>=0?'+':'')+Number(v).toFixed(1)+'%p':'—';\n  let data={brands:{},global:{}};try{data=JSON.parse(box.querySelector('[data-v34-comparedata]')?.textContent||'{}')}catch{}\n  const picks=[...box.querySelectorAll('[data-v34-pick]')];\n  if(picks[0])picks[0].value=data.brands['mega-mgc-coffee']?'mega-mgc-coffee':Object.keys(data.brands)[0]||'';\n  if(picks[1])picks[1].value=data.brands['compose-coffee']?'compose-coffee':Object.keys(data.brands)[1]||'';\n  const selected=()=>[...new Set(picks.map(x=>x.value).filter(Boolean))].slice(0,4).map(k=>data.brands[k]).filter(Boolean);\n  const core=bs=>[['cost','창업비용',won],['stores','가맹점',cnt],['sales','평균매출',won],['growth','점포증감',pct]].map(d=>{const key=d[0],lab=d[1],fmt=d[2],vals=bs.map(b=>n(b[key])),mx=Math.max(...vals.filter(finite).map(v=>Math.abs(v)),1);return '<div class="v34-core-metric" data-v34-core-metric="'+key+'"><h3>'+lab+'</h3>'+bs.map((b,i)=>{let left=0,width=0,v=vals[i];if(v!==null){if(key==='growth'){width=Math.min(50,Math.abs(v)/mx*50);left=v<0?50-width:50}else width=Math.max(1.5,Math.abs(v)/mx*100)}return '<div class="v34-bar" data-v34-bar="'+key+'" data-v34-slug="'+esc(b.slug)+'" data-v34-value="'+(v===null?'null':v)+'"><div class="v34-bar-label"><strong>'+esc(b.name)+'</strong><span>'+fmt(v)+'</span></div><div class="v34-bar-track'+(key==='growth'?' is-centered':'')+'"><i style="left:'+left.toFixed(2)+'%;width:'+width.toFixed(2)+'%"></i></div></div>'}).join('')+'</div>'}).join('');\n  const rings=bs=>'<div class="v34-rings">'+bs.map(b=>{const defs=[['franchise','가맹비'],['education','교육비'],['deposit','보증금'],['etc','기타']],parts=defs.map(d=>({key:d[0],label:d[1],value:n(b.components?.[d[0]])})),total=parts.reduce((s,p)=>s+(p.value??0),0);let off=0;const circles=parts.map((p,i)=>{const share=total>0&&p.value!==null?p.value/total*100:0,c='<circle class="v34-ring-seg s'+(i+1)+'" cx="22" cy="22" r="15.9155" pathLength="100" stroke-dasharray="'+share.toFixed(2)+' '+(100-share).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'"/>';off+=share;return c}).join(''),legend=parts.map(p=>{const share=total>0&&p.value!==null?p.value/total*100:0;return '<li><span>'+p.label+'</span><strong>'+won(p.value)+'</strong><em>'+share.toFixed(1)+'%</em></li>'}).join('');return '<article class="v34-ring-card" data-v34-ring="'+esc(b.slug)+'" data-v34-total="'+total+'"><header><strong>'+esc(b.name)+'</strong><span>'+won(total)+'</span></header><div class="v34-ring-body"><svg class="v34-ring" viewBox="0 0 44 44" role="img" aria-label="'+esc(b.name)+' 비용구성"><circle class="v34-ring-base" cx="22" cy="22" r="15.9155"/>'+circles+'</svg><ul>'+legend+'</ul></div></article>'}).join('')+'</div>';\n  const track=(b,key,value,category,global)=>{const axis=Math.max(Number(value)||0,Number(category)||0,Number(global)||0,1)*1.08,pos=v=>Math.max(0,Math.min(100,(Number(v)||0)/axis*100));return '<div class="v34-benchmark" data-v34-benchmark="'+key+'" data-v34-slug="'+esc(b.slug)+'" data-v34-value="'+(finite(value)?Number(value):'null')+'" data-v34-category="'+(finite(category)?Number(category):'null')+'" data-v34-global="'+(finite(global)?Number(global):'null')+'"><div class="v34-benchmark-title"><strong>'+esc(b.name)+'</strong><span>'+won(value)+'</span></div><div class="v34-benchmark-track"><i class="v34-global" style="left:'+pos(global).toFixed(2)+'%"></i><i class="v34-category" style="left:'+pos(category).toFixed(2)+'%"></i><b class="v34-selected-point" style="left:'+pos(value).toFixed(2)+'%"></b></div><div class="v34-benchmark-key"><span>브랜드 '+won(value)+'</span><span>업종 '+won(category)+'</span><span>전체 '+won(global)+'</span></div></div>'};\n  const benchmarks=bs=>'<div class="v34-benchmark-group"><h3>평균매출</h3>'+bs.map(b=>track(b,'sales',b.sales,b.category?.salesMedian,data.global.sales)).join('')+'</div><div class="v34-benchmark-group"><h3>3.3㎡매출</h3>'+bs.map(b=>track(b,'salesPerArea',b.salesPerArea,b.category?.salesPerAreaMedian,data.global.salesPerArea)).join('')+'</div>';\n  const diff=bs=>{const defs=[['franchise','가맹비',b=>b.components?.franchise,won,'won'],['education','교육비',b=>b.components?.education,won,'won'],['deposit','보증금',b=>b.components?.deposit,won,'won'],['etc','기타',b=>b.components?.etc,won,'won'],['cost','창업비용',b=>b.cost,won,'won'],['stores','가맹점',b=>b.stores,cnt,'count'],['sales','평균매출',b=>b.sales,won,'won'],['salesPerArea','3.3㎡매출',b=>b.salesPerArea,won,'won'],['growth','점포증감',b=>b.growth,pct,'pp']],delta=(vals,type)=>{const a=vals.filter(finite).map(Number);if(a.length<2)return '—';if(vals.length===2){const d=Number(vals[0])-Number(vals[1]);if(type==='count')return (d>=0?'+':'')+Math.round(d).toLocaleString('ko-KR')+'개';if(type==='pp')return pp(d);return (d>=0?'+':'')+d.toLocaleString('ko-KR',{maximumFractionDigits:1})+'만원'}const r=Math.max(...a)-Math.min(...a);if(type==='count')return Math.round(r).toLocaleString('ko-KR')+'개';if(type==='pp')return r.toFixed(1)+'%p';return r.toLocaleString('ko-KR',{maximumFractionDigits:1})+'만원'};return '<div class="table-scroll v34-diff-scroll"><table class="data-table v34-diff"><thead><tr><th>지표</th>'+bs.map(b=>'<th>'+esc(b.name)+'</th>').join('')+'<th>'+(bs.length===2?'A-B':'범위')+'</th></tr></thead><tbody>'+defs.map(d=>{const vals=bs.map(d[2]);return '<tr data-v34-diff="'+d[0]+'"><th>'+d[1]+'</th>'+vals.map(v=>'<td class="num">'+d[3](v)+'</td>').join('')+'<td class="num">'+delta(vals,d[4])+'</td></tr>'}).join('')+'</tbody></table></div>'};\n  const render=()=>{const bs=selected(),ok=bs.length>=2;box.querySelector('[data-v34-count]').textContent=bs.length+'/4';box.querySelector('[data-v34-status]').textContent=ok?'':'브랜드 2개 이상 선택';box.querySelector('[data-v34-core]').innerHTML=ok?core(bs):'';box.querySelector('[data-v34-components]').innerHTML=ok?rings(bs):'';box.querySelector('[data-v34-benchmarks]').innerHTML=ok?benchmarks(bs):'';box.querySelector('[data-v34-diff-table]').innerHTML=ok?diff(bs):''};\n  picks.forEach(x=>x.addEventListener('change',render));render();\n})();\n${JS_END}\n`;
new Function(client.replace(JS_START,'').replace(JS_END,''));
const appPath=path.join(out,'assets/app.js');let app=await fs.readFile(appPath,'utf8');app=stripBlock(app,JS_START,JS_END).trimEnd()+client;await fs.writeFile(appPath,app,'utf8');

const css=`\n${CSS_START}\n.v34-workspace{border-top:2px solid var(--v25-ink,#171717);border-bottom:1px solid var(--line,#d8d4cd);padding:0 0 20px}.v34-workspace-head{display:flex;align-items:baseline;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--line,#d8d4cd)}.v34-workspace-head h2,.v34-zone>h2{margin:0;font-size:18px}.v34-workspace-head span{font:12px ui-monospace,monospace}.v34-pickers{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:14px 0}.v34-pickers label{display:grid;gap:4px;font-size:10px;color:var(--muted,#6d6963)}.v34-pickers select{min-height:44px;border:1px solid var(--line,#bbb5ad);border-radius:4px;background:#fff;padding:0 9px;color:inherit}.v34-status{min-height:18px;font-size:12px}.v34-zone{padding:18px 0;border-top:1px solid var(--line,#d8d4cd)}.v34-zone>h2{margin-bottom:12px}.v34-core-metric{display:grid;grid-template-columns:112px 1fr;gap:8px 14px;padding:10px 0;border-top:1px solid var(--line,#d8d4cd)}.v34-core-metric h3{grid-row:1/-1;margin:0;font-size:12px}.v34-bar{grid-column:2;display:grid;grid-template-columns:minmax(120px,180px) 1fr;align-items:center;gap:12px}.v34-bar-label{display:flex;justify-content:space-between;gap:8px;font-size:11px}.v34-bar-label strong{font-weight:600}.v34-bar-label span{font-variant-numeric:tabular-nums;white-space:nowrap}.v34-bar-track{position:relative;height:7px;background:#e7e3dc}.v34-bar-track i{position:absolute;top:0;height:100%;background:var(--v25,#183a65)}.v34-bar-track.is-centered:after{content:'';position:absolute;left:50%;top:-3px;bottom:-3px;border-left:1px solid #777}.v34-rings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px}.v34-ring-card{padding:14px 0;border-top:1px solid var(--line,#d8d4cd)}.v34-ring-card header{display:flex;justify-content:space-between;gap:12px;font-size:12px}.v34-ring-body{display:grid;grid-template-columns:112px 1fr;gap:16px;align-items:center;margin-top:10px}.v34-ring{width:104px;height:104px;transform:rotate(-90deg);color:var(--v25,#183a65)}.v34-ring-base,.v34-ring-seg{fill:none;stroke-width:7}.v34-ring-base{stroke:#e7e3dc}.v34-ring-seg{stroke:currentColor}.v34-ring-seg.s2{opacity:.72}.v34-ring-seg.s3{opacity:.48}.v34-ring-seg.s4{opacity:.25}.v34-ring-body ul{list-style:none;margin:0;padding:0}.v34-ring-body li{display:grid;grid-template-columns:1fr auto 52px;gap:8px;padding:5px 0;border-bottom:1px solid var(--line,#e0ddd7);font-size:11px}.v34-ring-body li strong,.v34-ring-body li em{font-variant-numeric:tabular-nums;font-style:normal;text-align:right}.v34-benchmark-group{padding:10px 0;border-top:1px solid var(--line,#d8d4cd)}.v34-benchmark-group h3{margin:0 0 8px;font-size:12px}.v34-benchmark{display:grid;grid-template-columns:180px 1fr;gap:7px 14px;padding:8px 0}.v34-benchmark-title{display:flex;justify-content:space-between;gap:8px;font-size:11px}.v34-benchmark-track{position:relative;height:2px;background:#bbb5ad;margin:9px 4px}.v34-benchmark-track .v34-global,.v34-benchmark-track .v34-category{position:absolute;top:-5px;height:12px;border-left:1px solid #7e7972}.v34-benchmark-track .v34-category{border-left:2px solid var(--v25-ink,#171717)}.v34-selected-point{position:absolute;top:-5px;width:10px;height:10px;transform:translateX(-50%);border:2px solid var(--v25,#183a65);background:#fff;border-radius:50%}.v34-benchmark-key{grid-column:2;display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:var(--muted,#6d6963);font-variant-numeric:tabular-nums}.v34-diff th,.v34-diff td{white-space:nowrap}.v34-diff tbody th{font-weight:600}.v34-source{padding-top:12px;border-top:1px solid var(--line,#d8d4cd);font-size:10px;color:var(--muted,#6d6963)}.v34-basis,.v34-history{margin:10px 0;border-top:1px solid var(--line,#d8d4cd);border-bottom:1px solid var(--line,#d8d4cd);padding:8px 0;font-size:11px}.v34-basis summary,.v34-history summary{cursor:pointer;font-weight:700}.v34-basis p,.v34-history p{margin:8px 0 0;line-height:1.6;color:var(--muted,#6d6963)}\n@media(max-width:700px){.v34-pickers{grid-template-columns:repeat(2,minmax(0,1fr))}.v34-core-metric{grid-template-columns:1fr}.v34-core-metric h3,.v34-bar{grid-column:1}.v34-bar{grid-template-columns:minmax(110px,150px) 1fr}.v34-rings{grid-template-columns:1fr}.v34-benchmark{grid-template-columns:1fr}.v34-benchmark-key{grid-column:1}.v34-ring-body{grid-template-columns:88px 1fr}.v34-ring{width:82px;height:82px}.v34-diff-scroll{overflow-x:auto}.v34-diff{min-width:640px}}\n@media(max-width:460px){.v34-pickers{grid-template-columns:1fr}.v34-bar{grid-template-columns:1fr;gap:5px}.v34-ring-body li{grid-template-columns:1fr auto 46px}.v34-benchmark-key{gap:8px}}\n${CSS_END}\n`;
const cssPath=path.join(out,'assets/site.css');let siteCss=await fs.readFile(cssPath,'utf8');siteCss=stripBlock(siteCss,CSS_START,CSS_END).trimEnd()+css;await fs.writeFile(cssPath,siteCss,'utf8');

const report={schemaVersion:1,uiVersion:'11.34',generatedAt:new Date().toISOString(),snapshot:snap.snapshot_id,productionCandidateCount:candidates.length,trustedBrands:brands.length,categoryCount:snap.category_count,staticComparisons:STATIC_ROUTES.length,hubSelectors:4,coreMetrics:4,componentParts:4,benchmarkMetrics:2,diffRows:diffDefs.length,staticWorkspaces:STATIC_ROUTES.length,staticMetricBars:STATIC_ROUTES.length*2*4,staticRings:STATIC_ROUTES.length*2,staticBenchmarkTracks:STATIC_ROUTES.length*2*2,staticDiffRows:STATIC_ROUTES.length*diffDefs.length,globalMedians:{sales:globalSales,salesPerArea:globalArea},duplicateTwoBrandBuilderRemoved:!hub.includes('data-v11-22-compare-builder'),previewNoindex:/<meta name="robots" content="noindex,nofollow/.test(hub),productionDeployed:false,staticPairs,policy:'PREVIEW_ONLY;ONE_COMPARE_HUB_PLUS_7_CURATED_STATIC_ROUTES;TRUSTED_SNAPSHOT_ONLY;NO_RECOMMENDATION_SCORE;NO_NEW_ROUTE;NO_QUERY_FANOUT;NO_CANDIDATE_CHANGE;NO_INDEX_CHANGE;NO_PRODUCTION_DEPLOY'};
await fs.writeFile(path.join(out,'v11-34-compare-workspace.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_34CompareWorkspace:'PASS',...report},null,2));
