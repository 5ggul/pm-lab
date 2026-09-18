import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const preview=path.join(repo,'docs/franchise-ssg-preview');
const err=[];

const [report,rc,authority,readiness,quality,example,builder,safeBuilder,inputContract,inputCli,provenanceContract,sealCli,deployPackageContract,preparePackage,verifyPackage,liveVerifier,deployGate,handoffDoc,gitignore]=await Promise.all([
  fs.readFile(path.join(preview,'v11-53-release-handoff.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(preview,'v11-52-release-candidate.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(preview,'internal-authority-report.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(preview,'production-readiness-report.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(preview,'v11-quality-report.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(here,'release-config.example.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(here,'run-build-production-candidate.mjs'),'utf8'),
  fs.readFile(path.join(here,'run-build-production-candidate-v11-24.mjs'),'utf8'),
  fs.readFile(path.join(here,'release-input-contract.mjs'),'utf8'),
  fs.readFile(path.join(here,'run-validate-release-inputs.mjs'),'utf8'),
  fs.readFile(path.join(here,'release-provenance.mjs'),'utf8'),
  fs.readFile(path.join(here,'run-seal-production-candidate.mjs'),'utf8'),
  fs.readFile(path.join(here,'deployment-package.mjs'),'utf8'),
  fs.readFile(path.join(here,'run-prepare-production-deploy-package.mjs'),'utf8'),
  fs.readFile(path.join(here,'run-verify-production-deploy-package.mjs'),'utf8'),
  fs.readFile(path.join(here,'run-verify-live-production.mjs'),'utf8'),
  fs.readFile(path.join(here,'run-verify-production-deploy-gate.mjs'),'utf8'),
  fs.readFile(path.join(here,'PRODUCTION-HANDOFF.md'),'utf8'),
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
const builderTokens=['config.productionSiteUrl','config.operator?.displayName','config.operator?.legalName','config.operator?.businessDisclosure','config.operator?.address','config.contact?.email','config.legal?.privacyPolicySource','config.legal?.termsSource',"process.env.SSG_RELEASE_BUILD_APPROVED==='YES'","u.pathname==='/'",'!u.search','!u.hash',"!/\\.invalid$/i.test(u.hostname)"];
const inputTokens=['CREDENTIALS_NOT_ALLOWED','PATH_NOT_ALLOWED','QUERY_NOT_ALLOWED','HASH_NOT_ALLOWED','RESERVED_OR_PREVIEW_HOST_NOT_ALLOWED','RESERVED_EMAIL_DOMAIN_NOT_ALLOWED','PLACEHOLDER_OR_PREVIEW_COPY_REMAINS','REQUIRED_RELEASE_POLICY'];
const safeBuilderTokens=["from './release-input-contract.mjs'",'validateReleaseConfig','if(!inputValidation.ready)','run-build-production-candidate.mjs?v1124wrap='];
const provenanceTokens=['computeCandidateTree','fingerprintReleaseInputs','resolveSourceHead','digestSealCore','evaluateDeployApproval'];
const sealTokens=["kind:'franchise-production-candidate-seal'",'report.validation?.status','report.seoAudit?.status','tree.digest!==report.outputHash','sealDigest:digestSealCore(core)','deploymentPolicy'];
const deployPackageTokens=['buildFileManifest','resolveRollbackContract','verifyDeployPackage','packageDigest','relativeFileUrl'];
const preparePackageTokens=['resolveRollbackContract','copyTree','deployment-manifest.json','checksums.sha256','productionDeploy:false'];
const liveVerifierTokens=['SSG_LIVE_SITE_URL','BYTE_MISMATCH','exactPackageObserved','productionDeployPerformedByThisTool:false'];
const deployGateTokens=['CANDIDATE_BYTES_CHANGED_AFTER_SEAL','RELEASE_INPUT_FINGERPRINT_DRIFT','SOURCE_HEAD_DRIFT','verifyDeployPackage','SSG_PRODUCTION_DEPLOY_PACKAGE_DIGEST','DEPLOY_PACKAGE_DIGEST_MISSING','evaluateDeployApproval','productionDeploy:false'];

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
if(cfg.validatorPath!=='franchise-ssg-core/run-validate-release-inputs.mjs'||cfg.safeBuilderPath!=='franchise-ssg-core/run-build-production-candidate-v11-24.mjs')err.push('strict input paths');
if(cfg.exampleAlignedWithBuilder!==true||cfg.builderContractAligned!==true||cfg.strictInputContractDefined!==true||cfg.safeBuilderAligned!==true||cfg.inputCliAligned!==true||cfg.handoffAligned!==true||cfg.strictInputGateAligned!==true||cfg.localConfigIgnored!==true||cfg.productionOutputIgnored!==true||cfg.productionSealIgnored!==true||cfg.productionDeployPackageIgnored!==true||cfg.postDeployReportIgnored!==true)err.push('config alignment/strict input gate/ignore');
if(!gitignore.includes('/franchise-ssg-core/release-config.local.json')||!gitignore.includes('/build/franchise-production-candidate/')||!gitignore.includes('/build/franchise-production-candidate-seal.json')||!gitignore.includes('/build/franchise-production-deploy-package/')||!gitignore.includes('/build/franchise-post-deploy-report.json'))err.push('gitignore');
for(const key of requiredKeys){if(get(example,key)===undefined||!placeholder(get(example,key)))err.push(`example placeholder ${key}`)}
for(const [key,value] of Object.entries(expectedPolicy))if(get(example,key)!==value)err.push(`policy ${key}`);
for(const token of builderTokens)if(!builder.includes(token))err.push(`builder token ${token}`);
for(const token of inputTokens)if(!inputContract.includes(token))err.push(`input contract token ${token}`);
for(const token of safeBuilderTokens)if(!safeBuilder.includes(token))err.push(`safe builder token ${token}`);
if(safeBuilder.indexOf('validateReleaseConfig')>safeBuilder.indexOf('run-build-production-candidate.mjs?v1124wrap='))err.push('safe builder validates after internal builder');
if(!inputCli.includes('validateReleaseConfig')||!inputCli.includes('safeToRequestCandidateBuildApproval'))err.push('input cli alignment');
if(!handoffDoc.includes('run-validate-release-inputs.mjs')||!handoffDoc.includes('run-build-production-candidate-v11-24.mjs'))err.push('handoff strict path alignment');
const provenance=report.releaseProvenance||{};
if(provenance.contractPath!=='franchise-ssg-core/release-provenance.mjs'||provenance.sealPath!=='franchise-ssg-core/run-seal-production-candidate.mjs'||provenance.deployPackageContractPath!=='franchise-ssg-core/deployment-package.mjs'||provenance.preparePackagePath!=='franchise-ssg-core/run-prepare-production-deploy-package.mjs'||provenance.verifyPackagePath!=='franchise-ssg-core/run-verify-production-deploy-package.mjs'||provenance.liveVerifierPath!=='franchise-ssg-core/run-verify-live-production.mjs'||provenance.deployGatePath!=='franchise-ssg-core/run-verify-production-deploy-gate.mjs')err.push('provenance paths');
if(provenance.contractDefined!==true||provenance.sealCliAligned!==true||provenance.deployPackageContractDefined!==true||provenance.preparePackageAligned!==true||provenance.verifyPackageAligned!==true||provenance.liveVerifierAligned!==true||provenance.deployGatePackageAligned!==true||provenance.deployGateAligned!==true||provenance.handoffAligned!==true||provenance.provenanceGateAligned!==true||provenance.productionSealIgnored!==true||provenance.productionDeployPackageIgnored!==true||provenance.postDeployReportIgnored!==true)err.push('provenance gate alignment');
for(const token of provenanceTokens)if(!provenanceContract.includes(token))err.push(`provenance contract token ${token}`);
for(const token of sealTokens)if(!sealCli.includes(token))err.push(`seal cli token ${token}`);
for(const token of deployPackageTokens)if(!deployPackageContract.includes(token))err.push(`deploy package contract token ${token}`);
for(const token of preparePackageTokens)if(!preparePackage.includes(token))err.push(`prepare package token ${token}`);
if(!verifyPackage.includes('verifyDeployPackage')||!verifyPackage.includes('productionDeploy:false'))err.push('verify package alignment');
for(const token of liveVerifierTokens)if(!liveVerifier.includes(token))err.push(`live verifier token ${token}`);
for(const token of deployGateTokens)if(!deployGate.includes(token))err.push(`deploy gate token ${token}`);
if(!handoffDoc.includes('run-seal-production-candidate.mjs')||!handoffDoc.includes('run-prepare-production-deploy-package.mjs')||!handoffDoc.includes('run-verify-production-deploy-package.mjs')||!handoffDoc.includes('run-verify-live-production.mjs')||!handoffDoc.includes('run-verify-production-deploy-gate.mjs')||!handoffDoc.includes('SSG_PRODUCTION_DEPLOY_DIGEST=<')||!handoffDoc.includes('SSG_PRODUCTION_DEPLOY_PACKAGE_DIGEST=<'))err.push('handoff provenance path alignment');

const reportKeys=(cfg.requiredFields||[]).map(x=>x.key).sort();
if(JSON.stringify(reportKeys)!==JSON.stringify([...requiredKeys].sort()))err.push(`required keys ${reportKeys.join(',')}`);
if(!(cfg.optionalFields||[]).some(x=>x.key==='ads.adsTxtLine'))err.push('optional ads key');
if(!Array.isArray(report.manualGates)||report.manualGates.length!==2)err.push('manual gates');
else{
  if(report.manualGates[0]?.requiredSignal!=='SSG_RELEASE_BUILD_APPROVED=YES'||report.manualGates[0]?.status!=='NOT_GRANTED')err.push('candidate build gate');
  if(report.manualGates[1]?.requiredSignal!=='EXPLICIT_USER_DEPLOY_APPROVAL'||report.manualGates[1]?.status!=='NOT_GRANTED')err.push('deploy gate');
  const deploySignals=report.manualGates[1]?.requiredSignals||[];
  for(const signal of ['SSG_PRODUCTION_DEPLOY_APPROVED=YES','SSG_PRODUCTION_DEPLOY_DIGEST=<sealDigest>','SSG_PRODUCTION_DEPLOY_SOURCE_SHA=<sourceHead>','SSG_PRODUCTION_DEPLOY_PACKAGE_DIGEST=<packageDigest>'])if(!deploySignals.includes(signal))err.push(`deploy gate signal ${signal}`);
}
if(!Array.isArray(report.safeSequence)||report.safeSequence.length<13)err.push('safe sequence');
else{
  if(!report.safeSequence.some(x=>x.includes('run-validate-release-inputs.mjs')))err.push('safe sequence input preflight');
  if(!report.safeSequence.some(x=>x.includes('run-build-production-candidate-v11-24.mjs')))err.push('safe sequence safe builder');
  if(!report.safeSequence.some(x=>x.includes('run-seal-production-candidate.mjs')))err.push('safe sequence seal');
  if(!report.safeSequence.some(x=>x.includes('run-prepare-production-deploy-package.mjs')))err.push('safe sequence prepare package');
  if(!report.safeSequence.some(x=>x.includes('run-verify-production-deploy-package.mjs')))err.push('safe sequence verify package');
  if(!report.safeSequence.some(x=>x.includes('run-verify-production-deploy-gate.mjs')))err.push('safe sequence deploy gate');
  if(!report.safeSequence.some(x=>x.includes('run-verify-live-production.mjs')))err.push('safe sequence postdeploy verifier');
  const order=report.safeSequence.findIndex(x=>x.includes('production SEO audit'));
  if(order<0||!report.safeSequence[order].includes('then validate the production candidate'))err.push('safe sequence finalize/audit/validate order');
}
if(report.nextRequiredAction!=='USER_PROVIDES_REAL_DOMAIN_OPERATOR_CONTACT_AND_FINAL_LEGAL_SOURCES')err.push('next action');

try{await fs.access(path.join(here,'release-config.local.json'));err.push('release-config.local.json is tracked/present in CI checkout')}catch{}

if(err.length){
  console.error(JSON.stringify({v11_53ReleaseHandoffValidation:'FAIL',count:err.length,errors:err},null,2));
  process.exit(1);
}
console.log(JSON.stringify({v11_53ReleaseHandoffValidation:'PASS',baseUiVersion:'11.52',rcReady:true,candidates:184,html:311,adEligible:163,adDeferred:21,requiredExternalInputs:8,manualGates:2,strictInputGate:true,provenanceGate:true,previewLocked:true,productionDeployed:false},null,2));
