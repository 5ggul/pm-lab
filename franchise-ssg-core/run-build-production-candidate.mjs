import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const preview=path.join(repo,'docs/franchise-ssg-preview');
const PREVIEW_SITE='https://5ggul.github.io/pm-lab/franchise-ssg-preview';
const PREVIEW_BASE='/pm-lab/franchise-ssg-preview';
const TEST_MODE=String(process.env.SSG_RELEASE_TEST_MODE||'').toLowerCase()==='true';
const MANUAL_APPROVED=process.env.SSG_RELEASE_BUILD_APPROVED==='YES';
const defaultOutput=TEST_MODE?path.join(os.tmpdir(),'franchise-production-candidate-contract'):path.join(repo,'build/franchise-production-candidate');
const output=path.resolve(process.env.SSG_PRODUCTION_OUTPUT||defaultOutput);
const defaultReport=TEST_MODE?path.join(preview,'production-candidate-contract-test.json'):path.join(repo,'build/franchise-production-candidate-report.json');
const reportPath=path.resolve(process.env.SSG_PRODUCTION_CANDIDATE_REPORT||defaultReport);
const reportRelInPreview=reportPath.startsWith(path.resolve(preview)+path.sep)?path.relative(preview,reportPath).replace(/\\/g,'/'):null;
const previewHashIgnore=new Set(reportRelInPreview?[reportRelInPreview]:[]);
const generatedAt=new Date().toISOString();

const quality=JSON.parse(await fs.readFile(path.join(preview,'v11-quality-report.json'),'utf8'));
const authority=JSON.parse(await fs.readFile(path.join(preview,'internal-authority-report.json'),'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const candidateSet=new Set(candidates);
const expectedHtml=Number(authority.graph?.htmlRouteCount||0);

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split('#')[0].split('?')[0].replace(/^\/+|\/+$/g,'')}/`}
function routeFromHtml(rel){const p=rel.replace(/\\/g,'/');return p==='index.html'?'/':normalizeRoute('/'+p.replace(/\/index\.html$/,''))}
function placeholder(v){const s=String(v??'').trim();return !s||/^__.*__$/.test(s)}
function esc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim())&&!placeholder(v)}
function validSite(v){
  try{
    const u=new URL(String(v||'').trim());
    return u.protocol==='https:'&&u.pathname==='/'&&!u.search&&!u.hash&&!/github\.io$/i.test(u.hostname)&&!/(?:localhost|127\.0\.0\.1)$/i.test(u.hostname)&&!/\.invalid$/i.test(u.hostname);
  }catch{return false}
}
async function exists(p){return fs.access(p).then(()=>true).catch(()=>false)}
async function readLegal(rawPath){
  if(placeholder(rawPath))return {ready:false,text:'',path:null,reason:'PATH_NOT_CONFIGURED'};
  const p=path.isAbsolute(rawPath)?rawPath:path.resolve(repo,rawPath);
  if(!(await exists(p)))return {ready:false,text:'',path:p,reason:'SOURCE_NOT_FOUND'};
  const text=await fs.readFile(p,'utf8');
  if(text.trim().length<400)return {ready:false,text,path:p,reason:'SOURCE_TOO_SHORT'};
  if(/__REQUIRED_|TODO|TBD/i.test(text))return {ready:false,text,path:p,reason:'PLACEHOLDER_TEXT_PRESENT'};
  return {ready:true,text,path:p,reason:null};
}
function renderMarkdown(text){
  return String(text).split(/\r?\n/).map(line=>{
    const t=line.trim();if(!t)return '';
    if(/^###\s+/.test(t))return `<h3>${esc(t.replace(/^###\s+/,''))}</h3>`;
    if(/^##?\s+/.test(t))return `<h2>${esc(t.replace(/^##?\s+/,''))}</h2>`;
    if(/^[-*]\s+/.test(t))return `<p class="legal-list-item">• ${esc(t.replace(/^[-*]\s+/,''))}</p>`;
    return `<p>${esc(t)}</p>`;
  }).join('');
}
async function walk(dir){
  const out=[];
  for(const ent of await fs.readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())out.push(...await walk(p));else out.push(p);
  }
  return out;
}
async function hashFiles(root,ignoreRel=new Set()){
  const files=(await walk(root)).sort();const h=crypto.createHash('sha256');
  for(const file of files){const rel=path.relative(root,file).replace(/\\/g,'/');if(ignoreRel.has(rel))continue;h.update(rel);h.update('\0');h.update(await fs.readFile(file));h.update('\0')}
  return h.digest('hex');
}
function rewriteBase(text,site){return String(text).split(PREVIEW_SITE).join(site).split(`${PREVIEW_BASE}/`).join('/').split(PREVIEW_BASE).join('/')}
function setRobotMeta(html,name,value){
  const re=new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["'][^"']*["']\\s*\\/?\s*>`,'i');
  const tag=`<meta name="${name}" content="${value}">`;
  return re.test(html)?html.replace(re,tag):html.replace('</head>',`${tag}</head>`);
}
function replaceArticle(html,title,body){
  const article=`<article class="article"><div class="page-head"><h1>${esc(title)}</h1></div>${body}</article>`;
  return html.replace(/<article class="article">[\s\S]*?<\/article>/i,article);
}
function operatorFooter(config){
  const o=config.operator,c=config.contact;
  return `<div class="shell footer-operator" data-production-operator="1"><p><strong>${esc(o.displayName)}</strong> · ${esc(o.legalName)} · ${esc(o.businessDisclosure)}</p><p>${esc(o.address)} · <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p></div>`;
}
function removeInternalQa(html){
  return String(html)
    .replace(/<p>\s*<strong>품질점수<\/strong>[\s\S]*?<\/p>/gi,'')
    .replace(/<p>[^<]*정식 공개 시 색인 후보[^<]*<\/p>/gi,'')
    .replace(/<span[^>]*>[^<]*정식 공개 시 색인 후보[^<]*<\/span>/gi,'')
    .replace(/\sdata-quality-score="[^"]*"/gi,'')
    .replace(/\sdata-index-candidate="[^"]*"/gi,'');
}
function transformHtml(raw,route,site,config,privacyText,termsText){
  let html=removeInternalQa(rewriteBase(raw,site).replace(/<div class="preview-bar">[\s\S]*?<\/div>/i,''));
  const robots=candidateSet.has(route)?'index,follow':'noindex,nofollow,noarchive,nosnippet';
  for(const name of ['robots','googlebot','bingbot'])html=setRobotMeta(html,name,robots);
  if(route==='/about/'){
    const o=config.operator;
    html=replaceArticle(html,'서비스 소개',`<p>창업데이터랩은 공정거래위원회·공공데이터포털 공개자료를 같은 기준으로 정리하고 업종 중앙값·점포 변화·비용 구성·계산 도구를 연결하는 독립 데이터 서비스입니다. 특정 브랜드의 창업 성공이나 수익을 보장하지 않습니다.</p><h2>운영 정보</h2><div class="table-scroll"><table class="data-table"><tbody><tr><th>서비스 운영명</th><td>${esc(o.displayName)}</td></tr><tr><th>운영주체</th><td>${esc(o.legalName)}</td></tr><tr><th>사업자·운영 정보</th><td>${esc(o.businessDisclosure)}</td></tr><tr><th>주소</th><td>${esc(o.address)}</td></tr><tr><th>문의</th><td><a href="mailto:${esc(config.contact.email)}">${esc(config.contact.email)}</a></td></tr></tbody></table></div>`);
  }
  if(route==='/contact/'){
    html=replaceArticle(html,'문의',`<p>데이터 오류, 브랜드 명칭 매칭, 출처·계산식 오류와 서비스 운영 관련 문의는 아래 연락처로 보내주세요.</p><h2>연락처</h2><p><a href="mailto:${esc(config.contact.email)}">${esc(config.contact.email)}</a></p><p>${esc(config.operator.address)}</p>`);
  }
  if(route==='/privacy/')html=replaceArticle(html,'개인정보처리방침',renderMarkdown(privacyText));
  if(route==='/terms/')html=replaceArticle(html,'이용약관',renderMarkdown(termsText));
  if(!html.includes('data-production-operator="1"'))html=html.replace('</footer>',`${operatorFooter(config)}</footer>`);
  return html;
}
async function writeReport(report){await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2),'utf8')}

if(path.resolve(output)===path.resolve(preview)||path.resolve(output).startsWith(path.resolve(preview)+path.sep)){
  await writeReport({schemaVersion:1,generatedAt,testMode:TEST_MODE,decision:'BLOCKED_UNSAFE_OUTPUT_PATH',outputPath:output});
  throw new Error('Production candidate output must never be the preview directory');
}

let tempLegalDir=null;let config=null;let configSource=null;
if(TEST_MODE){
  tempLegalDir=await fs.mkdtemp(path.join(os.tmpdir(),'franchise-release-legal-'));
  const privacyPath=path.join(tempLegalDir,'privacy.md'),termsPath=path.join(tempLegalDir,'terms.md');
  await fs.writeFile(privacyPath,'# 계약 테스트 개인정보처리방침\n이 문서는 production candidate 생성기의 비공개 계약 테스트에만 사용합니다. 실제 운영 문서가 아닙니다. 개인정보 처리 목적, 수집 항목, 보유 기간, 파기 절차, 이용자 권리, 쿠키 및 광고 식별자, 처리위탁, 안전성 확보 조치, 문의 방법을 테스트하기 위한 문장입니다. '.repeat(5),'utf8');
  await fs.writeFile(termsPath,'# 계약 테스트 이용약관\n이 문서는 production candidate 생성기의 비공개 계약 테스트에만 사용합니다. 실제 운영 약관이 아닙니다. 서비스 이용 조건, 데이터 책임 범위, 금지 행위, 지식재산, 책임 제한, 서비스 변경, 분쟁 처리와 준거 기준을 테스트하기 위한 문장입니다. '.repeat(5),'utf8');
  config={schemaVersion:1,productionSiteUrl:'https://franchise-release-contract.invalid',operator:{displayName:'RELEASE CONTRACT TEST',legalName:'RELEASE CONTRACT TEST ENTITY',businessDisclosure:'TEST ONLY - NOT FOR PUBLICATION',address:'TEST ONLY'},contact:{email:'release-contract@example.invalid'},legal:{privacyPolicySource:privacyPath,termsSource:termsPath},ads:{adsTxtLine:''},releasePolicy:{indexOnlyProductionCandidates:true,keepNonCandidatesNoindex:true,requireManualApprovalBeforeDeploy:true,deployFromDryRun:false}};
  configSource='BUILT_IN_TEST_CONFIG';
}else{
  const raw=String(process.env.SSG_RELEASE_CONFIG||'').trim();
  if(!raw){await writeReport({schemaVersion:1,generatedAt,testMode:false,decision:'BLOCKED_RELEASE_CONFIG_REQUIRED',outputPath:null});process.exitCode=2;process.exit()}
  const p=path.isAbsolute(raw)?raw:path.resolve(repo,raw);config=JSON.parse(await fs.readFile(p,'utf8'));configSource=path.relative(repo,p).replace(/\\/g,'/');
}

const missing=[];
if(TEST_MODE===false&&!validSite(config.productionSiteUrl))missing.push('productionSiteUrl');
if(TEST_MODE===true&&!/^https:\/\/[^/]+\.invalid$/i.test(config.productionSiteUrl))missing.push('testProductionSiteUrl');
for(const [label,value] of [['operator.displayName',config.operator?.displayName],['operator.legalName',config.operator?.legalName],['operator.businessDisclosure',config.operator?.businessDisclosure],['operator.address',config.operator?.address]])if(placeholder(value))missing.push(label);
if(!validEmail(config.contact?.email))missing.push('contact.email');
const privacy=await readLegal(config.legal?.privacyPolicySource),terms=await readLegal(config.legal?.termsSource);
if(!privacy.ready)missing.push(`legal.privacyPolicySource:${privacy.reason}`);
if(!terms.ready)missing.push(`legal.termsSource:${terms.reason}`);
if(config.releasePolicy?.indexOnlyProductionCandidates!==true)missing.push('releasePolicy.indexOnlyProductionCandidates');
if(config.releasePolicy?.keepNonCandidatesNoindex!==true)missing.push('releasePolicy.keepNonCandidatesNoindex');
if(config.releasePolicy?.requireManualApprovalBeforeDeploy!==true)missing.push('releasePolicy.requireManualApprovalBeforeDeploy');
if(config.releasePolicy?.deployFromDryRun!==false)missing.push('releasePolicy.deployFromDryRun');

if(missing.length){
  await writeReport({schemaVersion:1,generatedAt,testMode:TEST_MODE,configSource,decision:'BLOCKED_CONFIG_INCOMPLETE',missing,outputPath:null,candidateCount:candidates.length,expectedHtml});
  if(tempLegalDir)await fs.rm(tempLegalDir,{recursive:true,force:true});
  process.exitCode=TEST_MODE?1:2;process.exit();
}
if(!TEST_MODE&&!MANUAL_APPROVED){
  await writeReport({schemaVersion:1,generatedAt,testMode:false,configSource,decision:'BLOCKED_MANUAL_BUILD_APPROVAL_REQUIRED',missing:[],outputPath:null,candidateCount:candidates.length,expectedHtml});
  process.exitCode=2;process.exit();
}
if((authority.graph?.candidateHtmlMissing||[]).length||(authority.graph?.unreachableCandidates||[]).length||(authority.graph?.orphanCandidates||[]).length)throw new Error('Internal authority graph is not safe for a production candidate build');

const site=String(config.productionSiteUrl).replace(/\/$/,'');
const previewHashBefore=await hashFiles(preview,previewHashIgnore);
await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output,{recursive:true});
const files=await walk(preview);let copiedFiles=0,htmlCount=0;
for(const src of files){
  const rel=path.relative(preview,src).replace(/\\/g,'/');const ext=path.extname(rel).toLowerCase();
  const isHtml=ext==='.html',isAsset=rel.startsWith('assets/');
  if(!isHtml&&!isAsset)continue;
  const dst=path.join(output,...rel.split('/'));await fs.mkdir(path.dirname(dst),{recursive:true});
  if(isHtml){const raw=await fs.readFile(src,'utf8'),route=routeFromHtml(rel);const next=transformHtml(raw,route,site,config,privacy.text,terms.text);await fs.writeFile(dst,next,'utf8');htmlCount++;copiedFiles++;continue}
  if(['.css','.js','.svg','.txt','.xml','.webmanifest','.json'].includes(ext)){const raw=await fs.readFile(src,'utf8');await fs.writeFile(dst,rewriteBase(raw,site),'utf8')}else await fs.copyFile(src,dst);
  copiedFiles++;
}
if(htmlCount!==expectedHtml)throw new Error(`HTML route count mismatch ${htmlCount}/${expectedHtml}`);

const today=generatedAt.slice(0,10);
const sitemapUrls=candidates.map(route=>route==='/'?`${site}/`:`${site}${route}`);
const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(url=>`  <url><loc>${esc(url)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
await fs.writeFile(path.join(output,'sitemap.xml'),sitemap,'utf8');
await fs.writeFile(path.join(output,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`,'utf8');
const adsLine=String(config.ads?.adsTxtLine||'').trim();if(adsLine&&!placeholder(adsLine))await fs.writeFile(path.join(output,'ads.txt'),adsLine+'\n','utf8');

const previewHashAfter=await hashFiles(preview,previewHashIgnore);if(previewHashAfter!==previewHashBefore)throw new Error('Preview tree mutated during production candidate build');
const outputHash=await hashFiles(output);
const report={schemaVersion:1,generatedAt,testMode:TEST_MODE,policy:'SEPARATE_OUTPUT_ONLY; NEVER_DEPLOY; PREVIEW_IMMUTABLE; INDEX_ONLY_VALIDATED_CANDIDATES; MANUAL_BUILD_APPROVAL_REQUIRED_IN_REAL_MODE',decision:'PRODUCTION_CANDIDATE_BUILT_NOT_DEPLOYED',configSource,productionSite:TEST_MODE?'RESERVED_TEST_ORIGIN':site,outputPath:output,candidateCount:candidates.length,nonCandidateCount:htmlCount-candidates.length,htmlCount,copiedFiles,sitemapUrlCount:sitemapUrls.length,adsTxtIncluded:Boolean(adsLine&&!placeholder(adsLine)),previewHashBefore,previewHashAfter,previewHashIgnored:[...previewHashIgnore],previewUnchanged:previewHashBefore===previewHashAfter,outputHash,sideEffects:{previewMutated:false,deployed:false,indexingChangedOnPreview:false}};
await writeReport(report);
if(tempLegalDir)await fs.rm(tempLegalDir,{recursive:true,force:true});
console.log(JSON.stringify({productionCandidateBuild:'PASS',testMode:TEST_MODE,candidates:candidates.length,nonCandidates:htmlCount-candidates.length,htmlCount,sitemapUrls:sitemapUrls.length,previewUnchanged:true,outputHash},null,2));
