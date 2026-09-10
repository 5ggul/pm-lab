import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const PREVIEW_SITE='https://5ggul.github.io/pm-lab/franchise-ssg-preview';
const PROD_SITE=String(process.env.SSG_PRODUCTION_SITE_URL||'').trim().replace(/\/$/,'');
const generatedAt=new Date().toISOString();

const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const authority=JSON.parse(await fs.readFile(path.join(out,'internal-authority-report.json'),'utf8'));
const candidates=[...(quality.indexPolicy?.productionCandidateUrls||[])].map(normalizeRoute);
const candidateSet=new Set(candidates);

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split('#')[0].split('?')[0].replace(/^\/+|\/+$/g,'')}/`}
function routeFile(route){return route==='/'?path.join(out,'index.html'):path.join(out,...route.split('/').filter(Boolean),'index.html')}
function strip(html){return String(html)
  .replace(/<div class="preview-bar">[\s\S]*?<\/div>/gi,' ')
  .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
  .replace(/<svg\b[\s\S]*?<\/svg>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;|&#160;/g,' ')
  .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  .replace(/\s+/g,' ').trim()}
function routeType(route){
  if(route==='/')return 'home';
  if(route==='/brands/')return 'brandsHub';
  if(route.startsWith('/brands/'))return 'brand';
  if(route==='/categories/')return 'categoriesHub';
  if(route.startsWith('/categories/'))return 'category';
  if(route==='/compare/')return 'compareHub';
  if(route.startsWith('/compare/'))return 'compare';
  if(route==='/tools/')return 'toolsHub';
  if(route.startsWith('/tools/'))return 'tool';
  if(route==='/explore/')return 'explore';
  if(route==='/rankings/')return 'rankings';
  if(route==='/cost-components/')return 'costComponents';
  if(route.startsWith('/guide/'))return 'guide';
  return 'trustOrInfo';
}
function adDecision(type,m){
  if(['home','brandsHub','categoriesHub','compareHub','toolsHub','tool','trustOrInfo'].includes(type))return {eligible:false,reason:'DEFER_INTERACTION_HUB_OR_TRUST_PAGE'};
  const rules={
    brand:[1800,5,2],category:[1200,3,2],compare:[1000,3,1],explore:[1200,3,2],rankings:[1200,3,2],costComponents:[1200,3,2],guide:[900,2,0]
  };
  const [chars,h2,tables]=rules[type]||[1400,3,1];
  if(m.visibleTextChars<chars||m.h2<h2||m.tables<tables)return {eligible:false,reason:'DEFER_PUBLISHER_CONTENT_DEPTH'};
  return {eligible:true,reason:'CONTENT_FIRST_CANDIDATE'};
}

const audits=[];
const missingHtml=[];
const previewNoindexMissing=[];
const canonicalOffPreview=[];
const adCodeRoutes=[];
const syntheticLeakRoutes=[];
const internalQaLeakRoutes=[];
const syntheticPatterns=[/SYNTHETIC_PREVIEW/i,/합성\s*(?:값|데이터|구조)/,/운영사 정보 연결 예정/,/샘플\s*데이터/,/예시\s*데이터/];
const internalQaPatterns=[/정식 공개 시 색인 후보/,/품질점수\s*\d+\s*\/\s*100/,/realContactReady\s*=\s*false/i];
for(const route of candidates){
  const file=routeFile(route);let html='';
  try{html=await fs.readFile(file,'utf8')}catch{missingHtml.push(route);continue}
  const text=strip(html);const type=routeType(route);
  const canonical=html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1]||html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i)?.[1]||null;
  const m={visibleTextChars:text.length,h2:(html.match(/<h2\b/gi)||[]).length,tables:(html.match(/<table\b/gi)||[]).length,forms:(html.match(/<form\b/gi)||[]).length,externalLinks:(html.match(/href="https?:\/\//gi)||[]).length};
  const ad=adDecision(type,m);
  if(!/<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">/i.test(html))previewNoindexMissing.push(route);
  if(!canonical||!canonical.startsWith(PREVIEW_SITE))canonicalOffPreview.push({route,canonical});
  if(/adsbygoogle|pagead2\.googlesyndication\.com|googlesyndication/i.test(html))adCodeRoutes.push(route);
  if(syntheticPatterns.some(re=>re.test(text)))syntheticLeakRoutes.push(route);
  if(internalQaPatterns.some(re=>re.test(text)))internalQaLeakRoutes.push(route);
  audits.push({route,type,...m,canonical,adEligible:ad.eligible,adReason:ad.reason});
}

const readText=async route=>strip(await fs.readFile(routeFile(route),'utf8'));
const aboutText=await readText('/about/');
const contactText=await readText('/contact/');
const privacyText=await readText('/privacy/');
const termsText=await readText('/terms/');
const robots=await fs.readFile(path.join(out,'robots.txt'),'utf8').catch(()=> '');
const sitemap=await fs.readFile(path.join(out,'sitemap.xml'),'utf8').catch(()=> '');
const adsTxtExists=await fs.access(path.join(out,'ads.txt')).then(()=>true).catch(()=>false);

const productionSiteConfigured=/^https:\/\/[^/]+/i.test(PROD_SITE)&&!PROD_SITE.startsWith(PREVIEW_SITE)&&!/^https:\/\/[^/]*github\.io(?:\/|$)/i.test(PROD_SITE);
const operatorIdentityReady=manifest.productionGates?.operatorIdentityReady===true&&!/실명·사업자 정보는 정식 서비스 공개 전에/.test(aboutText);
const realContactReady=manifest.productionGates?.realContactReady===true&&!/realContactReady\s*=\s*false/i.test(contactText)&&/@/.test(contactText);
const privacyFinal=!/현재 외부 검수용 프리뷰|활성화할 경우|반영한 뒤 공개/.test(privacyText);
const termsFinal=!/실제 사업자 정보가 확정된 뒤|최종 약관에 반영/.test(termsText);
const previewSafety={
  candidateCount:candidates.length,
  candidateHtmlMissing:missingHtml,
  candidateNoindexMissing:previewNoindexMissing,
  canonicalOffPreview,
  robotsDisallowAll:/User-agent:\s*\*[\s\S]*Disallow:\s*\//i.test(robots),
  sitemapEmpty:!/<url>/i.test(sitemap),
  adCodeRoutes
};
const graphSafe=(authority.graph?.candidateHtmlMissing||[]).length===0&&(authority.graph?.unreachableCandidates||[]).length===0&&(authority.graph?.orphanCandidates||[]).length===0;

const blockers=[];
if(!productionSiteConfigured)blockers.push('PRODUCTION_SITE_URL_UNSET');
if(!operatorIdentityReady)blockers.push('OPERATOR_IDENTITY_NOT_FINAL');
if(!realContactReady)blockers.push('REAL_CONTACT_NOT_FINAL');
if(!privacyFinal)blockers.push('PRIVACY_POLICY_NOT_FINAL');
if(!termsFinal)blockers.push('TERMS_NOT_FINAL');
if(missingHtml.length)blockers.push('CANDIDATE_HTML_MISSING');
if(previewNoindexMissing.length||!previewSafety.robotsDisallowAll||!previewSafety.sitemapEmpty)blockers.push('PREVIEW_SAFETY_REGRESSION');
if(!graphSafe)blockers.push('INTERNAL_LINK_GRAPH_REGRESSION');
if(adCodeRoutes.length)blockers.push('AD_CODE_PRESENT_BEFORE_RELEASE');
if(syntheticLeakRoutes.length)blockers.push('SYNTHETIC_VISIBLE_CONTENT_LEAK');
if(internalQaLeakRoutes.filter(r=>!['/about/','/contact/','/privacy/','/terms/'].includes(r)).length)blockers.push('INTERNAL_QA_COPY_VISIBLE');

const adEligibleRoutes=audits.filter(x=>x.adEligible).map(x=>x.route);
const adDeferred=audits.filter(x=>!x.adEligible).map(x=>({route:x.route,reason:x.adReason}));
const warnings=[];
if(!adsTxtExists)warnings.push('ADS_TXT_NOT_CONFIGURED_YET');
if(adEligibleRoutes.length===0)warnings.push('NO_AD_ELIGIBLE_CONTENT_CLASSIFIED');

const report={
  schemaVersion:1,generatedAt,baseUiVersion:manifest.uiVersion??null,previewMode:true,
  policy:'AUDIT_ONLY; NEVER_FLIP_INDEXING; PRODUCTION_REQUIRES_REAL_OPERATOR_CONTACT_LEGAL_TEXT_AND_FINAL_HOST; INDEX_ELIGIBILITY_IS_SEPARATE_FROM_AD_ELIGIBILITY',
  releaseDecision:blockers.length?'BLOCKED':'READY_FOR_MANUAL_PRODUCTION_SWITCH',
  productionSite:{configured:productionSiteConfigured,value:PROD_SITE||null,expectedSitemapUrls:candidates.length},
  operator:{identityReady:operatorIdentityReady,contactReady:realContactReady,privacyFinal,termsFinal},
  previewSafety,graphSafe,
  contentLeaks:{syntheticLeakRoutes,internalQaLeakRoutes},
  adReadiness:{candidateCount:candidates.length,adEligibleCount:adEligibleRoutes.length,adDeferredCount:adDeferred.length,adEligibleRoutes,adDeferred,adsTxtExists,adCodeRoutes},
  blockers,warnings,audits
};
await fs.writeFile(path.join(out,'production-readiness-report.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({productionReadiness:report.releaseDecision,uiVersion:report.baseUiVersion,candidates:candidates.length,adEligible:adEligibleRoutes.length,blockers,warnings,previewSafe:!missingHtml.length&&!previewNoindexMissing.length&&previewSafety.robotsDisallowAll&&previewSafety.sitemapEmpty,graphSafe},null,2));
