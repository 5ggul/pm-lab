import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {assessBaseUrl} from './validate-release-base-url-v6.mjs';

const readJson=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return null}};
const exists=file=>Boolean(file&&fs.existsSync(file));
const bool=v=>String(v||'').toLowerCase()==='true';

export function buildReleaseChecklist({sourceRoot='interior-cost-core/v6-review',productionDir='',publicPricePreflightFile='',baseUrl='',reviewCiPassed=false,productionValidated=false,ownerApproved=false,previewRehearsal=false,now=new Date()}={}){
  const root=path.resolve(sourceRoot),prod=productionDir?path.resolve(productionDir):'';
  const publicPrices=readJson(path.join(root,'data/public-unit-prices.json'))||{};
  const quoteSegments=readJson(path.join(root,'data/quote-public-segments.json'))||{};
  const pricePreflight=publicPricePreflightFile?readJson(path.resolve(publicPricePreflightFile)):null;
  const domain=baseUrl?assessBaseUrl(baseUrl):{ok:false,errors:['base-url-not-provided'],warnings:[],normalized_base_url:null,preview_host:false};
  const rehearsalDomain=baseUrl?assessBaseUrl(baseUrl,{allowPreviewHost:Boolean(previewRehearsal)}):domain;
  const productionFiles=prod?['index.html','sitemap.xml','robots.txt','site-index.json','data/catalog.json','llms.txt','release-manifest.json','release-manifest.sha256'].every(x=>exists(path.join(prod,x))):false;
  const publicPricePublished=publicPrices.status==='ready'&&Array.isArray(publicPrices.rows)&&publicPrices.rows.length>=5000;
  const quoteStatsPublished=quoteSegments.status==='published_segments_available'&&Array.isArray(quoteSegments.segments)&&quoteSegments.segments.length>0;
  const publicPricePreflightReady=pricePreflight?.summary?.readiness==='ready'&&pricePreflight?.validator?.ok===true;
  const publicPriceBlocker=pricePreflight?.blocker||null;
  const candidateTechnicalReady=Boolean(reviewCiPassed&&productionValidated&&productionFiles);
  const previewRehearsalReady=Boolean(previewRehearsal&&candidateTechnicalReady&&rehearsalDomain.ok&&rehearsalDomain.preview_host);
  const domainDetail=domain.ok?domain.normalized_base_url:previewRehearsalReady?`preview rehearsal passed at ${rehearsalDomain.normalized_base_url}; final production domain still required`:domain.errors.join(', ');
  const checks=[
    {id:'review_ci',group:'core',required_for:'core_only',status:reviewCiPassed?'ready':'pending',blocking:!reviewCiPassed,detail:reviewCiPassed?'review CI passed':'review CI pass must be supplied by the release workflow'},
    {id:'production_candidate',group:'core',required_for:'core_only',status:productionValidated&&productionFiles?'ready':'pending',blocking:!(productionValidated&&productionFiles),detail:productionFiles?'production candidate files present and manifest validated':'production candidate not built or manifest incomplete'},
    {id:'production_domain',group:'core',required_for:'core_only',status:domain.ok?'ready':'pending',blocking:!domain.ok,rehearsal_ready:previewRehearsalReady,detail:domainDetail},
    {id:'owner_preview_approval',group:'core',required_for:'core_only',status:ownerApproved?'ready':'pending',blocking:!ownerApproved,detail:ownerApproved?'explicit owner approval recorded':'explicit owner preview approval required'},
    {id:'public_price_live_preflight',group:'data',required_for:'full_data',status:publicPricePreflightReady?'ready':pricePreflight?'blocked':'pending',blocking:false,external_blocker:publicPriceBlocker,detail:publicPricePreflightReady?'live API preflight ready':pricePreflight?pricePreflight.summary?.readiness||'blocked':'live API preflight report not supplied'},
    {id:'public_price_published_dataset',group:'data',required_for:'full_data',status:publicPricePublished?'ready':'deferred',blocking:false,detail:publicPricePublished?`${publicPrices.rows.length} published rows`:'repository public-unit-prices remains gated'},
    {id:'quote_statistics',group:'data',required_for:'full_data',status:quoteStatsPublished?'ready':'deferred',blocking:false,detail:quoteStatsPublished?`${quoteSegments.segments.length} public segments`:'no qualifying public quote segment yet'},
    {id:'quote_submission',group:'optional',required_for:'optional',status:'deferred',blocking:false,detail:'submission remains disabled unless separately enabled'}
  ];
  const core=checks.filter(x=>x.group==='core'),coreReady=core.every(x=>x.status==='ready');
  const fullData=publicPricePreflightReady&&publicPricePublished&&quoteStatsPublished;
  const technical=core.filter(x=>x.id!=='owner_preview_approval'),technicalReady=technical.every(x=>x.status==='ready');
  const releaseMode=!technicalReady?'blocked_technical':!ownerApproved?'blocked_manual_approval':fullData?'full_data':'core_only';
  const coreReadyCount=core.filter(x=>x.status==='ready').length;
  return {
    schema_version:'1.1',generated_at:(now instanceof Date?now:new Date(now)).toISOString(),
    summary:{release_mode:releaseMode,candidate_technical_ready:candidateTechnicalReady,preview_rehearsal_ready:previewRehearsalReady,production_domain_ready:Boolean(domain.ok),core_technical_ready:technicalReady,core_release_ready:coreReady,full_data_ready:fullData,owner_approved:Boolean(ownerApproved),core_checks_ready:coreReadyCount,core_checks_total:core.length,core_completion_percent:Math.round(coreReadyCount/core.length*100)},
    checks,
    blockers:{core:checks.filter(x=>x.group==='core'&&x.status!=='ready').map(x=>x.id),external:checks.filter(x=>x.external_blocker).map(x=>({id:x.id,...x.external_blocker})),deferred:checks.filter(x=>x.status==='deferred').map(x=>x.id)},
    next_actions:checks.filter(x=>x.group==='core'&&x.status!=='ready').map(x=>x.detail).concat(checks.filter(x=>x.external_blocker).map(x=>x.external_blocker.owner_action)),
    safety:{preview_rehearsal:Boolean(previewRehearsal),preview_rehearsal_is_production_approval:false,deploy_executed:false,repository_mutated:false}
  };
}

export function main(env=process.env){
  const out=path.resolve(env.RELEASE_CHECKLIST_OUT||'/tmp/interior-v6-release-checklist.json');
  const report=buildReleaseChecklist({
    sourceRoot:env.SOURCE_ROOT||'interior-cost-core/v6-review',
    productionDir:env.OUT_DIR||'',
    publicPricePreflightFile:env.PUBLIC_PRICE_PREFLIGHT_FILE||'',
    baseUrl:env.BASE_URL||'',
    reviewCiPassed:bool(env.REVIEW_CI_PASSED),
    productionValidated:bool(env.PRODUCTION_VALIDATED),
    ownerApproved:bool(env.OWNER_APPROVED),
    previewRehearsal:bool(env.RELEASE_REHEARSAL)
  });
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:true,output:out,...report.summary,core_blockers:report.blockers.core,external_blockers:report.blockers.external.map(x=>x.code),deploy_executed:false},null,2));
  return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main();
