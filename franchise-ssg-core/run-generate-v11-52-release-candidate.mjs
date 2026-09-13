import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE='/pm-lab/franchise-ssg-preview';
const PREVIEW='https://5ggul.github.io/pm-lab/franchise-ssg-preview';
const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
if(manifest.uiVersion!=='11.51')throw new Error(`v11.52 requires v11.51 baseline, got ${manifest.uiVersion}`);
if(candidates.length!==184)throw new Error(`v11.52 candidate baseline ${candidates.length}`);

const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);

const routeFromFile=file=>{const rel=path.relative(out,file).split(path.sep).join('/');if(rel==='index.html')return '/';if(rel.endsWith('/index.html'))return '/'+rel.slice(0,-'index.html'.length);return '/'+rel;};
const routeMap=new Map(htmlFiles.map(f=>[routeFromFile(f),f]));
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');
const strip=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const decodeSafe=s=>{try{return decodeURIComponent(s)}catch{return s}};
function internalPageRoute(href){
  if(!href||href.startsWith('#')||/^(mailto:|tel:|javascript:)/i.test(href))return null;
  let p=href;
  if(/^https?:\/\//i.test(p)){try{const u=new URL(p);if(`${u.origin}${u.pathname}`.startsWith(PREVIEW))p=u.pathname+u.search+u.hash;else return null}catch{return null}}
  if(!p.startsWith(BASE))return null;
  p=p.slice(BASE.length)||'/';
  p=p.split('#')[0].split('?')[0]||'/';
  p=decodeSafe(p);
  if(!p.startsWith('/'))p='/'+p;
  if(p.startsWith('/assets/'))return null;
  if(p!=='/'&&!path.posix.extname(p)&&!p.endsWith('/'))p+='/';
  return p;
}
function internalAssetPath(ref){
  if(!ref)return null;
  let p=ref;
  if(/^https?:\/\//i.test(p)){try{const u=new URL(p);if(`${u.origin}${u.pathname}`.startsWith(PREVIEW))p=u.pathname;else return null}catch{return null}}
  if(!p.startsWith(BASE+'/assets/'))return null;
  return decodeSafe(p.slice(BASE.length+1));
}
function duplicateGroups(map){return [...map.entries()].filter(([,routes])=>routes.length>1).map(([value,routes])=>({value,routes}));}

const candidateSet=new Set(candidates);
const titleMap=new Map(),h1Map=new Map(),descMap=new Map(),canonicalMap=new Map();
const brokenLinks=[],missingAssets=[],candidateIssues=[],allLinkRefs=[];
let totalInternalLinks=0,totalInternalAssets=0,viewportMeta=0,imgCount=0,imgMissingAlt=0;

for(const file of htmlFiles){
  let html=await fs.readFile(file,'utf8');
  const route=routeFromFile(file);
  html=html.replace(/<body\b([^>]*)>/i,(full,attrs)=>{let a=attrs||'';a=a.replace(/\bclass="([^"]*)"/i,(m,c)=>{const list=c.split(/\s+/).filter(Boolean);if(!list.includes('v52-release-candidate'))list.push('v52-release-candidate');return `class="${list.join(' ')}"`});if(!/\bclass="/i.test(a))a+=' class="v52-release-candidate"';a=a.replace(/\sdata-v52-release-candidate="[^"]*"/gi,'');a+=' data-v52-release-candidate="1"';return `<body${a}>`});
  await fs.writeFile(file,html,'utf8');
  if(/<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/i.test(html))viewportMeta++;
  for(const m of html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)){const target=internalPageRoute(m[1]);if(!target)continue;totalInternalLinks++;allLinkRefs.push([route,target]);if(!routeMap.has(target))brokenLinks.push({from:route,to:target,href:m[1]})}
  for(const m of html.matchAll(/<(?:script|img|link)\b[^>]*(?:src|href)="([^"]+)"/gi)){const asset=internalAssetPath(m[1]);if(!asset)continue;totalInternalAssets++;try{await fs.access(path.join(out,asset))}catch{missingAssets.push({from:route,asset})}}
  for(const m of html.matchAll(/<img\b([^>]*)>/gi)){imgCount++;if(!/\balt="[^"]*"/i.test(m[1]))imgMissingAlt++}
  if(!candidateSet.has(route))continue;
  const title=strip(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
  const desc=html.match(/<meta name="description" content="([^"]*)">/i)?.[1]?.trim()||'';
  const h1s=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>strip(m[1])).filter(Boolean);
  const canonical=html.match(/<link rel="canonical" href="([^"]+)">/i)?.[1]||'';
  if(!title)candidateIssues.push({route,issue:'missing-title'});
  if(!desc)candidateIssues.push({route,issue:'missing-description'});
  if(h1s.length!==1)candidateIssues.push({route,issue:`h1-count-${h1s.length}`});
  if(!canonical||!canonical.startsWith(PREVIEW))candidateIssues.push({route,issue:'canonical-off-preview'});
  if(!html.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))candidateIssues.push({route,issue:'preview-noindex-missing'});
  for(const [map,val] of [[titleMap,title],[descMap,desc],[h1Map,h1s[0]||''],[canonicalMap,canonical]]){if(!val)continue;if(!map.has(val))map.set(val,[]);map.get(val).push(route)}
}

const titleDuplicates=duplicateGroups(titleMap),descriptionDuplicates=duplicateGroups(descMap),h1Duplicates=duplicateGroups(h1Map),canonicalDuplicates=duplicateGroups(canonicalMap);
const rcReady=htmlFiles.length===311&&viewportMeta===311&&brokenLinks.length===0&&missingAssets.length===0&&candidateIssues.length===0&&titleDuplicates.length===0&&descriptionDuplicates.length===0&&h1Duplicates.length===0&&canonicalDuplicates.length===0&&imgMissingAlt===0;

manifest.uiVersion='11.52';
manifest.v11_52={releaseCandidateAudit:true,allInternalLinksChecked:true,assetsChecked:true,searchIntentCollisionAudit:true,singleH1Audit:true,imageAltAudit:true,viewportCoverageAudit:true,v42VisualLanguagePreserved:true,candidateSetChanged:false,indexPolicyChanged:false,dataSemanticsChanged:false,productionDeployed:false,rcReady};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
const report={schemaVersion:1,uiVersion:'11.52',generatedAt:new Date().toISOString(),htmlPages:htmlFiles.length,candidatePages:candidates.length,viewportMeta,totalInternalLinks,brokenInternalLinks:brokenLinks,totalInternalAssets,missingAssets,candidateIssues,titleDuplicateGroups:titleDuplicates,descriptionDuplicateGroups:descriptionDuplicates,h1DuplicateGroups:h1Duplicates,canonicalDuplicateGroups:canonicalDuplicates,imageCount:imgCount,imageMissingAlt:imgMissingAlt,rcReady,productionDeployed:false};
await fs.writeFile(path.join(out,'v11-52-release-candidate.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({...report,brokenInternalLinks:brokenLinks.slice(0,30),missingAssets:missingAssets.slice(0,30),candidateIssues:candidateIssues.slice(0,30)},null,2));
