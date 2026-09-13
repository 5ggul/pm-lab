import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-51-viewport-guard.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');

const ui=Number(manifest.uiVersion);
if(!Number.isFinite(ui)||ui<11.51)err.push(`manifest ${manifest.uiVersion}`);
for(const k of ['viewportGuard','allHtmlCoverage','formControlContainment','tableOverflowContainment','mobileSingleColumnSafety','v42VisualLanguagePreserved'])if(manifest.v11_51?.[k]!==true)err.push(`flag ${k}`);
if(manifest.v11_51?.candidateSetChanged!==false||manifest.v11_51?.indexPolicyChanged!==false||manifest.v11_51?.dataSemanticsChanged!==false||manifest.v11_51?.productionDeployed!==false||report.productionDeployed!==false)err.push('immutable contracts');
if(candidates.length!==184||htmlFiles.length!==311)err.push(`counts ${candidates.length}/${htmlFiles.length}`);
if(report.htmlPages!==311||report.patchedHtmlPages!==311||report.candidatePages!==184)err.push(`report ${report.htmlPages}/${report.patchedHtmlPages}/${report.candidatePages}`);
if((css.match(/\/\* v11\.51 viewport guard \*\//g)||[]).length!==1||(css.match(/\/\* v11\.51 viewport guard end \*\//g)||[]).length!==1)err.push('css markers');
for(const token of ['min-width:0','max-width:100%','overflow-x:auto','font-size:16px','grid-template-columns:minmax(0,1fr)','@media(max-width:430px)'])if(!css.includes(token))err.push(`css ${token}`);

let bodyCoverage=0,viewportCoverage=0,noindex=0;
for(const f of htmlFiles){const h=await fs.readFile(f,'utf8');if(/<body\b[^>]*\bv51-viewport-guard\b[^>]*data-v51-viewport-guard="1"/i.test(h))bodyCoverage++;else err.push(`body ${path.relative(out,f)}`);if(/<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/i.test(h))viewportCoverage++;else err.push(`viewport ${path.relative(out,f)}`)}
if(bodyCoverage!==311||viewportCoverage!==311)err.push(`coverage ${bodyCoverage}/${viewportCoverage}`);
for(const r of candidates){const h=await fs.readFile(fileFor(r),'utf8');if(h.includes('<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">'))noindex++;else err.push(`noindex ${r}`)}
if(noindex!==184)err.push(`noindex ${noindex}`);

if(err.length){console.error(JSON.stringify({v11_51ViewportGuardValidation:'FAIL',count:err.length,bodyCoverage,viewportCoverage,noindex,errors:err.slice(0,200)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_51ViewportGuardValidation:'PASS',htmlPages:311,bodyCoverage,viewportCoverage,candidates:184,noindex,mobileBreakpoints:[720,430],productionDeployed:false},null,2));
