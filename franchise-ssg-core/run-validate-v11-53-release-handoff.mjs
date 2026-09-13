import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const preview=path.join(repo,'docs/franchise-ssg-preview');
const err=[];

const [report,rc,authority,readiness,quality,example,builder,gitignore]=await Promise.all([
  fs.readFile(path.join(preview,'v11-53-release-handoff.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(preview,'v11-52-release-candidate.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(preview,'internal-authority-report.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(preview,'production-readiness-report.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(preview,'v11-quality-report.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(here,'release-config.example.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(here,'run-build-production-candidate.mjs'),'utf8'),
  fs.readFile(path.join(repo,'.gitignore'),'utf8')
]);

const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const get=(obj,key)=>key.split('.').reduce((v,k)=>v?.[k],obj);
const placeholder=v=>/^__.*__$/.test(String(v??'').trim());
const requiredKeys=['productionSiteUrl','operator.displayName','operator.legalName','operator.businessDisclosure','operator.address','contact.email','legal.privacyPolicySource','legal.termsSource'];
const expectedPolicy={
  'releasePolicy.indexOnlyProductionCandidates':true,
  'releasePolicy.keepNonCandidatesNoindex':true,
  'releasePolicy.requireManualApprovalBeforeDeploy':true,
  'releasePolicy.deployFromDryRun':false
};
const expectedBlockers=['PRODUCTION_SITE_URL_UNSET','OPERATOR_IDENTITY_NOT_FINAL','REAL_CONTACT_NOT_FINAL','PRIVACY_POLICY_NOT_FINAL','TERMS_NOT_FINAL'];
const builderTokens=['config.productionSiteUrl','config.operator?.displayName','config.operator?.legalName','config.operator?.businessDisclosure','config.operator?.address','config.contact?.email','config.legal?.privacyPolicySource','config.legal?.termsSource',"process.env.SSG_RELEASE_BUILD_APPROVED==='YES'"];

if(report.handoffVersion!=='11.53')err.push(`handoffVersion ${report.handoffVersion}`);
if(report.baseUiVersion!=='11.52'||String(authority.currentUiVersion)!=='11.52'||String(rc.uiVersion)!=='11.52')err.push(`ui ${report.baseUiVersion}/${authority.currentUiVersion}/${rc.uiVersion}`);
if(report.state!=='AWAITING_REAL_RELEASE_INPUTS_AND_EXPLICIT_APPROVAL')err.push(`state ${report.state}`);
if(report.rcReady!==true||rc.rcReady!==true)err.push('rcReady');
if(report.productionDeployed!==false)err.push('production flag');
if(report.releaseDecision!=='BLOCKED'||readiness.releaseDecision!=='BLOCKED')err.push(`release decision ${report.releaseDecision}/${readiness.releaseDecision}`);
if(candidates.length!==184||Number(report.candidatePages)!==184||Number(report.htmlPages)!==311)err.push(`inventory ${candidates.length}/${report.candidatePages}/${report.htmlPages}`);
if(Number(report.adReadiness?.eligible)!==163||Number(report.adReadiness?.deferred)!==21)err.push(`ads ${report.adReadiness?.eligible}/${report.adReadiness?.deferred}`);
if(report.adReadiness?.adsTxtConfigured!==false)err.push('ads.txt should not be configured before account is final');

for(const b of expectedBlockers)if(!(report.currentBlockers||[]).includes(b)||!(readiness.blockers||[]).includes(b))err.push(`blocker ${b}`);
if(!(report.currentWarnings||[]).includes('ADS_TXT_NOT_CONFIGURED_YET'))err.push('ads warning');

const safety=report.previewSafety||{};
if(Number(safety.candidateCount)!==184)err.push(`safe candidate ${safety.candidateCount}`);
if((safety.candidateHtmlMissing||[]).length||(safety.candidateNoindexMissing||[]).length||(safety.canonicalOffPreview||[]).length||(safety.adCodeRoutes||[]).length)err.push('preview safety arrays');
if(safety.robotsDisallowAll!==true||safety.sitemapEmpty!==true)err.push('preview robots/sitemap');

const cfg=report.releaseConfig||{};
if(cfg.examplePath!=='franchise-ssg-core/release-config.example.json'||cfg.localPath!=='franchise-ssg-core/release-config.local.json')err.push('config paths');
if(cfg.exampleAlignedWithBuilder!==true||cfg.builderContractAligned!==true||cfg.localConfigIgnored!==true||cfg.productionOutputIgnored!==true)err.push('config alignment/ignore');
if(!gitignore.includes('/franchise-ssg-core/release-config.local.json')||!gitignore.includes('/build/franchise-production-candidate/'))err.push('gitignore');
for(const key of requiredKeys){if(get(example,key)===undefined||!placeholder(get(example,key)))err.push(`example placeholder ${key}`)}
for(const [key,value] of Object.entries(expectedPolicy))if(get(example,key)!==value)err.push(`policy ${key}`);
for(const token of builderTokens)if(!builder.includes(token))err.push(`builder token ${token}`);

const reportKeys=(cfg.requiredFields||[]).map(x=>x.key).sort();
if(JSON.stringify(reportKeys)!==JSON.stringify([...requiredKeys].sort()))err.push(`required keys ${reportKeys.join(',')}`);
if(!(cfg.optionalFields||[]).some(x=>x.key==='ads.adsTxtLine'))err.push('optional ads key');
if(!Array.isArray(report.manualGates)||report.manualGates.length!==2)err.push('manual gates');
else{
  if(report.manualGates[0]?.requiredSignal!=='SSG_RELEASE_BUILD_APPROVED=YES'||report.manualGates[0]?.status!=='NOT_GRANTED')err.push('candidate build gate');
  if(report.manualGates[1]?.requiredSignal!=='EXPLICIT_USER_DEPLOY_APPROVAL'||report.manualGates[1]?.status!=='NOT_GRANTED')err.push('deploy gate');
}
if(!Array.isArray(report.safeSequence)||report.safeSequence.length<7)err.push('safe sequence');
if(report.nextRequiredAction!=='USER_PROVIDES_REAL_DOMAIN_OPERATOR_CONTACT_AND_FINAL_LEGAL_SOURCES')err.push('next action');

// Ensure no real local release configuration is accidentally committed at the expected ignored path.
try{await fs.access(path.join(here,'release-config.local.json'));err.push('release-config.local.json is tracked/present in CI checkout')}catch{}

if(err.length){
  console.error(JSON.stringify({v11_53ReleaseHandoffValidation:'FAIL',count:err.length,errors:err},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_53ReleaseHandoffValidation:'PASS',baseUiVersion:'11.52',rcReady:true,candidates:184,html:311,adEligible:163,adDeferred:21,requiredExternalInputs:8,manualGates:2,previewLocked:true,productionDeployed:false},null,2));
