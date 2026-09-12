import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];

const report=JSON.parse(await fs.readFile(path.join(out,'internal-authority-report.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const toolTrust=JSON.parse(await fs.readFile(path.join(out,'v11-15-tool-trust.json'),'utf8'));
const home=await fs.readFile(path.join(out,'index.html'),'utf8');
const tools=await fs.readFile(path.join(out,'tools/index.html'),'utf8');
const categories=await fs.readFile(path.join(out,'categories/index.html'),'utf8');
const compare=await fs.readFile(path.join(out,'compare/index.html'),'utf8');

const candidates=new Set(quality.indexPolicy?.productionCandidateUrls||[]);
const graph=report.graph||{};
const currentUi=String(manifest.uiVersion||'');
const uiMatch=currentUi.match(/^11\.(\d+)$/);
const currentMinor=uiMatch?Number(uiMatch[1]):NaN;

if(report.revision!=='2026-09-10-v11.25')err.push('revision');
// This postpass was designed from the v11.25 authority graph, but it must remain
// valid for later UI layers (v11.26+). Do not pin the current manifest back to 11.25.
if(report.baseUiVersion!=='11.25'||!Number.isFinite(currentMinor)||currentMinor<25)err.push(`uiVersion:${report.baseUiVersion}/${currentUi}`);
if(currentMinor>=37&&manifest.v11_37?.averageSalesPositiveOnly!==true)err.push('v11.37 semantics metadata');
if(report.productionCandidateCount!==184||candidates.size!==184)err.push('candidate count');
if(manifest.internalAuthorityPostpass?.revision!==report.revision||quality.internalAuthorityPostpass?.revision!==report.revision)err.push('metadata');
if(manifest.internalAuthorityPostpass?.singleSnapshot!==true||quality.internalAuthorityPostpass?.singleSnapshot!==true)err.push('single snapshot');
if(!home.includes('data-v25-home="1"')||report.home?.terminalPreserved!==true)err.push('home terminal');
if(home.includes('data-internal-authority-tools="1"')||home.includes('data-v11-home-funnel="1"'))err.push('legacy home injected');
for(const route of ['/brands/','/categories/','/compare/','/tools/','/explore/']){
  if(!home.includes(`href="/pm-lab/franchise-ssg-preview${route}"`))err.push('home hub '+route);
}
const approved=toolTrust.approvedToolRoutes||[];
if(approved.length!==8||report.tools?.approved!==8||report.tools?.linked!==8||(report.tools?.missing||[]).length)err.push('tool hub coverage');
for(const r of approved)if(!tools.includes(`href="/pm-lab/franchise-ssg-preview${r}"`))err.push('tool '+r);
if(tools.includes('/tools/store-density/'))err.push('store-density');
if(!tools.includes('data-v25-tools="1"'))err.push('v25 tools hub');
if(!compare.includes('data-v34-workspace="hub"')||compare.includes('data-v11-22-compare-builder="1"'))err.push('v34 compare hub');
for(const [k,l] of [
  ['candidateHtmlMissing',graph.candidateHtmlMissing],
  ['unreachableCandidates',graph.unreachableCandidates],
  ['orphanCandidates',graph.orphanCandidates],
  ['hubDetailDepthViolations',graph.hubDetailDepthViolations],
  ['allDepthViolations',graph.allDepthViolations]
])if((l||[]).length)err.push(`${k}:${l.length}`);
if(graph.maxCandidateDepth>3)err.push('max depth '+graph.maxCandidateDepth);
if(graph.htmlRouteCount<300)err.push('html count '+graph.htmlRouteCount);
for(const [k,row] of Object.entries(report.hubCoverage||{})){
  if((row.missing||[]).length||row.expected!==row.linkedCandidates)err.push(`hub ${k} ${row.linkedCandidates}/${row.expected}`);
}
if(Object.keys(report.hubCoverage||{}).length!==4)err.push('four hubs');
for(const [name,html] of [['home',home],['tools',tools],['categories',categories],['compare',compare]]){
  if(!html.includes('noindex,nofollow,noarchive,nosnippet'))err.push('noindex '+name);
}
const robots=await fs.readFile(path.join(out,'robots.txt'),'utf8');
if(robots.trim()!=='User-agent: *\nDisallow: /')err.push('robots');

if(err.length){
  console.error(JSON.stringify({internalAuthorityV11_25Validation:'FAIL',currentUiVersion:currentUi,errors:err},null,2));
  process.exit(1);
}
console.log(JSON.stringify({
  internalAuthorityV11_25Validation:'PASS',
  baseUiVersion:report.baseUiVersion,
  currentUiVersion:currentUi,
  candidates:184,
  maxDepth:graph.maxCandidateDepth,
  orphans:0,
  tools:'8/8',
  compareHub:'v11.34',
  hubCoverage:Object.fromEntries(Object.entries(report.hubCoverage).map(([k,v])=>[k,`${v.linkedCandidates}/${v.expected}`]))
},null,2));
