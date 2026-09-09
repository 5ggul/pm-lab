import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'v11-21-internal-authority.json'),'utf8'));
const budgetIntent=JSON.parse(await fs.readFile(path.join(out,'v11-19-budget-intent.json'),'utf8'));
const rankingHub=JSON.parse(await fs.readFile(path.join(out,'v11-20-ranking-hub.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const toolTrust=JSON.parse(await fs.readFile(path.join(out,'v11-15-tool-trust.json'),'utf8'));
const compareTrust=JSON.parse(await fs.readFile(path.join(out,'v11-17-compare-trust.json'),'utf8'));
const home=await fs.readFile(path.join(out,'index.html'),'utf8');
const brands=await fs.readFile(path.join(out,'brands/index.html'),'utf8');
const categories=await fs.readFile(path.join(out,'categories/index.html'),'utf8');
const compare=await fs.readFile(path.join(out,'compare/index.html'),'utf8');
const tools=await fs.readFile(path.join(out,'tools/index.html'),'utf8');
const explore=await fs.readFile(path.join(out,'explore/index.html'),'utf8');
const rankings=await fs.readFile(path.join(out,'rankings/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');

if(report.uiVersion!=='11.21')errors.push(`report uiVersion ${report.uiVersion}`);
if(manifest.uiVersion!=='11.21')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_21?.internalAuthorityPolicy!==true)errors.push('manifest internalAuthorityPolicy flag missing');
if(manifest.v11_21?.budgetExplorerPreserved!==true)errors.push('manifest budgetExplorerPreserved flag missing');
if(manifest.v11_21?.rankingHubPreserved!==true)errors.push('manifest rankingHubPreserved flag missing');
if(quality.contentTrust?.version!=='11.21'||quality.contentTrust?.internalAuthorityPolicy!==true)errors.push('quality internal-authority metadata missing');
if(quality.contentTrust?.budgetExplorerPreserved!==true||quality.contentTrust?.rankingHubPreserved!==true)errors.push('quality discovery-hub preservation metadata missing');
if(report.productionCandidateCount!==rankingHub.productionCandidateCount)errors.push(`ranking baseline/candidate mismatch ${rankingHub.productionCandidateCount}/${report.productionCandidateCount}`);
if(report.productionCandidateCount!==183)errors.push(`unexpected production candidate count ${report.productionCandidateCount}`);
if((quality.indexPolicy?.productionCandidateUrls||[]).length!==report.productionCandidateCount)errors.push('quality candidate list/report count mismatch');
if(report.baselines?.budget?.candidateCount!==budgetIntent.productionCandidateCount)errors.push('budget baseline changed');
if(report.baselines?.rankings?.candidateCount!==rankingHub.productionCandidateCount)errors.push('ranking baseline changed');
if(report.baselines?.budget?.trustedBrands!==budgetIntent.trustedBrands)errors.push('budget trusted-brand baseline changed');
if(report.baselines?.rankings?.trustedBrands!==rankingHub.trustedBrands)errors.push('ranking trusted-brand baseline changed');

if(!home.includes('data-v11-21-home-paths="1"'))errors.push('home discovery-path section missing');
if(!home.includes('data-v11-21-home-tools="1"'))errors.push('home verified-tool section missing');
if(home.includes('<b>3</b><span>계산기</span>'))errors.push('stale home calculator count remains');
if(!home.includes('<b>8</b><span>검증 도구</span>'))errors.push('home verified-tool count is not 8');
if(!home.includes('계산·분석 도구 8개'))errors.push('home tool heading is not aligned to 8 tools');
for(const route of ['/explore/','/rankings/','/brands/','/categories/','/compare/','/tools/'])if(!home.includes(`href="/pm-lab/franchise-ssg-preview${route}"`))errors.push(`home discovery link missing: ${route}`);
const approvedTools=toolTrust.approvedToolRoutes||[];
if(approvedTools.length!==8)errors.push(`v11.15 approved tool count ${approvedTools.length}`);
for(const route of approvedTools)if(!home.includes(`href="/pm-lab/franchise-ssg-preview${route}"`))errors.push(`home verified-tool link missing: ${route}`);
if(home.includes('/tools/store-density/'))errors.push('blocked store-density leaked onto home');
if(!home.includes('noindex,nofollow,noarchive,nosnippet'))errors.push('home preview noindex lost');

if(!explore.includes('data-v11-budget-explorer="1"'))errors.push('v11.19 budget explorer page was overwritten');
if(!rankings.includes('data-v11-ranking-hub="1"'))errors.push('v11.20 ranking hub page was overwritten');
if(!explore.includes('Tier A/B')||!rankings.includes('Tier A/B'))errors.push('discovery trust copy missing');
if(!explore.includes('noindex,nofollow,noarchive,nosnippet')||!rankings.includes('noindex,nofollow,noarchive,nosnippet'))errors.push('discovery hub preview noindex lost');
if(!categories.includes('data-v11-21-category-directory="1"'))errors.push('category row-directory marker missing');
if(!categories.includes('authority-directory category-authority-directory'))errors.push('category hub did not move to restrained row directory');
if(!css.includes('/* v11.21 internal authority */'))errors.push('v11.21 authority CSS missing');
for(const html of [brands,categories,compare,tools])if(!html.includes('noindex,nofollow,noarchive,nosnippet'))errors.push('a primary hub lost preview noindex');

if(!String(quality.qualityPolicy?.compare||'').includes('Tier A or Tier B'))errors.push(`stale compare quality policy: ${quality.qualityPolicy?.compare}`);
if(!String(quality.qualityPolicy?.tools||'').includes('8 v11.15 verified interactive tools'))errors.push(`stale tools quality policy: ${quality.qualityPolicy?.tools}`);
if(!String(quality.qualityPolicy?.budget||'').includes('one /explore/ budget-intent hub'))errors.push(`budget quality policy missing: ${quality.qualityPolicy?.budget}`);
if(!String(quality.qualityPolicy?.rankings||'').includes('one /rankings/ consolidated metric-sort hub'))errors.push(`rankings quality policy missing: ${quality.qualityPolicy?.rankings}`);
if(String(quality.qualityPolicy?.tools||'').includes('startup-cost, monthly-profit-simulator, and disclosure-decoder are production candidates'))errors.push('old three-tool quality policy still present');

const graph=report.graph||{};
if((graph.candidateHtmlMissing||[]).length)errors.push(`candidate HTML missing: ${graph.candidateHtmlMissing.join(',')}`);
if((graph.unreachableCandidates||[]).length)errors.push(`unreachable candidates: ${graph.unreachableCandidates.join(',')}`);
if((graph.orphanCandidates||[]).length)errors.push(`orphan candidates: ${graph.orphanCandidates.join(',')}`);
if((graph.hubDetailDepthViolations||[]).length)errors.push(`detail candidates deeper than 2 clicks: ${graph.hubDetailDepthViolations.join(',')}`);
if((graph.allDepthViolations||[]).length)errors.push(`candidates deeper than 3 clicks: ${graph.allDepthViolations.join(',')}`);
if(graph.maxCandidateDepth>3)errors.push(`max candidate depth ${graph.maxCandidateDepth}`);
if(graph.exploreDepth!==1)errors.push(`budget explorer depth ${graph.exploreDepth}`);
if(graph.rankingDepth!==1)errors.push(`ranking hub depth ${graph.rankingDepth}`);
if(graph.htmlRouteCount<200)errors.push(`HTML route audit unexpectedly low: ${graph.htmlRouteCount}`);

for(const [key,row] of Object.entries(report.hubCoverage||{})){
  if((row.missing||[]).length)errors.push(`${key} hub candidate coverage missing: ${row.missing.join(',')}`);
  if(row.expected!==row.linkedCandidates)errors.push(`${key} hub coverage ${row.linkedCandidates}/${row.expected}`);
}
if(Object.keys(report.hubCoverage||{}).length!==4)errors.push('hub coverage does not cover four primary hubs');
if((report.home?.primaryHubLinks||[]).filter(x=>x.linked).length!==4)errors.push('home does not directly link all four primary hubs');
if(report.home?.exploreLinked!==true||report.home?.rankingsLinked!==true)errors.push('home does not directly link both data discovery hubs');
if((report.home?.discoveryLinks||[]).length!==6)errors.push(`home discovery link count ${report.home?.discoveryLinks?.length||0}`);
if(report.home?.verifiedToolLinks!==8)errors.push(`home verified-tool links ${report.home?.verifiedToolLinks}`);
if(manifest.v11_21?.homeDiscoveryLinks!==6)errors.push(`manifest homeDiscoveryLinks ${manifest.v11_21?.homeDiscoveryLinks}`);
if(manifest.v11_21?.homeVerifiedToolLinks!==8)errors.push(`manifest homeVerifiedToolLinks ${manifest.v11_21?.homeVerifiedToolLinks}`);
if(manifest.v11_21?.hubCoverageComplete!==true)errors.push('manifest hubCoverageComplete is false');
if(manifest.v11_21?.orphanCandidateCount!==0)errors.push(`manifest orphanCandidateCount ${manifest.v11_21?.orphanCandidateCount}`);

for(const row of compareTrust.blocked||[]){const slug=row.route.split('/').filter(Boolean).at(-1);if(compare.includes(`/compare/${slug}/`))errors.push(`blocked comparison linked from compare hub: ${row.route}`)}
if(tools.includes('/tools/store-density/'))errors.push('blocked store-density linked from tools hub');
const robots=await fs.readFile(path.join(out,'robots.txt'),'utf8');
if(robots.trim()!=='User-agent: *\nDisallow: /')errors.push('preview robots.txt no longer blocks crawling');

if(errors.length){console.error(JSON.stringify({v11_21Validation:'FAIL',errors,summary:{productionCandidates:report.productionCandidateCount,maxDepth:graph.maxCandidateDepth,exploreDepth:graph.exploreDepth,rankingDepth:graph.rankingDepth,orphans:graph.orphanCandidates?.length||0,homeVerifiedTools:report.home?.verifiedToolLinks||0}},null,2));process.exit(1)}
console.log(JSON.stringify({v11_21Validation:'PASS',productionCandidates:report.productionCandidateCount,candidateTypeCounts:report.candidateTypeCounts,maxCandidateDepth:graph.maxCandidateDepth,depthDistribution:graph.depthDistribution,exploreDepth:graph.exploreDepth,rankingDepth:graph.rankingDepth,homeDiscoveryLinks:6,homeVerifiedTools:8,hubCoverage:Object.fromEntries(Object.entries(report.hubCoverage).map(([k,v])=>[k,`${v.linkedCandidates}/${v.expected}`]))},null,2));
