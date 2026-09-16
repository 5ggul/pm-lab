import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const preview=path.join(repo,'docs/franchise-ssg-preview');
const reportPath=path.join(preview,'v11-53-release-handoff.json');
const generatedAt=new Date().toISOString();

const [rc,authority,readiness,quality,example,builder,gitignore]=await Promise.all([
  fs.readFile(path.join(preview,'v11-52-release-candidate.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(preview,'internal-authority-report.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(preview,'production-readiness-report.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(preview,'v11-quality-report.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(here,'release-config.example.json'),'utf8').then(JSON.parse),
  fs.readFile(path.join(here,'run-build-production-candidate.mjs'),'utf8'),
  fs.readFile(path.join(repo,'.gitignore'),'utf8')
]);

const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const adEligible=readiness.adReadiness?.adEligibleCount??null;
const adDeferred=readiness.adReadiness?.adDeferredCount??null;

const get=(obj,key)=>key.split('.').reduce((v,k)=>v?.[k],obj);
const placeholder=v=>/^__.*__$/.test(String(v??'').trim());
const requiredConfigFields=[
  {key:'productionSiteUrl',purpose:'운영 HTTPS origin. github.io, localhost, 테스트 도메인은 사용할 수 없습니다.'},
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
  "process.env.SSG_RELEASE_BUILD_APPROVED==='YES'"
];
const builderContractAligned=builderContractTokens.every(t=>builder.includes(t));
const exampleAligned=exampleFieldState.every(x=>x.present&&x.placeholder)&&policyState.every(x=>x.ok)&&builderContractAligned;
const localConfigIgnored=gitignore.includes('/franchise-ssg-core/release-config.local.json');
const productionOutputIgnored=gitignore.includes('/build/franchise-production-candidate/');

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
    exampleAlignedWithBuilder:exampleAligned,
    builderContractAligned,
    localConfigIgnored,
    productionOutputIgnored,
    requiredFields:exampleFieldState,
    optionalFields:optionalConfigFields,
    policy:policyState
  },
  manualGates:[
    {gate:'PRODUCTION_CANDIDATE_BUILD',requiredSignal:'SSG_RELEASE_BUILD_APPROVED=YES',status:'NOT_GRANTED',meaning:'실제 운영값으로 별도 production candidate를 생성해도 된다는 명시적 승인'},
    {gate:'REAL_PRODUCTION_DEPLOY',requiredSignal:'EXPLICIT_USER_DEPLOY_APPROVAL',status:'NOT_GRANTED',meaning:'검증된 candidate를 실제 운영 호스트에 배포하고 색인을 열어도 된다는 별도 명시적 승인'}
  ],
  safeSequence:[
    'Copy release-config.example.json to ignored release-config.local.json and fill only real values.',
    'Provide final privacy-policy and terms Markdown sources; do not use TODO/TBD/placeholders.',
    'Get explicit approval before setting SSG_RELEASE_BUILD_APPROVED=YES.',
    'Build to build/franchise-production-candidate only; preview must remain immutable and noindex.',
    'Finalize canonical/index policy, then validate production candidate and run production SEO audit.',
    'Review the separate production candidate output.',
    'Only after a second explicit deploy approval may a real hosting deployment/index switch be performed.'
  ],
  nextRequiredAction:'USER_PROVIDES_REAL_DOMAIN_OPERATOR_CONTACT_AND_FINAL_LEGAL_SOURCES',
  note:'v11.53 prepares the release handoff only. It does not change preview robots/canonical/sitemap, does not add ad code, and does not deploy production.'
};

if(!report.rcReady)throw new Error('v11.52 release candidate is not ready');
if(report.baseUiVersion!=='11.52')throw new Error(`v11.53 requires locked UI 11.52, got ${report.baseUiVersion}`);
if(report.candidatePages!==184||report.htmlPages!==311)throw new Error(`Unexpected release inventory ${report.candidatePages}/${report.htmlPages}`);
if(!exampleAligned)throw new Error('release-config.example.json is not aligned with the production builder contract');
if(!localConfigIgnored||!productionOutputIgnored)throw new Error('Local release values or production candidate output are not safely ignored');
if(previewSafety.candidateNoindexMissing.length||previewSafety.candidateHtmlMissing.length||previewSafety.canonicalOffPreview.length||!previewSafety.robotsDisallowAll||!previewSafety.sitemapEmpty||previewSafety.adCodeRoutes.length)throw new Error('Preview is not in the expected safe locked state');

await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({v11_53ReleaseHandoff:'PASS',state:report.state,rcReady:report.rcReady,candidates:report.candidatePages,html:report.htmlPages,adEligible,adDeferred,requiredExternalInputs:requiredConfigFields.length,exampleAligned,previewLocked:true,productionDeployed:false},null,2));
