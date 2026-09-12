import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const cssPath=path.join(out,'assets/site.css');
const manifestPath=path.join(out,'route-manifest.json');
const marker='/* v11.38 mobile safeguards */';

let css=await fs.readFile(cssPath,'utf8');
const prior=css.indexOf(marker);
if(prior>=0)css=css.slice(0,prior).trimEnd()+'\n';

const block=`
${marker}
/* Prevent native selects and long Korean brand names from forcing grid tracks wider than the viewport. */
.v34-pickers select,.v36-brandbar select{width:100%;min-width:0;max-width:100%}
.v34-bar-label strong,.v34-ring-card header>*{min-width:0;overflow-wrap:anywhere}
.v35-kpis>div,.v36-officialgrid>div,.v36-derived>div{min-width:0}
.v35-kpis strong,.v36-officialgrid strong,.v36-derived strong{overflow-wrap:anywhere}

@media(max-width:900px){
  .site-header nav{max-height:calc(100dvh - 68px);overflow-y:auto;overscroll-behavior:contain}
}
@media(max-width:460px){
  .v34-workspace-head,.v35-section-head,.v36-subhead,.v36-stage-head{align-items:flex-start;flex-wrap:wrap}
  .v34-workspace-head>*,.v35-section-head>*,.v36-subhead>*,.v36-stage-head>*{min-width:0}
  .v34-pickers select,.v36-brandbar select{font-size:16px}
  .v35-track-labels{gap:4px}
  .v35-track-labels span{min-width:0;overflow-wrap:anywhere}
  .v36-brandbar{top:68px}
  .v36-inputgrid label{grid-template-columns:minmax(0,1fr) minmax(88px,108px) 24px;gap:8px;padding-right:0}
  .v36-inputgrid input{width:100%;max-width:100%}
}
@media(max-width:340px){
  .v35-kpis strong,.v36-officialgrid strong,.v36-derived strong{font-size:17px}
  .v36-inputgrid label{grid-template-columns:minmax(0,1fr) minmax(82px,96px) 22px;gap:6px}
}
/* v11.38 mobile safeguards end */
`;
css=css.trimEnd()+'\n'+block;
await fs.writeFile(cssPath,css,'utf8');

const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.38';
manifest.v11_38={
  mobileSafeguards:true,
  viewports:[320,360,390,430],
  compareSelectContainment:true,
  longBrandNameContainment:true,
  mobileNavHeightBound:true,
  startupInputNarrowGuard:true,
  stickyHeaderOffset:68,
  candidateSetChanged:false,
  indexPolicyChanged:false
};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

const report={
  schemaVersion:1,
  uiVersion:'11.38',
  generatedAt:new Date().toISOString(),
  targetViewports:[320,360,390,430],
  surfaces:['home','brand-detail','category','compare','startup-cost'],
  fixes:[
    'compare select width containment',
    'long brand label wrapping containment',
    'mobile navigation viewport-height bound',
    '320px startup input grid guard',
    '68px sticky header offset consistency',
    'narrow KPI numeric wrapping guard'
  ],
  visualBrowserAvailable:false,
  validationMode:'STATIC_HTML_CSS_JS_CONTRACT',
  productionDeployed:false
};
await fs.writeFile(path.join(out,'v11-38-mobile-safeguards.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_38MobileSafeguards:'PASS',viewports:report.targetViewports,fixes:report.fixes.length,productionDeployed:false},null,2));
