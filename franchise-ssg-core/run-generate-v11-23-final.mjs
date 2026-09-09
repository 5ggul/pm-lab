import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {matchOfficialBrands} from './official-merge.mjs';

await import(`./run-generate-v11-22-final.mjs?v1123=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const SITE=(process.env.SSG_SITE_URL??'https://5ggul.github.io/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const COST_SOURCE='https://www.data.go.kr/data/15110265/openapi.do';
const STORE_SOURCE='https://www.data.go.kr/data/15110241/openapi.do';
const generatedAt=new Date().toISOString();
const route='/cost-components/';

async function loadClassic(file,expr){const code=await fs.readFile(file,'utf8');const ctx={console};vm.createContext(ctx);vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);return ctx.__EXPORT__}
const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,brands}');
const official=JSON.parse(await fs.readFile(path.join(repo,'data/franchise/official/brands-2025.json'),'utf8'));
const report13=JSON.parse(await fs.readFile(path.join(out,'v11-13-brand-expansion.json'),'utf8'));
const report14=JSON.parse(await fs.readFile(path.join(out,'v11-14-history-tiers.json'),'utf8'));
const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const matched=matchOfficialBrands(catalog.brands,official);
const recordByName=new Map(matched.matches.map(x=>[x.brand.name,x.record]));
const catalogByName=new Map(catalog.brands.map(x=>[x.name,x]));
const trustedRoutes=new Set((report14.candidateUrls||[]).filter(r=>/^\/brands\/[^/]+\/$/.test(r)).map(normalizeRoute));
const candidateBefore=new Set((quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
const safeJson=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const won=n=>finite(n)?`${Math.round(Number(n)).toLocaleString('ko-KR')}만원`:'정보 없음';
const num=n=>finite(n)?Math.round(Number(n)).toLocaleString('ko-KR'):'정보 없음';
function normalizeRoute(r){return r==='/'?'/':`/${String(r).replace(/^\/+|\/+$/g,'')}/`}
function median(values){const a=values.filter(finite).map(Number).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}

const trusted=(report13.eligibility||[]).filter(row=>trustedRoutes.has(normalizeRoute(row.route))).map(row=>{
  const record=recordByName.get(row.name);const b=catalogByName.get(row.name)||{};const c=record?.costComponents||{};
  const components={franchise:finite(c.franchiseFee10k)?Number(c.franchiseFee10k):null,education:finite(c.education10k)?Number(c.education10k):null,deposit:finite(c.deposit10k)?Number(c.deposit10k):null,etc:finite(c.etc10k)?Number(c.etc10k):null};
  return {name:row.name,route:normalizeRoute(row.route),categorySlug:b.categorySlug||'',categoryName:b.category||catalog.categories?.[b.categorySlug]?.name||'기타',total:finite(record?.startupCost10k)?Number(record.startupCost10k):finite(row.metrics?.cost)?Number(row.metrics.cost):null,...components};
}).filter(row=>[row.total,row.franchise,row.education,row.deposit,row.etc].every(finite));
if(trusted.length!==report14.productionBrandCandidates)throw new Error(`Component hub trusted rows mismatch ${trusted.length}/${report14.productionBrandCandidates}`);

const lowFee=[...trusted].sort((a,b)=>a.franchise-b.franchise||a.total-b.total||a.name.localeCompare(b.name,'ko'));
const lowEducation=[...trusted].sort((a,b)=>a.education-b.education||a.total-b.total||a.name.localeCompare(b.name,'ko'));
const lowDeposit=[...trusted].sort((a,b)=>a.deposit-b.deposit||a.total-b.total||a.name.localeCompare(b.name,'ko'));
const feeZero=trusted.filter(x=>x.franchise===0).sort((a,b)=>a.total-b.total||a.name.localeCompare(b.name,'ko'));
const educationZero=trusted.filter(x=>x.education===0).sort((a,b)=>a.total-b.total||a.name.localeCompare(b.name,'ko'));
const depositZero=trusted.filter(x=>x.deposit===0).sort((a,b)=>a.total-b.total||a.name.localeCompare(b.name,'ko'));
const globalMedian={franchise:median(trusted.map(x=>x.franchise)),education:median(trusted.map(x=>x.education)),deposit:median(trusted.map(x=>x.deposit)),etc:median(trusted.map(x=>x.etc)),total:median(trusted.map(x=>x.total))};
const categoryStats=[...new Set(trusted.map(x=>x.categorySlug).filter(Boolean))].map(slug=>{const rows=trusted.filter(x=>x.categorySlug===slug);return {slug,name:rows[0]?.categoryName||catalog.categories?.[slug]?.name||slug,count:rows.length,franchise:median(rows.map(x=>x.franchise)),education:median(rows.map(x=>x.education)),deposit:median(rows.map(x=>x.deposit)),etc:median(rows.map(x=>x.etc)),total:median(rows.map(x=>x.total))}}).sort((a,b)=>a.franchise-b.franchise||a.name.localeCompare(b.name,'ko'));
const reviewDate=String(official.generatedAt||report14.generatedAt||generatedAt).slice(0,10);
const robots=PREVIEW?'noindex,nofollow,noarchive,nosnippet':'index,follow';

function lowRows(rows,key,limit=20){return rows.slice(0,limit).map((x,i)=>`<tr><td class="num">${i+1}</td><td><a href="${BASE}${x.route}">${esc(x.name)}</a></td><td>${esc(x.categoryName)}</td><td class="num">${won(x[key])}</td><td class="num">${won(x.total)}</td></tr>`).join('')}
const zeroUnion=[...new Map([...feeZero,...educationZero,...depositZero].map(x=>[x.route,x])).values()].sort((a,b)=>a.total-b.total||a.name.localeCompare(b.name,'ko'));
const zeroRows=zeroUnion.slice(0,40).map(x=>`<tr><td><a href="${BASE}${x.route}">${esc(x.name)}</a></td><td>${esc(x.categoryName)}</td><td class="num">${won(x.franchise)}</td><td class="num">${won(x.education)}</td><td class="num">${won(x.deposit)}</td><td class="num">${won(x.total)}</td></tr>`).join('');
const categoryRows=categoryStats.map(x=>`<tr><td><a href="${BASE}/categories/${esc(x.slug)}/">${esc(x.name)}</a></td><td class="num">${x.count}개</td><td class="num">${won(x.franchise)}</td><td class="num">${won(x.education)}</td><td class="num">${won(x.deposit)}</td><td class="num">${won(x.etc)}</td><td class="num">${won(x.total)}</td></tr>`).join('');
const fullRows=[...trusted].sort((a,b)=>a.franchise-b.franchise||a.total-b.total).map(x=>`<tr data-component-row data-cat="${esc(x.categorySlug)}" data-franchise="${x.franchise}" data-education="${x.education}" data-deposit="${x.deposit}" data-etc="${x.etc}" data-total="${x.total}"><td data-rank-no class="num">—</td><td><a href="${BASE}${x.route}">${esc(x.name)}</a></td><td>${esc(x.categoryName)}</td><td class="num">${won(x.franchise)}</td><td class="num">${won(x.education)}</td><td class="num">${won(x.deposit)}</td><td class="num">${won(x.etc)}</td><td class="num">${won(x.total)}</td></tr>`).join('');
const categoryOptions=categoryStats.map(x=>`<option value="${esc(x.slug)}">${esc(x.name)}</option>`).join('');
const dataset={'@context':'https://schema.org','@type':'Dataset','@id':`${SITE}${route}#dataset`,name:'프랜차이즈 가맹비·교육비·본사 보증금·기타비용 비교 데이터',description:`Tier A/B 신뢰 게이트를 통과한 ${trusted.length}개 브랜드의 공정위 공개 비용 구성 항목을 동일 단위로 비교한 데이터입니다.`,url:`${SITE}${route}`,dateModified:reviewDate,creator:{'@type':'Organization',name:'창업데이터랩',url:SITE},isBasedOn:[COST_SOURCE,STORE_SOURCE],measurementTechnique:'공정거래위원회 공개자료 정규화 후 Tier A/B 신뢰 게이트 통과 브랜드만 포함; 0 공개값은 면제·무료로 재해석하지 않음',variableMeasured:[{'@type':'PropertyValue',name:'비교 브랜드 수',value:trusted.length,unitText:'개 브랜드'},{'@type':'PropertyValue',name:'가맹비 중앙값',value:globalMedian.franchise,unitText:'만원'},{'@type':'PropertyValue',name:'교육비 중앙값',value:globalMedian.education,unitText:'만원'},{'@type':'PropertyValue',name:'본사 보증금 중앙값',value:globalMedian.deposit,unitText:'만원'},{'@type':'PropertyValue',name:'가맹비 공개값 0 브랜드 수',value:feeZero.length,unitText:'개 브랜드'},{'@type':'PropertyValue',name:'교육비 공개값 0 브랜드 수',value:educationZero.length,unitText:'개 브랜드'},{'@type':'PropertyValue',name:'본사 보증금 공개값 0 브랜드 수',value:depositZero.length,unitText:'개 브랜드'}]};
const appSchema={'@context':'https://schema.org','@type':'WebApplication',name:'프랜차이즈 비용 구성 비교기',url:`${SITE}${route}`,applicationCategory:'BusinessApplication',operatingSystem:'Web',description:'업종과 비용 항목을 선택해 신뢰 브랜드의 가맹비·교육비·본사 보증금·기타비용·공개 창업비용을 다시 정렬하는 도구'};

const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="${robots}"><meta name="googlebot" content="${robots}"><meta name="bingbot" content="${robots}"><title>프랜차이즈 가맹비 비교 | 교육비·보증금·기타비용</title><meta name="description" content="신뢰 게이트를 통과한 ${trusted.length}개 프랜차이즈의 가맹비·교육비·본사 보증금·기타비용 공개값을 비교합니다. 0원 공개값은 면제라고 단정하지 않고 원문 확인 기준을 함께 제공합니다."><link rel="canonical" href="${SITE}${route}"><script type="application/ld+json" data-v11-component-dataset>${safeJson(dataset)}</script><script type="application/ld+json">${safeJson(appSchema)}</script><link rel="stylesheet" href="${BASE}/assets/site.css"><link rel="icon" href="${BASE}/assets/favicon.svg" type="image/svg+xml"></head><body>${PREVIEW?'<div class="preview-bar">외부 검수용 프리뷰 · 검색엔진 색인 차단</div>':''}<header class="site-header"><div class="shell header-inner"><a class="logo" href="${BASE}">창업데이터랩</a><nav aria-label="주요 메뉴"><a href="${BASE}/brands/">브랜드 찾기</a><a href="${BASE}/categories/">업종별 보기</a><a href="${BASE}/compare/">브랜드 비교</a><a href="${BASE}/tools/">계산기</a><a href="${BASE}/guide/low-price-coffee/">창업 자료</a><a href="${BASE}/sources/">데이터 출처</a></nav><button class="nav-toggle" aria-label="메뉴 열기" aria-expanded="false">메뉴</button></div></header><main id="main" data-v11-component-hub="1"><div class="shell page"><nav class="crumbs" aria-label="현재 위치"><a href="${BASE}">홈</a><i>›</i><span>비용 항목 비교</span></nav><div class="page-head"><h1>프랜차이즈 가맹비·교육비·보증금 비교</h1><p class="answer">공정위 공개 창업비용을 총액 하나로만 보지 않고, Tier A/B 신뢰 게이트를 통과한 ${trusted.length}개 브랜드의 가맹비·교육비·본사 보증금·기타비용을 같은 단위로 분리해 봅니다. 비용 항목이 낮다는 사실은 추천·수익성 점수가 아닙니다.</p></div><div class="stat-grid"><div class="stat-card"><span class="label">비교 브랜드</span><b class="value">${trusted.length}개</b><small>Tier A/B만 포함</small></div><div class="stat-card"><span class="label">가맹비 중앙값</span><b class="value">${won(globalMedian.franchise)}</b><small>공개값 중앙값</small></div><div class="stat-card"><span class="label">교육비 중앙값</span><b class="value">${won(globalMedian.education)}</b><small>공개값 중앙값</small></div><div class="stat-card"><span class="label">본사 보증금 중앙값</span><b class="value">${won(globalMedian.deposit)}</b><small>점포 임대보증금과 다름</small></div></div><section class="block" id="franchise-fee"><h2>프랜차이즈 가맹비가 낮은 순으로 보면?</h2><p>가맹비 공개값을 낮은 순으로 정렬한 앞 20개입니다. 공개값이 0이라고 해서 자동으로 무료·면제라고 해석하지 않습니다. 정보공개서 항목 정의와 가맹본부 최신 안내를 함께 확인해야 합니다.</p><div class="table-scroll"><table class="data-table stack-mobile"><thead><tr><th class="num">순서</th><th>브랜드</th><th>업종</th><th class="num">가맹비 공개값</th><th class="num">공개 창업비용</th></tr></thead><tbody>${lowRows(lowFee,'franchise')}</tbody></table></div></section><section class="block" id="education-fee"><h2>교육비가 낮은 순으로 보면?</h2><p>교육비는 가맹계약 전후 교육과 관련해 공개된 금액 항목입니다. 교육 범위·인원·추가 교육비 조건은 브랜드마다 다를 수 있으므로 낮은 금액 자체를 장점으로 단정하지 않습니다.</p><div class="table-scroll"><table class="data-table stack-mobile"><thead><tr><th class="num">순서</th><th>브랜드</th><th>업종</th><th class="num">교육비 공개값</th><th class="num">공개 창업비용</th></tr></thead><tbody>${lowRows(lowEducation,'education')}</tbody></table></div></section><section class="block" id="deposit-fee"><h2>본사 보증금이 낮은 순으로 보면?</h2><p>여기서 보증금은 공정위 비용 구성에 잡힌 <strong>가맹본부 관련 보증금</strong>입니다. 상가 임대차 계약에서 임대인에게 내는 점포 임대보증금과는 별개입니다.</p><div class="table-scroll"><table class="data-table stack-mobile"><thead><tr><th class="num">순서</th><th>브랜드</th><th>업종</th><th class="num">본사 보증금 공개값</th><th class="num">공개 창업비용</th></tr></thead><tbody>${lowRows(lowDeposit,'deposit')}</tbody></table></div></section><section class="block" id="zero-public"><h2>‘가맹비 없는 프랜차이즈’로 검색할 때 공개값 0원을 어떻게 봐야 하나요?</h2><p>현재 신뢰 브랜드 중 가맹비 공개값 0은 ${feeZero.length}개, 교육비 공개값 0은 ${educationZero.length}개, 본사 보증금 공개값 0은 ${depositZero.length}개입니다. 하지만 0은 곧바로 면제·무료를 뜻한다고 재해석하지 않습니다. 별도 청구 여부, 다른 비용 항목 포함 여부, 최신 정책 변경 여부를 원문에서 확인해야 합니다.</p>${zeroRows?`<div class="table-scroll"><table class="data-table stack-mobile"><thead><tr><th>브랜드</th><th>업종</th><th class="num">가맹비</th><th class="num">교육비</th><th class="num">본사 보증금</th><th class="num">공개 창업비용</th></tr></thead><tbody>${zeroRows}</tbody></table></div>`:'<p>현재 비교 대상에는 세 항목 모두에서 0 공개값이 확인되는 브랜드가 없습니다.</p>'}<div class="callout warning"><strong>0 공개값 ≠ 면제 확정</strong><p>계약 전 최신 정보공개서와 가맹본부 개설 안내에서 실제 청구 조건을 다시 확인하세요.</p></div></section><section class="block" id="category-medians"><h2>업종별 가맹비·교육비·보증금 중앙값은 어떻게 다른가요?</h2><p>같은 업종 안에서도 브랜드마다 비용 구조가 다르기 때문에 업종 중앙값은 비교 기준선으로만 사용합니다. 아래 표는 신뢰 브랜드가 존재하는 업종별 중앙값입니다.</p><div class="table-scroll"><table class="data-table component-category-table"><thead><tr><th>업종</th><th class="num">브랜드</th><th class="num">가맹비</th><th class="num">교육비</th><th class="num">본사 보증금</th><th class="num">기타비용</th><th class="num">공개 창업비용</th></tr></thead><tbody>${categoryRows}</tbody></table></div></section><section class="block" id="all-components"><div class="section-head"><h2>${trusted.length}개 전체 비용 항목 다시 정렬하기</h2><span class="basis-chip">공개값 기준</span></div><form class="calculator component-form" data-component-form><label>업종<select name="cat"><option value="">전체 업종</option>${categoryOptions}</select></label><label>공개값 0 필터<select name="zero"><option value="">전체</option><option value="franchise">가맹비 0</option><option value="education">교육비 0</option><option value="deposit">본사 보증금 0</option><option value="any">세 항목 중 하나 이상 0</option></select></label><label>정렬<select name="sort"><option value="franchise">가맹비 낮은 순</option><option value="education">교육비 낮은 순</option><option value="deposit">본사 보증금 낮은 순</option><option value="etc">기타비용 낮은 순</option><option value="total">공개 창업비용 낮은 순</option></select></label><button type="button" data-component-reset>초기화</button><output>조건 통과: <b data-component-count>${trusted.length}개</b></output></form><div class="table-scroll"><table class="data-table component-full-table"><thead><tr><th class="num">순서</th><th>브랜드</th><th>업종</th><th class="num">가맹비</th><th class="num">교육비</th><th class="num">본사 보증금</th><th class="num">기타비용</th><th class="num">공개 창업비용</th></tr></thead><tbody data-component-results>${fullRows}</tbody></table></div><p class="data-note">‘기타비용’은 브랜드별 정보공개서의 항목 정의가 다를 수 있습니다. 인테리어·설비·초도물품 등이 어떤 방식으로 포함되는지는 브랜드 상세와 원문을 확인해야 합니다.</p></section><section class="block" id="interpretation"><h2>가맹비·교육비·보증금만 더하면 실제 창업비용인가요?</h2><p>아닙니다. 공정위 공개 창업비용에는 기타비용이 함께 있고, 실제 점포에서는 임대보증금·권리금·철거·전기증설·냉난방·소방·외부공사·초도물품·운전자금 등이 별도로 발생할 수 있습니다. 본사 관련 비용 구성과 점포별 실제 지출을 분리해서 계산해야 합니다.</p><div class="peer-links"><a href="${BASE}/tools/disclosure-decoder/"><strong>정보공개서 비용 항목 계산</strong><span>가맹비·교육비·보증금·기타비용을 직접 입력해 합계 확인</span></a><a href="${BASE}/rankings/"><strong>전체 데이터 순위</strong><span>총 창업비용·가맹점·평균매출 공개지표를 별도로 정렬</span></a><a href="${BASE}/explore/"><strong>예산별 브랜드 찾기</strong><span>공개 창업비용 상한과 업종으로 후보 좁히기</span></a></div></section><section class="block" id="source"><h2>출처와 계산 기준</h2><div class="source-box"><p><strong>1차 출처</strong> <a href="${COST_SOURCE}" rel="external noopener">공공데이터포털 · 공정거래위원회 창업비용 통계</a></p><p><strong>보조 출처</strong> <a href="${STORE_SOURCE}" rel="external noopener">공공데이터포털 · 가맹점·매출 통계</a></p><p><strong>기준년도</strong> ${esc(official.referenceYear||'확인 필요')}</p><p><strong>데이터 갱신</strong> ${esc(reviewDate)}</p><p><strong>포함 기준</strong> Tier A/B 신뢰 게이트를 통과하고 4개 비용 구성 항목이 모두 수치로 확인되는 브랜드</p><p><strong>0 처리</strong> 숫자 0은 그대로 표시하되 면제·무료로 재해석하지 않습니다. 누락값은 0으로 바꾸지 않습니다.</p></div></section></div></main><footer class="site-footer"><div class="shell footer-grid"><div><strong>창업데이터랩</strong><p>프랜차이즈 창업비용, 가맹점 수, 평균매출과 계산기를 제공합니다.</p></div><div><a href="${BASE}/about/">서비스 소개</a><a href="${BASE}/sources/">데이터 출처</a><a href="${BASE}/methodology/">계산 기준</a><a href="${BASE}/updates/">데이터 변경 기록</a></div><div><a href="${BASE}/privacy/">개인정보처리방침</a><a href="${BASE}/terms/">이용약관</a><a href="${BASE}/disclaimer/">면책 고지</a><a href="${BASE}/contact/">문의</a></div></div><div class="shell footer-note">공정거래위원회 또는 가맹본부의 공식 사이트가 아닙니다. 공개자료의 해석·정규화 결과이며 계약 전 최신 정보공개서와 실제 견적을 확인해야 합니다.</div></footer><script src="${BASE}/assets/app.js" defer></script></body></html>`;

const pageDir=path.join(out,'cost-components');
await fs.mkdir(pageDir,{recursive:true});
await fs.writeFile(path.join(pageDir,'index.html'),html,'utf8');

const appPath=path.join(out,'assets/app.js');
let app=await fs.readFile(appPath,'utf8');
if(!app.includes('/* v11.23 component filter */')){
  app+=`\n/* v11.23 component filter */\n(()=>{const form=document.querySelector('[data-component-form]');if(!form)return;const tbody=document.querySelector('[data-component-results]');const rows=[...tbody.querySelectorAll('[data-component-row]')];const count=document.querySelector('[data-component-count]');const n=r=>Number(r.dataset[r._sort]||0);const render=()=>{const cat=form.elements.cat.value,zero=form.elements.zero.value,sort=form.elements.sort.value;const visible=rows.filter(r=>{if(cat&&r.dataset.cat!==cat)return false;if(!zero)return true;if(zero==='any')return Number(r.dataset.franchise)===0||Number(r.dataset.education)===0||Number(r.dataset.deposit)===0;return Number(r.dataset[zero])===0});visible.forEach(r=>r._sort=sort);visible.sort((a,b)=>n(a)-n(b)||Number(a.dataset.total)-Number(b.dataset.total)||a.textContent.localeCompare(b.textContent,'ko'));rows.forEach(r=>r.hidden=true);visible.forEach((r,i)=>{r.hidden=false;r.querySelector('[data-rank-no]').textContent=String(i+1);tbody.appendChild(r)});count.textContent=visible.length.toLocaleString('ko-KR')+'개'};form.addEventListener('change',render);form.querySelector('[data-component-reset]').addEventListener('click',()=>{form.reset();render()});render()})();\n`;
  await fs.writeFile(appPath,app,'utf8');
}

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
if(!css.includes('/* v11.23 cost component hub */')){
  css+=`\n/* v11.23 cost component hub */\n.component-form{display:grid;grid-template-columns:1fr 1fr 1fr auto auto;gap:12px;align-items:end;margin:18px 0}.component-form label{display:grid;gap:7px;font-weight:700}.component-form select{width:100%;min-height:44px;border:1px solid #cfc7bb;background:#fff;padding:8px 10px;font:inherit}.component-form button{min-height:44px;border:1px solid #1c1916;background:#fff;padding:0 14px;font:inherit;font-weight:700}.component-form output{min-height:44px;display:flex;align-items:center;justify-content:flex-end;font-size:13px}.component-full-table,.component-category-table{min-width:860px}#zero-public .callout{margin-top:16px}@media(max-width:860px){.component-form{grid-template-columns:1fr 1fr}.component-form output{justify-content:flex-start}}@media(max-width:600px){.component-form{grid-template-columns:1fr}.component-form output{min-height:auto}}\n`;
  await fs.writeFile(cssPath,css,'utf8');
}

const homePath=path.join(out,'index.html');
let home=await fs.readFile(homePath,'utf8');
if(!home.includes(`${BASE}${route}`))home=home.replace(/(<div class="quick-links">[\s\S]*?)(<\/div>)/,`$1<a href="${BASE}${route}">가맹비·교육비 비교</a>$2`);
await fs.writeFile(homePath,home,'utf8');

const rankingPath=path.join(out,'rankings/index.html');
let ranking=await fs.readFile(rankingPath,'utf8');
if(!ranking.includes(`${BASE}${route}`))ranking=ranking.replace('</main>',`<section class="block" data-v11-23-component-link="1"><h2>총액 말고 가맹비·교육비·보증금을 따로 보려면?</h2><p>총 창업비용 순위와 비용 구성 항목 순위는 다를 수 있습니다. <a href="${BASE}${route}">가맹비·교육비·본사 보증금·기타비용 비교</a>에서 항목별 공개값을 따로 확인할 수 있습니다.</p></section></main>`);
await fs.writeFile(rankingPath,ranking,'utf8');

const candidateAfter=new Set(candidateBefore);candidateAfter.add(route);const finalCandidates=[...candidateAfter].sort();
quality.indexPolicy={...(quality.indexPolicy||{}),productionCandidateUrls:finalCandidates};
quality.qualityPolicy={...(quality.qualityPolicy||{}),components:'one consolidated /cost-components/ intent hub across Tier A/B brands; zero public values are never reinterpreted as fee waivers; no programmatic component landing-page fanout'};
quality.contentTrust={...(quality.contentTrust||{}),version:'11.23',generatedAt,costComponentIntentHub:true,costComponentBrands:trusted.length};
await fs.writeFile(qualityPath,JSON.stringify(quality,null,2),'utf8');
manifest.uiVersion='11.23';
manifest.v11_23={costComponentIntentHub:true,trustedBrands:trusted.length,feeZero:feeZero.length,educationZero:educationZero.length,depositZero:depositZero.length,productionCandidateCount:finalCandidates.length};
manifest.indexPolicy={...(manifest.indexPolicy||{}),productionCandidates:finalCandidates.length,productionCandidateUrls:finalCandidates};
manifest.environmentPolicy={...(manifest.environmentPolicy||{}),productionCandidateCount:finalCandidates.length};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

if(!PREVIEW){
  const urls=finalCandidates.map(r=>`<url><loc>${SITE}${r==='/'?'':r}</loc><lastmod>${reviewDate}</lastmod></url>`).join('');
  await fs.writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,'utf8');
}
const report={schemaVersion:1,generatedAt,uiVersion:'11.23',previewMode:PREVIEW,policy:'ONE_CONSOLIDATED_COMPONENT_HUB; TIER_A_B_ONLY; ZERO_IS_DISPLAYED_AS_ZERO_BUT_NEVER_INFERRED_AS_FREE_OR_WAIVED; NO_COMPONENT_PAGE_FANOUT',trustedBrands:trusted.length,previousCandidateCount:candidateBefore.size,productionCandidateCount:finalCandidates.length,zeroPublicValues:{franchiseFee:feeZero.length,education:educationZero.length,deposit:depositZero.length},globalMedian,categoryCount:categoryStats.length,route,candidateUrls:finalCandidates};
await fs.writeFile(path.join(out,'v11-23-cost-components.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_23:'PASS',trustedBrands:trusted.length,feeZero:feeZero.length,educationZero:educationZero.length,depositZero:depositZero.length,productionCandidates:finalCandidates.length},null,2));
