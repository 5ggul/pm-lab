import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const preview=path.join(repo,'docs/franchise-ssg-preview');
const PREVIEW_SITE='https://5ggul.github.io/pm-lab/franchise-ssg-preview';
const PREVIEW_BASE='/pm-lab/franchise-ssg-preview';
const TEST_MODE=String(process.env.SSG_RELEASE_TEST_MODE||'').toLowerCase()==='true';
const defaultReport=TEST_MODE?path.join(preview,'production-candidate-contract-test.json'):path.join(repo,'build/franchise-production-candidate-report.json');
const reportPath=path.resolve(process.env.SSG_PRODUCTION_CANDIDATE_REPORT||defaultReport);
const reportRelInPreview=reportPath.startsWith(path.resolve(preview)+path.sep)?path.relative(preview,reportPath).replace(/\\/g,'/'):null;
const previewHashIgnore=new Set(reportRelInPreview?[reportRelInPreview]:[]);
const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
const output=path.resolve(process.env.SSG_PRODUCTION_OUTPUT||report.outputPath||path.join(repo,'build/franchise-production-candidate'));
const quality=JSON.parse(await fs.readFile(path.join(preview,'v11-quality-report.json'),'utf8'));
const authority=JSON.parse(await fs.readFile(path.join(preview,'internal-authority-report.json'),'utf8'));
const requestedCandidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const candidates=(report.effectiveCandidateUrls||requestedCandidates).map(normalizeRoute);
const candidateSet=new Set(candidates);
const expectedSite=TEST_MODE?'https://franchise-release-contract.invalid':String(report.productionSite||'').replace(/\/$/,'');
const errors=[];

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split('#')[0].split('?')[0].replace(/^\/+|\/+$/g,'')}/`}
function routeFromHtml(rel){const p=rel.replace(/\\/g,'/');return p==='index.html'?'/':normalizeRoute('/'+p.replace(/\/index\.html$/,''))}
function routeFile(root,route){return route==='/'?path.join(root,'index.html'):path.join(root,...route.split('/').filter(Boolean),'index.html')}
async function walk(dir){const out=[];for(const ent of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())out.push(...await walk(p));else out.push(p)}return out}
async function hashFiles(root,ignoreRel=new Set()){const files=(await walk(root)).sort();const h=crypto.createHash('sha256');for(const file of files){const rel=path.relative(root,file).replace(/\\/g,'/');if(ignoreRel.has(rel))continue;h.update(rel);h.update('\0');h.update(await fs.readFile(file));h.update('\0')}return h.digest('hex')}
async function hashPreview(){return hashFiles(preview,previewHashIgnore)}
function meta(html,name){return html.match(new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']+)["']`,'i'))?.[1]||null}
function canonical(html){return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]||html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1]||null}
function routeExists(route,htmlRoutes){return htmlRoutes.has(normalizeRoute(route))}
function productionCanonicalFromPreview(value){return String(value||'').split(PREVIEW_SITE).join(expectedSite).split(`${PREVIEW_BASE}/`).join('/').split(PREVIEW_BASE).join('/')}
function selfCanonical(route){return route==='/'?`${expectedSite}/`:`${expectedSite}${route}`}

if(report.decision!=='PRODUCTION_CANDIDATE_BUILT_NOT_DEPLOYED')errors.push(`unexpected build decision ${report.decision}`);
if(report.indexPolicyFinalized!==true)errors.push('production index policy was not finalized');
if(report.requestedCandidateCount!==requestedCandidates.length)errors.push(`requested candidate report count ${report.requestedCandidateCount}/${requestedCandidates.length}`);
if(report.seoAudit?.status!=='PASS')errors.push(`production SEO audit not passed: ${report.seoAudit?.status||'MISSING'}`);
if(!(await fs.access(output).then(()=>true).catch(()=>false)))errors.push('production candidate output missing');
if(!errors.length){
  const files=await walk(output);const htmlFiles=files.filter(f=>f.endsWith('.html'));const htmlRoutes=new Set(htmlFiles.map(f=>routeFromHtml(path.relative(output,f))));
  if(htmlFiles.length!==Number(authority.graph?.htmlRouteCount||0))errors.push(`html count ${htmlFiles.length}/${authority.graph?.htmlRouteCount}`);
  if(report.candidateCount!==candidates.length)errors.push(`candidate report count ${report.candidateCount}/${candidates.length}`);
  if(report.nonCandidateCount!==htmlFiles.length-candidates.length)errors.push(`noncandidate report count ${report.nonCandidateCount}/${htmlFiles.length-candidates.length}`);
  const internalJsonFiles=files.filter(f=>f.endsWith('.json')).map(f=>path.relative(output,f).replace(/\\/g,'/')).filter(rel=>!rel.startsWith('assets/'));
  if(internalJsonFiles.length)errors.push(`internal json leaked: ${internalJsonFiles.slice(0,5).join(', ')}`);
  for(const file of htmlFiles){
    const rel=path.relative(output,file).replace(/\\/g,'/'),route=routeFromHtml(rel),html=await fs.readFile(file,'utf8');
    const shouldIndex=candidateSet.has(route),expectedRobots=shouldIndex?'index,follow':'noindex,nofollow,noarchive,nosnippet';
    for(const name of ['robots','googlebot','bingbot'])if(meta(html,name)!==expectedRobots)errors.push(`${route}: ${name}=${meta(html,name)} expected ${expectedRobots}`);
    const sourceHtml=await fs.readFile(routeFile(preview,route),'utf8');
    const sourceCanonical=canonical(sourceHtml),expectedCan=productionCanonicalFromPreview(sourceCanonical),can=canonical(html);
    if(!sourceCanonical)errors.push(`${route}: preview canonical missing`);
    else if(can!==expectedCan)errors.push(`${route}: canonical ${can} expected preserved ${expectedCan}`);
    if(shouldIndex&&can!==selfCanonical(route))errors.push(`${route}: index candidate canonical ${can} expected self ${selfCanonical(route)}`);
    if(/5ggul\.github\.io\/pm-lab\/franchise-ssg-preview|\/pm-lab\/franchise-ssg-preview/i.test(html))errors.push(`${route}: preview URL leaked`);
    if(/외부 검수용 프리뷰|정식 공개 시 색인 후보|품질점수\s*\d+\s*\/\s*100|realContactReady\s*=\s*false/i.test(html))errors.push(`${route}: preview/internal QA copy leaked`);
    if(/data-quality-score=|data-index-candidate=/i.test(html))errors.push(`${route}: internal QA attributes leaked`);
    if(!html.includes('data-production-operator="1"'))errors.push(`${route}: production operator footer missing`);
    for(const m of html.matchAll(/href=["']([^"']+)["']/gi)){
      const href=m[1];if(!href.startsWith('/')||href.startsWith('//'))continue;
      const clean=href.split('#')[0].split('?')[0];if(!clean||/\.[a-z0-9]{2,8}$/i.test(clean))continue;
      if(!routeExists(clean,htmlRoutes))errors.push(`${route}: broken internal route ${href}`);
    }
  }
  for(const file of files.filter(f=>/\.(?:css|js|svg|txt|xml|webmanifest|json)$/i.test(f))){const text=await fs.readFile(file,'utf8');if(/5ggul\.github\.io\/pm-lab\/franchise-ssg-preview|\/pm-lab\/franchise-ssg-preview/i.test(text))errors.push(`${path.relative(output,file)}: preview path leaked`)}
  const robots=await fs.readFile(path.join(output,'robots.txt'),'utf8').catch(()=> '');
  if(!/^User-agent:\s*\*\s*\nAllow:\s*\/\s*\nSitemap:\s*https:\/\//m.test(robots))errors.push('robots.txt is not production allow+sitemap form');
  const sitemap=await fs.readFile(path.join(output,'sitemap.xml'),'utf8').catch(()=> '');
  const locs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  const expectedUrls=candidates.map(selfCanonical);
  if(locs.length!==expectedUrls.length)errors.push(`sitemap url count ${locs.length}/${expectedUrls.length}`);
  const locSet=new Set(locs);for(const url of expectedUrls)if(!locSet.has(url))errors.push(`sitemap missing ${url}`);
  if(locs.some(url=>!expectedUrls.includes(url)))errors.push('sitemap contains noncandidate URL');
  if(TEST_MODE&&await fs.access(path.join(output,'ads.txt')).then(()=>true).catch(()=>false))errors.push('test candidate unexpectedly includes ads.txt');
  const outputHash=await hashFiles(output);if(outputHash!==report.outputHash)errors.push(`output hash ${outputHash}/${report.outputHash}`);
  const previewHash=await hashPreview();if(previewHash!==report.previewHashAfter)errors.push('preview tree changed after candidate build');
}

const validation={status:errors.length?'FAIL':'PASS',validatedAt:new Date().toISOString(),errorCount:errors.length,errors:errors.slice(0,50),requestedCandidateCount:requestedCandidates.length,candidateCount:candidates.length,demotedCanonicalAliasCount:(report.canonicalAliasDemotions||[]).length,expectedHtml:Number(authority.graph?.htmlRouteCount||0),outputHash:report.outputHash||null,previewHashIgnored:[...previewHashIgnore],previewUnchanged:errors.every(e=>!e.includes('preview tree changed'))};
report.validation=validation;
if(TEST_MODE&&process.env.SSG_RELEASE_TEST_CLEANUP==='true'&&await fs.access(output).then(()=>true).catch(()=>false)){await fs.rm(output,{recursive:true,force:true});report.testOutputCleaned=true}else report.testOutputCleaned=false;
await fs.writeFile(reportPath,JSON.stringify(report,null,2),'utf8');
if(errors.length){console.error(JSON.stringify({productionCandidateValidation:'FAIL',errorCount:errors.length,errors:errors.slice(0,20)},null,2));process.exit(1)}
console.log(JSON.stringify({productionCandidateValidation:'PASS',testMode:TEST_MODE,requestedCandidates:requestedCandidates.length,candidates:candidates.length,demotedCanonicalAliases:(report.canonicalAliasDemotions||[]).length,html:validation.expectedHtml,outputHash:report.outputHash,testOutputCleaned:report.testOutputCleaned},null,2));
