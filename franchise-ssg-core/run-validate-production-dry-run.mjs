import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const report=JSON.parse(await fs.readFile(path.join(out,'production-release-dry-run.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const errors=[];

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split('#')[0].split('?')[0].replace(/^\/+|\/+$/g,'')}/`}
function routeFile(route){return route==='/'?path.join(out,'index.html'):path.join(out,...route.split('/').filter(Boolean),'index.html')}

if(report.policy!=='DRY_RUN_ONLY; NO_HTML_MUTATION; NO_ROBOTS_OR_SITEMAP_SWITCH; NO_DEPLOY; MANUAL_APPROVAL_REQUIRED')errors.push('dry-run policy marker changed');
if(report.candidateCount!==candidates.length)errors.push(`candidateCount ${report.candidateCount}/${candidates.length}`);
if(report.planned?.candidateIndexPages!==candidates.length)errors.push('planned candidate index count mismatch');
if(report.planned?.sitemapUrlCount!==candidates.length)errors.push('planned sitemap count mismatch');
if(report.planned?.nonCandidateNoindexPages!==Math.max(0,Number(report.graph?.htmlRouteCount||0)-candidates.length))errors.push('planned non-candidate noindex count mismatch');
for(const [key,value] of Object.entries(report.sideEffects||{}))if(value!==false)errors.push(`dry run side effect ${key}=${value}`);
if(report.previewInvariant?.previewHtmlMutated!==false||report.previewInvariant?.indexFlipAttempted!==false||report.previewInvariant?.deployAttempted!==false)errors.push('preview side-effect guard failed');

const robots=await fs.readFile(path.join(out,'robots.txt'),'utf8').catch(()=> '');
const sitemap=await fs.readFile(path.join(out,'sitemap.xml'),'utf8').catch(()=> '');
if(!/User-agent:\s*\*[\s\S]*Disallow:\s*\//i.test(robots))errors.push('preview robots no longer disallow all');
if(/<url>/i.test(sitemap))errors.push('preview sitemap is no longer empty');
for(const route of candidates){
  const html=await fs.readFile(routeFile(route),'utf8').catch(()=> '');
  if(!/<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">/i.test(html)){errors.push(`${route}: preview candidate indexing changed`);if(errors.length>30)break}
}
if(report.config?.usingExample===true){
  if(report.decision!=='BLOCKED_CONFIG_INCOMPLETE')errors.push(`example config must remain blocked, got ${report.decision}`);
  const expected=['productionSiteUrl','operator.displayName','operator.legalName','operator.businessDisclosure','operator.address','contact.email','legal.privacyPolicySource','legal.termsSource'];
  for(const field of expected)if(!(report.config.missing||[]).includes(field))errors.push(`example config missing blocker absent: ${field}`);
  if(report.productionSite?.configured!==false||report.productionSite?.value!==null)errors.push('example config unexpectedly configured production site');
}
if(report.graph?.authoritySafe!==true)errors.push('authority graph not safe in dry run');
if(errors.length){console.error(JSON.stringify({productionDryRunValidation:'FAIL',errors:errors.slice(0,40),errorCount:errors.length,decision:report.decision},null,2));process.exit(1)}
console.log(JSON.stringify({productionDryRunValidation:'PASS',decision:report.decision,candidates:candidates.length,usingExample:report.config?.usingExample,missing:report.config?.missing?.length||0,previewUnchanged:true,deployAttempted:false},null,2));
