import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const BASE='/pm-lab/franchise-ssg-preview';
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const routes=new Set(snap.brands.map(b=>b.route));
const appPath=path.join(out,'assets/app.js');
let app=await fs.readFile(appPath,'utf8');
function replace(source,from,to){if(source.includes(to))return source;const count=source.split(from).length-1;if(count!==1)throw new Error('v54 exact replacement failed: '+from.slice(0,80)+' count='+count);return source.replace(from,to)}
app=replace(app,'const raw=form.elements[name]?.value;',`const raw=(form.elements?.[name]??form.querySelector('[name="'+name+'"]'))?.value;`);
app=replace(app,'rate=Math.min(100,materialRate+platformRate+royaltyRate)','rate=(materialRate+platformRate+royaltyRate)');
app=replace(app,"const rows=body?qa('tr',body):[];const incoming=", "const trustedOnly=q('#directoryTrustedOnly',directory);const rows=body?qa('tr',body):[];const incoming=");
app=replace(app,"const ok=(!term||(r.dataset.name||'').includes(term))", "const ok=(!trustedOnly?.checked||r.dataset.v54Trusted==='1')&&(!term||(r.dataset.name||'').includes(term))");
app=replace(app,'[search,category,cost,stores,growth,sort].filter(Boolean)', '[search,category,cost,stores,growth,sort,trustedOnly].filter(Boolean)');
await fs.writeFile(appPath,app);
const directoryPath=path.join(out,'brands/index.html');
let directory=await fs.readFile(directoryPath,'utf8');
let total=0,trusted=0;
directory=directory.replace(/<tr\b([^>]*data-name="[^"]*"[^>]*)>([\s\S]*?)<\/tr>/g,(whole,attrs,body)=>{
  total++;const yes=[...body.matchAll(/href="([^"]+)"/g)].some(m=>{try{return routes.has(decodeURIComponent(m[1]).replace(BASE,''))}catch{return false}});if(yes)trusted++;
  attrs=attrs.replace(/\sdata-v54-trusted="[^"]*"/g,'').replace(/\shidden(?:="[^"]*")?/g,'');
  return '<tr'+attrs+' data-v54-trusted="'+(yes?'1':'0')+'"'+(yes?'':' hidden')+'>'+body+'</tr>';
});
if(trusted!==snap.brands.length)throw new Error(`v54 directory mapping ${trusted}/${snap.brands.length}`);
if(!directory.includes('id="directoryTrustedOnly"'))directory=directory.replace('<div class="directory-controls">','<label class="v54-trusted-toggle"><input id="directoryTrustedOnly" type="checkbox" checked> 분석 가능한 '+trusted+'개만 보기 <small>전체 카탈로그 '+total+'개</small></label><div class="directory-controls">');
directory=directory.replace(/(id="directoryCount"[^>]*>)[\d,]+개 브랜드/,'$1'+trusted+'개 브랜드');
await fs.writeFile(directoryPath,directory);
const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
css=css.replace(/\/\* v11\.54 runtime integrity \*\/[\s\S]*?\/\* v11\.54 runtime integrity end \*\//g,'').trimEnd();
css+=`\n/* v11.54 runtime integrity */
body.v44-v42-refined .v41-home-copy .v25-head h1.v44-home-title{width:100%!important;max-width:100%!important;font-size:clamp(28px,3.4vw,48px)!important;line-height:1.16!important;white-space:nowrap!important;letter-spacing:-.055em!important}
body.v44-v42-refined .v41-home-copy .v25-rail{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:visible}
body.v44-v42-refined .v41-home-copy .v25-rail>div{min-width:0;padding:12px 10px}
body.v44-v42-refined .v41-home-copy .v25-rail strong{font-size:clamp(13px,1.15vw,17px);white-space:nowrap}
.v54-trusted-toggle{display:flex;align-items:center;flex-wrap:wrap;gap:10px;min-height:44px;margin:0 0 14px;font-size:13px}
.v54-trusted-toggle input{width:20px!important;min-width:20px!important;min-height:20px!important;height:20px!important;margin:0;accent-color:#d9ff7c}
.v54-trusted-toggle small{color:#939d95;font-size:11px}
.v54-tool-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px}
.v54-tool-actions .button{font-size:12px;min-height:44px}
.v54-input-note{font-size:12px;line-height:1.6;color:#b9c3ba;margin:12px 0}
[aria-invalid=true]{outline:2px solid #ffb28e;outline-offset:2px}
@media(max-width:720px){body.v44-v42-refined .v41-home-copy{padding:48px 0 32px!important}body.v44-v42-refined .v41-home-copy .v25-head h1.v44-home-title{font-size:clamp(18px,6.8vw,34px)!important}body.v44-v42-refined .v41-home-copy .v25-rail{grid-template-columns:repeat(2,minmax(0,1fr))}body.v44-v42-refined .v41-home-copy .v25-rail strong{font-size:17px}body.v44-v42-refined .v41-home-copy>.v41-kicker{left:0!important;top:24px!important}}
/* v11.54 runtime integrity end */\n`;
await fs.writeFile(cssPath,css);
await fs.copyFile(path.join(here,'assets/v54-runtime-integrity.js'),path.join(out,'assets/v54-runtime-integrity.js'));
const affected=['/','/tools/startup-cost/','/tools/monthly-profit-simulator/','/tools/monthly-fixed-cost/','/tools/break-even/','/tools/open-close-rate/'];
for(const route of affected){const file=path.join(out,...route.split('/').filter(Boolean),'index.html');let h=await fs.readFile(file,'utf8');h=h.replace(/<script\b[^>]*src="[^"]*\/v54-runtime-integrity\.js"[^>]*><\/script>/g,'');h=h.replace('</body>',`<script src="${BASE}/assets/v54-runtime-integrity.js" defer></script></body>`);await fs.writeFile(file,h)}
const report={schemaVersion:1,patchVersion:'11.54',uiVersionPreserved:'11.52',generatedAt:new Date().toISOString(),legacyCalculatorRootFix:true,monthlyCostRatioUncapped:true,startupShareInputs:true,homeTitleContainment:true,homeDateContainment:true,directoryTrustedDefault:trusted,directoryCatalogTotal:total,scriptRoutes:affected,productionDeployed:false};
await fs.writeFile(path.join(out,'v11-54-runtime-integrity.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
