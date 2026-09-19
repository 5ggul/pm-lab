import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateReleaseConfig} from './release-input-contract.mjs';

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

const inputValidation=await validateReleaseConfig(config,{repoRoot:repo});
const privacy=inputValidation.legal.privacy;
const terms=inputValidation.legal.terms;
const productionSite=inputValidation.productionSite.value||'';
const missing=inputValidation.missing;

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
const configReady=inputValidation.ready&&!usingExample;
const dryRunDecision=!previewSafe?'BLOCKED_PREVIEW_SAFETY':configReady?'READY_FOR_MANUAL_RELEASE_BUILD':'BLOCKED_CONFIG_INCOMPLETE';
const canonicalExamples=inputValidation.productionSite.valid?candidates.slice(0,8).map(route=>({route,canonical:`${productionSite}${route==='/'?'':route}`})):[];
const adsTxtConfigured=inputValidation.ads.configured&&inputValidation.ads.valid;
const planned={
  candidateIndexPages:candidates.length,
  nonCandidateNoindexPages:Math.max(0,htmlRouteCount-candidates.length),
  canonicalRewritePages:htmlRouteCount,
  sitemapUrlCount:candidates.length,
  robotsTxt:`User-agent: *\nAllow: /\nSitemap: ${inputValidation.productionSite.valid?productionSite:'<PRODUCTION_SITE_URL>'}/sitemap.xml\n`,
  candidateRobots:'index,follow',
  nonCandidateRobots:'noindex,nofollow,noarchive,nosnippet',
  legalPages:['/about/','/contact/','/privacy/','/terms/'],
  adsTxtPlanned:adsTxtConfigured,
  productionOutputPolicy:'SEPARATE_OUTPUT_OR_MANUAL_SWITCH_ONLY; NEVER_OVERWRITE_PREVIEW_FROM_DRY_RUN',
  canonicalExamples
};
const report={
  schemaVersion:1,generatedAt,policy:'DRY_RUN_ONLY; NO_HTML_MUTATION; NO_ROBOTS_OR_SITEMAP_SWITCH; NO_DEPLOY; MANUAL_APPROVAL_REQUIRED',
  inputContract:'STRICT_EXACT_HTTPS_ORIGIN; NO_PATH_QUERY_HASH_CREDENTIALS_OR_RESERVED_HOST; FINAL_LEGAL_SOURCES; LOCKED_RELEASE_POLICY',
  config:{
    source:path.relative(repo,configPath).replace(/\\/g,'/'),
    usingExample,
    ready:configReady,
    missing,
    blockers:inputValidation.blockers,
    warnings:inputValidation.warnings
  },
  decision:dryRunDecision,
  currentReadiness:{releaseDecision:readiness?.releaseDecision??null,blockers:readiness?.blockers??[]},
  productionSite:{configured:inputValidation.productionSite.valid,value:inputValidation.productionSite.value,reasons:inputValidation.productionSite.reasons},
  operator:{
    displayNameReady:inputValidation.operator.displayName.ready,
    legalNameReady:inputValidation.operator.legalName.ready,
    businessDisclosureReady:inputValidation.operator.businessDisclosure.ready,
    addressReady:inputValidation.operator.address.ready,
    contactEmailReady:inputValidation.contact.email.valid
  },
  legal:{privacy,terms},
  ads:inputValidation.ads,
  releasePolicy:inputValidation.policy,
  previewInvariant,
  candidateCount:candidates.length,
  graph:{htmlRouteCount,authoritySafe:(authority.graph?.candidateHtmlMissing||[]).length===0&&(authority.graph?.unreachableCandidates||[]).length===0&&(authority.graph?.orphanCandidates||[]).length===0},
  planned,
  sideEffects:{previewFilesMutated:false,indexingChanged:false,robotsChanged:false,sitemapChanged:false,deployed:false}
};
await fs.writeFile(path.join(out,'production-release-dry-run.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({productionReleaseDryRun:report.decision,candidates:report.candidateCount,usingExample,missing,blockerCount:inputValidation.blockers.length,previewSafe,plannedIndexPages:planned.candidateIndexPages,plannedNoindexPages:planned.nonCandidateNoindexPages,deployAttempted:false},null,2));
