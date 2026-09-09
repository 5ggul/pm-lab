import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const errors=[];
const report=JSON.parse(await fs.readFile(path.join(out,'internal-authority-report.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const toolTrust=JSON.parse(await fs.readFile(path.join(out,'v11-15-tool-trust.json'),'utf8'));
const home=await fs.readFile(path.join(out,'index.html'),'utf8');
const categories=await fs.readFile(path.join(out,'categories/index.html'),'utf8');
const compare=await fs.readFile(path.join(out,'compare/index.html'),'utf8');
const tools=await fs.readFile(path.join(out,'tools/index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
let homeFunnel=null;try{homeFunnel=JSON.parse(await fs.readFile(path.join(out,'v11-21-home-funnel.json'),'utf8'))}catch{}
let universalCompare=null;try{universalCompare=JSON.parse(await fs.readFile(path.join(out,'v11-22-universal-compare.json'),'utf8'))}catch{}

const candidates=new Set(quality.indexPolicy?.productionCandidateUrls||[]);
if(report.revision!=='2026-09-09a')errors.push(`unexpected postpass revision ${report.revision}`);
if(report.productionCandidateCount!==candidates.size)errors.push(`candidate count mismatch ${report.productionCandidateCount}/${candidates.size}`);
if(report.baseUiVersion!==manifest.uiVersion)errors.push(`postpass changed/does not match core uiVersion ${report.baseUiVersion}/${manifest.uiVersion}`);
if(manifest.internalAuthorityPostpass?.revision!==report.revision||quality.internalAuthorityPostpass?.revision!==report.revision)errors.push('postpass metadata missing from manifest/quality');
if(manifest.internalAuthorityPostpass?.productionCandidateCount!==report.productionCandidateCount||quality.internalAuthorityPostpass?.productionCandidateCount!==report.productionCandidateCount)errors.push('postpass candidate metadata mismatch');

const approvedTools=toolTrust.approvedToolRoutes||[];
if(approvedTools.length!==8)errors.push(`approved tool baseline ${approvedTools.length}`);
if(!home.includes('data-internal-authority-tools="1"'))errors.push('home authority tool directory missing');
if(home.includes('<h2>계산기</h2>'))errors.push('stale three-tool calculator section remains');
if(!home.includes(`계산·분석 도구 ${approvedTools.length}개`))errors.push('home verified-tool heading count mismatch');
for(const route of approvedTools)if(!home.includes(`href="/pm-lab/franchise-ssg-preview${route}"`))errors.push(`home verified-tool link missing: ${route}`);
if(home.includes('/tools/store-density/'))errors.push('blocked store-density leaked onto home');
if(!categories.includes('data-internal-authority-category-directory="1"'))errors.push('category authority marker missing');
if(!css.includes('/* internal authority postpass */'))errors.push('postpass CSS missing');

if(homeFunnel){
  if(!home.includes('data-v11-home-funnel="1"')||!home.includes('data-v11-home-funnel-section="1"'))errors.push('v11.21 home funnel was overwritten');
  for(const route of homeFunnel.funnelRoutes||[])if(!home.includes(`href="/pm-lab/franchise-ssg-preview${route}"`))errors.push(`home funnel route lost: ${route}`);
  if((report.home?.missingFunnelLinks||[]).length)errors.push(`missing funnel links: ${report.home.missingFunnelLinks.join(',')}`);
}
if(universalCompare&&universalCompare.productionCandidateCount===report.productionCandidateCount&&!compare.includes('data-v11-22-universal-compare="1"'))errors.push('v11.22 universal compare was overwritten');

const graph=report.graph||{};
for(const [key,list] of [['candidateHtmlMissing',graph.candidateHtmlMissing],['unreachableCandidates',graph.unreachableCandidates],['orphanCandidates',graph.orphanCandidates],['hubDetailDepthViolations',graph.hubDetailDepthViolations],['allDepthViolations',graph.allDepthViolations]])if((list||[]).length)errors.push(`${key}: ${list.join(',')}`);
if(graph.maxCandidateDepth>3)errors.push(`max candidate depth ${graph.maxCandidateDepth}`);
for(const [route,depth] of Object.entries(graph.protectedDirectDepths||{}))if(depth!==1)errors.push(`${route} should be one click from home, got ${depth}`);
if(graph.htmlRouteCount<200)errors.push(`HTML route audit unexpectedly low ${graph.htmlRouteCount}`);
if(report.home?.verifiedToolLinks!==approvedTools.length)errors.push(`home verified-tool link count ${report.home?.verifiedToolLinks}/${approvedTools.length}`);

for(const [key,row] of Object.entries(report.hubCoverage||{})){
  if((row.missing||[]).length)errors.push(`${key} hub candidate coverage missing: ${row.missing.join(',')}`);
  if(row.expected!==row.linkedCandidates)errors.push(`${key} hub coverage ${row.linkedCandidates}/${row.expected}`);
}
if(Object.keys(report.hubCoverage||{}).length!==4)errors.push('four primary hub audits missing');
if(manifest.internalAuthorityPostpass?.hubCoverageComplete!==true||quality.internalAuthorityPostpass?.hubCoverageComplete!==true)errors.push('hubCoverageComplete metadata false');
if(manifest.internalAuthorityPostpass?.orphanCandidateCount!==0||quality.internalAuthorityPostpass?.orphanCandidateCount!==0)errors.push('orphan candidate metadata is not zero');

if(!String(report.qualityPolicy?.tools||'').includes('verified interactive tools'))errors.push(`tools quality policy not aligned: ${report.qualityPolicy?.tools}`);
if(candidates.has('/explore/')&&!String(report.qualityPolicy?.budget||'').includes('/explore/'))errors.push('budget quality policy missing');
if(candidates.has('/rankings/')&&!String(report.qualityPolicy?.rankings||'').includes('/rankings/'))errors.push('rankings quality policy missing');
if(tools.includes('/tools/store-density/'))errors.push('blocked store-density linked from tools hub');

for(const route of ['','categories/','compare/','tools/']){
  const html=route===''?home:route==='categories/'?categories:route==='compare/'?compare:tools;
  if(!html.includes('noindex,nofollow,noarchive,nosnippet'))errors.push(`preview noindex lost: /${route}`);
}
const robots=await fs.readFile(path.join(out,'robots.txt'),'utf8');
if(robots.trim()!=='User-agent: *\nDisallow: /')errors.push('preview robots.txt no longer blocks crawling');

if(errors.length){console.error(JSON.stringify({internalAuthorityValidation:'FAIL',errors,summary:{baseUiVersion:report.baseUiVersion,candidates:report.productionCandidateCount,maxDepth:graph.maxCandidateDepth,orphans:graph.orphanCandidates?.length||0,homeTools:report.home?.verifiedToolLinks||0}},null,2));process.exit(1)}
console.log(JSON.stringify({internalAuthorityValidation:'PASS',revision:report.revision,baseUiVersion:report.baseUiVersion,productionCandidates:report.productionCandidateCount,candidateTypeCounts:report.candidateTypeCounts,maxCandidateDepth:graph.maxCandidateDepth,depthDistribution:graph.depthDistribution,protectedDirectDepths:graph.protectedDirectDepths,homeVerifiedTools:report.home.verifiedToolLinks,hubCoverage:Object.fromEntries(Object.entries(report.hubCoverage).map(([k,v])=>[k,`${v.linkedCandidates}/${v.expected}`]))},null,2));
