import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'v11-22-internal-authority.json'),'utf8'));
const homeFunnel=JSON.parse(await fs.readFile(path.join(out,'v11-21-home-funnel.json'),'utf8'));
const rankingHub=JSON.parse(await fs.readFile(path.join(out,'v11-20-ranking-hub.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const toolTrust=JSON.parse(await fs.readFile(path.join(out,'v11-15-tool-trust.json'),'utf8'));
const compareTrust=JSON.parse(await fs.readFile(path.join(out,'v11-17-compare-trust.json'),'utf8'));
const home=await fs.readFile(path.join(out,'index.html'),'utf8');
const categories=await fs.readFile(path.join(out,'categories/index.html'),'utf8');
const compare=await fs.readFile(path.join(out,'compare/index.html'),'utf8');
const tools=await fs.readFile(path.join(out,'tools/index.html'),'utf8');
const explore=await fs.readFile(path.join(out,'explore/index.html'),'utf8');
const rankings=await fs.readFile(path.join(out,'rankings/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');

if(report.uiVersion!=='11.22')errors.push(`report uiVersion ${report.uiVersion}`);
if(manifest.uiVersion!=='11.22')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(report.productionCandidateCount!==homeFunnel.productionCandidateCount||report.productionCandidateCount!==rankingHub.productionCandidateCount)errors.push(`candidate baseline mismatch ${report.productionCandidateCount}/${homeFunnel.productionCandidateCount}/${rankingHub.productionCandidateCount}`);
if(report.productionCandidateCount!==183)errors.push(`unexpected production candidate count ${report.productionCandidateCount}`);
if((quality.indexPolicy?.productionCandidateUrls||[]).length!==183)errors.push('quality candidate list count changed');
if(manifest.v11_22?.internalAuthorityAudit!==true||quality.contentTrust?.internalAuthorityAudit!==true)errors.push('internal-authority audit metadata missing');
if(manifest.v11_22?.homeDecisionFunnelPreserved!==true||quality.contentTrust?.homeDecisionFunnelPreserved!==true)errors.push('home funnel preservation metadata missing');

if(!home.includes('data-v11-home-funnel="1"')||!home.includes('data-v11-home-funnel-section="1"'))errors.push('v11.21 home funnel was overwritten');
if(!home.includes('data-v11-22-home-tools="1"'))errors.push('v11.22 home tool directory missing');
if(home.includes('<h2>계산기</h2>'))errors.push('stale three-tool calculator section remains');
if(!home.includes('계산·분석 도구 8개'))errors.push('home tool directory count is not 8');
const approvedTools=toolTrust.approvedToolRoutes||[];
if(approvedTools.length!==8)errors.push(`approved tool baseline ${approvedTools.length}`);
for(const route of approvedTools)if(!home.includes(`href="/pm-lab/franchise-ssg-preview${route}"`))errors.push(`home verified-tool link missing: ${route}`);
if(home.includes('/tools/store-density/'))errors.push('blocked store-density leaked onto home');
for(const route of homeFunnel.funnelRoutes||[])if(!home.includes(`href="/pm-lab/franchise-ssg-preview${route}"`))errors.push(`home funnel route lost: ${route}`);
if(!home.includes('noindex,nofollow,noarchive,nosnippet'))errors.push('home preview noindex lost');

if(!explore.includes('data-v11-budget-explorer="1"'))errors.push('budget explorer was overwritten');
if(!rankings.includes('data-v11-ranking-hub="1"'))errors.push('ranking hub was overwritten');
if(!categories.includes('data-v11-22-category-directory="1"'))errors.push('category row-directory marker missing');
if(!categories.includes('authority-directory category-authority-directory'))errors.push('category hub still uses card grid');
if(!css.includes('/* v11.22 internal authority */'))errors.push('v11.22 CSS missing');

for(const [key,needle] of [['compare','Tier A or Tier B'],['tools','8 v11.15 verified interactive tools'],['budget','one /explore/ budget-intent hub'],['rankings','one /rankings/ consolidated metric-sort hub']])if(!String(quality.qualityPolicy?.[key]||'').includes(needle))errors.push(`qualityPolicy ${key} not aligned: ${quality.qualityPolicy?.[key]}`);

const graph=report.graph||{};
for(const [key,list] of [['candidateHtmlMissing',graph.candidateHtmlMissing],['unreachableCandidates',graph.unreachableCandidates],['orphanCandidates',graph.orphanCandidates],['hubDetailDepthViolations',graph.hubDetailDepthViolations],['allDepthViolations',graph.allDepthViolations]])if((list||[]).length)errors.push(`${key}: ${list.join(',')}`);
if(graph.maxCandidateDepth>3)errors.push(`max candidate depth ${graph.maxCandidateDepth}`);
if(graph.exploreDepth!==1)errors.push(`explore depth ${graph.exploreDepth}`);
if(graph.rankingDepth!==1)errors.push(`ranking depth ${graph.rankingDepth}`);
if(graph.htmlRouteCount<200)errors.push(`HTML route count unexpectedly low ${graph.htmlRouteCount}`);
if((report.home?.missingFunnelLinks||[]).length)errors.push(`missing funnel links: ${report.home.missingFunnelLinks.join(',')}`);
if(report.home?.verifiedToolLinks!==8)errors.push(`home verified tools ${report.home?.verifiedToolLinks}`);

for(const [key,row] of Object.entries(report.hubCoverage||{})){
  if((row.missing||[]).length)errors.push(`${key} hub missing: ${row.missing.join(',')}`);
  if(row.expected!==row.linkedCandidates)errors.push(`${key} hub coverage ${row.linkedCandidates}/${row.expected}`);
}
if(Object.keys(report.hubCoverage||{}).length!==4)errors.push('four primary hub audits missing');
if(manifest.v11_22?.hubCoverageComplete!==true)errors.push('manifest hubCoverageComplete false');
if(manifest.v11_22?.orphanCandidateCount!==0)errors.push(`manifest orphan count ${manifest.v11_22?.orphanCandidateCount}`);
if(manifest.v11_22?.funnelRoutesPreserved!==true)errors.push('manifest funnelRoutesPreserved false');

for(const row of compareTrust.blocked||[]){const slug=row.route.split('/').filter(Boolean).at(-1);if(compare.includes(`/compare/${slug}/`))errors.push(`blocked comparison linked from compare hub: ${row.route}`)}
if(tools.includes('/tools/store-density/'))errors.push('blocked store-density linked from tools hub');
for(const html of [home,categories,compare,tools,explore,rankings])if(!html.includes('noindex,nofollow,noarchive,nosnippet'))errors.push('preview noindex lost on audited page');
const robots=await fs.readFile(path.join(out,'robots.txt'),'utf8');
if(robots.trim()!=='User-agent: *\nDisallow: /')errors.push('preview robots.txt no longer blocks crawling');

if(errors.length){console.error(JSON.stringify({v11_22Validation:'FAIL',errors,summary:{candidates:report.productionCandidateCount,maxDepth:graph.maxCandidateDepth,orphans:graph.orphanCandidates?.length||0,homeTools:report.home?.verifiedToolLinks||0}},null,2));process.exit(1)}
console.log(JSON.stringify({v11_22Validation:'PASS',productionCandidates:report.productionCandidateCount,candidateTypeCounts:report.candidateTypeCounts,maxCandidateDepth:graph.maxCandidateDepth,depthDistribution:graph.depthDistribution,exploreDepth:graph.exploreDepth,rankingDepth:graph.rankingDepth,homeVerifiedTools:8,hubCoverage:Object.fromEntries(Object.entries(report.hubCoverage).map(([k,v])=>[k,`${v.linkedCandidates}/${v.expected}`]))},null,2));
