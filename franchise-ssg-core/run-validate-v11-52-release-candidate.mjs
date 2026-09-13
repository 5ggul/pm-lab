import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-52-release-candidate.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');

if(manifest.uiVersion!=='11.52')err.push(`manifest ${manifest.uiVersion}`);
for(const k of ['releaseCandidateAudit','allInternalLinksChecked','assetsChecked','searchIntentCollisionAudit','singleH1Audit','imageAltAudit','viewportCoverageAudit','v42VisualLanguagePreserved'])if(manifest.v11_52?.[k]!==true)err.push(`flag ${k}`);
if(manifest.v11_52?.candidateSetChanged!==false||manifest.v11_52?.indexPolicyChanged!==false||manifest.v11_52?.dataSemanticsChanged!==false||manifest.v11_52?.productionDeployed!==false||report.productionDeployed!==false)err.push('immutable contracts');
if(htmlFiles.length!==311||candidates.length!==184)err.push(`counts ${htmlFiles.length}/${candidates.length}`);
for(const [k,v] of [['htmlPages',311],['candidatePages',184],['viewportMeta',311],['imageMissingAlt',0]])if(Number(report[k])!==v)err.push(`report ${k}=${report[k]}`);
for(const k of ['brokenInternalLinks','missingAssets','candidateIssues','titleDuplicateGroups','descriptionDuplicateGroups','h1DuplicateGroups','canonicalDuplicateGroups'])if(!Array.isArray(report[k])||report[k].length!==0)err.push(`${k}=${Array.isArray(report[k])?report[k].length:'invalid'}`);
if(report.rcReady!==true||manifest.v11_52?.rcReady!==true)err.push('rcReady false');

let bodyCoverage=0,noindex=0,singleH1=0,metaDescriptions=0,canonicalPreview=0;
for(const f of htmlFiles){const h=await fs.readFile(f,'utf8');if(/<body\b[^>]*\bv52-release-candidate\b[^>]*data-v52-release-candidate="1"/i.test(h))bodyCoverage++;else err.push(`body ${path.relative(out,f)}`)}
for(const r of candidates){const h=await fs.readFile(fileFor(r),'utf8');if(h.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))noindex++;else err.push(`noindex ${r}`);if((h.match(/<h1\b/gi)||[]).length===1)singleH1++;else err.push(`h1 ${r}`);if(/<meta name="description" content="[^"]+">/i.test(h))metaDescriptions++;else err.push(`description ${r}`);if(/<link rel="canonical" href="https:\/\/5ggul\.github\.io\/pm-lab\/franchise-ssg-preview[^"]*">/i.test(h))canonicalPreview++;else err.push(`canonical ${r}`)}
if(bodyCoverage!==311||noindex!==184||singleH1!==184||metaDescriptions!==184||canonicalPreview!==184)err.push(`coverage ${bodyCoverage}/${noindex}/${singleH1}/${metaDescriptions}/${canonicalPreview}`);

if(err.length){console.error(JSON.stringify({v11_52ReleaseCandidateValidation:'FAIL',count:err.length,bodyCoverage,noindex,singleH1,metaDescriptions,canonicalPreview,reportSummary:{broken:report.brokenInternalLinks?.length,missingAssets:report.missingAssets?.length,candidateIssues:report.candidateIssues?.length,titleDup:report.titleDuplicateGroups?.length,descDup:report.descriptionDuplicateGroups?.length,h1Dup:report.h1DuplicateGroups?.length,canonicalDup:report.canonicalDuplicateGroups?.length,imageMissingAlt:report.imageMissingAlt,rcReady:report.rcReady},errors:err.slice(0,220)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_52ReleaseCandidateValidation:'PASS',htmlPages:311,bodyCoverage,candidates:184,noindex,singleH1,metaDescriptions,canonicalPreview,internalLinksChecked:report.totalInternalLinks,assetsChecked:report.totalInternalAssets,imagesChecked:report.imageCount,rcReady:true,productionDeployed:false},null,2));
