import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const preview=path.join(repo,'docs/franchise-ssg-preview');
const TEST_MODE=String(process.env.SSG_RELEASE_TEST_MODE||'').toLowerCase()==='true';
const defaultReport=TEST_MODE?path.join(preview,'production-candidate-contract-test.json'):path.join(repo,'build/franchise-production-candidate-report.json');
const reportPath=path.resolve(process.env.SSG_PRODUCTION_CANDIDATE_REPORT||defaultReport);
const report=JSON.parse(await fs.readFile(reportPath,'utf8'));
const output=path.resolve(process.env.SSG_PRODUCTION_OUTPUT||report.outputPath||path.join(repo,'build/franchise-production-candidate'));
const candidates=[...(report.effectiveCandidateUrls||[])].map(normalizeRoute);
const candidateSet=new Set(candidates);
const expectedSite=TEST_MODE?'https://franchise-release-contract.invalid':String(report.productionSite||'').replace(/\/$/,'');
const aliasDemotions=new Map((report.canonicalAliasDemotions||[]).map(x=>[normalizeRoute(x.route),normalizeRoute(x.canonicalRoute)]));

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split('#')[0].split('?')[0].replace(/^\/+|\/+$/g,'')}/`}
function routeFromHtml(rel){const p=rel.replace(/\\/g,'/');return p==='index.html'?'/':normalizeRoute('/'+p.replace(/\/index\.html$/,''))}
async function walk(dir){const out=[];for(const ent of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())out.push(...await walk(p));else out.push(p)}return out}
function decode(text){return String(text).replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")}
function textOnly(html){const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||html;return decode(main.replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<svg\b[\s\S]*?<\/svg>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}
function meta(html,name){return html.match(new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`,'i'))?.[1]||html.match(new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+name=["']${name}["']`,'i'))?.[1]||null}
function title(html){return decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g,' ').trim()||'')}
function description(html){return decode(meta(html,'description')||'')}
function canonical(html){return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]||html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1]||null}
function h1s(html){return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>decode(m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()))}
function jsonLd(html){return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1].trim())}
function routeType(route){if(route==='/')return 'home';if(route==='/brands/')return 'brandsHub';if(route.startsWith('/brands/'))return 'brand';if(route==='/categories/')return 'categoriesHub';if(route.startsWith('/categories/'))return 'category';if(route==='/compare/')return 'compareHub';if(route.startsWith('/compare/'))return 'compare';if(route==='/tools/')return 'toolsHub';if(route.startsWith('/tools/'))return 'tool';if(route.startsWith('/guide/'))return 'guide';if(['/explore/','/rankings/','/cost-components/'].includes(route))return 'intentHub';return 'trustOrInfo'}
function expectedCanonical(route){return route==='/'?`${expectedSite}/`:`${expectedSite}${route}`}
function hardMin(type){return ({home:450,brandsHub:500,categoriesHub:450,compareHub:450,toolsHub:450,brand:1300,category:850,compare:850,tool:450,guide:700,intentHub:700,trustOrInfo:80})[type]||300}
function warnMin(type){return ({home:900,brandsHub:900,categoriesHub:800,compareHub:800,toolsHub:800,brand:1800,category:1200,compare:1100,tool:650,guide:1000,intentHub:1000,trustOrInfo:250})[type]||500}
function sha(text){return crypto.createHash('sha256').update(text).digest('hex')}
function internalLinks(html){return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({href:m[1],text:decode(m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())}))}

if(!candidates.length)throw new Error('SEO audit requires finalized effectiveCandidateUrls');
const files=await walk(output);const htmlFiles=files.filter(f=>f.endsWith('.html'));
const byRoute=new Map(htmlFiles.map(f=>[routeFromHtml(path.relative(output,f)),f]));
const rows=[];const blockers=[];const warnings=[];
const titleMap=new Map(),descMap=new Map(),canonicalMap=new Map(),textHashMap=new Map();
const genericAnchors=new Set(['여기','보기','자세히','자세히 보기','더보기','확인','확인하기','바로가기','클릭']);

for(const route of candidates){
  const file=byRoute.get(route);if(!file){blockers.push({code:'CANDIDATE_HTML_MISSING',route});continue}
  const html=await fs.readFile(file,'utf8');const type=routeType(route);const t=title(html),d=description(html),h=h1s(html),can=canonical(html),body=textOnly(html),lds=jsonLd(html),links=internalLinks(html);
  const jsonErrors=[];for(const raw of lds){try{JSON.parse(raw)}catch(e){jsonErrors.push(String(e.message||e))}}
  const internal=links.filter(x=>x.href.startsWith('/')&&!x.href.startsWith('//'));
  const generic=internal.filter(x=>genericAnchors.has(x.text.trim()));
  const aliasLinks=internal.map(x=>normalizeRoute(x.href)).filter(r=>aliasDemotions.has(r));
  const metrics={route,type,title:t,titleChars:t.length,description:d,descriptionChars:d.length,h1Count:h.length,h1:h[0]||null,canonical:can,visibleTextChars:body.length,jsonLdCount:lds.length,jsonLdErrors:jsonErrors.length,internalLinks:internal.length,genericAnchors:generic.length,aliasLinks:[...new Set(aliasLinks)]};
  rows.push(metrics);

  if(meta(html,'robots')!=='index,follow')blockers.push({code:'INDEX_CANDIDATE_ROBOTS_NOT_INDEX',route,value:meta(html,'robots')});
  if(!t)blockers.push({code:'TITLE_MISSING',route});
  if(!d)blockers.push({code:'META_DESCRIPTION_MISSING',route});
  if(t.length>75||t.length<8)warnings.push({code:'TITLE_LENGTH_REVIEW',route,value:t.length});
  if(d.length>200||d.length<35)warnings.push({code:'META_DESCRIPTION_LENGTH_REVIEW',route,value:d.length});
  if(h.length!==1)blockers.push({code:'H1_COUNT_NOT_ONE',route,value:h.length});
  if(can!==expectedCanonical(route))blockers.push({code:'INDEX_CANDIDATE_NOT_SELF_CANONICAL',route,canonical:can,expected:expectedCanonical(route)});
  if(body.length<hardMin(type))blockers.push({code:'VISIBLE_TEXT_TOO_THIN',route,type,value:body.length,min:hardMin(type)});else if(body.length<warnMin(type))warnings.push({code:'VISIBLE_TEXT_DEPTH_REVIEW',route,type,value:body.length,target:warnMin(type)});
  if(['brand','category','compare'].includes(type)&&lds.length===0)blockers.push({code:'STRUCTURED_DATA_MISSING',route,type});
  if(jsonErrors.length)blockers.push({code:'JSON_LD_INVALID',route,errors:jsonErrors.slice(0,3)});
  if(/주소\s*안내|주소가\s*정리되었습니다|정식 공개 시 색인 후보|품질점수\s*\d+\s*\/\s*100|외부 검수용 프리뷰/i.test(body+' '+t+' '+d))blockers.push({code:'INTERNAL_OR_ALIAS_COPY_VISIBLE',route});
  if(generic.length)warnings.push({code:'GENERIC_INTERNAL_ANCHOR',route,count:generic.length,examples:generic.slice(0,5)});
  if(aliasLinks.length)warnings.push({code:'LINKS_TO_CANONICAL_ALIAS',route,count:[...new Set(aliasLinks)].length,aliases:[...new Set(aliasLinks)].slice(0,10)});

  const normalizedBody=body.replace(/\d[\d,.%/년월개만원원㎡평-]*/g,'#').replace(/\s+/g,' ').trim();
  const bodyHash=sha(normalizedBody);
  for(const [map,key,value] of [[titleMap,t,route],[descMap,d,route],[canonicalMap,can,route],[textHashMap,bodyHash,route]]){if(!map.has(key))map.set(key,[]);map.get(key).push(value)}
}

for(const [value,routes] of titleMap)if(value&&routes.length>1)blockers.push({code:'DUPLICATE_TITLE',value,routes});
for(const [value,routes] of descMap)if(value&&routes.length>1)blockers.push({code:'DUPLICATE_META_DESCRIPTION',value,routes});
for(const [value,routes] of canonicalMap)if(value&&routes.length>1)blockers.push({code:'DUPLICATE_CANONICAL',value,routes});
for(const [value,routes] of textHashMap)if(routes.length>1)blockers.push({code:'EXACT_TEMPLATE_TEXT_DUPLICATE_AFTER_NUMBER_NORMALIZATION',hash:value,routes});

const sitemap=await fs.readFile(path.join(output,'sitemap.xml'),'utf8').catch(()=> '');
const locs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
const expectedUrls=candidates.map(expectedCanonical);const locSet=new Set(locs),expectedSet=new Set(expectedUrls);
if(locs.length!==expectedUrls.length)blockers.push({code:'SITEMAP_COUNT_MISMATCH',value:locs.length,expected:expectedUrls.length});
for(const url of expectedUrls)if(!locSet.has(url))blockers.push({code:'SITEMAP_MISSING_EFFECTIVE_CANDIDATE',url});
for(const url of locs)if(!expectedSet.has(url))blockers.push({code:'SITEMAP_CONTAINS_NON_EFFECTIVE_URL',url});

const seoAudit={status:blockers.length?'FAIL':'PASS',auditedAt:new Date().toISOString(),effectiveCandidateCount:candidates.length,demotedCanonicalAliasCount:aliasDemotions.size,blockerCount:blockers.length,warningCount:warnings.length,blockers:blockers.slice(0,100),warnings:warnings.slice(0,200),summary:{duplicateTitles:blockers.filter(x=>x.code==='DUPLICATE_TITLE').length,duplicateDescriptions:blockers.filter(x=>x.code==='DUPLICATE_META_DESCRIPTION').length,duplicateCanonicals:blockers.filter(x=>x.code==='DUPLICATE_CANONICAL').length,thinPages:blockers.filter(x=>x.code==='VISIBLE_TEXT_TOO_THIN').length,jsonLdInvalid:blockers.filter(x=>x.code==='JSON_LD_INVALID').length,nonSelfCanonicals:blockers.filter(x=>x.code==='INDEX_CANDIDATE_NOT_SELF_CANONICAL').length,aliasLinkWarnings:warnings.filter(x=>x.code==='LINKS_TO_CANONICAL_ALIAS').length},rows};
report.seoAudit=seoAudit;
await fs.writeFile(reportPath,JSON.stringify(report,null,2),'utf8');
if(blockers.length){console.error(JSON.stringify({productionSeoAudit:'FAIL',effectiveCandidates:candidates.length,blockers:blockers.slice(0,30),warnings:warnings.slice(0,20)},null,2));process.exit(1)}
console.log(JSON.stringify({productionSeoAudit:'PASS',effectiveCandidates:candidates.length,demotedCanonicalAliases:aliasDemotions.size,warnings:warnings.length,summary:seoAudit.summary},null,2));
