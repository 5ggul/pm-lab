import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');
const examplePath=path.join(here,'release-config.example.json');
const requestedRaw=String(process.env.SSG_RELEASE_CONFIG||'').trim();
const requestedPath=requestedRaw?(path.isAbsolute(requestedRaw)?requestedRaw:path.resolve(repo,requestedRaw)):path.join(here,'release-config.local.json');
const exists=async p=>fs.access(p).then(()=>true).catch(()=>false);
const configPath=await exists(requestedPath)?requestedPath:examplePath;
const usingExample=path.resolve(configPath)===path.resolve(examplePath);
const config=JSON.parse(await fs.readFile(configPath,'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const authority=JSON.parse(await fs.readFile(path.join(out,'internal-authority-report.json'),'utf8'));
let readiness=null;
try{readiness=JSON.parse(await fs.readFile(path.join(out,'production-readiness-report.json'),'utf8'))}catch{}
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const htmlRouteCount=Number(authority.graph?.htmlRouteCount||0);
const generatedAt=new Date().toISOString();

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split('#')[0].split('?')[0].replace(/^\/+|\/+$/g,'')}/`}
function routeFile(route){return route==='/'?path.join(out,'index.html'):path.join(out,...route.split('/').filter(Boolean),'index.html')}
function placeholder(v){const s=String(v??'').trim();return !s||/^__.*__$/.test(s)}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim())&&!placeholder(v)}
function validProductionSite(v){
  try{
    const u=new URL(String(v||'').trim());
    return u.protocol==='https:'&&!/github\.io$/i.test(u.hostname)&&!/(?:localhost|127\.0\.0\.1)$/i.test(u.hostname)&&!String(v).includes('/pm-lab/franchise-ssg-preview');
  }catch{return false}
}
function baseSite(v){return String(v||'').trim().replace(/\/$/,'')}
async function inspectLegal(label,rawPath,requiredTerms){
  if(placeholder(rawPath))return {label,configured:false,exists:false,chars:0,final:false,path:null,reasons:['PATH_NOT_CONFIGURED']};
  const p=path.isAbsolute(rawPath)?rawPath:path.resolve(repo,rawPath);
  if(!(await exists(p)))return {label,configured:true,exists:false,chars:0,final:false,path:rawPath,reasons:['SOURCE_NOT_FOUND']};
  const text=await fs.readFile(p,'utf8');
  const reasons=[];
  if(text.trim().length<400)reasons.push('SOURCE_TOO_SHORT');
  if(/__REQUIRED_|현재 외부 검수용 프리뷰|확정된 뒤|반영한 뒤 공개|추후 반영|준비 중/.test(text))reasons.push('PLACEHOLDER_OR_PREVIEW_COPY_REMAINS');
  if(!requiredTerms.every(re=>re.test(text)))reasons.push('REQUIRED_SECTION_MARKER_MISSING');
  return {label,configured:true,exists:true,chars:text.trim().length,final:reasons.length===0,path:rawPath,reasons};
}

const privacy=await inspectLegal('privacy',config.legal?.privacyPolicySource,[/개인정보/,/처리|수집|이용/]);
const terms=await inspectLegal('terms',config.legal?.termsSource,[/이용약관|약관/,/서비스|이용/]);
const productionSite=baseSite(config.productionSiteUrl);
const missing=[];
if(!validProductionSite(productionSite))missing.push('productionSiteUrl');
for(const [name,value] of Object.entries({
  'operator.displayName':config.operator?.displayName,
  'operator.legalName':config.operator?.legalName,
  'operator.businessDisclosure':config.operator?.businessDisclosure,
  'operator.address':config.operator?.address
}))if(placeholder(value))missing.push(name);
if(!validEmail(config.contact?.email))missing.push('contact.email');
if(!privacy.final)missing.push('legal.privacyPolicySource');
if(!terms.final)missing.push('legal.termsSource');
if(config.releasePolicy?.indexOnlyProductionCandidates!==true)missing.push('releasePolicy.indexOnlyProductionCandidates');
if(config.releasePolicy?.keepNonCandidatesNoindex!==true)missing.push('releasePolicy.keepNonCandidatesNoindex');
if(config.releasePolicy?.requireManualApprovalBeforeDeploy!==true)missing.push('releasePolicy.requireManualApprovalBeforeDeploy');
if(config.releasePolicy?.deployFromDryRun!==false)missing.push('releasePolicy.deployFromDryRun_must_be_false');

const robots=await fs.readFile(path.join(out,'robots.txt'),'utf8').catch(()=> '');
const sitemap=await fs.readFile(path.join(out,'sitemap.xml'),'utf8').catch(()=> '');
const noindexMissing=[];
for(const route of candidates){
  const html=await fs.readFile(routeFile(route),'utf8').catch(()=> '');
  if(!/<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">/i.test(html))noindexMissing.push(route);
}
const previewInvariant={
  candidatesStillNoindex:noindexMissing.length===0,
  noindexMissing,
  robotsStillDisallowAll:/User-agent:\s*\*[\s\S]*Disallow:\s*\//i.test(robots),
  sitemapStillEmpty:!/<url>/i.test(sitemap),
  previewHtmlMutated:false,
  indexFlipAttempted:false,
  deployAttempted:false
};
const previewSafe=previewInvariant.candidatesStillNoindex&&previewInvariant.robotsStillDisallowAll&&previewInvariant.sitemapStillEmpty;
const configReady=missing.length===0&&!usingExample;
const dryRunDecision=!previewSafe?'BLOCKED_PREVIEW_SAFETY':configReady?'READY_FOR_MANUAL_RELEASE_BUILD':'BLOCKED_CONFIG_INCOMPLETE';
const canonicalExamples=validProductionSite(productionSite)?candidates.slice(0,8).map(route=>({route,canonical:`${productionSite}${route==='/'?'':route}`})):[];
const adsTxtConfigured=!placeholder(config.ads?.adsTxtLine)&&!/^__OPTIONAL_/i.test(String(config.ads?.adsTxtLine||''));
const planned={
  candidateIndexPages:candidates.length,
  nonCandidateNoindexPages:Math.max(0,htmlRouteCount-candidates.length),
  canonicalRewritePages:htmlRouteCount,
  sitemapUrlCount:candidates.length,
  robotsTxt:`User-agent: *\nAllow: /\nSitemap: ${validProductionSite(productionSite)?productionSite:'<PRODUCTION_SITE_URL>'}/sitemap.xml\n`,
  candidateRobots:'index,follow',
  nonCandidateRobots:'noindex,nofollow,noarchive,nosnippet',
  legalPages:['/about/','/contact/','/privacy/','/terms/'],
  adsTxtPlanned:adsTxtConfigured,
  productionOutputPolicy:'SEPARATE_OUTPUT_OR_MANUAL_SWITCH_ONLY; NEVER_OVERWRITE_PREVIEW_FROM_DRY_RUN',
  canonicalExamples
};
const report={
  schemaVersion:1,generatedAt,policy:'DRY_RUN_ONLY; NO_HTML_MUTATION; NO_ROBOTS_OR_SITEMAP_SWITCH; NO_DEPLOY; MANUAL_APPROVAL_REQUIRED',
  config:{source:path.relative(repo,configPath).replace(/\\/g,'/'),usingExample,ready:configReady,missing},
  decision:dryRunDecision,
  currentReadiness:{releaseDecision:readiness?.releaseDecision??null,blockers:readiness?.blockers??[]},
  productionSite:{configured:validProductionSite(productionSite),value:validProductionSite(productionSite)?productionSite:null},
  operator:{displayNameReady:!placeholder(config.operator?.displayName),legalNameReady:!placeholder(config.operator?.legalName),businessDisclosureReady:!placeholder(config.operator?.businessDisclosure),addressReady:!placeholder(config.operator?.address),contactEmailReady:validEmail(config.contact?.email)},
  legal:{privacy,terms},
  previewInvariant,
  candidateCount:candidates.length,
  graph:{htmlRouteCount,authoritySafe:(authority.graph?.candidateHtmlMissing||[]).length===0&&(authority.graph?.unreachableCandidates||[]).length===0&&(authority.graph?.orphanCandidates||[]).length===0},
  planned,
  sideEffects:{previewFilesMutated:false,indexingChanged:false,robotsChanged:false,sitemapChanged:false,deployed:false}
};
await fs.writeFile(path.join(out,'production-release-dry-run.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({productionReleaseDryRun:report.decision,candidates:report.candidateCount,usingExample,missing,previewSafe,plannedIndexPages:planned.candidateIndexPages,plannedNoindexPages:planned.nonCandidateNoindexPages,deployAttempted:false},null,2));
