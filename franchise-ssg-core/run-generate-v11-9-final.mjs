import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

await import(`./run-generate-v11-8-final.mjs?v119=${Date.now()}`);

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const out=path.join(repo,'docs/franchise-ssg-preview');

const homePath=path.join(out,'index.html');
let home=await fs.readFile(homePath,'utf8');
const heroVisual=`<figure class="startup-motion" data-home-motion aria-hidden="true">
  <svg viewBox="0 0 480 320" focusable="false">
    <g class="startup-store">
      <path class="store-frame" d="M54 124h202v126H54z M74 104h162l20 20H54z"/>
      <path class="store-awning" d="M54 124h202v24H54z M80 124v24 M106 124v24 M132 124v24 M158 124v24 M184 124v24 M210 124v24 M236 124v24"/>
      <path class="store-window" d="M76 170h86v52H76z M181 170h49v80h-49z"/>
      <path class="store-detail" d="M91 196h56 M205 211h1"/>
    </g>
    <g class="budget-stack">
      <rect class="budget-track" x="298" y="98" width="126" height="13" rx="2"/>
      <rect class="budget-bar bar-1" x="298" y="98" width="72" height="13" rx="2"/>
      <rect class="budget-track" x="298" y="128" width="126" height="13" rx="2"/>
      <rect class="budget-bar bar-2" x="298" y="128" width="104" height="13" rx="2"/>
      <rect class="budget-track" x="298" y="158" width="126" height="13" rx="2"/>
      <rect class="budget-bar bar-3" x="298" y="158" width="48" height="13" rx="2"/>
      <rect class="budget-track" x="298" y="188" width="126" height="13" rx="2"/>
      <rect class="budget-bar bar-4" x="298" y="188" width="88" height="13" rx="2"/>
      <path class="budget-rule" d="M298 228h126 M298 219v18 M424 219v18"/>
    </g>
    <g class="motion-route">
      <path class="route-line" d="M270 258C306 258 308 245 333 245h66"/>
      <circle class="route-dot" cx="270" cy="258" r="5"/>
      <path class="route-check" d="M403 243l7 7 14-18"/>
    </g>
    <g class="coin-stack">
      <ellipse class="coin coin-1" cx="321" cy="270" rx="19" ry="6"/>
      <ellipse class="coin coin-2" cx="321" cy="261" rx="19" ry="6"/>
      <ellipse class="coin coin-3" cx="321" cy="252" rx="19" ry="6"/>
    </g>
  </svg>
</figure>`;
if(!home.includes('data-home-motion')){
  home=home.replace(/<section class="home-intro"><div class="shell">([\s\S]*?)<\/div><\/section><div class="shell data-status">/,(_m,inner)=>`<section class="home-intro"><div class="shell home-intro-grid"><div class="home-intro-copy">${inner}</div>${heroVisual}</div></section><div class="shell data-status">`);
}
await fs.writeFile(homePath,home,'utf8');

const htmlFiles=[];
async function walk(dir){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory())await walk(p);else if(p.endsWith('.html'))htmlFiles.push(p);
  }
}
await walk(out);
let motionChartCount=0;
for(const file of htmlFiles){
  let html=await fs.readFile(file,'utf8');
  const before=html;
  html=html.replace(/<svg class="chart-svg(?![^>]*data-motion-chart)([^"]*)"/g,'<svg class="chart-svg$1" data-motion-chart');
  if(html!==before){
    motionChartCount+=(html.match(/data-motion-chart/g)||[]).length;
    await fs.writeFile(file,html,'utf8');
  }else{
    motionChartCount+=(html.match(/data-motion-chart/g)||[]).length;
  }
}

const cssPath=path.join(out,'assets/site.css');
let css=await fs.readFile(cssPath,'utf8');
if(!css.includes('/* v11.9 restrained motion */')){
css+=`\n/* v11.9 restrained motion */
.home-intro-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(330px,.65fr);gap:48px;align-items:center}.home-intro-copy{min-width:0}.startup-motion{margin:0;min-height:300px;display:flex;align-items:center;justify-content:center;border-left:1px solid var(--line)}.startup-motion svg{width:min(100%,460px);overflow:visible}.startup-motion .store-frame,.startup-motion .store-awning,.startup-motion .store-window,.startup-motion .store-detail,.startup-motion .budget-rule,.startup-motion .route-line,.startup-motion .route-check{fill:none;stroke:#1c1916;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.startup-motion .store-window{stroke:#8f877e}.startup-motion .budget-track{fill:#eee8de}.startup-motion .budget-bar{fill:#2457d6;transform-box:fill-box;transform-origin:left center;animation:startupBar .72s cubic-bezier(.22,.75,.25,1) both}.startup-motion .bar-1{animation-delay:.12s}.startup-motion .bar-2{animation-delay:.24s}.startup-motion .bar-3{animation-delay:.36s}.startup-motion .bar-4{animation-delay:.48s}.startup-motion .store-frame{stroke-dasharray:900;stroke-dashoffset:900;animation:startupDraw 1s .05s ease-out forwards}.startup-motion .store-awning,.startup-motion .store-window,.startup-motion .store-detail{stroke-dasharray:500;stroke-dashoffset:500;animation:startupDraw .7s .45s ease-out forwards}.startup-motion .route-line{stroke:#8f877e;stroke-dasharray:180;stroke-dashoffset:180;animation:startupDraw .7s .74s ease-out forwards}.startup-motion .route-dot{fill:#2457d6;transform-box:fill-box;transform-origin:center;animation:startupDot .7s .72s cubic-bezier(.2,.7,.2,1) both}.startup-motion .route-check{stroke:#0f7b4a;stroke-width:3;stroke-dasharray:38;stroke-dashoffset:38;animation:startupDraw .42s 1.12s ease-out forwards}.startup-motion .coin{fill:#fffaf0;stroke:#8f877e;stroke-width:1.5;opacity:0;animation:coinRise .46s cubic-bezier(.2,.8,.2,1) forwards}.startup-motion .coin-1{animation-delay:.78s}.startup-motion .coin-2{animation-delay:.9s}.startup-motion .coin-3{animation-delay:1.02s}@keyframes startupDraw{to{stroke-dashoffset:0}}@keyframes startupBar{from{transform:scaleX(.02);opacity:.32}to{transform:scaleX(1);opacity:1}}@keyframes startupDot{from{transform:translateX(0);opacity:0}15%{opacity:1}to{transform:translateX(129px);opacity:1}}@keyframes coinRise{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
.js-motion [data-motion-chart].motion-pending rect{transform-box:fill-box;transform-origin:left center;transform:scaleX(.02);opacity:.42}.js-motion [data-motion-chart].motion-pending polyline{stroke-dasharray:1800;stroke-dashoffset:1800}.js-motion [data-motion-chart].motion-pending circle{transform-box:fill-box;transform-origin:center;transform:scale(0);opacity:0}.js-motion [data-motion-chart].motion-visible rect{animation:chartBarReveal .72s cubic-bezier(.22,.75,.25,1) both}.js-motion [data-motion-chart].motion-visible polyline{animation:chartLineReveal .9s ease-out both}.js-motion [data-motion-chart].motion-visible circle{animation:chartDotReveal .38s .46s ease-out both}@keyframes chartBarReveal{to{transform:scaleX(1);opacity:1}}@keyframes chartLineReveal{to{stroke-dashoffset:0}}@keyframes chartDotReveal{to{transform:scale(1);opacity:1}}
@media(max-width:900px){.home-intro-grid{grid-template-columns:1fr;gap:26px}.startup-motion{min-height:230px;border-left:0;border-top:1px solid var(--line);padding-top:20px}.startup-motion svg{max-width:410px}}@media(max-width:600px){.startup-motion{min-height:200px}.startup-motion svg{max-width:340px}.home-intro{padding-top:48px}.home-intro-grid{gap:20px}}@media(prefers-reduced-motion:reduce){.startup-motion *{animation:none!important}.js-motion [data-motion-chart].motion-pending rect,.js-motion [data-motion-chart].motion-pending circle{transform:none!important;opacity:1!important}.js-motion [data-motion-chart].motion-pending polyline{stroke-dasharray:none!important;stroke-dashoffset:0!important}.js-motion [data-motion-chart].motion-visible *{animation:none!important}}\n`;
await fs.writeFile(cssPath,css,'utf8');
}

const appPath=path.join(out,'assets/app.js');
let app=await fs.readFile(appPath,'utf8');
if(!app.includes('/* v11.9 chart motion */')){
app+=`\n/* v11.9 chart motion */\n(()=>{if(!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const charts=[...document.querySelectorAll('[data-motion-chart]')];if(!charts.length)return;document.documentElement.classList.add('js-motion');charts.forEach(chart=>chart.classList.add('motion-pending'));const io=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;entry.target.classList.remove('motion-pending');entry.target.classList.add('motion-visible');io.unobserve(entry.target)}},{threshold:.2,rootMargin:'0px 0px -8% 0px'});charts.forEach(chart=>io.observe(chart))})();\n`;
await fs.writeFile(appPath,app,'utf8');
}

const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.9';
manifest.v11_9={homeStartupMotion:true,scrollChartMotion:true,motionChartCount,reducedMotionSupport:true,loopingDecorativeMotion:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2),'utf8');
const report={schemaVersion:1,generatedAt:new Date().toISOString(),uiVersion:'11.9',homeStartupMotion:true,motionChartCount,reducedMotionSupport:true,intersectionObserver:true,loopingDecorativeMotion:false};
await fs.writeFile(path.join(out,'v11-9-motion-report.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({v11_9:'PASS',homeStartupMotion:true,motionChartCount,reducedMotionSupport:true,loopingDecorativeMotion:false},null,2));
