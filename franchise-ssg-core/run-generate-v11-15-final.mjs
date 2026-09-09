import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {matchOfficialBrands} from './official-merge.mjs';
import {brandSlugFor} from './routing-v3.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const SITE=(process.env.SSG_SITE_URL??'https://5ggul.github.io/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const generatedAt=new Date().toISOString();
const FTC_COST_SOURCE='https://www.data.go.kr/data/15110265/openapi.do';
const FTC_STORE_SOURCE='https://www.data.go.kr/data/15110241/openapi.do';

async function loadClassic(file,expr){
  const code=await fs.readFile(file,'utf8');
  const ctx={console};
  vm.createContext(ctx);
  vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);
  return ctx.__EXPORT__;
}

const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,brands}');
const official=JSON.parse(await fs.readFile(path.join(repo,'data/franchise/official/brands-2025.json'),'utf8'));
const matched=matchOfficialBrands(catalog.brands,official);
const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const finitePositive=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0;
const normalizeRoute=r=>r==='/'?'/':`/${String(r).replace(/^\/+|\/+$/g,'')}/`;
const median=values=>{const a=values.filter(finitePositive).map(Number).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};

const categoryRows=new Map();
for(const hit of matched.matches||[]){
  const slug=hit?.brand?.categorySlug;
  const cost=hit?.record?.startupCost10k;
  if(!slug||!finitePositive(cost))continue;
  const rows=categoryRows.get(slug)||[];
  rows.push({hit,cost:Number(cost)});
  categoryRows.set(slug,rows);
}
const categoryStats=new Map();
for(const [slug,rows] of categoryRows){
  const med=median(rows.map(row=>row.cost));
  if(med!==null&&rows.length>=3)categoryStats.set(slug,{median:med,sample:rows.length,name:catalog.categories?.[slug]?.name||slug});
}
const brandOptions=[];
for(const hit of matched.matches||[]){
  const slug=hit?.brand?.categorySlug;
  const cost=hit?.record?.startupCost10k;
  const stat=categoryStats.get(slug);
  if(!stat||!finitePositive(cost))continue;
  const brandName=hit.brand.name;
  brandOptions.push({name:brandName,cost:Number(cost),categorySlug:slug,categoryName:stat.name,median:stat.median,sample:stat.sample,route:normalizeRoute(`/brands/${brandSlugFor(brandName,hit.brand.id||brandName)}/`)});
}
brandOptions.sort((a,b)=>a.categoryName.localeCompare(b.categoryName,'ko')||a.name.localeCompare(b.name,'ko'));

function patchBrandFilter(html){
  let missingCostCards=0,missingStoreCards=0;
  html=html.replace(/<article class="brand-card"[\s\S]*?<\/article>/g,block=>{
    let next=block;
    if(/<dt>공개비용<\/dt><dd>정보 없음<\/dd>/.test(next)){
      next=next.replace(/data-cost="0(?:\.0+)?"/,'data-cost=""');
      missingCostCards++;
    }
    if(/<dt>가맹점<\/dt><dd>정보 없음개<\/dd>/.test(next)){
      next=next.replace(/data-stores="0(?:\.0+)?"/,'data-stores=""').replace('정보 없음개','정보 없음');
      missingStoreCards++;
    }
    return next;
  });
  html=html.replace('id="brandConditionForm" class="calculator"','id="brandConditionForm" class="calculator" data-v11-15-missing-safe="1"');
  html=html.replace("function n(v){const x=Number(v);return Number.isFinite(x)?x:null}","function n(v){if(v==null||String(v).trim()==='')return null;const x=Number(v);return Number.isFinite(x)?x:null}");
  html=html.replaceAll('정보 없음개','정보 없음');
  return {html,missingCostCards,missingStoreCards};
}

function categoryMedianForm(){
  const options=brandOptions.map(row=>`<option value="${esc(row.route)}" data-cost="${row.cost}" data-category="${esc(row.categorySlug)}" data-category-name="${esc(row.categoryName)}" data-median="${row.median}" data-sample="${row.sample}">${esc(row.name)} · ${esc(row.categoryName)}</option>`).join('');
  return `<form class="calculator" data-tool="category-median-v11" data-v11-15-real-tool="1"><label>브랜드 선택<select name="brand"><option value="">브랜드를 선택하세요</option>${options}</select></label><output class="tool-live-note">브랜드를 선택하면 같은 업종의 공식 매칭 브랜드 공개비용 중앙값과 비교합니다.</output></form><section class="block tool-result-panel" data-category-median-result><h2>업종 중앙값 비교 결과</h2><div class="stat-grid"><div class="stat-card"><span class="label">브랜드 공개비용</span><b class="value" data-cm-cost>—</b></div><div class="stat-card"><span class="label">업종 중앙값</span><b class="value" data-cm-median>—</b></div><div class="stat-card"><span class="label">중앙값과 차이</span><b class="value" data-cm-diff>—</b></div><div class="stat-card"><span class="label">비교 표본</span><b class="value" data-cm-sample>—</b></div></div><p class="data-note" data-cm-note>비용이 확인된 같은 업종의 공식 매칭 브랜드만 비교합니다. 낮거나 높다는 사실만으로 수익성·안정성을 판단하지 않습니다.</p><div class="actions"><a data-cm-brand-link href="${SITE}/brands/">선택 브랜드 상세 보기</a></div></section>`;
}

function monthlyFixedForm(){
  return `<form class="calculator" data-tool="monthly-fixed-cost-v11" data-v11-15-real-tool="1"><label>월세(만원)<input inputmode="numeric" name="rent" min="0" placeholder="예: 250"></label><label>관리비(만원)<input inputmode="numeric" name="management" min="0" placeholder="예: 40"></label><label>고정 인건비(만원)<input inputmode="numeric" name="labor" min="0" placeholder="예: 700"></label><label>대출 원리금(만원)<input inputmode="numeric" name="loan" min="0" placeholder="예: 0"></label><label>보험료(만원)<input inputmode="numeric" name="insurance" min="0" placeholder="예: 20"></label><label>통신·POS(만원)<input inputmode="numeric" name="pos" min="0" placeholder="예: 15"></label><label>기타 고정비(만원)<input inputmode="numeric" name="other" min="0" placeholder="예: 100"></label><label>예비자금 기간<select name="reserveMonths"><option value="1">1개월</option><option value="2">2개월</option><option value="3" selected>3개월</option><option value="6">6개월</option></select></label><output>입력한 항목만 합산합니다.</output></form><section class="block tool-result-panel" data-monthly-fixed-result><h2>월 고정비 계산 결과</h2><div class="stat-grid"><div class="stat-card"><span class="label">월 고정비 합계</span><b class="value" data-fixed-monthly>입력 대기</b></div><div class="stat-card"><span class="label">선택 기간 예비자금</span><b class="value" data-fixed-reserve>입력 대기</b></div></div><p class="data-note" data-fixed-note>원재료·카드수수료·배달수수료처럼 매출에 따라 달라지는 비용은 이 계산에 포함하지 않습니다.</p></section>`;
}

const filterPath=path.join(out,'tools/brand-filter/index.html');
let filterHtml=await fs.readFile(filterPath,'utf8');
const filterPatch=patchBrandFilter(filterHtml);
filterHtml=filterPatch.html;
await fs.writeFile(filterPath,filterHtml,'utf8');

const cmPath=path.join(out,'tools/category-median/index.html');
let cmHtml=await fs.readFile(cmPath,'utf8');
cmHtml=cmHtml.replace(/<div class="tool-static">[\s\S]*?<\/div>/,categoryMedianForm());
cmHtml=cmHtml.replace('<p>페이지에 실제 비교 대상 브랜드 수를 표시해야 합니다.</p>','<p>브랜드가 속한 업종에서 공개비용이 확인된 공식 매칭 브랜드만 사용하며 결과에 실제 표본 수를 표시합니다.</p>');
if(!cmHtml.includes('data-v11-15-source="category-median"'))cmHtml=cmHtml.replace('</article>',`<aside class="source-box" data-v11-15-source="category-median"><b>데이터 기준</b><p>브랜드 공개비용은 공정거래위원회 공개자료의 공식 매칭 값만 사용하고, 업종 중앙값은 같은 업종에서 0보다 큰 공개비용이 확인된 브랜드만 계산합니다.</p><p><a href="${FTC_COST_SOURCE}" rel="noopener">공정위 가맹사업거래 비용 공개데이터</a></p></aside></article>`);
await fs.writeFile(cmPath,cmHtml,'utf8');

const fixedPath=path.join(out,'tools/monthly-fixed-cost/index.html');
let fixedHtml=await fs.readFile(fixedPath,'utf8');
fixedHtml=fixedHtml.replace(/<div class="tool-static">[\s\S]*?<\/div>/,monthlyFixedForm());
if(!fixedHtml.includes('data-v11-15-input-note="monthly-fixed"'))fixedHtml=fixedHtml.replace('</article>','<aside class="source-box" data-v11-15-input-note="monthly-fixed"><b>입력값 기준</b><p>이 계산기는 공식 평균비용을 임의로 채우지 않습니다. 모든 금액은 사용자가 입력한 가정이며 실제 계약서·견적서·대출 상환표와 대조해야 합니다.</p></aside></article>');
await fs.writeFile(fixedPath,fixedHtml,'utf8');

const appPath=path.join(out,'assets/app.js');
let app=await fs.readFile(appPath,'utf8');
if(!app.includes('/* v11.15 tool trust */')){
  app+=`\n/* v11.15 tool trust */\n(()=>{\n  const money15=v=>Number.isFinite(Number(v))?Math.round(Number(v)).toLocaleString('ko-KR')+'만원':'—';\n  const nullable=v=>{if(v==null||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)&&n>=0?n:null};\n  document.querySelectorAll('form[data-tool="category-median-v11"]').forEach(form=>{const select=form.elements.brand,root=document.querySelector('[data-category-median-result]');const run=()=>{const opt=select.selectedOptions[0],cost=nullable(opt?.dataset.cost),med=nullable(opt?.dataset.median),sample=nullable(opt?.dataset.sample);const set=(sel,text)=>{const el=root?.querySelector(sel);if(el)el.textContent=text};const link=root?.querySelector('[data-cm-brand-link]');if(cost==null||med==null||med<=0){set('[data-cm-cost]','—');set('[data-cm-median]','—');set('[data-cm-diff]','—');set('[data-cm-sample]','—');if(link){link.href='/pm-lab/franchise-ssg-preview/brands/';link.textContent='브랜드 목록 보기'};return}const diff=cost-med,pct=diff/med*100;set('[data-cm-cost]',money15(cost));set('[data-cm-median]',money15(med));set('[data-cm-diff]',(diff>=0?'+':'-')+money15(Math.abs(diff))+' · '+(pct>=0?'+':'')+pct.toFixed(1)+'%');set('[data-cm-sample]',Math.round(sample||0)+'개');const note=root?.querySelector('[data-cm-note]');if(note)note.textContent=(opt.dataset.categoryName||'같은 업종')+'에서 공개비용이 확인된 공식 매칭 '+Math.round(sample||0)+'개 브랜드의 중앙값과 비교한 위치입니다. 추천·수익성 점수가 아닙니다.';if(link){link.href=opt.value||'/pm-lab/franchise-ssg-preview/brands/';link.textContent=select.options[select.selectedIndex].textContent.split(' · ')[0]+' 상세 보기'};syncQuery(form,['brand'])};select?.addEventListener('change',run);hydrateQuery(form,['brand']);run()});\n  document.querySelectorAll('form[data-tool="monthly-fixed-cost-v11"]').forEach(form=>{const names=['rent','management','labor','loan','insurance','pos','other','reserveMonths'];hydrateQuery(form,names);const run=()=>{const values=['rent','management','labor','loan','insurance','pos','other'].map(name=>nullable(form.elements[name]?.value));const entered=values.some(v=>v!==null);const monthly=values.reduce((sum,v)=>sum+(v??0),0),months=Math.max(1,nullable(form.elements.reserveMonths?.value)??1),root=document.querySelector('[data-monthly-fixed-result]');const a=root?.querySelector('[data-fixed-monthly]'),b=root?.querySelector('[data-fixed-reserve]'),note=root?.querySelector('[data-fixed-note]');if(a)a.textContent=entered?money15(monthly):'입력 대기';if(b)b.textContent=entered?money15(monthly*months):'입력 대기';if(note)note.textContent=entered?'입력한 고정비 '+money15(monthly)+' × '+months+'개월 = '+money15(monthly*months)+'입니다. 원재료·카드수수료·배달수수료·세금 등 변동·별도 비용은 포함하지 않습니다.':'금액을 하나 이상 입력하면 월 합계와 선택 기간 예비자금을 계산합니다.';syncQuery(form,names)};form.querySelectorAll('input,select').forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',run));run()});\n})();\n`;
  await fs.writeFile(appPath,app,'utf8');
}

const approvedTools=['/tools/startup-cost/','/tools/monthly-profit-simulator/','/tools/disclosure-decoder/','/tools/brand-filter/','/tools/break-even/','/tools/category-median/','/tools/monthly-fixed-cost/','/tools/open-close-rate/'].map(normalizeRoute);
const blockedTools=[normalizeRoute('/tools/store-density/')];
const candidateSet=new Set((quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute));
for(const route of approvedTools)candidateSet.add(route);
for(const route of blockedTools)candidateSet.delete(route);
const finalCandidates=[...candidateSet].sort();
quality.indexPolicy={...(quality.indexPolicy||{}),productionCandidateUrls:finalCandidates};
quality.contentTrust={...(quality.contentTrust||{}),version:'11.15',generatedAt,toolTrustPolicy:true,approvedToolRoutes:approvedTools,blockedToolRoutes:blockedTools,missingValueSemantics:'BLANK_OR_MISSING_IS_NULL_NOT_ZERO'};
await fs.writeFile(qualityPath,JSON.stringify(quality,null,2),'utf8');

const htmlFiles=[];
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);
const routeForFile=file=>{const rel=path.relative(out,file).replace(/\\/g,'/');return rel==='index.html'?'/':normalizeRoute('/'+rel.replace(/\/index\.html$/,''))};
for(const file of htmlFiles){
  let html=await fs.readFile(file,'utf8');
  const route=routeForFile(file);
  const robots=PREVIEW?'noindex,nofollow,noarchive,nosnippet':(candidateSet.has(route)?'index,follow':'noindex,nofollow,noarchive,nosnippet');
  html=html.replace(/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${robots}">`).replace(/<meta name="googlebot" content="[^"]*">/,`<meta name="googlebot" content="${robots}">`).replace(/<meta name="bingbot" content="[^"]*">/,`<meta name="bingbot" content="${robots}">`);
  await fs.writeFile(file,html,'utf8');
}
const reviewDate=String(official.generatedAt||generatedAt).slice(0,10);
if(PREVIEW){
  await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n','utf8');
  await fs.writeFile(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>','utf8');
}else{
  await fs.writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`,'utf8');
  const urls=finalCandidates.map(route=>`<url><loc>${SITE}${route==='/'?'':route}</loc><lastmod>${reviewDate}</lastmod></url>`).join('');
  await fs.writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,'utf8');
}

manifest.uiVersion='11.15';
manifest.v11_15={toolTrustPolicy:true,missingValueNullSemantics:true,brandFilterMissingSafe:true,categoryMedianInteractive:true,monthlyFixedCostInteractive:true,approvedToolRoutes:approvedTools,blockedToolRoutes:blockedTools};
manifest.indexPolicy={...(manifest.indexPolicy||{}),productionCandidates:finalCandidates.length,productionCandidateUrls:finalCandidates};
manifest.environmentPolicy={...(manifest.environmentPolicy||{}),indexedHtml:PREVIEW?0:finalCandidates.length,noindexHtml:htmlFiles.length-(PREVIEW?0:finalCandidates.length),productionCandidateCount:finalCandidates.length,productionFailsIfCandidateNoindex:true};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

const report={schemaVersion:1,generatedAt,uiVersion:'11.15',previewMode:PREVIEW,policy:'MISSING_IS_NULL_NOT_ZERO; PROMOTE_ONLY_INTERACTIVE_TOOLS_WITH_EXPLICIT_INPUT_RESULT_SEMANTICS; STORE_DENSITY_REMAINS_BLOCKED_WITHOUT_REAL_LOCAL_DATA',officialMatchedBrands:(matched.matches||[]).length,categoryMedianOptions:brandOptions.length,categoryMedianCategories:categoryStats.size,brandFilterMissingCostCards:filterPatch.missingCostCards,brandFilterMissingStoreCards:filterPatch.missingStoreCards,approvedToolRoutes:approvedTools,blockedToolRoutes:blockedTools,productionCandidateCount:finalCandidates.length,candidateUrls:finalCandidates,sources:[FTC_COST_SOURCE,FTC_STORE_SOURCE]};
await fs.writeFile(path.join(out,'v11-15-tool-trust.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_15:'PASS',categoryMedianOptions:report.categoryMedianOptions,missingCostCardsFixed:report.brandFilterMissingCostCards,missingStoreCardsFixed:report.brandFilterMissingStoreCards,approvedTools:approvedTools.length,blockedTools:blockedTools.length,productionCandidates:report.productionCandidateCount},null,2));
