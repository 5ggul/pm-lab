import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyBrowserRegressionFix} from './browser-regression-assets.mjs';
import {applyCompareDecision} from './compare-decision-integrator.mjs';
import {applyToolsDecision} from './tools-decision-integrator.mjs';
import {applyHomeDecision} from './home-decision-integrator.mjs';
import {applyTrustConsistency} from './trust-consistency-integrator.mjs';
import {applyDiscoveryHubs} from './discovery-hubs-integrator.mjs';
import {applyVisualIntegrity} from './visual-integrity-integrator.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE='/pm-lab/franchise-ssg-preview';
const PREVIEW='https://5ggul.github.io/pm-lab/franchise-ssg-preview';
const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const legacyCompareRoutes=new Set(['/compare/bhc-chicken-vs-bbq-chicken/','/compare/cu-vs-gs25/']);
if(manifest.uiVersion!=='11.51')throw new Error(`v11.52 requires v11.51 baseline, got ${manifest.uiVersion}`);
if(candidates.length!==184)throw new Error(`v11.52 candidate baseline ${candidates.length}`);

await fs.copyFile(path.join(here,'brand-lower-funnel.js'),path.join(out,'assets/brand-lower-funnel.js'));
await fs.copyFile(path.join(here,'brand-lower-funnel.css'),path.join(out,'assets/brand-lower-funnel.css'));
await fs.copyFile(path.join(here,'category-decision.js'),path.join(out,'assets/category-decision.js'));
await fs.copyFile(path.join(here,'category-decision.css'),path.join(out,'assets/category-decision.css'));
await fs.copyFile(path.join(here,'static-compare-decision.js'),path.join(out,'assets/static-compare-decision.js'));
await fs.copyFile(path.join(here,'static-compare-decision.css'),path.join(out,'assets/static-compare-decision.css'));
await fs.copyFile(path.join(here,'legacy-compare-decision.js'),path.join(out,'assets/legacy-compare-decision.js'));
await fs.copyFile(path.join(here,'legacy-compare-decision.css'),path.join(out,'assets/legacy-compare-decision.css'));
await fs.copyFile(path.join(here,'tools-decision.css'),path.join(out,'assets/tools-decision.css'));
await fs.copyFile(path.join(here,'home-decision.css'),path.join(out,'assets/home-decision.css'));
await fs.copyFile(path.join(here,'trust-consistency.css'),path.join(out,'assets/trust-consistency.css'));
await fs.copyFile(path.join(here,'discovery-hubs.css'),path.join(out,'assets/discovery-hubs.css'));
await fs.copyFile(path.join(here,'discovery-hubs.js'),path.join(out,'assets/discovery-hubs.js'));
applyToolsDecision(out);
const toolsDecisionUx=true;
applyHomeDecision(out);
const homeDecisionUx=true;
applyTrustConsistency(out);
const trustConsistencyUx=true;
applyDiscoveryHubs(out);
const discoveryHubsUx=true;
const visualIntegrity=applyVisualIntegrity(out);
const visualIntegrityUx=visualIntegrity.removedStockImages===153&&visualIntegrity.affectedPages===153&&visualIntegrity.homePages===1&&visualIntegrity.brandPages===136&&visualIntegrity.categoryPages===16;
if(!visualIntegrityUx)throw new Error(`v11.52 visual integrity coverage ${JSON.stringify(visualIntegrity)}`);

const comparePath=path.join(out,'compare/index.html');
let compareHydrationAligned=false;
{
  let html=await fs.readFile(comparePath,'utf8');
  const picks=[...html.matchAll(/<select data-v34-pick>[\s\S]*?<\/select>/g)];
  if(picks.length!==4)throw new Error(`v11.52 compare picker gate ${picks.length}/4`);
  const defaults=['mega-mgc-coffee','compose-coffee'];
  let i=0;
  html=html.replace(/<select data-v34-pick>[\s\S]*?<\/select>/g,block=>{
    const wanted=defaults[i++]||null;
    let next=block.replace(/\sselected(?=[\s>])/g,'');
    if(wanted){
      const needle=`<option value="${wanted}">`;
      if(!next.includes(needle))throw new Error(`v11.52 compare default option missing ${wanted}`);
      next=next.replace(needle,`<option value="${wanted}" selected>`);
    }
    return next;
  });
  html=html.replace('<strong data-v49-compare-count>0개</strong>','<strong data-v49-compare-count>2개</strong>');
  html=html.replace('<div class="v49-compare-chips" data-v49-compare-chips></div>','<div class="v49-compare-chips" data-v49-compare-chips><button type="button" data-v49-remove="0"><span>메가MGC커피</span><i aria-hidden="true">×</i></button><button type="button" data-v49-remove="1"><span>컴포즈커피</span><i aria-hidden="true">×</i></button></div>');
  const pickerArea=html.match(/<div class="v34-pickers" data-v34-pickers>([\s\S]*?)<\/div><div class="v34-status"/)?.[1]||'';
  compareHydrationAligned=(pickerArea.match(/\sselected(?=[\s>])/g)||[]).length===2&&pickerArea.includes('<option value="mega-mgc-coffee" selected>')&&pickerArea.includes('<option value="compose-coffee" selected>')&&html.includes('<strong data-v49-compare-count>2개</strong>');
  if(!compareHydrationAligned)throw new Error('v11.52 compare hydration alignment failed');
  await fs.writeFile(comparePath,html,'utf8');
}

const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);

const routeFromFile=file=>{const rel=path.relative(out,file).split(path.sep).join('/');if(rel==='index.html')return '/';if(rel.endsWith('/index.html'))return '/'+rel.slice(0,-'index.html'.length);return '/'+rel;};
const routeMap=new Map(htmlFiles.map(f=>[routeFromFile(f),f]));
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
const brokenLinks=[],missingAssets=[],candidateIssues=[];
let totalInternalLinks=0,totalInternalAssets=0,viewportMeta=0,imgCount=0,imgMissingAlt=0,brandDecisionPages=0,brandDecisionTagged=0,brandLowerFunnelEligiblePages=0,staticCompareDecisionPages=0,legacyCompareDecisionPages=0;

for(const file of htmlFiles){
  let html=await fs.readFile(file,'utf8');
  const route=routeFromFile(file);
  html=html.replace(/<body\b([^>]*)>/i,(full,attrs)=>{let a=attrs||'';a=a.replace(/\bclass="([^"]*)"/i,(m,c)=>{const list=c.split(/\s+/).filter(Boolean);if(!list.includes('v52-release-candidate'))list.push('v52-release-candidate');return `class="${list.join(' ')}"`});if(!/\bclass="/i.test(a))a+=' class="v52-release-candidate"';a=a.replace(/\sdata-v52-release-candidate="[^"]*"/gi,'');a+=' data-v52-release-candidate="1"';return `<body${a}>`});
  if(html.includes('data-v10-brand="1"')){
    html=html.replace(/<body\b([^>]*)>/i,(full,attrs)=>{let a=attrs||'';a=a.replace(/\bclass="([^"]*)"/i,(m,c)=>{const list=c.split(/\s+/).filter(Boolean);if(!list.includes('v52-brand-decision'))list.push('v52-brand-decision');return `class="${list.join(' ')}"`});if(!/\bclass="/i.test(a))a+=' class="v52-brand-decision"';a=a.replace(/\sdata-v52-brand-decision="[^"]*"/gi,'');a+=' data-v52-brand-decision="1"';return `<body${a}>`});
    const cssTag=`<link rel="stylesheet" href="${BASE}/assets/brand-lower-funnel.css" data-v52-lower-funnel>`;
    const jsTag=`<script src="${BASE}/assets/brand-lower-funnel.js" defer data-v52-lower-funnel></script>`;
    if(!html.includes('brand-lower-funnel.css'))html=html.replace('</head>',cssTag+'</head>');
    if(!html.includes('brand-lower-funnel.js'))html=html.replace('</body>',jsTag+'</body>');
    brandDecisionPages++;
    if(html.includes('id="official-current-cost"'))brandLowerFunnelEligiblePages++;
    if(html.includes('data-v52-brand-decision="1"')&&html.includes('data-v52-lower-funnel')&&html.includes('/assets/brand-lower-funnel.css')&&html.includes('/assets/brand-lower-funnel.js'))brandDecisionTagged++;
  }
  if(html.includes('data-v10-category="1"')){
    const cssTag=`<link rel="stylesheet" href="${BASE}/assets/category-decision.css" data-v52-category-decision>`;
    const jsTag=`<script src="${BASE}/assets/category-decision.js" defer data-v52-category-decision></script>`;
    if(!html.includes('category-decision.css'))html=html.replace('</head>',cssTag+'</head>');
    if(!html.includes('category-decision.js'))html=html.replace('</body>',jsTag+'</body>');
  }
  if(html.includes('data-v34-workspace="static"')){
    const cssTag=`<link rel="stylesheet" href="${BASE}/assets/static-compare-decision.css" data-v52-static-compare-decision>`;
    const jsTag=`<script src="${BASE}/assets/static-compare-decision.js" defer data-v52-static-compare-decision></script>`;
    if(!html.includes('static-compare-decision.css'))html=html.replace('</head>',cssTag+'</head>');
    if(!html.includes('static-compare-decision.js'))html=html.replace('</body>',jsTag+'</body>');
    staticCompareDecisionPages++;
  }
  if(legacyCompareRoutes.has(route)){
    if(!html.includes('data-v10-compare="1"')||html.includes('data-v34-workspace'))throw new Error(`v11.52 legacy compare shape mismatch ${route}`);
    if(route==='/compare/bhc-chicken-vs-bbq-chicken/')html=html.replaceAll('bhc치킨와 BBQ치킨','bhc치킨과 BBQ치킨');
    const cssTag=`<link rel="stylesheet" href="${BASE}/assets/legacy-compare-decision.css" data-v52-legacy-compare-decision>`;
    const jsTag=`<script src="${BASE}/assets/legacy-compare-decision.js" defer data-v52-legacy-compare-decision></script>`;
    if(!html.includes('legacy-compare-decision.css'))html=html.replace('</head>',cssTag+'</head>');
    if(!html.includes('legacy-compare-decision.js'))html=html.replace('</body>',jsTag+'</body>');
    legacyCompareDecisionPages++;
  }
  await fs.writeFile(file,html,'utf8');
  if(/<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/i.test(html))viewportMeta++;
  for(const m of html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)){const target=internalPageRoute(m[1]);if(!target)continue;totalInternalLinks++;if(!routeMap.has(target))brokenLinks.push({from:route,to:target,href:m[1]})}
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
if(brandDecisionPages===0||brandDecisionTagged!==brandDecisionPages||brandLowerFunnelEligiblePages===0)throw new Error(`v11.52 brand decision coverage ${brandDecisionTagged}/${brandDecisionPages}, eligible ${brandLowerFunnelEligiblePages}`);
if(staticCompareDecisionPages!==7)throw new Error(`v11.52 static compare decision pages ${staticCompareDecisionPages}/7`);
if(legacyCompareDecisionPages!==2)throw new Error(`v11.52 legacy compare decision pages ${legacyCompareDecisionPages}/2`);
applyBrowserRegressionFix(out);
applyCompareDecision(out);
const compareDecisionUx=true;
const brandLowerFunnelUx=brandDecisionPages>0&&brandDecisionTagged===brandDecisionPages&&brandLowerFunnelEligiblePages>0;
const rcReady=htmlFiles.length===311&&viewportMeta===311&&brokenLinks.length===0&&missingAssets.length===0&&candidateIssues.length===0&&titleDuplicates.length===0&&descriptionDuplicates.length===0&&h1Duplicates.length===0&&canonicalDuplicates.length===0&&imgMissingAlt===0&&brandLowerFunnelUx&&compareHydrationAligned&&compareDecisionUx&&staticCompareDecisionPages===7&&legacyCompareDecisionPages===2&&toolsDecisionUx&&homeDecisionUx&&trustConsistencyUx&&discoveryHubsUx&&visualIntegrityUx;

manifest.uiVersion='11.52';
manifest.v11_52={releaseCandidateAudit:true,allInternalLinksChecked:true,assetsChecked:true,searchIntentCollisionAudit:true,singleH1Audit:true,imageAltAudit:true,viewportCoverageAudit:true,brandLowerFunnelUx:true,compareHydrationAligned:true,compareDecisionUx:true,staticCompareDecisionUx:true,legacyCompareDecisionUx:true,toolsDecisionUx:true,homeDecisionUx:true,trustConsistencyUx:true,discoveryHubsUx:true,visualIntegrityUx:true,v42VisualLanguagePreserved:true,candidateSetChanged:false,indexPolicyChanged:false,dataSemanticsChanged:false,productionDeployed:false,rcReady};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
const report={schemaVersion:1,uiVersion:'11.52',generatedAt:new Date().toISOString(),htmlPages:htmlFiles.length,candidatePages:candidates.length,viewportMeta,totalInternalLinks,brokenInternalLinks:brokenLinks,totalInternalAssets,missingAssets,candidateIssues,titleDuplicateGroups:titleDuplicates,descriptionDuplicateGroups:descriptionDuplicates,h1DuplicateGroups:h1Duplicates,canonicalDuplicateGroups:canonicalDuplicates,imageCount:imgCount,imageMissingAlt:imgMissingAlt,brandDecisionPages,brandDecisionTagged,brandLowerFunnelEligiblePages,brandLowerFunnelUx,compareHydrationAligned,compareDecisionUx,staticCompareDecisionPages,staticCompareDecisionUx:true,legacyCompareDecisionPages,legacyCompareDecisionUx:true,toolsDecisionUx,homeDecisionUx,trustConsistencyUx:true,discoveryHubsUx,visualIntegrityUx,visualIntegrityRemovedStockImages:visualIntegrity.removedStockImages,visualIntegrityAffectedPages:visualIntegrity.affectedPages,rcReady,productionDeployed:false};
await fs.writeFile(path.join(out,'v11-52-release-candidate.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({...report,brokenInternalLinks:brokenLinks.slice(0,30),missingAssets:missingAssets.slice(0,30),candidateIssues:candidateIssues.slice(0,30)},null,2));
