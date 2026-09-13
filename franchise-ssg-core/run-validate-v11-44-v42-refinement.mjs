import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const js=await fs.readFile(path.join(out,'assets/v44-refinement.js'),'utf8');
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-44-v42-refinement.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');
const htmlFiles=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}await walk(out);

if(manifest.uiVersion!=='11.44'||manifest.v11_44?.v42VisualBaseRestored!==true)err.push(`manifest ${manifest.uiVersion}`);
for(const k of ['homeTitleSingleLine','minimalControlFeedback','compactReset','accessibilityFocus'])if(manifest.v11_44?.[k]!==true)err.push(`flag ${k}`);
if(manifest.v11_44?.candidateSetChanged!==false||manifest.v11_44?.indexPolicyChanged!==false||manifest.v11_44?.dataSemanticsChanged!==false)err.push('immutable contracts');
if(manifest.v11_44?.productionDeployed!==false||report.productionDeployed!==false)err.push('production flag');
if(candidates.length!==184)err.push(`candidates ${candidates.length}`);
if(report.allHtmlPages!==htmlFiles.length||report.patchedHtmlPages!==htmlFiles.length)err.push(`html report ${report.patchedHtmlPages}/${htmlFiles.length}`);
if((css.match(/\/\* v11\.44 v42 refinement \*\//g)||[]).length!==1||(css.match(/\/\* v11\.44 v42 refinement end \*\//g)||[]).length!==1)err.push('v44 css markers');
if(/\/\* v11\.43 control ux \*\//.test(css))err.push('v43 css still active');
for(const t of ['.v44-home-title','.v44-compare-tools','.v44-reset','focus-visible','@media(max-width:430px)'])if(!css.includes(t))err.push(`css ${t}`);
for(const t of ['v44-compare-tools','v44-selection-status','selectedIndex=0','data-v44-has-value','aria-live'])if(!js.includes(t))err.push(`js ${t}`);

let classCount=0,scriptCount=0,noindex=0,v43Class=0,v43Script=0;
for(const f of htmlFiles){const h=await fs.readFile(f,'utf8');const rel=path.relative(out,f);if(/<body\b[^>]*\bv44-v42-refined\b[^>]*data-v44-v42-refined="1"/i.test(h))classCount++;else err.push(`class ${rel}`);if(h.includes('/assets/v44-refinement.js'))scriptCount++;else err.push(`script ${rel}`);if(/\bv43-control-ui\b/.test(h))v43Class++;if(h.includes('/assets/v43-control-ux.js'))v43Script++;}
if(classCount!==htmlFiles.length||scriptCount!==htmlFiles.length)err.push(`coverage ${classCount}/${scriptCount}/${htmlFiles.length}`);
if(v43Class||v43Script)err.push(`v43 active ${v43Class}/${v43Script}`);
for(const r of candidates){const h=await fs.readFile(fileFor(r),'utf8');if(/<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">/i.test(h))noindex++;else err.push(`noindex ${r}`)}if(noindex!==184)err.push(`noindex ${noindex}`);

const home=await fs.readFile(fileFor('/'),'utf8');
if(!home.includes('<h1 class="v44-home-title">프랜차이즈 비교</h1>'))err.push('home title');
if(!home.includes('브랜드 또는 업종을 검색하세요'))err.push('home placeholder');
if(!home.includes('v42-data-ui'))err.push('v42 home base');
const compare=await fs.readFile(fileFor('/compare/'),'utf8');
for(const n of ['비교 브랜드 1','비교 브랜드 2','비교 브랜드 3','비교 브랜드 4'])if(!compare.includes(n))err.push(`compare label ${n}`);
if(!compare.includes('data-v34-workspace="hub"'))err.push('compare workspace');
const startup=await fs.readFile(fileFor('/tools/startup-cost/'),'utf8');if(!startup.includes('브랜드 선택')||!startup.includes('data-v36-startup="1"'))err.push('startup label/workspace');
const missing=await fs.readFile(fileFor('/brands/666버거/'),'utf8');if(!missing.includes('data-v35-kpi="sales" data-v35-value="null"'))err.push('missing sales semantics');

if(err.length){console.error(JSON.stringify({v11_44V42RefinementValidation:'FAIL',count:err.length,htmlPages:htmlFiles.length,classCount,scriptCount,v43Class,v43Script,noindex,errors:err.slice(0,180)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_44V42RefinementValidation:'PASS',htmlPages:htmlFiles.length,classCount,scriptCount,candidates:184,noindex,v43VisualOverridesRemoved:true,homeTitleSingleLine:true,productionDeployed:false},null,2));
