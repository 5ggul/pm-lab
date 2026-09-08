import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {brandSlugFor} from './routing-v3.mjs';

await import(`./run-generate-v6-final.mjs?v7=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');

async function loadClassic(file,expr){const code=await fs.readFile(file,'utf8');const ctx={console};vm.createContext(ctx);vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);return ctx.__EXPORT__}
const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,brands}');
const {categories,brands}=catalog;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=p=>`${BASE}${p==='/'?'':p}`.replace(/\/+/g,'/');
const won=n=>n==null||!Number.isFinite(Number(n))?'정보 없음':`${Math.round(Number(n)).toLocaleString('ko-KR')}만원`;
const num=n=>n==null||!Number.isFinite(Number(n))?'정보 없음':Math.round(Number(n)).toLocaleString('ko-KR');
const growth=b=>Number.isFinite(Number(b?.lastStores))&&Number(b.lastStores)>0&&Number.isFinite(Number(b?.stores))?((Number(b.stores)-Number(b.lastStores))/Number(b.lastStores)*100):null;
const pct=n=>n==null||!Number.isFinite(Number(n))?'정보 없음':`${Number(n)>=0?'+':''}${Number(n).toFixed(1)}%`;

const header=`<header class="site-header"><div class="shell header-inner"><a class="logo" href="${url('/')}">창업데이터랩</a><nav><a href="${url('/brands/')}">브랜드 찾기</a><a href="${url('/categories/')}">업종</a><a href="${url('/compare/')}">브랜드 비교</a><a href="${url('/areas/')}">지역</a><a href="${url('/tools/')}">계산기</a><a href="${url('/guides/')}">가이드</a></nav><button class="nav-toggle" aria-label="메뉴 열기">메뉴</button></div></header>`;

const featuredNames=['메가MGC커피','교촌치킨','맘스터치','한솥','파리바게뜨','CU','샐러디','크린토피아'];
const featured=featuredNames.map(n=>brands.find(b=>b.name===n)).filter(Boolean);
const tableRows=featured.map(b=>{const g=growth(b);return `<a class="home-table-row" href="${url(`/brands/${brandSlugFor(b.name,b.slug)}/`)}"><strong>${esc(b.name)}</strong><span>${esc(b.category)}</span><span>${won(b.cost)}</span><span>${num(b.stores)}개</span><span class="${g==null?'':g>=0?'positive':'negative'}">${pct(g)}</span></a>`}).join('');
const catChips=Object.entries(categories).map(([slug,c])=>`<a href="${url(`/rankings/${slug}/`)}">${esc(c.name)}</a>`).join('');

const homeMain=`<main id="main"><section class="home-hero"><div class="shell home-hero-grid"><div><div class="home-kicker">프랜차이즈 데이터 검색·비교·계산</div><h1>프랜차이즈 브랜드 170개 데이터 비교</h1><p class="home-lead">브랜드별 공개 창업비용, 가맹점 수, 전년 증감, 업종·지역 데이터를 찾고 비교할 수 있습니다. 창업비용과 월 손익도 직접 계산할 수 있습니다.</p><form class="home-search" action="${url('/brands/')}" method="get"><input name="q" aria-label="브랜드 검색" placeholder="브랜드명 검색 · 예: 메가MGC커피, 교촌치킨"><button>브랜드 찾기</button></form></div><div class="home-hero-side"><a class="hero-action" href="${url('/tools/brand-filter/')}">조건으로 브랜드 찾기 <span>업종·비용·점포수 →</span></a><a class="hero-action" href="${url('/compare/')}">두 브랜드 비교 <span>비용·점포·증감 →</span></a><a class="hero-action" href="${url('/tools/startup-cost/')}">총 창업비용 계산 <span>임대·권리금 포함 →</span></a><a class="hero-action" href="${url('/tools/monthly-profit-simulator/')}">월 손익 계산 <span>매출·원가·임대료 →</span></a></div></div></section><div class="shell"><div class="stat-strip"><a href="${url('/brands/')}"><b>170</b><span>브랜드</span></a><a href="${url('/categories/')}"><b>20</b><span>업종</span></a><a href="${url('/areas/')}"><b>12</b><span>지역 데이터</span></a><a href="${url('/tools/')}"><b>9</b><span>계산기·도구</span></a></div><section class="block"><div class="section-head"><h2>바로 시작</h2></div><div class="quick-grid"><a class="quick-card" href="${url('/brands/')}"><b>전체 브랜드</b><span>170개 브랜드의 공개비용·가맹점·전년 증감 확인</span><em>브랜드 목록 →</em></a><a class="quick-card" href="${url('/categories/')}"><b>업종별 보기</b><span>카페·치킨·외식·서비스 등 20개 업종별 비교</span><em>업종 선택 →</em></a><a class="quick-card" href="${url('/areas/compare/')}"><b>지역 비교</b><span>두 지역의 업소 수와 면적 대비 공급 밀도 비교</span><em>지역 비교 →</em></a><a class="quick-card" href="${url('/themes/')}"><b>조건별 브랜드</b><span>1억원 이하·가맹점 500개 이상 등 숫자 조건</span><em>조건 보기 →</em></a></div></section><section class="block"><div class="section-head"><h2>브랜드 데이터 예시</h2><a href="${url('/brands/')}">170개 전체 보기 →</a></div><div class="home-table"><div class="home-table-head"><span>브랜드</span><span>업종</span><span>공개 창업비용</span><span>가맹점</span><span>전년 증감</span></div>${tableRows}</div><p class="v7-compact-note">현재 프리뷰의 숫자는 화면 검수용 합성값입니다. 공식 데이터 연결 전까지 noindex 상태로 유지합니다.</p></section><section class="block"><div class="section-head"><h2>업종별 보기</h2><a href="${url('/categories/')}">업종 전체 보기 →</a></div><div class="category-chips">${catChips}</div></section><section class="block"><div class="section-head"><h2>비용·점포 조건으로 찾기</h2></div><div class="budget-chips"><a href="${url('/themes/public-cost-under-10000/')}">공개 창업비용 1억원 이하</a><a href="${url('/themes/stores-500-plus/')}">가맹점 500개 이상</a><a href="${url('/themes/store-count-increase/')}">전년 대비 가맹점 증가</a><a href="${url('/tools/brand-filter/')}">조건 직접 입력</a></div></section></div></main>`;

const htmlFiles=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p)}}await walk(out);
const v7Css=await fs.readFile(path.join(here,'assets','v7.css'),'utf8');await fs.writeFile(path.join(out,'assets','v7.css'),v7Css,'utf8');

for(const file of htmlFiles){let h=await fs.readFile(file,'utf8');
 h=h.replace(/<header class="site-header">[\s\S]*?<\/header>/,header);
 if(!h.includes('/assets/v7.css'))h=h.replace(/(<link rel="stylesheet" href="[^"]*\/assets\/site\.css">)/,`$1<link rel="stylesheet" href="${url('/assets/v7.css')}">`);
 h=h.replaceAll('외부 검수용 SSG 프리뷰 · 검색엔진 제외(noindex) · 합성 수치는 정식 공개 전 공식 스냅샷으로 교체','프리뷰 · noindex · 공식 데이터 연결 전');
 h=h.replaceAll('외부 검수용 SSG 프리뷰 · 검색엔진 제외(noindex) · 지역 숫자는 공식 상권 Snapshot 연결 전 합성값','프리뷰 · noindex · 지역 데이터 연결 전');
 h=h.replaceAll('외부 검수용 프리뷰 · 검색엔진 제외(noindex) · 공정거래위원회 공개데이터 매칭값','프리뷰 · noindex · 공정위 공개데이터');
 h=h.replaceAll('공개 데이터와 사용자가 입력한 비용을 분리해 보는 프랜차이즈 비교 도구입니다.','프랜차이즈 브랜드 비용·가맹점·지역 데이터와 창업 계산기를 제공합니다.');
 h=h.replaceAll('이 SSG 프리뷰의 비용·점포·매출 수치는 화면과 문서 구조 검수용 합성값입니다. 정식 도메인에서는 공정거래위원회 정보공개서·공공데이터 스냅샷 검증을 통과한 값만 색인합니다.','현재 숫자는 프리뷰용 합성값입니다. 공식 데이터 연결 전까지 검색엔진에 노출하지 않습니다.');
 h=h.replaceAll('현재 숫자는 구조와 사용 흐름을 검수하기 위한 합성값입니다. 공식 Snapshot이 전체 브랜드와 안전하게 매칭되기 전에는 검색엔진에 노출하지 않습니다.','현재 숫자는 프리뷰용 합성값입니다. 공식 데이터 연결 전까지 검색엔진에 노출하지 않습니다.');
 await fs.writeFile(file,h,'utf8')}

const homeFile=path.join(out,'index.html');let home=await fs.readFile(homeFile,'utf8');home=home.replace(/<main id="main">[\s\S]*?<\/main>/,homeMain);home=home.replace('<title>프랜차이즈 창업비용·가맹점 현황 비교 | 창업데이터랩</title>','<title>프랜차이즈 브랜드 170개 데이터 비교 | 창업데이터랩</title>');home=home.replace(/<meta name="description" content="[^"]*">/,'<meta name="description" content="프랜차이즈 브랜드 170개의 공개 창업비용, 가맹점 수, 전년 증감, 업종·지역 데이터를 검색·비교하고 창업비용과 월 손익을 계산합니다.">');await fs.writeFile(homeFile,home,'utf8');

async function replacePageHead(rel,{h1,p}){const file=path.join(out,rel,'index.html');try{let h=await fs.readFile(file,'utf8');h=h.replace(/(<div class="page-head">[\s\S]*?<h1>)[\s\S]*?(<\/h1>\s*<p(?: class="answer")?>)[\s\S]*?(<\/p>)/,`$1${h1}$2${p}$3`);await fs.writeFile(file,h,'utf8')}catch{}}
await replacePageHead('brands',{h1:'프랜차이즈 브랜드 170개 찾기',p:'브랜드명·업종으로 검색하고 공개 창업비용, 가맹점 수, 전년 증감을 비교합니다.'});
await replacePageHead('explore',{h1:'프랜차이즈 찾기',p:'업종·비용·가맹점 수·지역 조건으로 브랜드를 찾고, 브랜드 비교와 계산기로 이어집니다.'});
await replacePageHead('categories',{h1:'업종별 프랜차이즈 브랜드',p:'20개 업종별 브랜드 수, 공개 창업비용, 가맹점 수를 확인합니다.'});
await replacePageHead('themes',{h1:'비용·점포 조건별 브랜드',p:'공개 창업비용 1억원 이하, 가맹점 500개 이상, 전년 대비 점포 증가 등 숫자 조건으로 브랜드를 봅니다.'});

const manifestPath=path.join(out,'route-manifest.json');const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));manifest.productEnhancements={...(manifest.productEnhancements||{}),dataFirstUi:true,clearPagePurposeCopy:true,brandListTableDesktop:true,referenceInspiredIA:true};manifest.uiVersion=7;await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({v7:true,htmlPages:htmlFiles.length,homeRedesign:true,dataFirstCopy:true,brandListTableDesktop:true},null,2));
