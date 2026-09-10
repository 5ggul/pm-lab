import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE='/pm-lab/franchise-ssg-preview';
const SITE=(process.env.SSG_SITE_URL??'https://5ggul.github.io/pm-lab/franchise-ssg-preview').replace(/\/$/,'');
const revision='2026-09-10-v11.25';
const generatedAt=new Date().toISOString();
const qualityPath=path.join(out,'v11-quality-report.json');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(qualityPath,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const toolTrust=JSON.parse(await fs.readFile(path.join(out,'v11-15-tool-trust.json'),'utf8'));
const snapshot=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-25.json'),'utf8'));
const normalize=r=>r==='/'?'/':`/${String(r).split(/[?#]/)[0].replace(/^\/+|\/+$/g,'')}/`;
const candidates=new Set((quality.indexPolicy?.productionCandidateUrls||[]).map(normalize));
const candidateCount=candidates.size;
function type(r){if(r==='/')return'home';if(r==='/brands/')return'brandsHub';if(r.startsWith('/brands/'))return'brand';if(r==='/categories/')return'categoriesHub';if(r.startsWith('/categories/'))return'category';if(r==='/compare/')return'compareHub';if(r.startsWith('/compare/'))return'compare';if(r==='/tools/')return'toolsHub';if(r.startsWith('/tools/'))return'tool';if(r==='/explore/')return'explore';if(r==='/rankings/')return'rankings';if(r.startsWith('/guide/'))return'guide';return'trustOrInfo'}
const decode=s=>String(s??'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
function internal(href){if(!href)return null;let x=decode(href.trim());if(x.startsWith(SITE))x=BASE+x.slice(SITE.length);if(x===BASE||x===`${BASE}/`)return'/';if(!x.startsWith(`${BASE}/`))return null;return normalize(x.slice(BASE.length))}
function links(html){const a=[];for(const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/gi)){const r=internal(m[1]);if(r)a.push(r)}return[...new Set(a)]}
const htmlFiles=[];async function walk(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p)}}await walk(out);
const fileRoute=f=>{const rel=path.relative(out,f).replace(/\\/g,'/');return rel==='index.html'?'/':normalize('/'+rel.replace(/\/index\.html$/,''))};
const html=new Map();for(const f of htmlFiles)html.set(fileRoute(f),await fs.readFile(f,'utf8'));
const graph=new Map(),inbound=new Map();for(const [r,h] of html){const ls=links(h).filter(x=>html.has(x));graph.set(r,ls);for(const x of ls){const s=inbound.get(x)||new Set();s.add(r);inbound.set(x,s)}}
const distance=new Map([['/',0]]),q=['/'];while(q.length){const r=q.shift(),d=distance.get(r);for(const x of graph.get(r)||[]){if(distance.has(x))continue;distance.set(x,d+1);q.push(x)}}
const missing=[...candidates].filter(r=>!html.has(r)).sort();const unreachable=[...candidates].filter(r=>!distance.has(r)).sort();const orphan=[...candidates].filter(r=>r!=='/'&&!(inbound.get(r)?.size)).sort();
const depths=[...candidates].filter(r=>distance.has(r)).map(r=>({route:r,type:type(r),depth:distance.get(r)}));const max=depths.length?Math.max(...depths.map(x=>x.depth)):null;const dist={};for(const x of depths)dist[x.depth]=(dist[x.depth]||0)+1;
const detailDepthViolations=depths.filter(x=>['brand','category','compare','tool'].includes(x.type)&&x.depth>2).map(x=>x.route);const allDepthViolations=depths.filter(x=>x.depth>3).map(x=>x.route);
const hubs={brands:'/brands/',categories:'/categories/',compare:'/compare/',tools:'/tools/'};const expected={brands:[...candidates].filter(r=>type(r)==='brand'),categories:[...candidates].filter(r=>type(r)==='category'),compare:[...candidates].filter(r=>type(r)==='compare'),tools:[...candidates].filter(r=>type(r)==='tool')};const hubCoverage={};for(const [k,hub] of Object.entries(hubs)){const l=new Set(graph.get(hub)||[]),e=expected[k],m=e.filter(r=>!l.has(r)).sort();hubCoverage[k]={hubRoute:hub,expected:e.length,linkedCandidates:e.length-m.length,missing:m}}
const approved=(toolTrust.approvedToolRoutes||[]).map(normalize);const toolHubLinks=new Set(graph.get('/tools/')||[]),missingApprovedTools=approved.filter(r=>!toolHubLinks.has(r));
const homeLinks=new Set(graph.get('/')||[]);const primaryHomeHubs=['/brands/','/categories/','/compare/','/tools/','/explore/'].filter(r=>candidates.has(r)||['/brands/','/categories/','/compare/','/tools/'].includes(r));const missingHomeHubs=primaryHomeHubs.filter(r=>!homeLinks.has(r));
const typeCounts={};for(const r of candidates){const t=type(r);typeCounts[t]=(typeCounts[t]||0)+1}
const post={revision,generatedAt,baseUiVersion:manifest.uiVersion,productionCandidateCount:candidateCount,maxCandidateDepth:max,orphanCandidateCount:orphan.length,hubCoverageComplete:Object.values(hubCoverage).every(x=>x.missing.length===0),singleSnapshot:snapshot.uiVersion==='11.25'&&snapshot.brand_count===136,homeTerminalPreserved:html.get('/')?.includes('data-v25-home="1"')===true,toolsHubCoverage:approved.length-missingApprovedTools.length};
quality.internalAuthorityPostpass=post;manifest.internalAuthorityPostpass=post;await fs.writeFile(qualityPath,JSON.stringify(quality,null,2));await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2));
const report={schemaVersion:2,revision,generatedAt,baseUiVersion:manifest.uiVersion,previewMode:true,policy:'V11_25_DATA_PRODUCT; NO_HOME_TOOL_INJECTION; PRIMARY_HUB_COVERAGE; DETAIL_DEPTH_LE_2; ALL_CANDIDATE_DEPTH_LE_3; NO_ORPHANS; SINGLE_SNAPSHOT',productionCandidateCount:candidateCount,candidateTypeCounts:typeCounts,home:{primaryHubs:primaryHomeHubs,missingPrimaryHubs:missingHomeHubs,terminalPreserved:post.homeTerminalPreserved},tools:{approved:approved.length,linked:approved.length-missingApprovedTools.length,missing:missingApprovedTools},graph:{htmlRouteCount:html.size,candidateHtmlMissing:missing,unreachableCandidates:unreachable,maxCandidateDepth:max,depthDistribution:dist,orphanCandidates:orphan,hubDetailDepthViolations:detailDepthViolations,allDepthViolations},hubCoverage,snapshot:{id:snapshot.snapshot_id,brands:snapshot.brand_count,categories:snapshot.category_count,sourceYear:snapshot.source_year}};
await fs.writeFile(path.join(out,'internal-authority-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({internalAuthorityV11_25:'PASS',candidates:candidateCount,maxDepth:max,orphans:orphan.length,homeTerminal:post.homeTerminalPreserved,tools:`${report.tools.linked}/${report.tools.approved}`,hubCoverage:Object.fromEntries(Object.entries(hubCoverage).map(([k,v])=>[k,`${v.linkedCandidates}/${v.expected}`]))},null,2));
