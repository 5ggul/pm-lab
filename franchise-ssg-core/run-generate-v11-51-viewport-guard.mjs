import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
if(manifest.uiVersion!=='11.50')throw new Error(`v11.51 requires v11.50 baseline, got ${manifest.uiVersion}`);
if(candidates.length!==184)throw new Error(`v11.51 candidate baseline ${candidates.length}`);

const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);

function patchBody(html){return html.replace(/<body\b([^>]*)>/i,(full,attrs)=>{let a=attrs||'';a=a.replace(/\bclass="([^"]*)"/i,(m,c)=>{const list=c.split(/\s+/).filter(Boolean);if(!list.includes('v51-viewport-guard'))list.push('v51-viewport-guard');return `class="${list.join(' ')}"`});if(!/\bclass="/i.test(a))a+=' class="v51-viewport-guard"';a=a.replace(/\sdata-v51-viewport-guard="[^"]*"/gi,'');a+=' data-v51-viewport-guard="1"';return `<body${a}>`})}
let patched=0;
for(const file of htmlFiles){const before=await fs.readFile(file,'utf8');const html=patchBody(before);if(html!==before){await fs.writeFile(file,html,'utf8');patched++}}

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
css=css.replace(/\/\* v11\.51 viewport guard \*\/[\s\S]*?\/\* v11\.51 viewport guard end \*\//g,'').trimEnd();
css+=`\n\n/* v11.51 viewport guard */
body.v51-viewport-guard main,
body.v51-viewport-guard article,
body.v51-viewport-guard section,
body.v51-viewport-guard form,
body.v51-viewport-guard .shell,
body.v51-viewport-guard .page,
body.v51-viewport-guard .calc-layout>* ,
body.v51-viewport-guard .v35-brand-workspace>* ,
body.v51-viewport-guard .v36-workspace>* ,
body.v51-viewport-guard .v49-compare-live>* ,
body.v51-viewport-guard .v50-category-actions>* {min-width:0;}
body.v51-viewport-guard img,
body.v51-viewport-guard video,
body.v51-viewport-guard canvas {max-width:100%;height:auto;}
body.v51-viewport-guard svg {max-width:100%;}
body.v51-viewport-guard input:not([type=checkbox]):not([type=radio]),
body.v51-viewport-guard select,
body.v51-viewport-guard textarea,
body.v51-viewport-guard button {max-width:100%;box-sizing:border-box;}
body.v51-viewport-guard .table-scroll,
body.v51-viewport-guard .v33-table-scroll {max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain;-webkit-overflow-scrolling:touch;}
body.v51-viewport-guard h1,
body.v51-viewport-guard h2,
body.v51-viewport-guard h3,
body.v51-viewport-guard .button,
body.v51-viewport-guard label {word-break:keep-all;overflow-wrap:anywhere;}
@media(max-width:720px){
 body.v51-viewport-guard .calc-layout,
 body.v51-viewport-guard .calculator,
 body.v51-viewport-guard .v34-pickers,
 body.v51-viewport-guard .v50-category-actions {min-width:0;}
 body.v51-viewport-guard input:not([type=checkbox]):not([type=radio]),
 body.v51-viewport-guard select,
 body.v51-viewport-guard textarea {font-size:16px;}
}
@media(max-width:430px){
 body.v51-viewport-guard .page-head h1,
 body.v51-viewport-guard .brand-header h1 {line-height:1.08;max-width:100%;}
 body.v51-viewport-guard .calculator {grid-template-columns:minmax(0,1fr);}
 body.v51-viewport-guard .calc-layout {grid-template-columns:minmax(0,1fr);}
 body.v51-viewport-guard .v34-pickers {grid-template-columns:minmax(0,1fr);}
 body.v51-viewport-guard .v50-category-actions {grid-template-columns:minmax(0,1fr);}
 body.v51-viewport-guard .v49-compare-chips {max-width:100%;overflow-x:auto;}
}
/* v11.51 viewport guard end */\n`;
await fs.writeFile(cssPath,css,'utf8');

manifest.uiVersion='11.51';
manifest.v11_51={viewportGuard:true,allHtmlCoverage:true,formControlContainment:true,tableOverflowContainment:true,mobileSingleColumnSafety:true,v42VisualLanguagePreserved:true,candidateSetChanged:false,indexPolicyChanged:false,dataSemanticsChanged:false,productionDeployed:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
const report={schemaVersion:1,uiVersion:'11.51',generatedAt:new Date().toISOString(),htmlPages:htmlFiles.length,patchedHtmlPages:patched,candidatePages:candidates.length,viewportBreakpoints:[720,430],features:['all-page min-width containment','responsive media containment','form control width and 16px mobile text','table horizontal scroll containment','single-column mobile calculator and compare controls'],productionDeployed:false};
await fs.writeFile(path.join(out,'v11-51-viewport-guard.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
