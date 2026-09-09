import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'v11-19-internal-authority.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const toolTrust=JSON.parse(await fs.readFile(path.join(out,'v11-15-tool-trust.json'),'utf8'));
const compareTrust=JSON.parse(await fs.readFile(path.join(out,'v11-17-compare-trust.json'),'utf8'));
const home=await fs.readFile(path.join(out,'index.html'),'utf8');
const brands=await fs.readFile(path.join(out,'brands/index.html'),'utf8');
const categories=await fs.readFile(path.join(out,'categories/index.html'),'utf8');
const compare=await fs.readFile(path.join(out,'compare/index.html'),'utf8');
const tools=await fs.readFile(path.join(out,'tools/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');

if(report.uiVersion!=='11.19')errors.push(`report uiVersion ${report.uiVersion}`);
if(manifest.uiVersion!=='11.19')errors.push(`manifest uiVersion ${manifest.uiVersion}`);
if(manifest.v11_19?.internalAuthorityPolicy!==true)errors.push('manifest internalAuthorityPolicy flag missing');
if(quality.contentTrust?.version!=='11.19'||quality.contentTrust?.internalAuthorityPolicy!==true)errors.push('quality internal authority metadata missing');
if(report.productionCandidateCount!==181)errors.push(`production candidate count changed: ${report.productionCandidateCount}`);
if((quality.indexPolicy?.productionCandidateUrls||[]).length!==report.productionCandidateCount)errors.push('quality candidate list/report count mismatch');

if(!home.includes('data-v11-19-home-paths="1"'))errors.push('home primary-path section missing');
if(!home.includes('data-v11-19-home-tools="1"'))errors.push('home verified-tool section missing');
if(home.includes('<b>3</b><span>계산기</span>'))errors.push('stale home calculator count remains');
if(!home.includes('<b>8</b><span>검증 도구</span>'))errors.push('home verified-tool count is not 8');
if(!home.includes('계산·분석 도구 8개'))errors.push('home tool heading is not aligned to 8 tools');
for(const route of ['/brands/','/categories/','/compare/','/tools/']){
  if(!home.includes(`href="/pm-lab/franchise-ssg-preview${route}"`))errors.push(`home primary hub link missing: ${route}`);
}
const approvedTools=(toolTrust.approvedToolRoutes||[]);
if(approvedTools.length!==8)errors.push(`v11.15 approved tool count ${approvedTools.length}`);
for(const route of approvedTools){
  if(!home.includes(`href="/pm-lab/franchise-ssg-preview${route}"`))errors.push(`home direct verified-tool link missing: ${route}`);
}
if(home.includes('/tools/store-density/'))errors.push('blocked store-density leaked onto home');
if(!home.includes('noindex,nofollow,noarchive,nosnippet'))errors.push('home preview noindex lost');

if(!categories.includes('data-v11-19-category-directory="1"'))errors.push('category row-directory marker missing');
if(!categories.includes('authority-directory category-authority-directory'))errors.push('category hub did not move to restrained row directory');
if(!css.includes('/* v11.19 internal authority */'))errors.push('v11.19 authority CSS missing');
for(const html of [brands,categories,compare,tools])if(!html.includes('noindex,nofollow,noarchive,nosnippet'))errors.push('a primary hub lost preview noindex');

if(!String(quality.qualityPolicy?.compare||'').includes('Tier A or Tier B'))errors.push(`stale compare quality policy: ${quality.qualityPolicy?.compare}`);
if(!String(quality.qualityPolicy?.tools||'').includes('8 v11.15 verified interactive tools'))errors.push(`stale tools quality policy: ${quality.qualityPolicy?.tools}`);
if(String(quality.qualityPolicy?.tools||'').includes('startup-cost, monthly-profit-simulator, and disclosure-decoder are production candidates'))errors.push('old three-tool quality policy still present');

const graph=report.graph||{};
if((graph.candidateHtmlMissing||[]).length)errors.push(`candidate HTML missing: ${graph.candidateHtmlMissing.join(',')}`);
if((graph.unreachableCandidates||[]).length)errors.push(`unreachable candidates: ${graph.unreachableCandidates.join(',')}`);
if((graph.orphanCandidates||[]).length)errors.push(`orphan candidates: ${graph.orphanCandidates.join(',')}`);
if((graph.hubDetailDepthViolations||[]).length)errors.push(`detail candidates deeper than 2 clicks: ${graph.hubDetailDepthViolations.join(',')}`);
if((graph.allDepthViolations||[]).length)errors.push(`candidates deeper than 3 clicks: ${graph.allDepthViolations.join(',')}`);
if(graph.maxCandidateDepth>3)errors.push(`max candidate depth ${graph.maxCandidateDepth}`);
if(graph.htmlRouteCount<200)errors.push(`HTML route audit unexpectedly low: ${graph.htmlRouteCount}`);

for(const [key,row] of Object.entries(report.hubCoverage||{})){
  if((row.missing||[]).length)errors.push(`${key} hub candidate coverage missing: ${row.missing.join(',')}`);
  if(row.expected!==row.linkedCandidates)errors.push(`${key} hub coverage ${row.linkedCandidates}/${row.expected}`);
}
if(Object.keys(report.hubCoverage||{}).length!==4)errors.push('hub coverage does not cover four primary hubs');
if((report.home?.primaryHubLinks||[]).filter(x=>x.linked).length!==4)errors.push('home does not directly link all four primary hubs');
if(report.home?.verifiedToolLinks!==8)errors.push(`home direct verified-tool links ${report.home?.verifiedToolLinks}`);
if(manifest.v11_19?.homeVerifiedToolLinks!==8)errors.push(`manifest homeVerifiedToolLinks ${manifest.v11_19?.homeVerifiedToolLinks}`);
if(manifest.v11_19?.hubCoverageComplete!==true)errors.push('manifest hubCoverageComplete is false');
if(manifest.v11_19?.orphanCandidateCount!==0)errors.push(`manifest orphanCandidateCount ${manifest.v11_19?.orphanCandidateCount}`);

const compareBlocked=(compareTrust.blocked||[]).map(x=>x.route);
for(const route of compareBlocked){
  const slug=route.split('/').filter(Boolean).at(-1);
  if(compare.includes(`/compare/${slug}/`))errors.push(`blocked comparison linked from compare hub: ${route}`);
}
if(tools.includes('/tools/store-density/'))errors.push('blocked store-density linked from tools hub');

const robots=await fs.readFile(path.join(out,'robots.txt'),'utf8');
if(robots.trim()!=='User-agent: *\nDisallow: /')errors.push('preview robots.txt no longer blocks crawling');

if(errors.length){
  console.error(JSON.stringify({v11_19Validation:'FAIL',errors,summary:{productionCandidates:report.productionCandidateCount,maxDepth:graph.maxCandidateDepth,orphans:graph.orphanCandidates?.length||0,homeVerifiedTools:report.home?.verifiedToolLinks||0}},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_19Validation:'PASS',productionCandidates:report.productionCandidateCount,candidateTypeCounts:report.candidateTypeCounts,maxCandidateDepth:graph.maxCandidateDepth,depthDistribution:graph.depthDistribution,homePrimaryHubs:4,homeVerifiedTools:8,hubCoverage:Object.fromEntries(Object.entries(report.hubCoverage).map(([k,v])=>[k,`${v.linkedCandidates}/${v.expected}`]))},null,2));
