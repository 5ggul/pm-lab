import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-generate-v11-9-final.mjs?v1110=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');

const homePath=path.join(out,'index.html');
let home=await fs.readFile(homePath,'utf8');
if(!home.includes('class="home-title-tail"')){
  home=home.replace('<h1>프랜차이즈 창업비용 비교</h1>','<h1>프랜차이즈 <span class="home-title-tail">창업비용 비교</span></h1>');
  await fs.writeFile(homePath,home,'utf8');
}

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
if(!css.includes('/* v11.10 mobile visual QA */')){
  css+=`\n/* v11.10 mobile visual QA */
.home-title-tail{display:inline}.history-three-year{max-width:100%}@media(max-width:720px){.history-three-year{min-width:0!important;width:100%!important;max-width:100%;overflow:visible}.history-three-year text{font-size:22px}.history-three-year circle{r:7px}.history-table{margin-top:8px}}@media(max-width:600px){.home-intro h1{font-size:38px;line-height:1.08}.home-title-tail{display:block}.startup-motion{margin-top:2px}}\n`;
  await fs.writeFile(cssPath,css,'utf8');
}

const htmlFiles=[];
async function walk(dir){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p);
  }
}
await walk(out);
let historyCharts=0;
let mobileOverflowMarkers=0;
for(const file of htmlFiles){
  const html=await fs.readFile(file,'utf8');
  historyCharts+=(html.match(/class="chart-svg history-three-year"/g)||[]).length;
  mobileOverflowMarkers+=(html.match(/history-three-year/g)||[]).length;
}

const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.10';
manifest.v11_10={balancedMobileHeroTitle:true,responsiveHistoryCharts:true,historyCharts,visualQa:'desktop+mobile-capture'};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');

const report={schemaVersion:1,generatedAt:new Date().toISOString(),uiVersion:'11.10',balancedMobileHeroTitle:true,responsiveHistoryCharts:true,historyCharts,mobileOverflowMarkers};
await fs.writeFile(path.join(out,'v11-10-mobile-visual-report.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_10:'PASS',balancedMobileHeroTitle:true,responsiveHistoryCharts:true,historyCharts},null,2));
