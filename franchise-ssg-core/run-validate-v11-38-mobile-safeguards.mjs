import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const err=[];
const read=async r=>fs.readFile(r==='/'?path.join(out,'index.html'):path.join(out,...r.split('/').filter(Boolean),'index.html'),'utf8');
const css=await fs.readFile(path.join(out,'assets/site.css'),'utf8');
const app=await fs.readFile(path.join(out,'assets/app.js'),'utf8');
const manifest=JSON.parse(await fs.readFile(path.join(out,'route-manifest.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(out,'v11-38-mobile-safeguards.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const uiMatch=String(manifest.uiVersion||'').match(/^11\.(\d+)$/),uiMinor=uiMatch?Number(uiMatch[1]):NaN;
const targets={home:'/',brandMissing:'/brands/666버거/',brandStandard:'/brands/mega-mgc-coffee/',category:'/categories/burger/',compare:'/compare/',startup:'/tools/startup-cost/'};
const pages={};for(const [k,r] of Object.entries(targets))pages[k]=await read(r);

if(!Number.isFinite(uiMinor)||uiMinor<38||manifest.v11_38?.mobileSafeguards!==true)err.push(`manifest v11.38 under ${manifest.uiVersion}`);
if((quality.indexPolicy?.productionCandidateUrls||[]).length!==184)err.push('candidate count');
if(JSON.stringify(report.targetViewports)!==JSON.stringify([320,360,390,430]))err.push('viewport contract');
if(!css.includes('/* v11.38 mobile safeguards */')||!css.includes('/* v11.38 mobile safeguards end */'))err.push('css marker');
if((css.match(/\/\* v11\.38 mobile safeguards \*\//g)||[]).length!==1)err.push('duplicate mobile marker');

const cssRules=[
  ['body min width',/body\{[^}]*min-width:0/],
  ['nav mobile toggle layout',/@media\(max-width:900px\)[\s\S]*?\.site-header nav\{[^}]*display:none/],
  ['nav viewport bound',/\.site-header nav\{[^}]*max-height:calc\(100dvh - 68px\)[^}]*overflow-y:auto/],
  ['430 shell',/@media\(max-width:430px\)[\s\S]*?\.shell\{width:calc\(100% - 22px\)/],
  ['compare picker 460 one column',/@media\(max-width:460px\)[\s\S]*?\.v34-pickers\{grid-template-columns:1fr\}/],
  ['compare select containment',/\.v34-pickers select,.v36-brandbar select\{width:100%;min-width:0;max-width:100%\}/],
  ['brand kpi collapse',/@media\(max-width:760px\)[\s\S]*?\.v35-kpis\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/],
  ['startup 560 official collapse',/@media\(max-width:560px\)[\s\S]*?\.v36-officialgrid\{grid-template-columns:repeat\(2,1fr\)\}/],
  ['startup narrow input guard',/\.v36-inputgrid label\{grid-template-columns:minmax\(0,1fr\) minmax\(88px,108px\) 24px/],
  ['sticky offset',/\.v36-brandbar\{top:68px\}/]
];
for(const [name,re] of cssRules)if(!re.test(css))err.push('css '+name);

if(!app.includes("const toggle=q('.nav-toggle')")||!app.includes("nav.classList.toggle('is-open')"))err.push('mobile nav js');
for(const [name,html] of Object.entries(pages)){
  if(!html.includes('name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"'))err.push(`viewport ${name}`);
  if(!html.includes('class="nav-toggle"'))err.push(`nav toggle ${name}`);
  if(!html.includes('/assets/site.css'))err.push(`css link ${name}`);
  if(!html.includes('/assets/app.js'))err.push(`app link ${name}`);
  if(/style="[^"]*(?:min-width|width):\s*(?:[4-9]\d\d|\d{4,})px/i.test(html))err.push(`inline fixed width ${name}`);
}
if(!pages.home.includes('data-v25-home="1"'))err.push('home surface');
if(!pages.brandMissing.includes('v35-brand-detail')||!pages.brandMissing.includes('data-v35-kpi="sales" data-v35-value="null"'))err.push('missing-sales brand surface');
if(!pages.brandStandard.includes('v35-brand-detail'))err.push('standard brand surface');
if(!pages.category.includes('v25-category'))err.push('category surface');
if(!pages.compare.includes('data-v34-workspace="hub"'))err.push('compare surface');
if(!pages.startup.includes('data-v36-startup="1"'))err.push('startup surface');

if(err.length){console.error(JSON.stringify({v11_38MobileValidation:'FAIL',currentUiVersion:manifest.uiVersion,count:err.length,errors:err},null,2));process.exit(1)}
console.log(JSON.stringify({v11_38MobileValidation:'PASS',currentUiVersion:manifest.uiVersion,viewports:report.targetViewports,surfaces:Object.keys(targets),candidateCount:184,visualBrowserAvailable:false,productionDeployed:false},null,2));
