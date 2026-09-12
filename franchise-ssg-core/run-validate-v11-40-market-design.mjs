import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-40-market-design.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');

const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);

if(Number(manifest.uiVersion)<11.40||manifest.v11_40?.marketDesign!==true)err.push(`manifest v11.40 current=${manifest.uiVersion}`);
if(candidates.length!==184)err.push(`candidate count ${candidates.length}`);
if(report.allHtmlPages!==htmlFiles.length)err.push(`html report ${report.allHtmlPages}/${htmlFiles.length}`);
if(report.productionDeployed!==false||manifest.v11_40?.productionDeployed!==false)err.push('production flag');
if(manifest.v11_40?.candidateSetChanged!==false||manifest.v11_40?.indexPolicyChanged!==false||manifest.v11_40?.dataSemanticsChanged!==false)err.push('immutable contracts');

const start='/* v11.40 market terminal design */',end='/* v11.40 market terminal design end */';
if((css.match(/\/\* v11\.40 market terminal design \*\//g)||[]).length!==1)err.push('design marker start');
if((css.match(/\/\* v11\.40 market terminal design end \*\//g)||[]).length!==1)err.push('design marker end');
const a=css.indexOf(start),b=css.indexOf(end,a+start.length);
const block=a>=0&&b>a?css.slice(a,b+end.length):'';
if(!block)err.push('design block missing');
for(const token of ['--bg:#090b0a','--paper:#0d100e','--accent:#c8ff3d','--risk:#ff6b76','--safe:#79ef9a'])if(!block.includes(token))err.push(`token ${token}`);
for(const rule of [
  'body.v40-market-ui .site-header',
  'body.v40-market-ui .v25-head',
  'body.v40-market-ui .v35-kpis',
  'body.v40-market-ui .v39-evidence',
  'body.v40-market-ui .v34-workspace',
  'body.v40-market-ui .v36-stage',
  'body.v40-market-ui .data-table',
  'body.v40-market-ui .site-footer'
])if(!block.includes(rule))err.push(`surface css ${rule}`);
if(/(?:linear|radial|conic)-gradient\s*\(/i.test(block))err.push('gradient in v11.40 block');
if(!block.includes('border-radius:0!important;box-shadow:none!important;background-image:none!important'))err.push('anti-template flatten rule');
if(!block.includes('@media(max-width:560px)')||!block.includes('@media(max-width:340px)'))err.push('mobile breakpoints');

let classCount=0,themeCount=0;
for(const file of htmlFiles){
  const html=await fs.readFile(file,'utf8');
  if(/<body\b[^>]*\bclass="[^"]*\bv40-market-ui\b[^"]*"[^>]*\bdata-v40-market-ui="1"/i.test(html))classCount++;else err.push(`market class ${path.relative(out,file)}`);
  if(html.includes('<meta name="theme-color" content="#090b0a">'))themeCount++;else err.push(`theme color ${path.relative(out,file)}`);
}
if(classCount!==htmlFiles.length)err.push(`class coverage ${classCount}/${htmlFiles.length}`);
if(themeCount!==htmlFiles.length)err.push(`theme coverage ${themeCount}/${htmlFiles.length}`);

const reps={home:'/',brand:'/brands/mega-mgc-coffee/',brandMissing:'/brands/666버거/',category:'/categories/cafe/',compare:'/compare/',rankings:'/rankings/',tools:'/tools/',startup:'/tools/startup-cost/',guide:'/guide/low-price-coffee/',sources:'/sources/'};
for(const [name,route] of Object.entries(reps)){
  const html=await fs.readFile(fileFor(route),'utf8');
  if(!html.includes('v40-market-ui'))err.push(`representative class ${name}`);
  if(!html.includes('/assets/site.css'))err.push(`css link ${name}`);
  if(!html.includes('name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"'))err.push(`viewport ${name}`);
}
const brand=await fs.readFile(fileFor(reps.brand),'utf8');
if(!brand.includes('data-v39-evidence="1"')||(brand.match(/<table\b/gi)||[]).length<3)err.push('brand evidence preserved');
const missing=await fs.readFile(fileFor(reps.brandMissing),'utf8');
if(!missing.includes('data-v35-kpi="sales" data-v35-value="null"'))err.push('missing sales semantics preserved');
const startup=await fs.readFile(fileFor(reps.startup),'utf8');
if(!startup.includes('data-v36-startup="1"'))err.push('startup workspace preserved');

let noindex=0;
for(const route of candidates){
  const html=await fs.readFile(fileFor(route),'utf8');
  if(/<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">/i.test(html))noindex++;else err.push(`candidate noindex ${route}`);
}
if(noindex!==184)err.push(`candidate noindex ${noindex}/184`);

if(err.length){console.error(JSON.stringify({v11_40MarketDesignValidation:'FAIL',count:err.length,htmlPages:htmlFiles.length,classCount,themeCount,noindex,errors:err.slice(0,180)},null,2));process.exit(1)}
console.log(JSON.stringify({v11_40MarketDesignValidation:'PASS',currentUiVersion:manifest.uiVersion,htmlPages:htmlFiles.length,classCount,themeCount,candidates:184,noindex,representativeSurfaces:Object.keys(reps),productionDeployed:false},null,2));
