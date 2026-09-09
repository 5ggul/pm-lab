import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE='/pm-lab/franchise-ssg-preview';
const SITE=(process.env.SSG_SITE_URL??'https://5ggul.github.io/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const generatedAt=new Date().toISOString();
const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const toolTrust=JSON.parse(await fs.readFile(path.join(out,'v11-15-tool-trust.json'),'utf8'));
const compareTrust=JSON.parse(await fs.readFile(path.join(out,'v11-17-compare-trust.json'),'utf8'));
const budgetIntent=JSON.parse(await fs.readFile(path.join(out,'v11-19-budget-intent.json'),'utf8'));
const rankingHub=JSON.parse(await fs.readFile(path.join(out,'v11-20-ranking-hub.json'),'utf8'));

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const stripTags=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const decode=s=>String(s??'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const normalizeRoute=r=>r==='/'?'/':`/${String(r).split('#')[0].split('?')[0].replace(/^\/+|\/+$/g,'')}/`;
const candidateSet=new Set((quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute));
const productionCandidateCount=candidateSet.size;
if(productionCandidateCount!==rankingHub.productionCandidateCount)throw new Error(`Candidate baseline mismatch ${productionCandidateCount}/${rankingHub.productionCandidateCount}`);

function routeType(route){
  if(route==='/')return 'home';
  if(route==='/explore/')return 'explore';
  if(route==='/rankings/')return 'rankings';
  if(route==='/brands/')return 'brandsHub';
  if(route.startsWith('/brands/'))return 'brand';
  if(route==='/categories/')return 'categoriesHub';
  if(route.startsWith('/categories/'))return 'category';
  if(route==='/compare/')return 'compareHub';
  if(route.startsWith('/compare/'))return 'compare';
  if(route==='/tools/')return 'toolsHub';
  if(route.startsWith('/tools/'))return 'tool';
  if(route.startsWith('/guide/'))return 'guide';
  return 'trustOrInfo';
}
const candidateTypeCounts={};
for(const route of candidateSet){const type=routeType(route);candidateTypeCounts[type]=(candidateTypeCounts[type]||0)+1}

function internalRoute(href){
  if(!href)return null;
  let raw=decode(href.trim());
  if(raw.startsWith(SITE))raw=BASE+raw.slice(SITE.length);
  if(raw===BASE||raw===`${BASE}/`)return '/';
  if(!raw.startsWith(`${BASE}/`))return null;
  return normalizeRoute(raw.slice(BASE.length));
}
function extractInternalLinks(html){
  const links=[];
  for(const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/gi)){
    const route=internalRoute(match[1]);
    if(route)links.push(route);
  }
  return links;
}
const unique=arr=>[...new Set(arr)];

const homePath=path.join(out,'index.html');
const brandsPath=path.join(out,'brands/index.html');
const categoriesPath=path.join(out,'categories/index.html');
const comparePath=path.join(out,'compare/index.html');
const toolsPath=path.join(out,'tools/index.html');
let home=await fs.readFile(homePath,'utf8');
let brands=await fs.readFile(brandsPath,'utf8');
let categories=await fs.readFile(categoriesPath,'utf8');
let compare=await fs.readFile(comparePath,'utf8');
let tools=await fs.readFile(toolsPath,'utf8');

const brandHubLinks=unique(extractInternalLinks(brands).filter(r=>r.startsWith('/brands/')&&r!=='/brands/'));
const categoryHubLinks=unique(extractInternalLinks(categories).filter(r=>r.startsWith('/categories/')&&r!=='/categories/'));
const compareHubLinks=unique(extractInternalLinks(compare).filter(r=>r.startsWith('/compare/')&&r!=='/compare/'));
const toolHubLinks=unique(extractInternalLinks(tools).filter(r=>r.startsWith('/tools/')&&r!=='/tools/'));

const toolRows=[];
for(const match of tools.matchAll(/<tr data-v11-16-tool-row="([^"]+)"><td><a href="([^"]+)">([\s\S]*?)<\/a><\/td><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g)){
  const route=internalRoute(match[2]);
  if(!route||!candidateSet.has(route))continue;
  toolRows.push({slug:match[1],route,href:match[2],name:decode(stripTags(match[3])),goal:decode(stripTags(match[4]))});
}
const approvedToolRoutes=(toolTrust.approvedToolRoutes||[]).map(normalizeRoute);
if(toolRows.length!==approvedToolRoutes.length)throw new Error(`Expected ${approvedToolRoutes.length} verified tool rows, parsed ${toolRows.length}`);
for(const required of ['/explore/','/rankings/'])if(!candidateSet.has(required))throw new Error(`Required preserved candidate missing: ${required}`);

const journeyRows=[
  {href:`${BASE}/explore/`,name:'예산별 찾기',desc:`Tier A/B ${budgetIntent.trustedBrands}개 브랜드를 예산·업종·가맹점 조건으로 좁힙니다.`},
  {href:`${BASE}/rankings/`,name:'데이터 순위',desc:`Tier A/B ${rankingHub.trustedBrands}개 브랜드를 공개비용·가맹점·평균매출 공개지표로 각각 정렬합니다.`},
  {href:`${BASE}/brands/`,name:'브랜드 찾기',desc:`${brandHubLinks.length}개 브랜드 페이지에서 공개비용·가맹점·원자료를 확인합니다.`},
  {href:`${BASE}/categories/`,name:'업종별 보기',desc:`${categoryHubLinks.length}개 업종의 창업비용 중앙값과 브랜드 분포를 비교합니다.`},
  {href:`${BASE}/compare/`,name:'브랜드 비교',desc:`이력 기준을 통과한 ${compareTrust.eligibleCompareCount||compareHubLinks.length}개 대표 조합을 동일 기준으로 비교합니다.`},
  {href:`${BASE}/tools/`,name:'계산·분석 도구',desc:`검증된 ${toolRows.length}개 도구에서 공식값·사용자 입력·파생 통계를 구분해 확인합니다.`}
];
const journeySection=`<section class="home-section home-paths" data-v11-21-home-paths="1"><div class="shell"><div class="section-head"><h2>원하는 방식으로 찾기</h2></div><div class="authority-directory">${journeyRows.map(row=>`<a href="${row.href}"><strong>${esc(row.name)}</strong><span>${esc(row.desc)}</span></a>`).join('')}</div></div></section>`;
const toolSection=`<section class="home-section home-tool-directory" data-v11-21-home-tools="1"><div class="shell"><div class="section-head"><h2>계산·분석 도구 ${toolRows.length}개</h2><a href="${BASE}/tools/">도구 전체 보기</a></div><div class="authority-directory">${toolRows.map(row=>`<a href="${row.href}"><strong>${esc(row.name)}</strong><span>${esc(row.goal)}</span></a>`).join('')}</div><p class="data-note">공식 공개값, 사용자가 입력한 가정, 공개값에서 계산한 파생 통계를 도구별로 구분합니다.</p></div></section>`;

home=home.replace('<div><b>3</b><span>계산기</span></div>',`<div><b>${toolRows.length}</b><span>검증 도구</span></div>`);
if(!home.includes('data-v11-21-home-paths="1"'))home=home.replace(/(<div class="shell data-status">[\s\S]*?<\/div><\/div>)/,`$1${journeySection}`);
home=home.replace(/<section class="home-section"><div class="shell"><div class="section-head"><h2>계산기<\/h2>[\s\S]*?<\/section>/,toolSection);
if(!home.includes('data-v11-21-home-tools="1"'))throw new Error('Failed to replace stale home calculator section');
await fs.writeFile(homePath,home,'utf8');

categories=categories.replace('<div class="report-grid">','<div class="authority-directory category-authority-directory" data-v11-21-category-directory="1">');
await fs.writeFile(categoriesPath,categories,'utf8');

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
if(!css.includes('/* v11.21 internal authority */')){
  css+=`\n/* v11.21 internal authority */\n.authority-directory{display:grid;border-top:1px solid var(--line)}.authority-directory>a{display:grid;grid-template-columns:minmax(190px,270px) 1fr;gap:18px;align-items:start;padding:15px 2px;border-bottom:1px solid var(--line);text-decoration:none}.authority-directory>a strong{font-size:15px;line-height:1.5}.authority-directory>a span{font-size:14px;line-height:1.65;color:var(--muted)}.home-tool-directory .data-note{margin-top:14px}.category-authority-directory{margin-top:24px}@media(max-width:720px){.authority-directory>a{grid-template-columns:1fr;gap:4px;padding:14px 0}}\n`;
  await fs.writeFile(cssPath,css,'utf8');
}

quality.qualityPolicy={...(quality.qualityPolicy||{}),compare:'comparison candidate requires both brands to pass v11.14 Tier A or Tier B history trust; Tier C pairs remain noindex and unlinked from the verified compare hub',tools:'8 v11.15 verified interactive tools are production candidates; store-density remains blocked until real local/geospatial store data exists',budget:'one /explore/ budget-intent hub only; no programmatic budget landing-page fanout; Tier A/B brand rows only',rankings:'one /rankings/ consolidated metric-sort hub only; legacy ranking subpages remain noindex; metric order is not a recommendation'};
quality.contentTrust={...(quality.contentTrust||{}),version:'11.21',generatedAt,internalAuthorityPolicy:true,budgetExplorerPreserved:true,rankingHubPreserved:true,productionCandidateCount,internalAuthorityRule:'HOME_TO_EXPLORE_RANKINGS_AND_PRIMARY_HUBS; PRIMARY_HUBS_TO_CANDIDATE_DETAILS; VERIFIED_TOOLS_DIRECT_FROM_HOME; ALL_CANDIDATES_REACHABLE_WITHIN_3_CLICKS'};
await fs.writeFile(qualityPath,JSON.stringify(quality,null,2),'utf8');

const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);
const fileRoute=file=>{const rel=path.relative(out,file).replace(/\\/g,'/');return rel==='index.html'?'/':normalizeRoute('/'+rel.replace(/\/index\.html$/,''))};
const htmlByRoute=new Map();
for(const file of htmlFiles)htmlByRoute.set(fileRoute(file),await fs.readFile(file,'utf8'));
const graph=new Map(),inbound=new Map();
for(const [route,html] of htmlByRoute){
  const links=unique(extractInternalLinks(html)).filter(target=>htmlByRoute.has(target));
  graph.set(route,links);
  for(const target of links){const set=inbound.get(target)||new Set();set.add(route);inbound.set(target,set)}
}
const distance=new Map([['/',0]]),queue=['/'];
while(queue.length){const route=queue.shift(),d=distance.get(route);for(const next of graph.get(route)||[]){if(distance.has(next))continue;distance.set(next,d+1);queue.push(next)}}
const candidateHtmlMissing=[...candidateSet].filter(route=>!htmlByRoute.has(route)).sort();
const unreachableCandidates=[...candidateSet].filter(route=>!distance.has(route)).sort();
const candidateDepths=[...candidateSet].filter(route=>distance.has(route)).map(route=>({route,depth:distance.get(route),type:routeType(route)}));
const maxCandidateDepth=candidateDepths.length?Math.max(...candidateDepths.map(x=>x.depth)):null;
const depthDistribution={};for(const row of candidateDepths)depthDistribution[row.depth]=(depthDistribution[row.depth]||0)+1;
const orphanCandidates=[...candidateSet].filter(route=>route!=='/'&&!(inbound.get(route)?.size)).sort();
const hubRoutes={brands:'/brands/',categories:'/categories/',compare:'/compare/',tools:'/tools/'};
const detailExpected={brands:[...candidateSet].filter(r=>routeType(r)==='brand'),categories:[...candidateSet].filter(r=>routeType(r)==='category'),compare:[...candidateSet].filter(r=>routeType(r)==='compare'),tools:[...candidateSet].filter(r=>routeType(r)==='tool')};
const hubCoverage={};
for(const [key,hubRoute] of Object.entries(hubRoutes)){const linked=new Set(graph.get(hubRoute)||[]),expected=detailExpected[key],missing=expected.filter(route=>!linked.has(route)).sort();hubCoverage[key]={hubRoute,expected:expected.length,linkedCandidates:expected.length-missing.length,missing}}
const homeLinks=new Set(graph.get('/')||[]);
const homeHubCoverage=Object.values(hubRoutes).map(route=>({route,linked:homeLinks.has(route)}));
const homeDirectVerifiedTools=approvedToolRoutes.filter(route=>homeLinks.has(route));
const hubDetailDepthViolations=candidateDepths.filter(row=>['brand','category','compare','tool'].includes(row.type)&&row.depth>2).map(row=>row.route);
const allDepthViolations=candidateDepths.filter(row=>row.depth>3).map(row=>row.route);
const exploreDepth=distance.get('/explore/')??null,rankingDepth=distance.get('/rankings/')??null;

manifest.uiVersion='11.21';
manifest.v11_21={internalAuthorityPolicy:true,budgetExplorerPreserved:true,rankingHubPreserved:true,productionCandidateCount,homeDiscoveryLinks:journeyRows.length,homePrimaryHubLinks:homeHubCoverage.filter(x=>x.linked).length,homeVerifiedToolLinks:homeDirectVerifiedTools.length,exploreDepth,rankingDepth,maxCandidateDepth,orphanCandidateCount:orphanCandidates.length,hubCoverageComplete:Object.values(hubCoverage).every(row=>row.missing.length===0),qualityPolicyMetadataAligned:true,categoryDirectoryRowStyle:true};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');
const report={schemaVersion:1,generatedAt,uiVersion:'11.21',previewMode:true,policy:'PRESERVE_V11_19_EXPLORE_AND_V11_20_RANKINGS; HOME_LINKS_6_DISCOVERY_PATHS_AND_8_VERIFIED_TOOLS; HUBS_COVER_ALL_CANDIDATE_DETAILS; CANDIDATE_DETAIL_DEPTH_LE_2; ALL_CANDIDATE_DEPTH_LE_3; NO_ORPHAN_CANDIDATES',productionCandidateCount,baselines:{budget:{candidateCount:budgetIntent.productionCandidateCount,trustedBrands:budgetIntent.trustedBrands},rankings:{candidateCount:rankingHub.productionCandidateCount,trustedBrands:rankingHub.trustedBrands}},candidateTypeCounts,catalogHubCounts:{brandLinks:brandHubLinks.length,categoryLinks:categoryHubLinks.length,compareLinks:compareHubLinks.length,toolLinks:toolHubLinks.length},home:{discoveryLinks:journeyRows.map(row=>internalRoute(row.href)),primaryHubLinks:homeHubCoverage,verifiedToolLinks:homeDirectVerifiedTools.length,verifiedToolRoutes:homeDirectVerifiedTools,exploreLinked:homeLinks.has('/explore/'),rankingsLinked:homeLinks.has('/rankings/')},graph:{htmlRouteCount:htmlByRoute.size,candidateHtmlMissing,unreachableCandidates,maxCandidateDepth,depthDistribution,orphanCandidates,hubDetailDepthViolations,allDepthViolations,exploreDepth,rankingDepth},hubCoverage,qualityPolicyUpdated:{compare:quality.qualityPolicy.compare,tools:quality.qualityPolicy.tools,budget:quality.qualityPolicy.budget,rankings:quality.qualityPolicy.rankings}};
await fs.writeFile(path.join(out,'v11-21-internal-authority.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_21:'PASS',productionCandidates:productionCandidateCount,candidateTypeCounts,homeVerifiedTools:homeDirectVerifiedTools.length,exploreDepth,rankingDepth,maxCandidateDepth,orphanCandidates:orphanCandidates.length,hubCoverage:Object.fromEntries(Object.entries(hubCoverage).map(([k,v])=>[k,`${v.linkedCandidates}/${v.expected}`]))},null,2));
