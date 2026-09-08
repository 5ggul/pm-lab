import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

await import(`./run-generate-v5-final.mjs?v6=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const SITE=(process.env.SSG_SITE_URL??`https://5ggul.github.io${BASE}`).replace(/\/$/,'');
const PREVIEW=process.env.SSG_PREVIEW_MODE!=='false';

async function loadClassic(file,expr){const code=await fs.readFile(file,'utf8');const ctx={console};vm.createContext(ctx);vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);return ctx.__EXPORT__}
const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,areas}');
const categories=catalog.categories;
const allAreas=catalog.areas;
const areaDir=path.join(out,'areas');
const available=(await fs.readdir(areaDir,{withFileTypes:true})).filter(e=>e.isDirectory()&&e.name!=='compare').map(e=>e.name);
const areas=available.map(slug=>allAreas.find(a=>a.slug===slug)).filter(Boolean);

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=p=>`${BASE}${p==='/'?'':p}`.replace(/\/+/g,'/');
const canonical=p=>`${SITE}${p==='/'?'':p}`;
const num=n=>n==null||!Number.isFinite(Number(n))?'정보 없음':Math.round(Number(n)).toLocaleString('ko-KR');
const dec=(n,d=1)=>n==null||!Number.isFinite(Number(n))?'정보 없음':Number(n).toFixed(d);
const pct=n=>n==null||!Number.isFinite(Number(n))?'정보 없음':`${Number(n).toFixed(1)}%`;
const label=a=>`${a.sido} ${a.name}`.replace('경기 수원 ','경기 수원시 ').replace('경기 성남 ','경기 성남시 ').replace('경기 용인 ','경기 용인시 ');
const density=a=>a?.areaKm2>0?a.allStores/a.areaKm2:null;
const foodShare=a=>a?.allStores>0?a.foodStores/a.allStores*100:null;
const categoryDensity=(a,slug)=>a?.areaKm2>0?(Number(a.categoryCounts?.[slug])||0)/a.areaKm2:null;
const topCategories=a=>Object.entries(a.categoryCounts||{}).map(([slug,count])=>({slug,count:Number(count)||0,name:categories[slug]?.name||slug,density:categoryDensity(a,slug)})).sort((x,y)=>y.count-x.count).slice(0,6);

function header(){return `<header class="site-header"><div class="shell header-inner"><a class="logo" href="${url('/')}">창업데이터랩</a><nav><a href="${url('/brands/')}">브랜드</a><a href="${url('/explore/')}">탐색</a><a href="${url('/compare/')}">브랜드 비교</a><a href="${url('/areas/')}">지역</a><a href="${url('/tools/')}">계산기</a><a href="${url('/guides/')}">가이드</a></nav><button class="nav-toggle" aria-label="메뉴 열기">메뉴</button></div></header>`}
function footer(){return `<footer class="site-footer"><div class="shell footer-grid"><div><b>창업데이터랩</b><p>공개 데이터와 사용자가 입력한 비용을 분리해 보는 프랜차이즈 비교 도구입니다.</p></div><div><a href="${url('/about/')}">서비스 소개</a><a href="${url('/sources/')}">데이터 출처</a><a href="${url('/methodology/')}">계산 기준</a><a href="${url('/disclaimer/')}">이용 전 확인사항</a></div><div><a href="${url('/privacy/')}">개인정보처리방침</a><a href="${url('/terms/')}">이용약관</a><a href="${url('/contact/')}">문의</a></div></div><div class="shell footer-note">공식 가맹본부·정부기관 사이트가 아닙니다. 계약 전 최신 정보공개서와 실제 계약조건을 확인하세요.</div></footer>`}
function crumbs(items){return `<nav class="crumbs" aria-label="현재 위치">${items.map((x,i)=>i===items.length-1?`<span>${esc(x.name)}</span>`:`<a href="${url(x.path)}">${esc(x.name)}</a>`).join('<i>›</i>')}</nav>`}
function layout({pagePath,title,description,main,extra='',schema=[]}){const robots=PREVIEW?'<meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><meta name="googlebot" content="noindex,nofollow,noarchive,nosnippet">':'<meta name="robots" content="index,follow">';const ld=schema.map(x=>`<script type="application/ld+json">${JSON.stringify(x).replace(/<\//g,'<\\/')}</script>`).join('');const bar=PREVIEW?'<div class="preview-bar">외부 검수용 SSG 프리뷰 · 검색엔진 제외(noindex) · 지역 숫자는 공식 상권 Snapshot 연결 전 합성값</div>':'';return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${robots}<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical(pagePath))}"><link rel="stylesheet" href="${url('/assets/site.css')}">${ld}</head><body>${bar}${header()}<main id="main">${main}</main>${footer()}<script src="${url('/assets/app.js')}" defer></script>${extra}</body></html>`}
async function writePage(pagePath,html){const dir=pagePath==='/'?out:path.join(out,pagePath.replace(/^\//,'').replace(/\/$/,''));await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'index.html'),html,'utf8')}
function dataBox(){return `<aside class="source-box"><b>현재 지역 데이터 상태</b><p>지역 업소 수·면적·업종별 업소 수는 상권 비교 UI를 검수하기 위한 합성값입니다. 소상공인 상권 API Snapshot이 검증되기 전에는 검색엔진에 노출하지 않습니다.</p><p><b>밀도는 공급 관찰값이지 수요·매출·성공 가능성 점수가 아닙니다.</b></p></aside>`}

const areaCards=areas.map(a=>`<a href="${url(`/areas/${a.slug}/`)}"><b>${esc(label(a))}</b><span>전체 업소 ${num(a.allStores)}곳 · 면적 ${num(a.areaKm2)}㎢ · 전체 업소 밀도 ${dec(density(a))}곳/㎢</span></a>`).join('');
const areasMain=`<div class="shell page" data-area-hub-v6="1">${crumbs([{name:'홈',path:'/'},{name:'탐색',path:'/explore/'},{name:'지역'}])}<div class="page-head"><h1>지역별 프랜차이즈·상권 데이터</h1><p class="answer">현재 준비된 12개 지역을 같은 기준으로 봅니다. 전체 업소·외식 업소·면적·업소 밀도와 업종별 공급량을 비교하되, 밀도가 높거나 낮다는 이유만으로 좋은 상권이라고 판단하지 않습니다.</p></div><section class="block"><div class="actions"><a class="button" href="${url('/areas/compare/')}">두 지역 직접 비교</a><a href="${url('/guides/trade-area-density/')}">상권 밀도 해석법</a></div></section><div class="link-cards">${areaCards}</div>${dataBox()}</div>`;
await writePage('/areas/',layout({pagePath:'/areas/',title:'지역별 프랜차이즈·상권 데이터 | 창업데이터랩',description:'서울과 경기 주요 지역의 전체 업소, 외식 업소, 면적, 업종별 공급 밀도를 같은 기준으로 비교합니다.',main:areasMain}));

for(const a of areas){
 const top=topCategories(a);
 const topRows=top.map(x=>`<tr><td>${esc(x.name)}</td><td>${num(x.count)}곳</td><td>${dec(x.density)}곳/㎢</td></tr>`).join('');
 const main=`<div class="shell page" data-area-v6="1" data-area-slug="${esc(a.slug)}">${crumbs([{name:'홈',path:'/'},{name:'지역',path:'/areas/'},{name:label(a)}])}<div class="page-head"><h1>${esc(label(a))} 업종·상권 공급 구조</h1><p class="answer">전체 업소 <b>${num(a.allStores)}곳</b>, 외식 업소 <b>${num(a.foodStores)}곳</b>, 면적 <b>${num(a.areaKm2)}㎢</b>인 프리뷰입니다. 전체 업소 밀도는 <b>${dec(density(a))}곳/㎢</b>입니다.</p></div><section class="block"><h2>지역 기본 지표</h2><div class="metric-row"><div><span>전체 업소</span><b>${num(a.allStores)}곳</b></div><div><span>외식 업소</span><b>${num(a.foodStores)}곳</b></div><div><span>외식 업소 비중</span><b>${pct(foodShare(a))}</b></div><div><span>면적</span><b>${num(a.areaKm2)}㎢</b></div><div><span>전체 업소 밀도</span><b>${dec(density(a))}곳/㎢</b></div><div><span>비교 가능한 업종</span><b>${Object.keys(a.categoryCounts||{}).length}개</b></div></div></section><section class="block"><h2>공급량이 큰 업종 6개</h2><div class="table-wrap"><table><thead><tr><th>업종</th><th>업소 수</th><th>면적 대비 밀도</th></tr></thead><tbody>${topRows}</tbody></table></div><p class="note">업소 수가 많다는 사실은 해당 지역의 수요·매출·수익성이 높다는 의미가 아닙니다.</p></section><section class="block"><h2>다른 지역과 같은 기준으로 비교</h2><div class="actions"><a class="button" href="${url(`/areas/compare/?a=${encodeURIComponent(a.slug)}`)}">이 지역을 기준으로 비교</a><a href="${url('/areas/')}">지역 목록</a><a href="${url('/guides/trade-area-density/')}">밀도 지표 읽는 법</a></div></section>${dataBox()}</div>`;
 await writePage(`/areas/${a.slug}/`,layout({pagePath:`/areas/${a.slug}/`,title:`${label(a)} 프랜차이즈 업종·상권 밀도 | 창업데이터랩`,description:`${label(a)}의 전체 업소, 외식 업소, 면적과 업종별 공급 밀도를 비교합니다.`,main}));
}

const publicAreas=areas.map(a=>({slug:a.slug,label:label(a),allStores:a.allStores,foodStores:a.foodStores,areaKm2:a.areaKm2,categoryCounts:a.categoryCounts}));
const options=areas.map(a=>`<option value="${esc(a.slug)}">${esc(label(a))}</option>`).join('');
const compareMain=`<div class="shell page" data-area-compare-v6="1">${crumbs([{name:'홈',path:'/'},{name:'지역',path:'/areas/'},{name:'지역 비교'}])}<div class="page-head"><h1>두 지역 상권 데이터 비교</h1><p class="answer">두 지역을 선택해 전체 업소·외식 업소·면적·밀도와 업종별 공급량을 같은 기준으로 비교합니다. 결과는 차이를 보여줄 뿐 어느 지역이 더 좋은지 판정하지 않습니다.</p></div><form id="areaCompareForm" class="calculator"><label>지역 A<select id="areaA">${options}</select></label><label>지역 B<select id="areaB">${options}</select></label><label>비교 업종<select id="areaCategory"><option value="all">전체 업소</option>${Object.entries(categories).map(([slug,c])=>`<option value="${esc(slug)}">${esc(c.name)}</option>`).join('')}</select></label><output id="areaCompareOutput"></output></form><section class="block"><h2>계산식</h2><p class="formula">전체 업소 밀도 = 전체 업소 수 ÷ 행정구역 면적(㎢)</p><p class="formula">선택 업종 밀도 = 선택 업종 업소 수 ÷ 행정구역 면적(㎢)</p></section><section class="block"><h2>비교표</h2><div id="areaCompareTable" class="table-wrap"></div></section><section class="block"><h2>계산 예</h2><div class="example-grid"><div><b>강남구 vs 마포구</b><p>같은 업종의 업소 수와 ㎢당 공급량을 따로 비교합니다.</p></div><div><b>면적 차이 보정</b><p>절대 업소 수뿐 아니라 면적 대비 밀도를 함께 봅니다.</p></div></div></section><section class="block"><h2>자주 묻는 질문</h2><div class="faq"><details><summary>밀도가 낮은 지역이 창업하기 더 좋은가요?</summary><p>그렇게 판단할 수 없습니다. 낮은 밀도는 공급이 적다는 관찰값일 뿐 수요가 충분하다는 뜻이 아닙니다.</p></details><details><summary>밀도가 높은 지역은 경쟁이 심하다고 보면 되나요?</summary><p>공급이 많다는 신호로 볼 수 있지만 유동인구·거주인구·매출·임대료·상권 성격을 함께 확인해야 합니다.</p></details><details><summary>업소 수와 프랜차이즈 가맹점 수는 같은 숫자인가요?</summary><p>아닙니다. 지역 업소 수와 특정 브랜드의 가맹점 수는 서로 다른 지표입니다.</p></details><details><summary>현재 숫자는 공식 데이터인가요?</summary><p>아닙니다. 현재 프리뷰는 구조 검수용 합성값이며 공식 상권 API Snapshot 연결 전까지 noindex입니다.</p></details></div></section>${dataBox()}</div>`;
const compareScript=`<script>(()=>{const areas=${JSON.stringify(publicAreas).replace(/</g,'\\u003c')};const cats=${JSON.stringify(Object.fromEntries(Object.entries(categories).map(([k,v])=>[k,v.name]))).replace(/</g,'\\u003c')};const by=new Map(areas.map(x=>[x.slug,x]));const aEl=document.getElementById('areaA'),bEl=document.getElementById('areaB'),cEl=document.getElementById('areaCategory'),out=document.getElementById('areaCompareOutput'),table=document.getElementById('areaCompareTable');const params=new URLSearchParams(location.search);if(params.get('a')&&by.has(params.get('a')))aEl.value=params.get('a');if(params.get('b')&&by.has(params.get('b')))bEl.value=params.get('b');if(!params.get('b')&&areas[1])bEl.value=areas[1].slug;function fmt(n,d=0){return Number.isFinite(n)?n.toLocaleString('ko-KR',{maximumFractionDigits:d,minimumFractionDigits:d}):'정보 없음'}function dens(x,count){return x.areaKm2>0?count/x.areaKm2:null}function render(){const a=by.get(aEl.value),b=by.get(bEl.value),cat=cEl.value;const aCount=cat==='all'?a.allStores:Number(a.categoryCounts?.[cat]||0),bCount=cat==='all'?b.allStores:Number(b.categoryCounts?.[cat]||0),ad=dens(a,aCount),bd=dens(b,bCount),name=cat==='all'?'전체 업소':cats[cat];out.innerHTML='<b>'+name+' 공급량 비교</b><br>'+a.label+' '+fmt(aCount)+'곳 · '+fmt(ad,1)+'곳/㎢ / '+b.label+' '+fmt(bCount)+'곳 · '+fmt(bd,1)+'곳/㎢';const rows=[['전체 업소',a.allStores,b.allStores,'곳'],['외식 업소',a.foodStores,b.foodStores,'곳'],['면적',a.areaKm2,b.areaKm2,'㎢'],['전체 업소 밀도',dens(a,a.allStores),dens(b,b.allStores),'곳/㎢'],[name+' 업소 수',aCount,bCount,'곳'],[name+' 밀도',ad,bd,'곳/㎢']];table.innerHTML='<table><thead><tr><th>지표</th><th>'+a.label+'</th><th>'+b.label+'</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td>'+r[0]+'</td><td>'+fmt(r[1],i===3||i===5?1:0)+r[3]+'</td><td>'+fmt(r[2],i===3||i===5?1:0)+r[3]+'</td></tr>').join('')+'</tbody></table>'}aEl.addEventListener('change',render);bEl.addEventListener('change',render);cEl.addEventListener('change',render);render()})();</script>`;
await writePage('/areas/compare/',layout({pagePath:'/areas/compare/',title:'두 지역 상권 데이터 비교 | 창업데이터랩',description:'두 지역의 전체 업소, 외식 업소, 면적, 업종별 업소 수와 공급 밀도를 같은 기준으로 비교합니다.',main:compareMain,extra:compareScript,schema:[{'@context':'https://schema.org','@type':'WebApplication',name:'두 지역 상권 데이터 비교',url:canonical('/areas/compare/'),applicationCategory:'BusinessApplication',operatingSystem:'Web'}]}));

const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.coverage.areaCompare=1;
manifest.productEnhancements={...(manifest.productEnhancements||{}),areaCompare:true,areaMetricEnrichment:true,areaRecommendationScore:false};
manifest.areaData={mode:'SYNTHETIC_STRUCTURE_PREVIEW',availableAreas:areas.length,metrics:['allStores','foodStores','areaKm2','storeDensity','categoryCount','categoryDensity']};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');

console.log(JSON.stringify({v6:true,areas:areas.length,areaCompare:true,areaMetricEnrichment:true,recommendationScore:false},null,2));
