import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
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
const quality=JSON.parse(await fs.readFile(path.join(preview,'v11-quality-report.json'),'utf8'));
const requested=[...(quality.indexPolicy?.productionCandidateUrls||[])].map(normalizeRoute);
const requestedSet=new Set(requested);
const expectedSite=TEST_MODE?'https://franchise-release-contract.invalid':String(report.productionSite||'').replace(/\/$/,'');

function normalizeRoute(r){return r==='/'?'/':`/${String(r).split('#')[0].split('?')[0].replace(/^\/+|\/+$/g,'')}/`}
function routeFromHtml(rel){const p=rel.replace(/\\/g,'/');return p==='index.html'?'/':normalizeRoute('/'+p.replace(/\/index\.html$/,''))}
async function walk(dir){const out=[];for(const ent of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())out.push(...await walk(p));else out.push(p)}return out}
async function hashFiles(root){const files=(await walk(root)).sort();const h=crypto.createHash('sha256');for(const file of files){h.update(path.relative(root,file).replace(/\\/g,'/'));h.update('\0');h.update(await fs.readFile(file));h.update('\0')}return h.digest('hex')}
function canonical(html){return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]||html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1]||null}
function setRobotMeta(html,name,value){const re=new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["'][^"']*["']\\s*\\/?\s*>`,'i');const tag=`<meta name="${name}" content="${value}">`;return re.test(html)?html.replace(re,tag):html.replace('</head>',`${tag}</head>`)}
function canonicalRoute(url){try{const u=new URL(url);const site=new URL(expectedSite);if(u.origin!==site.origin)return null;return normalizeRoute(u.pathname)}catch{return null}}
function escXml(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}

const files=await walk(output);
const htmlFiles=files.filter(f=>f.endsWith('.html'));
const htmlByRoute=new Map(htmlFiles.map(f=>[routeFromHtml(path.relative(output,f)),f]));
const demotions=[];
const offOriginCanonicals=[];

for(const route of requested){
  const file=htmlByRoute.get(route);if(!file)continue;
  let html=await fs.readFile(file,'utf8');
  const can=canonical(html);
  if(!can)continue;
  const target=canonicalRoute(can);
  if(target===null){offOriginCanonicals.push({route,canonical:can});continue}
  if(target!==route){
    demotions.push({route,canonicalRoute:target,targetRequestedCandidate:requestedSet.has(target)});
    const robots='noindex,nofollow,noarchive,nosnippet';
    for(const name of ['robots','googlebot','bingbot'])html=setRobotMeta(html,name,robots);
    await fs.writeFile(file,html,'utf8');
  }
}

if(offOriginCanonicals.length)throw new Error(`Requested candidates contain off-origin canonicals: ${JSON.stringify(offOriginCanonicals.slice(0,10))}`);
const demotedSet=new Set(demotions.map(x=>x.route));
const effective=requested.filter(route=>!demotedSet.has(route));
const effectiveSet=new Set(effective);
for(const d of demotions){if(!htmlByRoute.has(d.canonicalRoute))throw new Error(`Canonical alias target HTML missing: ${d.route} -> ${d.canonicalRoute}`);if(!effectiveSet.has(d.canonicalRoute))throw new Error(`Canonical alias target is not an effective candidate: ${d.route} -> ${d.canonicalRoute}`)}

const today=String(report.generatedAt||new Date().toISOString()).slice(0,10);
const sitemapUrls=effective.map(route=>route==='/'?`${expectedSite}/`:`${expectedSite}${route}`);
const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(url=>`  <url><loc>${escXml(url)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
await fs.writeFile(path.join(output,'sitemap.xml'),sitemap,'utf8');

report.requestedCandidateCount=requested.length;
report.candidateCount=effective.length;
report.nonCandidateCount=htmlFiles.length-effective.length;
report.sitemapUrlCount=effective.length;
report.effectiveCandidateUrls=effective;
report.indexPolicyFinalized=true;
report.indexPolicyFinalizedAt=new Date().toISOString();
report.canonicalAliasDemotions=demotions;
report.outputHash=await hashFiles(output);
await fs.writeFile(reportPath,JSON.stringify(report,null,2),'utf8');

console.log(JSON.stringify({productionIndexPolicy:'PASS',requestedCandidates:requested.length,effectiveCandidates:effective.length,demotedCanonicalAliases:demotions.length,nonCandidates:report.nonCandidateCount,sitemapUrls:effective.length,outputHash:report.outputHash,demotions},null,2));
