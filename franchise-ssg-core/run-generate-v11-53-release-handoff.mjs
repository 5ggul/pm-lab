import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const preview=path.join(repo,'docs/franchise-ssg-preview');
const reportPath=path.join(preview,'v11-53-release-handoff.json');
const generatedAt=new Date().toISOString();

const [rc,authority,readiness,quality,example,builder,safeBuilder,inputContract,inputCli,provenanceContract,sealCli,deployPackageContract,preparePackage,verifyPackage,liveVerifier,deployGate,handoffDoc,gitignore]=await Promise.all([
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
const adEligible=readiness.adReadiness?.adEligibleCount??null;
const adDeferred=readiness.adReadiness?.adDeferredCount??null;

const get=(obj,key)=>key.split('.').reduce((v,k)=>v?.[k],obj);
const placeholder=v=>/^__.*__$/.test(String(v??'').trim());
const requiredConfigFields=[
  {key:'productionSiteUrl',purpose:'운영 HTTPS origin. path/query/hash/credentials, github.io, localhost, 테스트·예약·예시 도메인은 사용할 수 없습니다.'},
  {key:'operator.displayName',purpose:'사이트에 표시할 실제 서비스 운영명'},
  {key:'operator.legalName',purpose:'실제 운영주체 이름 또는 법적 명칭'},
  {key:'operator.businessDisclosure',purpose:'실제 사업자·운영자 고지 문구'},
  {key:'operator.address',purpose:'실제 공개 가능한 운영/사업 주소'},
  {key:'contact.email',purpose:'실제로 수신 가능한 공개 문의 이메일'},
  {key:'legal.privacyPolicySource',purpose:'최종 개인정보처리방침 Markdown 파일 경로'},
  {key:'legal.termsSource',purpose:'최종 이용약관 Markdown 파일 경로'}
];
const optionalConfigFields=[
  {key:'ads.adsTxtLine',purpose:'AdSense/광고 계정이 확정된 뒤 넣는 ads.txt 한 줄. 계정 확정 전에는 비워둡니다.'}
];
const requiredPolicy={
  'releasePolicy.indexOnlyProductionCandidates':true,
  'releasePolicy.keepNonCandidatesNoindex':true,
  'releasePolicy.requireManualApprovalBeforeDeploy':true,
  'releasePolicy.deployFromDryRun':false
};

const exampleFieldState=requiredConfigFields.map(x=>({
  ...x,
  present:get(example,x.key)!==undefined,
  placeholder:placeholder(get(example,x.key)),
  valueCommitted:false
}));
const policyState=Object.entries(requiredPolicy).map(([key,expected])=>({key,expected,actual:get(example,key),ok:get(example,key)===expected}));
const builderContractTokens=[
  'config.productionSiteUrl',
  'config.operator?.displayName',
  'config.operator?.legalName',
  'config.operator?.businessDisclosure',
  'config.operator?.address',
  'config.contact?.email',
  'config.legal?.privacyPolicySource',
  'config.legal?.termsSource',
  'config.releasePolicy?.indexOnlyProductionCandidates',
  'config.releasePolicy?.keepNonCandidatesNoindex',
  'config.releasePolicy?.requireManualApprovalBeforeDeploy',
  'config.releasePolicy?.deployFromDryRun',
  "process.env.SSG_RELEASE_BUILD_APPROVED==='YES'",
  "u.pathname==='/'",
  '!u.search',
  '!u.hash',
  "!/\\.invalid$/i.test(u.hostname)"
];
const builderContractAligned=builderContractTokens.every(t=>builder.includes(t));
const strictInputTokens=[
  'CREDENTIALS_NOT_ALLOWED',
  'PATH_NOT_ALLOWED',
  'QUERY_NOT_ALLOWED',
  'HASH_NOT_ALLOWED',
  'RESERVED_OR_PREVIEW_HOST_NOT_ALLOWED',
  'RESERVED_EMAIL_DOMAIN_NOT_ALLOWED',
  'PLACEHOLDER_OR_PREVIEW_COPY_REMAINS',
  'REQUIRED_RELEASE_POLICY'
];
const strictContractDefined=strictInputTokens.every(t=>inputContract.includes(t));
const safeBuilderAligned=[
  "from './release-input-contract.mjs'",
  'validateReleaseConfig',
  'if(!inputValidation.ready)',
  'run-build-production-candidate.mjs?v1124wrap='
].every(t=>safeBuilder.includes(t))&&safeBuilder.indexOf('validateReleaseConfig')<safeBuilder.indexOf('run-build-production-candidate.mjs?v1124wrap=');
const inputCliAligned=inputCli.includes('validateReleaseConfig')&&inputCli.includes('safeToRequestCandidateBuildApproval');
const handoffAligned=handoffDoc.includes('run-validate-release-inputs.mjs')&&handoffDoc.includes('run-build-production-candidate-v11-24.mjs');
const strictInputGateAligned=strictContractDefined&&safeBuilderAligned&&inputCliAligned&&handoffAligned;
const provenanceTokens=['computeCandidateTree','fingerprintReleaseInputs','resolveSourceHead','digestSealCore','evaluateDeployApproval'];
const provenanceContractDefined=provenanceTokens.every(t=>provenanceContract.includes(t));
const sealCliAligned=[
  "kind:'franchise-production-candidate-seal'",
  'report.validation?.status',
  'report.seoAudit?.status',
  'tree.digest!==report.outputHash',
  'sealDigest:digestSealCore(core)',
  'deploymentPolicy'
].every(t=>sealCli.includes(t));
const deployGateAligned=[
  'CANDIDATE_BYTES_CHANGED_AFTER_SEAL',
  'RELEASE_INPUT_FINGERPRINT_DRIFT',
  'SOURCE_HEAD_DRIFT',
  'evaluateDeployApproval',
  'productionDeploy:false'
].every(t=>deployGate.includes(t));
const deployPackageTokens=['buildFileManifest','resolveRollbackContract','verifyDeployPackage','packageDigest','relativeFileUrl'];
const deployPackageContractDefined=deployPackageTokens.every(t=>deployPackageContract.includes(t));
const preparePackageAligned=['franchise-production-candidate-seal.json','resolveRollbackContract','copyTree','deployment-manifest.json','checksums.sha256','productionDeploy:false'].every(t=>preparePackage.includes(t));
const verifyPackageAligned=verifyPackage.includes('verifyDeployPackage')&&verifyPackage.includes('productionDeploy:false');
const liveVerifierAligned=['verifyDeployPackage','SSG_LIVE_SITE_URL','BYTE_MISMATCH','exactPackageObserved','productionDeployPerformedByThisTool:false'].every(t=>liveVerifier.includes(t));
const deployGatePackageAligned=['verifyDeployPackage','packageDigest'].every(t=>deployGate.includes(t))&&provenanceContract.includes('SSG_PRODUCTION_DEPLOY_PACKAGE_DIGEST')&&provenanceContract.includes('DEPLOY_PACKAGE_DIGEST_MISSING');
const provenanceHandoffAligned=handoffDoc.includes('run-seal-production-candidate.mjs')&&handoffDoc.includes('run-prepare-production-deploy-package.mjs')&&handoffDoc.includes('run-verify-production-deploy-package.mjs')&&handoffDoc.includes('run-verify-live-production.mjs')&&handoffDoc.includes('run-verify-production-deploy-gate.mjs')&&handoffDoc.includes('SSG_PRODUCTION_DEPLOY_PACKAGE_DIGEST=<');
const provenanceGateAligned=provenanceContractDefined&&sealCliAligned&&deployPackageContractDefined&&preparePackageAligned&&verifyPackageAligned&&liveVerifierAligned&&deployGateAligned&&deployGatePackageAligned&&provenanceHandoffAligned;
const exampleAligned=exampleFieldState.every(x=>x.present&&x.placeholder)&&policyState.every(x=>x.ok)&&builderContractAligned&&strictInputGateAligned;
const localConfigIgnored=gitignore.includes('/franchise-ssg-core/release-config.local.json');
const productionOutputIgnored=gitignore.includes('/build/franchise-production-candidate/');
const productionSealIgnored=gitignore.includes('/build/franchise-production-candidate-seal.json');
const productionDeployPackageIgnored=gitignore.includes('/build/franchise-production-deploy-package/');
const postDeployReportIgnored=gitignore.includes('/build/franchise-post-deploy-report.json');

const previewSafety={
  candidateCount:readiness.previewSafety?.candidateCount,
  candidateHtmlMissing:readiness.previewSafety?.candidateHtmlMissing||[],
  candidateNoindexMissing:readiness.previewSafety?.candidateNoindexMissing||[],
  canonicalOffPreview:readiness.previewSafety?.canonicalOffPreview||[],
  robotsDisallowAll:readiness.previewSafety?.robotsDisallowAll===true,
  sitemapEmpty:readiness.previewSafety?.sitemapEmpty===true,
  adCodeRoutes:readiness.previewSafety?.adCodeRoutes||[]
};

const report={
  schemaVersion:1,
  handoffVersion:'11.53',
  generatedAt,
  baseUiVersion:String(authority.currentUiVersion||rc.uiVersion||''),
  state:'AWAITING_REAL_RELEASE_INPUTS_AND_EXPLICIT_APPROVAL',
  rcReady:rc.rcReady===true,
  productionDeployed:false,
  releaseDecision:readiness.releaseDecision,
  candidatePages:candidates.length,
  htmlPages:Number(authority.graph?.htmlRouteCount||rc.htmlPages||0),
  adReadiness:{eligible:adEligible,deferred:adDeferred,adsTxtConfigured:readiness.adReadiness?.adsTxtExists===true},
  currentBlockers:readiness.blockers||[],
  currentWarnings:readiness.warnings||[],
  previewSafety,
  releaseConfig:{
    examplePath:'franchise-ssg-core/release-config.example.json',
    localPath:'franchise-ssg-core/release-config.local.json',
    validatorPath:'franchise-ssg-core/run-validate-release-inputs.mjs',
    safeBuilderPath:'franchise-ssg-core/run-build-production-candidate-v11-24.mjs',
    exampleAlignedWithBuilder:exampleAligned,
    builderContractAligned,
    strictInputContractDefined:strictContractDefined,
    safeBuilderAligned,
    inputCliAligned,
    handoffAligned,
    strictInputGateAligned,
    localConfigIgnored,
    productionOutputIgnored,
    productionSealIgnored,
    productionDeployPackageIgnored,
    postDeployReportIgnored,
    requiredFields:exampleFieldState,
    optionalFields:optionalConfigFields,
    policy:policyState
  },
  releaseProvenance:{
    contractPath:'franchise-ssg-core/release-provenance.mjs',
    sealPath:'franchise-ssg-core/run-seal-production-candidate.mjs',
    deployPackageContractPath:'franchise-ssg-core/deployment-package.mjs',
    preparePackagePath:'franchise-ssg-core/run-prepare-production-deploy-package.mjs',
    verifyPackagePath:'franchise-ssg-core/run-verify-production-deploy-package.mjs',
    liveVerifierPath:'franchise-ssg-core/run-verify-live-production.mjs',
    deployGatePath:'franchise-ssg-core/run-verify-production-deploy-gate.mjs',
    contractDefined:provenanceContractDefined,
    sealCliAligned,
    deployPackageContractDefined,
    preparePackageAligned,
    verifyPackageAligned,
    liveVerifierAligned,
    deployGatePackageAligned,
    deployGateAligned,
    handoffAligned:provenanceHandoffAligned,
    provenanceGateAligned,
    productionSealIgnored,
    productionDeployPackageIgnored,
    postDeployReportIgnored
  },
  manualGates:[
    {gate:'PRODUCTION_CANDIDATE_BUILD',requiredSignal:'SSG_RELEASE_BUILD_APPROVED=YES',status:'NOT_GRANTED',meaning:'strict input preflight가 PASS한 실제 운영값으로 별도 production candidate를 생성해도 된다는 명시적 승인'},
    {gate:'REAL_PRODUCTION_DEPLOY',requiredSignal:'EXPLICIT_USER_DEPLOY_APPROVAL',requiredSignals:['SSG_PRODUCTION_DEPLOY_APPROVED=YES','SSG_PRODUCTION_DEPLOY_DIGEST=<sealDigest>','SSG_PRODUCTION_DEPLOY_SOURCE_SHA=<sourceHead>','SSG_PRODUCTION_DEPLOY_PACKAGE_DIGEST=<packageDigest>'],status:'NOT_GRANTED',meaning:'검증·봉인된 exact candidate digest와 source SHA를 실제 운영 호스트에 배포하고 색인을 열어도 된다는 별도 명시적 승인'}
  ],
  safeSequence:[
    'Copy release-config.example.json to ignored release-config.local.json and fill only real values.',
    'Run run-validate-release-inputs.mjs with SSG_RELEASE_CONFIG and require PASS before requesting candidate-build approval.',
    'Provide final privacy-policy and terms Markdown sources; do not use TODO/TBD/placeholders.',
    'Get explicit approval before setting SSG_RELEASE_BUILD_APPROVED=YES.',
    'Use run-build-production-candidate-v11-24.mjs so the strict input contract is rechecked before the internal builder runs.',
    'Finalize canonical/index policy, run production SEO audit, then validate the production candidate.',
    'Seal the validated candidate with run-seal-production-candidate.mjs; the seal must bind source HEAD, release-input fingerprint and candidate tree SHA256.',
    'Declare rollback mode explicitly: FIRST_DEPLOYMENT or PREVIOUS_SEAL with a valid previous production seal.',
    'Create and verify the exact deploy package with run-prepare-production-deploy-package.mjs and run-verify-production-deploy-package.mjs.',
    'Review the separate production candidate, seal digest, deploy package digest and rollback contract.',
    'Bind second approval to exact sealDigest, sourceHead and packageDigest, then run run-verify-production-deploy-gate.mjs; this gate does not deploy.',
    'Only after the deploy gate is READY and a second explicit deploy approval may a real hosting deployment/index switch be performed.',
    'After hosting deployment, run run-verify-live-production.mjs against the real production origin and require exact packaged bytes on every file.'
  ],
  nextRequiredAction:'USER_PROVIDES_REAL_DOMAIN_OPERATOR_CONTACT_AND_FINAL_LEGAL_SOURCES',
  note:'v11.53 prepares the release handoff only. It does not change preview robots/canonical/sitemap, does not add ad code, and does not deploy production.'
};

if(!report.rcReady)throw new Error('v11.52 release candidate is not ready');
if(report.baseUiVersion!=='11.52')throw new Error(`v11.53 requires locked UI 11.52, got ${report.baseUiVersion}`);
if(report.candidatePages!==184||report.htmlPages!==311)throw new Error(`Unexpected release inventory ${report.candidatePages}/${report.htmlPages}`);
if(!exampleAligned)throw new Error('release-config.example.json or strict release-input gate is not aligned with the production builder contract');
if(!localConfigIgnored||!productionOutputIgnored||!productionSealIgnored||!productionDeployPackageIgnored||!postDeployReportIgnored)throw new Error('Local release values, production candidate output, seal, deploy package or post-deploy report are not safely ignored');
if(!provenanceGateAligned)throw new Error('Production candidate provenance/deploy gate is not aligned');
if(previewSafety.candidateNoindexMissing.length||previewSafety.candidateHtmlMissing.length||previewSafety.canonicalOffPreview.length||!previewSafety.robotsDisallowAll||!previewSafety.sitemapEmpty||previewSafety.adCodeRoutes.length)throw new Error('Preview is not in the expected safe locked state');

await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({v11_53ReleaseHandoff:'PASS',state:report.state,rcReady:report.rcReady,candidates:report.candidatePages,html:report.htmlPages,adEligible,adDeferred,requiredExternalInputs:requiredConfigFields.length,exampleAligned,strictInputGateAligned,provenanceGateAligned,previewLocked:true,productionDeployed:false},null,2));
