import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {brandSlugFor} from './routing-v3.mjs';
import {matchOfficialBrands} from './official-merge.mjs';
import {officialView,finite,median} from './v10-lib.mjs';

await import(`./run-generate-v10-final.mjs?v11=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const PREVIEW=(process.env.SSG_PREVIEW_MODE??'true')!=='false';
const BASE=(process.env.SSG_BASE_PATH??'/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const SITE=(process.env.SSG_SITE_URL??'https://5ggul.github.io/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const generatedAt=new Date().toISOString();

async function loadClassic(file,expr){
  const code=await fs.readFile(file,'utf8');
  const ctx={console};
  vm.createContext(ctx);
  vm.runInContext(`${code}\n;globalThis.__EXPORT__=${expr};`,ctx);
  return ctx.__EXPORT__;
}
const catalog=await loadClassic(path.join(repo,'docs/franchise-data-preview/data-final.js'),'{categories,brands}');
const official=JSON.parse(await fs.readFile(path.join(repo,'data/franchise/official/brands-2025.json'),'utf8'));
const currentCostPath=path.join(here,'operator-opening-costs.json');
const currentCosts=JSON.parse(await fs.readFile(currentCostPath,'utf8'));
const matched=matchOfficialBrands(catalog.brands,official);
const hitByName=new Map(matched.matches.map(x=>[x.brand.name,x]));
const views=catalog.brands.map(b=>officialView(b,hitByName.get(b.name)||null));
const byName=new Map(views.map(b=>[b.name,b]));
const reviewDate=String(official.generatedAt||generatedAt).slice(0,10);

const priorityNames=[
  '메가MGC커피','컴포즈커피','빽다방','이디야커피','더벤티','매머드커피',
  '교촌치킨','bhc치킨','BBQ치킨','굽네치킨','네네치킨','맘스터치','프랭크버거','롯데리아',
  '김가네','얌샘김밥','신전떡볶이','청년다방','한솥','본죽&비빔밥',
  '파리바게뜨','뚜레쥬르','배스킨라빈스','설빙','CU','GS25','세븐일레븐','이마트24',
  '역전할머니맥주','생활맥주'
];

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=n=>Number(n).toLocaleString('ko-KR');
const won10k=n=>finite(n)?`${Math.round(Number(n)).toLocaleString('ko-KR')}만원`:'정보 없음';
const exactWon=n=>finite(n)?`${Math.round(Number(n)).toLocaleString('ko-KR')}원`:'정보 없음';
function quantile(values,q){const a=values.filter(finite).map(Number).sort((x,y)=>x-y);if(!a.length)return null;const pos=(a.length-1)*q,base=Math.floor(pos),rest=pos-base;return a[base+1]!==undefined?a[base]+rest*(a[base+1]-a[base]):a[base]}
const routeFor=(file)=>{const rel=path.relative(out,file).replace(/\\/g,'/');if(rel==='index.html')return '/';return '/'+rel.replace(/\/index\.html$/,'')+'/'};
const normalizeRoute=r=>r==='/'?'/':`/${String(r).replace(/^\/+|\/+$/g,'')}/`;

function hasSource(r){return Boolean(r?.sourceUrl||r?.source?.statsUrl||r?.source?.costUrl)}
function strictBrandRecord(name){
  const hit=hitByName.get(name);
  if(!hit)return {name,eligible:false,reasons:['OFFICIAL_MATCH_MISSING']};
  const r=hit.record, reasons=[];
  if(!hasSource(r))reasons.push('SOURCE_MISSING');
  if(!r.referenceYear)reasons.push('REFERENCE_YEAR_MISSING');
  if(!finite(r.startupCost10k))reasons.push('COST_MISSING');
  if(!finite(r.stores))reasons.push('STORES_MISSING');
  if(!finite(r.averageSales10k))reasons.push('SALES_MISSING');
  const c=r.costComponents||{};
  const componentKeys=['franchiseFee10k','education10k','deposit10k','etc10k'];
  if(!componentKeys.every(k=>finite(c[k])))reasons.push('COST_COMPONENTS_INCOMPLETE');
  const history=(r.storeHistory||[]).filter(x=>finite(x?.stores));
  if(history.length<3)reasons.push('STORE_HISTORY_LT_3');
  const oc=r.openClose||{};
  const newStores=r.newStores??oc.newStores;
  const ended=r.contractEnd??oc.ended;
  const cancelled=r.contractCancel??oc.cancelled;
  if(!finite(newStores)||!finite(ended)||!finite(cancelled))reasons.push('OPEN_CLOSE_INCOMPLETE');
  return {name,eligible:reasons.length===0,reasons,method:hit.method,historyYears:history.map(x=>x.year),componentCount:componentKeys.filter(k=>finite(c[k])).length};
}
const strictAudit=priorityNames.map(strictBrandRecord);
const strictNames=new Set(strictAudit.filter(x=>x.eligible).map(x=>x.name));
const strictBrandRoutes=new Set([...strictNames].map(n=>normalizeRoute(`/brands/${brandSlugFor(n,byName.get(n)?.slug)}/`)));

const categoryRows=new Map();
for(const [slug] of Object.entries(catalog.categories))categoryRows.set(slug,views.filter(v=>v.categorySlug===slug&&v.dataMode==='FTC_OFFICIAL'&&finite(v.cost)&&finite(v.stores)));
const categoryEligible=new Set([...categoryRows.entries()].filter(([,rows])=>rows.length>=5).map(([slug])=>normalizeRoute(`/categories/${slug}/`)));

const files=[];
async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))files.push(p)}}
await walk(out);

function cleanJsonLd(html){
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,(full,raw)=>{
    try{
      const data=JSON.parse(raw);
      const type=data?.['@type'];
      if(['FAQPage','HowTo','Dataset'].includes(type))return '';
      if(type==='WebSite'&&data.potentialAction){const copy={...data};delete copy.potentialAction;return `<script type="application/ld+json">${JSON.stringify(copy).replace(/</g,'\\u003c')}</script>`}
      return full;
    }catch{return full}
  });
}
function cleanWording(html){
  return html
    .replace(/정보공개서 기준/g,'공정위 공개 기준년도')
    .replace(/(\d{4}) 정보공개서 공개자료/g,'공정위 공개 기준년도 $1 · 공개자료')
    .replace(/(\d{4}) 정보공개서 공개 창업비용/g,'공정위 공개 기준년도 $1의 창업비용')
    .replace(/(\d{4}) 공개자료 기준/g,'공정위 공개 기준년도 $1 기준')
    .replace(/공개 기준 (\d{4})/g,'공정위 기준년도 $1')
    .replace(/전년 점포 변화/g,'이전 기준 점포 변화')
    .replace(/전년 증감/g,'이전 기준 증감')
    .replace(/전년보다/g,'이전 기준보다')
    .replace(/전년 대비/g,'이전 기준 대비')
    .replace(/이 프리뷰에서는 계산 구조와 검색용 문서를 먼저 검수합니다\. 정식 구현에서는 입력값만 브라우저에서 다시 계산하고 설명·표·FAQ는 서버가 만든 HTML에 남습니다\./g,'입력값을 임의로 추정하지 않습니다. 아래 계산식과 확인 항목은 공개자료를 읽을 때 적용하는 기준이며, 실제 계약·견적 판단은 원문과 최신 자료를 다시 확인해야 합니다.');
}

function currentCostBlock(name,data){
  const rows=(data.rows||[]).map(r=>`<tr><td data-label="구분">${esc(r.label)}</td><td data-label="공개금액" class="num">${exactWon(r.totalWon)}</td><td data-label="기준">${esc(r.basis||'')}</td><td data-label="VAT">${esc(r.vat||'확인 필요')}</td></tr>`).join('');
  const excluded=(data.excluded||[]).map(x=>`<li>${esc(x)}</li>`).join('');
  return `<section class="block operator-cost" id="official-current-cost"><div class="section-head"><h2>${esc(name)} 가맹본부 현재 개설 안내</h2><span class="basis-chip">확인일 ${esc(data.checkedOn)}</span></div><p>공정위 정보공개서 수치와 섞지 않고, 가맹본부가 현재 공개한 개설 안내를 별도 기준으로 표시합니다.</p><div class="table-scroll"><table class="data-table stack-mobile"><thead><tr><th>구분</th><th class="num">가맹본부 공개금액</th><th>기준</th><th>VAT</th></tr></thead><tbody>${rows}</tbody></table></div>${excluded?`<div class="operator-excluded"><strong>별도 확인 항목</strong><ul>${excluded}</ul></div>`:''}<p class="source-line"><a href="${esc(data.sourceUrl)}" rel="external noopener">가맹본부 공개자료 원문</a> · 확인일 ${esc(data.checkedOn)}</p></section>`;
}

function scatterSvg(rows,label){
  const data=rows.filter(r=>finite(r.cost)&&finite(r.stores));
  if(data.length<5)return '';
  const w=820,h=340,l=78,r=28,t=28,b=58;
  const costs=data.map(x=>Number(x.cost)),stores=data.map(x=>Number(x.stores));
  const minC=Math.min(...costs),maxC=Math.max(...costs),minS=Math.min(...stores),maxS=Math.max(...stores);
  const sx=v=>l+(maxC===minC?0.5:(v-minC)/(maxC-minC))*(w-l-r);
  const sy=v=>h-b-(maxS===minS?0.5:(v-minS)/(maxS-minS))*(h-t-b);
  const dots=data.map(x=>`<circle cx="${sx(Number(x.cost)).toFixed(1)}" cy="${sy(Number(x.stores)).toFixed(1)}" r="5"><title>${esc(x.name)} · ${won10k(x.cost)} · ${fmt(x.stores)}개</title></circle>`).join('');
  return `<svg class="chart-svg category-scatter" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)} 공개 창업비용과 가맹점 수 분포"><title>${esc(label)} 공개 창업비용과 가맹점 수 분포</title><line x1="${l}" y1="${h-b}" x2="${w-r}" y2="${h-b}"/><line x1="${l}" y1="${t}" x2="${l}" y2="${h-b}"/>${dots}<text x="${(l+w-r)/2}" y="${h-14}" text-anchor="middle">공개 창업비용</text><text x="18" y="${(t+h-b)/2}" text-anchor="middle" transform="rotate(-90 18 ${(t+h-b)/2})">가맹점 수</text></svg>`;
}
function categoryDistribution(slug,rows){
  if(rows.length<5)return '';
  const costs=rows.map(x=>x.cost).filter(finite);
  const q1=quantile(costs,.25),med=median(costs),q3=quantile(costs,.75);
  const label=catalog.categories[slug]?.name||catalog.categories[slug]?.label||slug;
  return `<section class="block distribution-block" id="distribution"><div class="section-head"><h2>${esc(label)} 창업비용 분포</h2><span class="basis-chip">공식 매칭 ${rows.length}개</span></div><p>한두 개 브랜드의 극단값보다 업종 안에서 어느 구간에 위치하는지 보기 위한 분포 요약입니다. 추천·수익성 점수가 아닙니다.</p><div class="stat-grid distribution-stats"><div class="stat-card"><span class="label">25% 지점</span><b class="value">${won10k(q1)}</b><small>Q1</small></div><div class="stat-card"><span class="label">중앙값</span><b class="value">${won10k(med)}</b><small>Median</small></div><div class="stat-card"><span class="label">75% 지점</span><b class="value">${won10k(q3)}</b><small>Q3</small></div><div class="stat-card"><span class="label">비교 표본</span><b class="value">${rows.length}개</b><small>공식 매칭 브랜드</small></div></div>${scatterSvg(rows,label)}<div class="chart-legend">가로축은 공개 창업비용, 세로축은 가맹점 수입니다. 점포 수가 많거나 비용이 낮다는 사실만으로 우수 브랜드를 의미하지 않습니다.</div></section>`;
}

for(const file of files){
  let html=await fs.readFile(file,'utf8');
  html=cleanJsonLd(cleanWording(html));
  const route=routeFor(file);
  if(route==='/'){
    html=html.replace(/<div class="shell data-status">(?:<div>[\s\S]*?<\/div>){5}<\/div>/,`<div class="shell data-status"><div><b>170</b><span>브랜드 탐색</span></div><div><b>20</b><span>업종 비교</span></div><div><b>2</b><span>핵심 계산기</span></div><div><b>${reviewDate}</b><span>데이터 갱신일</span></div></div>`);
  }
  if(route==='/tools/'){
    const hide=['/tools/disclosure-decoder/','/tools/monthly-fixed-cost/','/tools/break-even/','/tools/open-close-rate/','/tools/category-median/','/tools/store-density/'];
    for(const p of hide){const escaped=p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');html=html.replace(new RegExp(`<a href="${BASE}${escaped}">[\\s\\S]*?<\\/a>`,'g'),'')}
    html=html.replace(/<section class="block"><h2>초기비용<\/h2>/,'<section class="block"><h2>바로 쓰는 계산기</h2>')
      .replace(/<section class="block"><h2>운영<\/h2>/,'<section class="block"><h2>운영 계산</h2>')
      .replace(/<div class="report-grid">\s*<\/div>/g,'')
      .replace(/<section class="block"><h2>브랜드·지역 분석<\/h2>[\s\S]*?<\/section>/,'');
  }
  if(route.startsWith('/brands/')){
    const slug=route.split('/').filter(Boolean)[1];
    const b=views.find(x=>brandSlugFor(x.name,x.slug)===slug);
    const entry=b?currentCosts.brands?.[b.name]:null;
    if(b&&entry&&!html.includes('id="official-current-cost"')){
      html=html.replace('<div class="brand-toc"><nav>','<div class="brand-toc"><nav>')
        .replace('<a href="#cost">비용 구성</a>',`<a href="#official-current-cost">본사 개설비</a><a href="#cost">비용 구성</a>`)
        .replace('<section class="block" id="cost">',`${currentCostBlock(b.name,entry)}<section class="block" id="cost">`);
    }
  }
  if(route.startsWith('/categories/')){
    const slug=route.split('/').filter(Boolean)[1];
    const rows=categoryRows.get(slug)||[];
    const block=categoryDistribution(slug,rows);
    if(block&&!html.includes('id="distribution"'))html=html.replace('<section class="block">',`${block}<section class="block">`);
  }
  await fs.writeFile(file,html,'utf8');
}

const staticRoutes=['/','/brands/','/categories/','/compare/','/tools/','/tools/startup-cost/','/tools/monthly-profit-simulator/','/guide/low-price-coffee/','/sources/','/methodology/','/about/','/privacy/','/terms/','/disclaimer/','/contact/','/updates/'];
const oldQuality=JSON.parse(await fs.readFile(path.join(out,'v10-quality-report.json'),'utf8'));
const compareRoutes=(oldQuality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute).filter(r=>r.startsWith('/compare/')&&r!=='/compare/').filter(r=>{
  const m=r.match(/^\/compare\/(.+)-vs-(.+)\/$/);if(!m)return false;
  return strictBrandRoutes.has(normalizeRoute(`/brands/${m[1]}/`))&&strictBrandRoutes.has(normalizeRoute(`/brands/${m[2]}/`));
});
const candidates=new Set([...staticRoutes.map(normalizeRoute),...strictBrandRoutes,...categoryEligible,...compareRoutes]);

for(const file of files){
  let html=await fs.readFile(file,'utf8');
  const route=normalizeRoute(routeFor(file));
  const value=PREVIEW?'noindex,nofollow,noarchive,nosnippet':(candidates.has(route)?'index,follow':'noindex,nofollow,noarchive,nosnippet');
  html=html.replace(/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${value}">`)
    .replace(/<meta name="googlebot" content="[^"]*">/,`<meta name="googlebot" content="${value}">`)
    .replace(/<meta name="bingbot" content="[^"]*">/,`<meta name="bingbot" content="${value}">`);
  await fs.writeFile(file,html,'utf8');
}

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
const cssPatch=`\n/* v11 evidence + distribution */\n.basis-chip{font-size:12px;color:#6b645c;border:1px solid #d9d1c5;padding:5px 8px;border-radius:999px;white-space:nowrap}.operator-cost .source-line{font-size:13px;color:#6b645c}.operator-excluded{margin-top:18px;padding-top:16px;border-top:1px solid #e6dfd4}.operator-excluded ul{margin:8px 0 0;padding-left:20px}.distribution-block{border-top:3px solid #1c1916}.distribution-stats{margin-top:18px}.category-scatter{margin-top:18px}.category-scatter line{stroke:#cfc7bb;stroke-width:1}.category-scatter circle{fill:#2457d6;opacity:.78}.category-scatter text{fill:#6b645c;font-size:12px}@media(max-width:720px){.operator-cost .section-head,.distribution-block .section-head{align-items:flex-start;gap:8px}.basis-chip{white-space:normal}.category-scatter{min-width:620px}.distribution-block{overflow:hidden}}\n`;
if(!css.includes('/* v11 evidence + distribution */')){css+=cssPatch;await fs.writeFile(cssPath,css,'utf8')}

const routeManifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(routeManifestPath,'utf8'));
manifest.uiVersion=11;
manifest.v11={schemaCleanup:true,referenceYearLanguage:true,currentOperatorCostBrands:Object.keys(currentCosts.brands||{}),strictBrandCandidates:strictBrandRoutes.size,categoryDistributionCandidates:categoryEligible.size,compareCandidates:compareRoutes.length};
manifest.indexPolicy={previewAllNoindex:PREVIEW,brandCandidates:strictBrandRoutes.size,categoryCandidates:categoryEligible.size,compareCandidates:compareRoutes.length,productionCandidates:candidates.size,productionCandidateUrls:[...candidates].sort()};
manifest.environmentPolicy={siteEnv:PREVIEW?'preview':'production',centralRobots:true,indexedHtml:PREVIEW?0:candidates.size,noindexHtml:files.length-(PREVIEW?0:candidates.size),productionCandidateCount:candidates.size,productionFailsIfCandidateNoindex:true};
await fs.writeFile(routeManifestPath,JSON.stringify(manifest,null,2),'utf8');

const report={schemaVersion:1,generatedAt,uiVersion:11,previewMode:PREVIEW,official:{records:official.records?.length||0,referenceYear:official.referenceYear,matched:matched.matches.length,unmatched:matched.unmatched.length,ambiguous:matched.ambiguous.length},qualityPolicy:{brand:'required-field gate, not score threshold',category:'at least 5 official matched rows with cost and stores',compare:'both brands must pass strict brand gate',tools:'only startup-cost and monthly-profit-simulator are production candidates until other tools truly work'},strictBrands:strictAudit,indexPolicy:{productionCandidateUrls:[...candidates].sort()},currentOperatorOpeningCosts:currentCosts,productionBlockers:['OPERATOR_IDENTITY_NOT_READY','REAL_CONTACT_NOT_READY',...(matched.ambiguous.length?[`AMBIGUOUS_CATALOG:${matched.ambiguous.length}`]:[]),...(matched.unmatched.length?[`UNMATCHED_CATALOG:${matched.unmatched.length}`]:[]),'VAT_BASIS_METADATA_INCOMPLETE_FOR_MOST_BRANDS','CURRENT_OPERATOR_COST_COVERAGE_PARTIAL']};
await fs.writeFile(path.join(out,'v11-quality-report.json'),JSON.stringify(report,null,2),'utf8');

if(PREVIEW){
  await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n','utf8');
  await fs.writeFile(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>','utf8');
}else{
  await fs.writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`,'utf8');
  const urls=[...candidates].sort().map(r=>`<url><loc>${SITE}${r==='/'?'':r}</loc><lastmod>${reviewDate}</lastmod></url>`).join('');
  await fs.writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,'utf8');
}

console.log(JSON.stringify({v11:'PASS',preview:PREVIEW,html:files.length,strictBrandCandidates:strictBrandRoutes.size,categoryCandidates:categoryEligible.size,compareCandidates:compareRoutes.length,productionCandidates:candidates.size,currentOperatorCostBrands:Object.keys(currentCosts.brands||{})},null,2));
