import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const report=JSON.parse(await fs.readFile(path.join(out,'v11-24-content-polish.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const candidates=(quality.indexPolicy?.productionCandidateUrls||[]).map(normalizeRoute);
const errors=[];

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split('#')[0].split('?')[0].replace(/^\/+|\/+$/g,'')}/`}
function routeFile(route){return route==='/'?path.join(out,'index.html'):path.join(out,...route.split('/').filter(Boolean),'index.html')}
function decode(text){return String(text).replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")}
function textOnly(html){const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||html;return decode(main.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<svg\b[\s\S]*?<\/svg>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function description(html){return decode(html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1]||'')}

if(report.uiVersion!=='11.24')errors.push(`report uiVersion ${report.uiVersion}`);
if(report.productionCandidateCount!==candidates.length)errors.push(`candidate count ${report.productionCandidateCount}/${candidates.length}`);
if(manifest.v11_24?.contentPolish!==true)errors.push('manifest v11_24 contentPolish marker missing');
if(manifest.v11_24?.candidateSetChanged!==false)errors.push('v11.24 must not change candidate set');
if((report.descriptionRoutes||[]).length!==7)errors.push(`description route count ${(report.descriptionRoutes||[]).length}`);
if((report.contentRoutes||[]).length!==6)errors.push(`content route count ${(report.contentRoutes||[]).length}`);

for(const route of report.descriptionRoutes||[]){
  const html=await fs.readFile(routeFile(route),'utf8');const d=description(html);
  if(d.length<35)errors.push(`${route}: description too short ${d.length}`);
  if(/소개과|문의과|고지과|과 데이터 처리 원칙/.test(d))errors.push(`${route}: awkward generic description remains`);
  if(!/noindex,nofollow,noarchive,nosnippet/.test(html))errors.push(`${route}: preview noindex missing`);
}

const thresholds={'/categories/':800,'/contact/':250,'/disclaimer/':250,'/tools/break-even/':650,'/tools/open-close-rate/':650,'/updates/':250};
for(const route of report.contentRoutes||[]){
  const html=await fs.readFile(routeFile(route),'utf8');const text=textOnly(html);const key=route.replace(/^\/|\/$/g,'').replace(/[^a-zA-Z0-9가-힣_-]+/g,'-')||'home';
  const markerCount=(html.match(new RegExp(`data-v11-24-polish="${key}"`,'g'))||[]).length;
  if(markerCount!==1)errors.push(`${route}: v11.24 block count ${markerCount}`);
  if(text.length<(thresholds[route]||0))errors.push(`${route}: visible text ${text.length}/${thresholds[route]}`);
  if(!/noindex,nofollow,noarchive,nosnippet/.test(html))errors.push(`${route}: preview noindex missing`);
}

const contact=await fs.readFile(routeFile('/contact/'),'utf8');
if(/mailto:|@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i.test(contact))errors.push('/contact/: fake or unresolved contact must not be introduced in preview');
const updates=await fs.readFile(routeFile('/updates/'),'utf8');
if(/production gate/i.test(textOnly(updates)))errors.push('/updates/: internal production-gate wording remains visible');
const category=await fs.readFile(routeFile('/categories/'),'utf8');
if(!category.includes('업종 중앙값은 이렇게 읽습니다'))errors.push('/categories/: median interpretation section missing');
const breakEven=await fs.readFile(routeFile('/tools/break-even/'),'utf8');
if(!breakEven.includes('한 번의 결과보다 조건을 바꿔 비교하세요'))errors.push('/tools/break-even/: sensitivity section missing');
const openClose=await fs.readFile(routeFile('/tools/open-close-rate/'),'utf8');
if(!openClose.includes('분모와 기간을 맞춥니다'))errors.push('/tools/open-close-rate/: denominator-period guidance missing');

if(errors.length){console.error(JSON.stringify({v11_24Validation:'FAIL',errors,report},null,2));process.exit(1)}
console.log(JSON.stringify({v11_24Validation:'PASS',productionCandidates:candidates.length,descriptionTargets:report.descriptionRoutes.length,contentTargets:report.contentRoutes.length},null,2));
