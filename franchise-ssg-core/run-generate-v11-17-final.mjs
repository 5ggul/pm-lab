import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const SITE=(process.env.SSG_SITE_URL??'https://5ggul.github.io/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const BASE='/pm-lab/franchise-ssg-preview';
const generatedAt=new Date().toISOString();

const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const historyTiers=JSON.parse(await fs.readFile(path.join(out,'v11-14-history-tiers.json'),'utf8'));

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeJson=v=>JSON.stringify(v).replace(/</g,'\\u003c');
const normalizeRoute=r=>r==='/'?'/':`/${String(r).replace(/^\/+|\/+$/g,'')}/`;

const pairs=[
  {slug:'mega-mgc-coffee-vs-compose-coffee',a:'메가MGC커피',aRoute:'/brands/mega-mgc-coffee/',b:'컴포즈커피',bRoute:'/brands/compose-coffee/'},
  {slug:'mega-mgc-coffee-vs-paiks-coffee',a:'메가MGC커피',aRoute:'/brands/mega-mgc-coffee/',b:'빽다방',bRoute:'/brands/paiks-coffee/'},
  {slug:'compose-coffee-vs-the-venti',a:'컴포즈커피',aRoute:'/brands/compose-coffee/',b:'더벤티',bRoute:'/brands/the-venti/'},
  {slug:'kyochon-chicken-vs-bhc-chicken',a:'교촌치킨',aRoute:'/brands/kyochon-chicken/',b:'bhc치킨',bRoute:'/brands/bhc-chicken/'},
  {slug:'bhc-chicken-vs-bbq-chicken',a:'bhc치킨',aRoute:'/brands/bhc-chicken/',b:'BBQ치킨',bRoute:'/brands/bbq-chicken/'},
  {slug:'goobne-chicken-vs-kyochon-chicken',a:'굽네치킨',aRoute:'/brands/goobne-chicken/',b:'교촌치킨',bRoute:'/brands/kyochon-chicken/'},
  {slug:'momstouch-vs-frank-burger',a:'맘스터치',aRoute:'/brands/momstouch/',b:'프랭크버거',bRoute:'/brands/frank-burger/'},
  {slug:'gimgane-vs-yamsaem-gimbap',a:'김가네',aRoute:'/brands/gimgane/',b:'얌샘김밥',bRoute:'/brands/yamsaem-gimbap/'},
  {slug:'paris-baguette-vs-tous-les-jours',a:'파리바게뜨',aRoute:'/brands/paris-baguette/',b:'뚜레쥬르',bRoute:'/brands/tous-les-jours/'},
  {slug:'cu-vs-gs25',a:'CU',aRoute:'/brands/cu/',b:'GS25',bRoute:'/brands/gs25/'}
].map(p=>({...p,route:normalizeRoute(`/compare/${p.slug}/`),href:`${BASE}/compare/${p.slug}/`}));

const strictByName=new Map((quality.strictBrands||[]).map(row=>[row.name,row]));
const tierBRoutes=new Set((historyTiers.addedTierBRoutes||[]).map(normalizeRoute));
function brandTrust(name,route){
  const strict=strictByName.get(name)||{};
  const historyYears=Array.isArray(strict.historyYears)?strict.historyYears.map(Number).filter(Number.isFinite).sort((a,b)=>a-b):[];
  const normalized=normalizeRoute(route);
  if(strict.eligible===true)return {tier:'A',historyYears,route:normalized};
  if(tierBRoutes.has(normalized))return {tier:'B',historyYears,route:normalized};
  return {tier:'C',historyYears,route:normalized};
}
function diffFrom(html,label){
  const re=new RegExp(`<span>${label.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}<\\/span><b>([^<]+)<\\/b>`);
  return html.match(re)?.[1]?.trim()||'—';
}

const audited=[];
for(const pair of pairs){
  const aTrust=brandTrust(pair.a,pair.aRoute),bTrust=brandTrust(pair.b,pair.bRoute);
  const eligible=aTrust.tier!=='C'&&bTrust.tier!=='C';
  const file=path.join(out,'compare',pair.slug,'index.html');
  const html=await fs.readFile(file,'utf8');
  audited.push({...pair,aTrust,bTrust,eligible,costDiff:diffFrom(html,'공개비용 차이 · A-B'),storeDiff:diffFrom(html,'가맹점 차이 · A-B'),growthDiff:diffFrom(html,'증감률 차이 · A-B')});
}
const eligiblePairs=audited.filter(x=>x.eligible);
const blockedPairs=audited.filter(x=>!x.eligible);

function yearText(trust){return trust.historyYears.length?trust.historyYears.join('·'):'확인 이력 부족'}
function tierLabel(trust){return trust.tier==='A'?'3개년 이상':trust.tier==='B'?'연속 2개년':'보강 대기'}

for(const pair of audited){
  const file=path.join(out,'compare',pair.slug,'index.html');
  let html=await fs.readFile(file,'utf8');
  html=html.replace(/<aside class="compare-trust-note" data-v11-17-compare-trust="1">[\s\S]*?<\/aside>/,'');
  html=html.replace(/<section class="block compare-next" data-v11-17-compare-next="1">[\s\S]*?<\/section>/,'');
  if(pair.eligible){
    const tierSentence=pair.aTrust.tier==='B'||pair.bTrust.tier==='B'?'연속 2개년 이력은 한 구간의 변화만 보여주므로 장기 추세로 해석하지 않습니다.':'두 브랜드 모두 3개년 이상 정제 이력이 확인됩니다.';
    const trust=`<aside class="compare-trust-note" data-v11-17-compare-trust="1"><b>비교 이력 기준</b><p>${esc(pair.a)} ${esc(yearText(pair.aTrust))} (${esc(tierLabel(pair.aTrust))}) · ${esc(pair.b)} ${esc(yearText(pair.bTrust))} (${esc(tierLabel(pair.bTrust))}). ${esc(tierSentence)}</p></aside>`;
    const next=`<section class="block compare-next" data-v11-17-compare-next="1"><h2>비교한 브랜드를 더 확인하려면</h2><div class="compare-next-links"><a href="${BASE}${pair.aRoute}"><strong>${esc(pair.a)}</strong><span>공개비용·가맹점·원자료 확인</span></a><a href="${BASE}${pair.bRoute}"><strong>${esc(pair.b)}</strong><span>공개비용·가맹점·원자료 확인</span></a><a href="${BASE}/tools/startup-cost/"><strong>창업비용 계산기</strong><span>공개비용에 임대·권리금 등 실제 준비 항목 더하기</span></a></div></section>`;
    html=html.replace(/(<header class="compare-head">[\s\S]*?<\/header>)/,`$1${trust}`);
    if(html.includes('</article>'))html=html.replace('</article>',`${next}</article>`);else html=html.replace('</main>',`${next}</main>`);
  }
  await fs.writeFile(file,html,'utf8');
}

const tableRows=eligiblePairs.map(pair=>`<tr data-v11-17-compare-row="${pair.slug}"><td><a href="${pair.href}"><strong>${esc(pair.a)} vs ${esc(pair.b)}</strong></a></td><td class="num">${esc(pair.costDiff)}</td><td class="num">${esc(pair.storeDiff)}</td><td>${esc(tierLabel(pair.aTrust))} / ${esc(tierLabel(pair.bTrust))}</td></tr>`).join('');
const linkRows=eligiblePairs.map(pair=>`<a href="${pair.href}"><strong>${esc(pair.a)} vs ${esc(pair.b)}</strong><span>공개비용 ${esc(pair.costDiff)} · 가맹점 ${esc(pair.storeDiff)}</span></a>`).join('');
const itemList={'@context':'https://schema.org','@type':'ItemList','@id':`${SITE}/compare/#verified-comparisons`,name:'프랜차이즈 브랜드 비교',numberOfItems:eligiblePairs.length,itemListElement:eligiblePairs.map((pair,i)=>({'@type':'ListItem',position:i+1,name:`${pair.a} vs ${pair.b}`,url:`${SITE}${pair.route}`}))};
const hubMain=`<main data-v11-17-compare-hub="1"><div class="shell page"><nav class="crumbs" aria-label="현재 위치"><a href="${BASE}">홈</a><i>›</i><span>두 브랜드 비교</span></nav><div class="page-head"><h1>프랜차이즈 브랜드 비교</h1><p>같은 업종의 대표 브랜드를 동일한 공개비용·가맹점 기준으로 비교합니다. 현재 연속 이력 기준까지 통과한 ${eligiblePairs.length}개 조합만 검색 후보로 운영합니다.</p></div><section class="block"><h2>현재 비교 가능한 조합</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>브랜드 비교</th><th class="num">공개비용 차이 A-B</th><th class="num">가맹점 차이 A-B</th><th>정제 이력</th></tr></thead><tbody>${tableRows}</tbody></table></div></section><section class="block"><h2>비교 페이지를 고르는 기준</h2><dl class="tool-basis-list"><div><dt>3개년 이상</dt><dd>정제된 점포 이력이 3개년 이상 이어지는 브랜드입니다.</dd></div><div><dt>연속 2개년</dt><dd>다른 데이터·콘텐츠 게이트를 모두 통과한 경우 한 구간 변화 비교까지 허용합니다.</dd></div><div><dt>보강 대기</dt><dd>1개년뿐이거나 연도가 끊긴 브랜드가 포함된 조합은 검색 후보와 비교 허브에서 제외합니다.</dd></div></dl></section><section class="block"><h2>대표 비교 바로 보기</h2><div class="compare-directory">${linkRows}</div></section><section class="block"><h2>숫자를 읽을 때 주의할 점</h2><div class="faq"><details><summary>공개 창업비용이 낮으면 실제 창업비용도 낮나요?</summary><p>아닙니다. 임대보증금·권리금·별도 공사 등 공개 항목 밖의 금액은 실제 조건에 따라 달라집니다.</p></details><details><summary>가맹점이 많으면 수익성이 높다는 뜻인가요?</summary><p>아닙니다. 가맹점 수는 브랜드 규모 지표이며 점포별 이익을 뜻하지 않습니다.</p></details><details><summary>2개년 증감률로 성장성을 판단해도 되나요?</summary><p>한 구간 변화만 보여주므로 장기 성장성 판단 근거로 단정하지 않습니다.</p></details></div></section><section class="block"><h2>비교 다음 단계</h2><div class="compare-directory"><a href="${BASE}/tools/brand-filter/"><strong>브랜드 조건 찾기</strong><span>업종·비용·가맹점 조건으로 후보 좁히기</span></a><a href="${BASE}/tools/category-median/"><strong>업종 중앙값 비교</strong><span>선택 브랜드가 업종 중앙값에서 어디에 있는지 확인</span></a><a href="${BASE}/tools/startup-cost/"><strong>창업비용 계산기</strong><span>공개비용과 실제 준비자금 항목을 분리해 계산</span></a></div></section></div></main>`;

const hubPath=path.join(out,'compare/index.html');
let hub=await fs.readFile(hubPath,'utf8');
hub=hub.replace(/<title>[^<]*<\/title>/,'<title>프랜차이즈 브랜드 비교 | 창업비용·가맹점 비교</title>');
hub=hub.replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="연속 점포 이력과 공개비용 기준을 통과한 대표 프랜차이즈 ${eligiblePairs.length}개 조합의 창업비용·가맹점 차이를 비교합니다.">`);
hub=hub.replace(/<script type="application\/ld\+json" data-v11-17-compare-list>[\s\S]*?<\/script>/,'').replace('</head>',`<script type="application/ld+json" data-v11-17-compare-list>${safeJson(itemList)}</script></head>`);
hub=hub.replace(/<main[\s\S]*?<\/main>/,hubMain);
await fs.writeFile(hubPath,hub,'utf8');

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
if(!css.includes('/* v11.17 compare trust */')){
  css+=`\n/* v11.17 compare trust */\n.compare-trust-note{margin:0 0 28px;padding:14px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.compare-trust-note b{display:block;margin-bottom:5px}.compare-trust-note p{margin:0;color:var(--muted);font-size:14px;line-height:1.65}.compare-directory,.compare-next-links{display:grid;border-top:1px solid var(--line)}.compare-directory a,.compare-next-links a{display:grid;grid-template-columns:minmax(190px,270px) 1fr;gap:18px;padding:15px 2px;border-bottom:1px solid var(--line);text-decoration:none}.compare-directory span,.compare-next-links span{color:var(--muted);font-size:14px;line-height:1.6}@media(max-width:720px){.compare-directory a,.compare-next-links a{grid-template-columns:1fr;gap:5px}.compare-trust-note{margin-bottom:20px}}\n`;
  await fs.writeFile(cssPath,css,'utf8');
}

const candidateSet=new Set((quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute));
const previousCandidateCount=candidateSet.size;
for(const pair of eligiblePairs)candidateSet.add(pair.route);
for(const pair of blockedPairs)candidateSet.delete(pair.route);
const candidateUrls=[...candidateSet].sort();
quality.indexPolicy={...(quality.indexPolicy||{}),productionCandidateUrls:candidateUrls};
quality.contentTrust={...(quality.contentTrust||{}),version:'11.17',generatedAt,compareTrustPolicy:true,compareTierPolicy:'TIER_A_OR_TIER_B_BOTH_REQUIRED',eligibleCompareRoutes:eligiblePairs.map(x=>x.route),blockedCompareRoutes:blockedPairs.map(x=>x.route)};
await fs.writeFile(qualityPath,JSON.stringify(quality,null,2),'utf8');

const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);
const routeFor=file=>{const rel=path.relative(out,file).replace(/\\/g,'/');return rel==='index.html'?'/':normalizeRoute('/'+rel.replace(/\/index\.html$/,''))};
for(const file of htmlFiles){
  let html=await fs.readFile(file,'utf8');
  const route=routeFor(file);
  const robots=PREVIEW?'noindex,nofollow,noarchive,nosnippet':(candidateSet.has(route)?'index,follow':'noindex,nofollow,noarchive,nosnippet');
  html=html.replace(/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${robots}">`).replace(/<meta name="googlebot" content="[^"]*">/,`<meta name="googlebot" content="${robots}">`).replace(/<meta name="bingbot" content="[^"]*">/,`<meta name="bingbot" content="${robots}">`);
  await fs.writeFile(file,html,'utf8');
}
if(PREVIEW){
  await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n','utf8');
  await fs.writeFile(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>','utf8');
}else{
  await fs.writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`,'utf8');
  const lastmod=generatedAt.slice(0,10);
  const urls=candidateUrls.map(route=>`<url><loc>${SITE}${route==='/'?'':route}</loc><lastmod>${lastmod}</lastmod></url>`).join('');
  await fs.writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,'utf8');
}

manifest.uiVersion='11.17';
manifest.v11_17={compareTrustPolicy:true,eligibleCompareCount:eligiblePairs.length,blockedCompareCount:blockedPairs.length,tierBCompareExpansion:eligiblePairs.filter(x=>x.aTrust.tier==='B'||x.bTrust.tier==='B').length,compareItemList:true,compareContextLinks:true};
manifest.indexPolicy={...(manifest.indexPolicy||{}),productionCandidates:candidateUrls.length,productionCandidateUrls:candidateUrls};
manifest.environmentPolicy={...(manifest.environmentPolicy||{}),indexedHtml:PREVIEW?0:candidateUrls.length,noindexHtml:htmlFiles.length-(PREVIEW?0:candidateUrls.length),productionCandidateCount:candidateUrls.length,productionFailsIfCandidateNoindex:true};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

const report={schemaVersion:1,generatedAt,uiVersion:'11.17',previewMode:PREVIEW,policy:'COMPARE_REQUIRES_BOTH_BRANDS_TIER_A_OR_B; TIER_B_IS_EXACTLY_2_CONSECUTIVE_YEARS_ALREADY_APPROVED_BY_V11_14; TIER_C_COMPARISONS_REMAIN_UNLINKED_AND_NOINDEX',previousCandidateCount,productionCandidateCount:candidateUrls.length,eligibleCompareCount:eligiblePairs.length,blockedCompareCount:blockedPairs.length,tierBExpandedCompareCount:eligiblePairs.filter(x=>x.aTrust.tier==='B'||x.bTrust.tier==='B').length,eligible:eligiblePairs.map(x=>({route:x.route,a:{name:x.a,...x.aTrust},b:{name:x.b,...x.bTrust},costDiff:x.costDiff,storeDiff:x.storeDiff,growthDiff:x.growthDiff})),blocked:blockedPairs.map(x=>({route:x.route,a:{name:x.a,...x.aTrust},b:{name:x.b,...x.bTrust}}))};
await fs.writeFile(path.join(out,'v11-17-compare-trust.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_17:'PASS',previousCandidates:previousCandidateCount,productionCandidates:candidateUrls.length,eligibleComparisons:eligiblePairs.length,blockedComparisons:blockedPairs.length,tierBExpandedComparisons:report.tierBExpandedCompareCount},null,2));
