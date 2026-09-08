import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {brandSlugFor} from './routing-v3.mjs';
import {buildOfficialMergePlan} from './official-merge.mjs';
import {CURATED_COMPARE_NAMES} from './content.mjs';

await import(`./run-generate-v7.mjs?v8=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');

async function loadClassic(file,expr){const code=await fs.readFile(file,'utf8');const ctx={console};vm.createContext(ctx);vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);return ctx.__EXPORT__}
const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,brands}');
let official={status:'MISSING',records:[],promotion:{allowPreviewOverlay:false}};try{official=JSON.parse(await fs.readFile(path.join(repo,'data/franchise/official/brands-2025.json'),'utf8'))}catch{}
const critical=[...new Set([...CURATED_COMPARE_NAMES.flat(),...catalog.brands.slice(0,12).map(b=>b.name)])];
const plan=buildOfficialMergePlan({catalogBrands:catalog.brands,officialDoc:official,criticalBrandNames:critical});
const brands=plan.active?plan.mergedBrands:catalog.brands;
const categories=catalog.categories;
const previewSubpageNames=new Set(['메가MGC커피','컴포즈커피','빽다방','이디야커피','교촌치킨','bhc치킨','BBQ치킨','굽네치킨','맘스터치','프랭크버거']);

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=p=>`${BASE}${p==='/'?'':p}`.replace(/\/+/g,'/');
const finite=v=>v!=null&&Number.isFinite(Number(v));
const num=v=>finite(v)?Math.round(Number(v)).toLocaleString('ko-KR'):'정보 없음';
const won=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'정보 없음';
const growth=b=>finite(b?.lastStores)&&Number(b.lastStores)>0&&finite(b?.stores)?((Number(b.stores)-Number(b.lastStores))/Number(b.lastStores)*100):null;
const pct=v=>finite(v)?`${Number(v)>=0?'+':''}${Number(v).toFixed(1)}%`:'정보 없음';
const median=arr=>{const v=arr.filter(finite).map(Number).sort((a,b)=>a-b);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2};
const clamp=n=>Math.max(4,Math.min(100,Number.isFinite(n)?n:0));
const exists=async p=>{try{await fs.stat(p);return true}catch{return false}};
const byName=new Map(brands.map(b=>[b.name,b]));
const peers=b=>brands.filter(x=>x.categorySlug===b.categorySlug);

const v8Css=await fs.readFile(path.join(here,'assets','v8.css'),'utf8');
await fs.writeFile(path.join(out,'assets','v8.css'),v8Css,'utf8');
const htmlFiles=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p)}}await walk(out);
for(const file of htmlFiles){let h=await fs.readFile(file,'utf8');if(!h.includes('/assets/v8.css'))h=h.replace(/(<link rel="stylesheet" href="[^"]*\/assets\/v7\.css">)/,`$1<link rel="stylesheet" href="${url('/assets/v8.css')}">`);await fs.writeFile(file,h,'utf8')}

function componentRows(b){const raw=[['가맹비',b.fee],['교육비',b.education],['가맹 보증금',b.deposit],['인테리어',b.interior],['기타',b.other]].filter(([,v])=>finite(v));const total=raw.reduce((s,[,v])=>s+Number(v),0)||Number(b.cost)||1;return raw.map(([label,v])=>({label,value:Number(v),share:Number(v)/total*100}))}
function compareBar(label,aLabel,a,bLabel,b,format){if(!finite(a)&&!finite(b))return '';const max=Math.max(Number(a)||0,Number(b)||0,1);return `<div class="compare-metric-v8"><div class="labels"><span>${esc(label)} · ${esc(aLabel)} ${format(a)}</span><span>${esc(bLabel)} ${format(b)}</span></div><div class="dual"><i style="--w:${clamp((Number(a)||0)/max*100)}%"></i><i style="--w:${clamp((Number(b)||0)/max*100)}%"></i></div></div>`}

let brandDetails=0;
for(const b of brands){const slug=brandSlugFor(b.name,b.slug);const file=path.join(out,'brands',slug,'index.html');if(!(await exists(file)))continue;let h=await fs.readFile(file,'utf8');const p=peers(b);const medCost=median(p.map(x=>x.cost)),medStores=median(p.map(x=>x.stores));const g=growth(b);const gClass=finite(g)?Number(g)>=0?'positive':'negative':'';const actions=[`<a class="primary" href="${url(`/tools/startup-cost/?brand=${encodeURIComponent(slug)}`)}">창업비용 계산</a>`,`<a href="${url('/compare/')}">브랜드 비교</a>`];if(previewSubpageNames.has(b.name)){actions.push(`<a href="${url(`/brands/${slug}/cost/`)}">비용 상세</a>`,`<a href="${url(`/brands/${slug}/stores/`)}">점포 상세</a>`)}
 const hero=`<section class="brand-hero-v8"><div class="brand-hero-v8-top"><div><div class="eyebrow">${esc(b.category)} · 브랜드 데이터</div><h1>${esc(b.name)}</h1><div class="brand-meta-v8">창업비용 · 가맹점 · 점포 변화 · 비용 구성</div></div><div class="brand-actions-v8">${actions.join('')}</div></div><div class="kpi-grid-v8"><div class="kpi-v8"><span>공개 창업비용</span><b>${won(b.cost)}</b><small>공개 비용 합계</small></div><div class="kpi-v8"><span>가맹점 수</span><b>${finite(b.stores)?`${num(b.stores)}개`:'정보 없음'}</b><small>현재 기준</small></div><div class="kpi-v8"><span>전년 증감</span><b class="${gClass}">${pct(g)}</b><small>이전 기준 대비</small></div><div class="kpi-v8"><span>평균매출 지표</span><b>${won(b.sales)}</b><small>공개 스냅샷 연결 대상</small></div></div></section>`;
 const comps=componentRows(b);const costBars=comps.map(x=>`<div class="bar-row-v8"><span>${esc(x.label)}</span><div class="bar-track-v8"><div class="bar-fill-v8" style="--w:${clamp(x.share)}%"></div></div><strong>${won(x.value)}</strong></div>`).join('');
 const summary=`<div class="brand-summary-grid-v8"><section class="viz-panel-v8"><h2>창업비용 구성</h2>${costBars||'<p>정보 없음</p>'}</section><section class="viz-panel-v8"><h2>${esc(b.category)} 중앙값 비교</h2>${compareBar('공개 창업비용',b.name,b.cost,'업종 중앙값',medCost,won)}${compareBar('가맹점 수',b.name,b.stores,'업종 중앙값',medStores,v=>finite(v)?`${num(v)}개`:'정보 없음')}<p class="v8-data-note">현재 프리뷰 기준 ${p.length}개 브랜드 비교</p></section></div>`;
 const target=/<div class="page-head">[\s\S]*?<\/div><section class="metric-row">[\s\S]*?<\/section>/;if(target.test(h))h=h.replace(target,hero+summary);else h=h.replace(/<article>/,`<article>${hero}${summary}`);
 h=h.replace('<div class="shell page">','<div class="shell page" data-v8-brand-detail="1">');
 h=h.replaceAll('공개 창업비용 구성','창업비용 구성').replaceAll('가맹점 수와 전년 변화','가맹점 변화');
 await fs.writeFile(file,h,'utf8');brandDetails++}

let comparePages=0;
for(const [aName,bName] of CURATED_COMPARE_NAMES){const a=byName.get(aName),b=byName.get(bName);if(!a||!b)continue;const aSlug=brandSlugFor(a.name,a.slug),bSlug=brandSlugFor(b.name,b.slug);const file=path.join(out,'compare',aSlug,bSlug,'index.html');if(!(await exists(file)))continue;let h=await fs.readFile(file,'utf8');const ag=growth(a),bg=growth(b);const costDiff=finite(a.cost)&&finite(b.cost)?Math.abs(Number(a.cost)-Number(b.cost)):null;const storeDiff=finite(a.stores)&&finite(b.stores)?Math.abs(Number(a.stores)-Number(b.stores)):null;const growthDiff=finite(ag)&&finite(bg)?Math.abs(Number(ag)-Number(bg)):null;
 const brandPanel=x=>`<section class="compare-brand-v8"><h2>${esc(x.name)}</h2><div class="cat">${esc(x.category)}</div><dl><div><dt>공개 창업비용</dt><dd>${won(x.cost)}</dd></div><div><dt>가맹점</dt><dd>${finite(x.stores)?`${num(x.stores)}개`:'정보 없음'}</dd></div><div><dt>전년 증감</dt><dd>${pct(growth(x))}</dd></div></dl></section>`;
 const hero=`<section class="compare-hero-v8"><div class="eyebrow">브랜드 데이터 비교</div><h1>${esc(a.name)} vs ${esc(b.name)}</h1><div class="vs-grid">${brandPanel(a)}<div class="compare-vs-v8">VS</div>${brandPanel(b)}</div><div class="difference-strip-v8"><div><span>공개비용 차이</span><b>${won(costDiff)}</b></div><div><span>가맹점 차이</span><b>${finite(storeDiff)?`${num(storeDiff)}개`:'정보 없음'}</b></div><div><span>증감률 차이</span><b>${finite(growthDiff)?`${Number(growthDiff).toFixed(1)}%p`:'정보 없음'}</b></div></div><div class="compare-actions-v8"><a class="primary" href="${url(`/tools/startup-cost/?brand=${encodeURIComponent(aSlug)}`)}">${esc(a.name)} 비용 계산</a><a href="${url(`/tools/startup-cost/?brand=${encodeURIComponent(bSlug)}`)}">${esc(b.name)} 비용 계산</a><a href="${url('/compare/')}">다른 비교 보기</a></div></section>`;
 const target=/<div class="page-head">[\s\S]*?<\/div><section class="metric-row">[\s\S]*?<\/section>/;if(target.test(h))h=h.replace(target,hero);else h=h.replace(/<article>/,`<article>${hero}`);h=h.replace('<div class="shell page">','<div class="shell page" data-v8-compare="1">');await fs.writeFile(file,h,'utf8');comparePages++}

const compareHub=path.join(out,'compare','index.html');if(await exists(compareHub)){let h=await fs.readFile(compareHub,'utf8');h=h.replace(/<div class="page-head">[\s\S]*?<\/div>/,`<div class="page-head"><h1>프랜차이즈 브랜드 비교</h1><p class="answer">10개 비교 조합에서 창업비용, 가맹점 수, 전년 증감, 비용 구성을 확인합니다.</p></div>`);h=h.replace('<div class="shell page">','<div class="shell page" data-v8-compare-hub="1">');await fs.writeFile(compareHub,h,'utf8')}

let rankingPages=0;
for(const [slug,c] of Object.entries(categories)){const file=path.join(out,'rankings',slug,'index.html');if(!(await exists(file)))continue;let h=await fs.readFile(file,'utf8');const rows=brands.filter(b=>b.categorySlug===slug);const medCost=median(rows.map(b=>b.cost)),medStores=median(rows.map(b=>b.stores)),medGrowth=median(rows.map(growth));const head=`<section class="ranking-head-v8"><div class="eyebrow">${esc(c.name)} · 가맹점 수 기준</div><h1>${esc(c.name)} 프랜차이즈 데이터</h1><div class="rank-kpis"><div><span>브랜드</span><b>${rows.length}개</b></div><div><span>공개비용 중앙값</span><b>${won(medCost)}</b></div><div><span>가맹점 중앙값</span><b>${finite(medStores)?`${num(medStores)}개`:'정보 없음'}</b></div><div><span>증감 중앙값</span><b>${pct(medGrowth)}</b></div></div><p class="rank-note">가맹점 수 내림차순 · 추천 순위 아님</p></section>`;h=h.replace(/<div class="page-head">[\s\S]*?<\/div>/,head).replace('<div class="shell page">','<div class="shell page" data-v8-ranking="1">').replace('<div class="table-wrap">','<div class="table-wrap ranking-table-v8">');await fs.writeFile(file,h,'utf8');rankingPages++}

async function patchCalculator(rel,{title,desc,steps,includes}){const file=path.join(out,rel,'index.html');if(!(await exists(file)))return false;let h=await fs.readFile(file,'utf8');const intro=`<div class="calculator-v8-intro"><div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div><div class="calc-steps-v8">${steps.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`;h=h.replace(/<div class="page-head">[\s\S]*?<\/div>/,intro);h=h.replace(/class="calculator"/, 'class="calculator" data-v8-calculator="1"');h=h.replace(/(<\/div>)(<section class="block"><h2>계산식)/,`$1<div class="calc-includes-v8">${includes.map(x=>`<span>${esc(x)}</span>`).join('')}</div>$2`);await fs.writeFile(file,h,'utf8');return true}
const startupPatched=await patchCalculator('tools/startup-cost',{title:'프랜차이즈 창업비용 계산기',desc:'브랜드 선택 후 임대보증금·권리금·추가공사·운전자금을 입력하면 총 초기 필요자금을 계산합니다.',steps:['1 브랜드 선택','2 점포 비용 입력','3 총액 확인'],includes:['브랜드 공개비용','임대보증금','권리금','추가공사·설비','운전자금']});
const profitPatched=await patchCalculator('tools/monthly-profit-simulator',{title:'월 손익 계산기',desc:'월매출·원가율·플랫폼비·로열티·인건비·임차료를 입력해 영업잔액과 손익분기 매출을 계산합니다.',steps:['1 매출 입력','2 비용 입력','3 손익 확인'],includes:['월매출','원가율','플랫폼 비용','로열티','인건비','임차료']});

const manifestPath=path.join(out,'route-manifest.json');const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));manifest.uiVersion=8;manifest.productEnhancements={...(manifest.productEnhancements||{}),brandDetailKpi:true,costCompositionBars:true,g2StyleCompare:true,rankingSummaryKpi:true,calculatorResultFirst:true};manifest.coverage.v8BrandDetails=brandDetails;manifest.coverage.v8ComparePages=comparePages;manifest.coverage.v8RankingPages=rankingPages;await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({v8:true,brandDetails,comparePages,rankingPages,startupPatched,profitPatched,officialData:plan.active},null,2));
