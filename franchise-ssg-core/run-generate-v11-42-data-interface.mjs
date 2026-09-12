import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const cssPath=path.join(out,'assets/site.css');
const jsPath=path.join(out,'assets/v42-interface.js');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);

const counts={genericScenesRemoved:0,photoBreaksRemoved:0,insetPhotosRemoved:0,orbitsRemoved:0,detailIndexRemoved:0,parallaxAttrsRemoved:0,patchedHtmlPages:0};
function stripPattern(html,re,key){return html.replace(re,m=>{counts[key]++;return ''})}
function patchBody(html){return html.replace(/<body\b([^>]*)>/i,(full,attrs)=>{
  let a=attrs||'';
  if(/\bclass="[^"]*"/i.test(a))a=a.replace(/\bclass="([^"]*)"/i,(m,c)=>{const list=c.split(/\s+/).filter(Boolean);if(!list.includes('v42-data-ui'))list.push('v42-data-ui');return `class="${list.join(' ')}"`});
  else a=` class="v42-data-ui"${a}`;
  if(!/\bdata-v42-interface=/i.test(a))a+=' data-v42-interface="1"';
  return `<body${a}>`;
})}

for(const file of htmlFiles){
  let html=await fs.readFile(file,'utf8');
  const before=html;
  html=stripPattern(html,/<section class="v41-generic-scene"\b[\s\S]*?<\/section>/g,'genericScenesRemoved');
  html=stripPattern(html,/<section class="v41-photo-break"\b[\s\S]*?<\/section>/g,'photoBreaksRemoved');
  html=stripPattern(html,/<figure class="v41-shot v41-shot-inset"\b[\s\S]*?<\/figure>/g,'insetPhotosRemoved');
  html=stripPattern(html,/<div class="v41-orbit"\b[\s\S]*?<\/div>/g,'orbitsRemoved');
  html=stripPattern(html,/<div class="v41-detail-index"\b[\s\S]*?<\/div>/g,'detailIndexRemoved');
  html=html.replace(/\sdata-v41-parallax(?:="[^"]*")?/g,m=>{counts.parallaxAttrsRemoved++;return ''});
  html=patchBody(html);
  if(!html.includes('/assets/v42-interface.js'))html=html.replace('</body>','<script defer src="/pm-lab/franchise-ssg-preview/assets/v42-interface.js"></script></body>');
  if(html!==before){await fs.writeFile(file,html,'utf8');counts.patchedHtmlPages++;}
}

let css=await fs.readFile(cssPath,'utf8');
css=css.replace(/\/\* v11\.42 data interface \*\/[\s\S]*?\/\* v11\.42 data interface end \*\//g,'').trimEnd();
const uiCss=String.raw`
/* v11.42 data interface */
body.v42-data-ui{--v42-line:#293129;--v42-panel:#0c100d;--v42-panel2:#101511;--v42-soft:#151b16;--v42-accent:#c8ff3d;--v42-muted:#8c968d}
body.v42-data-ui .v41-generic-scene,body.v42-data-ui .v41-photo-break,body.v42-data-ui .v41-shot-inset,body.v42-data-ui .v41-orbit,body.v42-data-ui .v41-detail-index{display:none!important}
body.v42-data-ui [data-v41-parallax]{transform:none!important}
body.v42-data-ui .v41-global-tape{height:28px;display:flex;align-items:center;overflow:hidden;border-block-color:#202720;background:#0a0d0b}
body.v42-data-ui .v41-global-tape>div{font-size:10px;line-height:28px;gap:20px;white-space:nowrap}
body.v42-data-ui .v41-global-tape b{color:#c8ff3d;font-weight:650}
body.v42-data-ui .shell{min-width:0}
body.v42-data-ui main,body.v42-data-ui article,body.v42-data-ui section,body.v42-data-ui div{min-width:0}
body.v42-data-ui h1,body.v42-data-ui h2,body.v42-data-ui h3,body.v42-data-ui strong,body.v42-data-ui b{overflow-wrap:anywhere}

/* Hero: one purposeful image, protected text zones */
body.v42-data-ui .v41-home-hero{display:grid;grid-template-columns:minmax(0,.9fr) minmax(420px,1.1fr);gap:clamp(28px,5vw,72px);align-items:center;min-height:clamp(620px,80vh,860px);padding:46px 0 58px}
body.v42-data-ui .v41-home-copy{position:relative;z-index:2;align-self:center;min-width:0}
body.v42-data-ui .v41-home-copy .v25-head{padding:0;border:0}
body.v42-data-ui .v41-home-copy .v25-head h1{max-width:8.5ch;font-size:clamp(48px,7vw,92px);line-height:.93;letter-spacing:-.065em}
body.v42-data-ui .v41-home-media{position:relative;min-height:clamp(460px,58vw,690px);overflow:hidden;border:1px solid #293129;background:#0b0e0c}
body.v42-data-ui .v41-shot-main{position:absolute;inset:0;margin:0;overflow:hidden}
body.v42-data-ui .v41-shot-main img{display:block;width:100%;height:100%;object-fit:cover;object-position:center;transform:none!important}
body.v42-data-ui .v41-frame-label{z-index:3;max-width:calc(100% - 32px)}
body.v42-data-ui .v41-kicker{margin-bottom:18px;color:#a6b0a7;font:600 10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.12em}

body.v42-data-ui .v41-detail-hero{position:relative;display:flex;align-items:flex-end;min-height:clamp(520px,70vh,720px);overflow:hidden;border-bottom:1px solid #293129}
body.v42-data-ui .v41-detail-photo{position:absolute;inset:0;overflow:hidden}
body.v42-data-ui .v41-detail-photo img{width:100%;height:100%;object-fit:cover;object-position:center;transform:none!important}
body.v42-data-ui .v41-detail-wash{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(6,8,7,.05) 18%,rgba(6,8,7,.45) 58%,rgba(6,8,7,.94) 100%)}
body.v42-data-ui .v41-detail-hero .brand-header{position:relative;z-index:2;width:100%;padding:34px 0 30px;border:0;margin:0}
body.v42-data-ui .v41-detail-hero .brand-header-main{grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:end}
body.v42-data-ui .v41-detail-hero .brand-header h1{max-width:14ch;margin:5px 0 10px;font-size:clamp(44px,7vw,82px);line-height:.95;letter-spacing:-.06em}
body.v42-data-ui .v41-detail-hero .brand-actions{max-width:320px;align-self:end}
body.v42-data-ui .v41-detail-hero .brand-toc{margin-top:24px;overflow:hidden;border-color:#3a443b}
body.v42-data-ui .v41-detail-hero .brand-toc nav{display:flex;flex-wrap:nowrap;gap:20px;overflow-x:auto;overscroll-behavior-inline:contain;scrollbar-width:thin;padding-bottom:2px}
body.v42-data-ui .v41-detail-hero .brand-toc a{flex:0 0 auto;white-space:nowrap;color:#c5cec6}
body.v42-data-ui .v41-scroll-cue{z-index:3;right:20px;bottom:18px}

body.v42-data-ui .v41-category-scene{position:relative;min-height:clamp(300px,42vw,470px);overflow:hidden;border:1px solid #293129;margin-bottom:22px}
body.v42-data-ui .v41-category-photo{position:absolute;inset:0}
body.v42-data-ui .v41-category-photo img{width:100%;height:100%;object-fit:cover;object-position:center;transform:none!important}
body.v42-data-ui .v41-category-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,8,7,.08),rgba(6,8,7,.88))}
body.v42-data-ui .v41-category-type{position:absolute;z-index:2;left:clamp(20px,4vw,48px);right:clamp(20px,4vw,48px);bottom:clamp(22px,4vw,44px);display:grid;gap:6px;align-content:end}
body.v42-data-ui .v41-category-type span,body.v42-data-ui .v41-category-type em{font:600 10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.12em;color:#b3bdb4}
body.v42-data-ui .v41-category-type b{max-width:16ch;font-size:clamp(38px,6vw,72px);line-height:.95;letter-spacing:-.055em;color:#fff}

/* Data density and visual hierarchy */
body.v42-data-ui .v35-brand-workspace{position:relative;z-index:3}
body.v42-data-ui .v35-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;margin-top:-22px;border:1px solid #303830;background:#0a0e0b}
body.v42-data-ui .v35-kpis>div{min-width:0;padding:18px 16px;border-right:1px solid #293129}
body.v42-data-ui .v35-kpis>div:last-child{border-right:0}
body.v42-data-ui .v35-kpis span{display:block;margin-bottom:5px;color:#7f8a80;font:600 10px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.06em}
body.v42-data-ui .v35-kpis strong{display:block;white-space:nowrap;font:650 clamp(20px,2vw,29px)/1.15 ui-monospace,SFMono-Regular,Consolas,monospace;color:#f2f5ef}
body.v42-data-ui .v35-panel{padding:30px 0;border-bottom:1px solid #293129}
body.v42-data-ui .v35-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding-bottom:12px;border-bottom:1px solid #303830}
body.v42-data-ui .v35-section-head h2{margin:0;font-size:19px}
body.v42-data-ui .v35-section-head>span{white-space:nowrap;color:#a4aea5;font:600 11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v42-data-ui .v35-benchmarks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
body.v42-data-ui .v35-benchmark{min-width:0;padding:15px;border:1px solid #293129;background:#0c100d}
body.v42-data-ui .v35-benchmark-head{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:9px;align-items:baseline}
body.v42-data-ui .v35-benchmark-head strong,body.v42-data-ui .v35-benchmark-head em{white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
body.v42-data-ui .v35-track{margin-top:14px}
body.v42-data-ui .v35-comp-row{display:grid;grid-template-columns:minmax(130px,1fr) auto 64px;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #222922}
body.v42-data-ui .v35-comp-row strong,body.v42-data-ui .v35-comp-row em{white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;text-align:right}

body.v42-data-ui .v25-cathead{display:grid;grid-template-columns:minmax(180px,.7fr) minmax(0,1.3fr);gap:32px;align-items:end;padding:20px 0 26px;border-bottom:1px solid #293129}
body.v42-data-ui .v25-cathead h1{margin:0;font-size:clamp(38px,5vw,62px);line-height:.98}
body.v42-data-ui .v25-cathead .v25-rail{margin:0}
body.v42-data-ui .distribution-block,body.v42-data-ui .v26-category-area{margin-top:42px}
body.v42-data-ui .category-scatter{display:block;width:100%;max-height:520px;background:#0b0f0c;border:1px solid #293129}
body.v42-data-ui .v26-area-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #293129;border-bottom:0;background:#0c100d}
body.v42-data-ui .v26-area-summary span{padding:13px 15px;border-right:1px solid #293129;color:#7e897f;font-size:11px}
body.v42-data-ui .v26-area-summary span:last-child{border-right:0}
body.v42-data-ui .v26-area-summary b{display:block;margin-top:3px;color:#eef2ec;font:650 19px/1.25 ui-monospace,SFMono-Regular,Consolas,monospace}
body.v42-data-ui .v26-area-row{display:grid;grid-template-columns:minmax(130px,1fr) minmax(160px,2.2fr) auto;gap:14px;align-items:center;padding:11px 0;border-top:1px solid #242b25;color:#dfe4de}
body.v42-data-ui .v26-area-row strong{white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}

/* Tables: easier scanning, less decorative chrome */
body.v42-data-ui .table-scroll,body.v42-data-ui .table-wrap,body.v42-data-ui .v39-table-wrap{position:relative;max-width:100%;overflow-x:auto;overscroll-behavior-inline:contain;scrollbar-gutter:stable;border:1px solid #293129;border-top-color:#3a443b;background:#0a0d0b}
body.v42-data-ui table{min-width:680px}
body.v42-data-ui table th,body.v42-data-ui table td{padding:11px 12px;border-color:#242b25}
body.v42-data-ui table thead th{background:#111612!important;color:#aeb7af!important;font-size:10px!important;text-transform:none;letter-spacing:.04em}
body.v42-data-ui table tbody tr:nth-child(even){background:#0c100d}
body.v42-data-ui table tbody tr:hover{background:#121812}
body.v42-data-ui table td.num,body.v42-data-ui table th.num{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-variant-numeric:tabular-nums}
body.v42-data-ui .v42-scrollable::after{content:"↔ 가로 스크롤";position:sticky;right:8px;bottom:6px;float:right;padding:3px 6px;background:rgba(9,11,10,.88);border:1px solid #303830;color:#758076;font:9px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;pointer-events:none}

/* Compare / tools: interaction first */
body.v42-data-ui .v34-workspace,body.v42-data-ui .v36-workspace{margin-top:8px}
body.v42-data-ui .v34-workspace-head,body.v42-data-ui .v36-stage-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid #303830}
body.v42-data-ui .v34-pickers{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:14px 0}
body.v42-data-ui .v34-pickers label{min-width:0;display:grid;gap:5px;color:#8d978e;font-size:10px}
body.v42-data-ui .v34-pickers select{width:100%;min-width:0;min-height:48px}
body.v42-data-ui .v36-brandbar{background:#0c100d;border:1px solid #293129;padding:12px 14px}
body.v42-data-ui .v36-brandbar label{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center}
body.v42-data-ui .v36-brandbar select{width:100%;min-width:0;min-height:48px}
body.v42-data-ui .v36-stage{padding:22px 0;border-bottom:1px solid #293129}
body.v42-data-ui .v36-results,body.v42-data-ui .calc-result-panel{background:#0c100d;border-color:#303830}

/* Auto-generated section navigation */
body.v42-data-ui .v42-jump{position:sticky;top:68px;z-index:22;margin:0 0 24px;border-block:1px solid #293129;background:rgba(9,11,10,.96);backdrop-filter:blur(12px)}
body.v42-data-ui .v42-jump>div{display:flex;gap:0;overflow-x:auto;scrollbar-width:none}
body.v42-data-ui .v42-jump a{flex:0 0 auto;min-height:42px;display:flex;align-items:center;padding:0 14px;border-right:1px solid #242b25;color:#8e988f;font-size:11px;white-space:nowrap}
body.v42-data-ui .v42-jump a:hover,body.v42-data-ui .v42-jump a.is-active{background:#111711;color:#c8ff3d}

/* Overlap guards */
body.v42-data-ui .section-head,body.v42-data-ui .v25-sec header,body.v42-data-ui .v34-workspace-head,body.v42-data-ui .v36-stage-head{min-width:0;flex-wrap:wrap}
body.v42-data-ui .section-head>*:first-child,body.v42-data-ui .v25-sec header>*:first-child{min-width:0}
body.v42-data-ui .meta-line{row-gap:5px}
body.v42-data-ui .actions,body.v42-data-ui .brand-actions{min-width:0}
body.v42-data-ui svg text{font-size:11px;fill:#9ba59c}

@media(max-width:1040px){
 body.v42-data-ui .v41-home-hero{grid-template-columns:minmax(0,1fr) minmax(340px,.9fr);gap:28px;min-height:auto}
 body.v42-data-ui .v41-home-copy .v25-head h1{font-size:clamp(46px,7vw,76px)}
 body.v42-data-ui .v35-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}
 body.v42-data-ui .v35-kpis>div{border-bottom:1px solid #293129}
 body.v42-data-ui .v35-kpis>div:nth-child(3n){border-right:0}
 body.v42-data-ui .v25-cathead{grid-template-columns:1fr}
 body.v42-data-ui .v34-pickers{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:760px){
 body.v42-data-ui .v41-global-tape{height:24px}
 body.v42-data-ui .v41-global-tape>div{line-height:24px;font-size:9px}
 body.v42-data-ui .v41-home-hero{display:block;padding:28px 0 40px}
 body.v42-data-ui .v41-home-media{min-height:420px;margin-top:26px}
 body.v42-data-ui .v41-home-copy .v25-head h1{max-width:10ch;font-size:clamp(42px,14vw,68px)}
 body.v42-data-ui .v41-detail-hero{min-height:520px}
 body.v42-data-ui .v41-detail-hero .brand-header-main{grid-template-columns:1fr;align-items:start}
 body.v42-data-ui .v41-detail-hero .brand-header h1{font-size:clamp(40px,13vw,64px);max-width:12ch}
 body.v42-data-ui .v41-detail-hero .brand-actions{justify-content:flex-start;max-width:none}
 body.v42-data-ui .v41-scroll-cue{display:none}
 body.v42-data-ui .v41-category-scene{min-height:300px}
 body.v42-data-ui .v35-kpis{margin-top:0;grid-template-columns:repeat(2,minmax(0,1fr))}
 body.v42-data-ui .v35-kpis>div:nth-child(3n){border-right:1px solid #293129}
 body.v42-data-ui .v35-kpis>div:nth-child(2n){border-right:0}
 body.v42-data-ui .v35-kpis strong{font-size:20px}
 body.v42-data-ui .v35-benchmarks{grid-template-columns:1fr}
 body.v42-data-ui .v35-benchmark-head{grid-template-columns:minmax(0,1fr) auto}
 body.v42-data-ui .v35-benchmark-head em{grid-column:1/-1;text-align:left}
 body.v42-data-ui .v35-comp-row{grid-template-columns:minmax(110px,1fr) auto 54px;gap:8px}
 body.v42-data-ui .v26-area-row{grid-template-columns:minmax(100px,1fr) minmax(100px,1.4fr) auto;gap:9px}
 body.v42-data-ui .v34-pickers{grid-template-columns:1fr}
 body.v42-data-ui .v36-brandbar label{grid-template-columns:1fr}
 body.v42-data-ui .v42-jump{top:68px;margin-inline:calc(50% - 50vw);padding-inline:calc(50vw - 50%)}
}
@media(max-width:430px){
 body.v42-data-ui .v41-home-media{min-height:330px}
 body.v42-data-ui .v41-detail-hero{min-height:480px}
 body.v42-data-ui .v41-detail-hero .brand-header{padding-bottom:20px}
 body.v42-data-ui .v41-detail-hero .brand-header h1{font-size:clamp(36px,12vw,52px)}
 body.v42-data-ui .v41-category-type b{font-size:clamp(34px,12vw,48px)}
 body.v42-data-ui .v35-kpis>div{padding:14px 11px}
 body.v42-data-ui .v35-kpis strong{font-size:18px}
 body.v42-data-ui .v26-area-summary{grid-template-columns:1fr}
 body.v42-data-ui .v26-area-summary span{border-right:0;border-bottom:1px solid #293129}
 body.v42-data-ui .v26-area-row{grid-template-columns:minmax(95px,1fr) minmax(80px,1fr);}
 body.v42-data-ui .v26-area-row strong{grid-column:1/-1;text-align:right}
 body.v42-data-ui .v35-comp-row{grid-template-columns:1fr auto}
 body.v42-data-ui .v35-comp-row em{grid-column:1/-1;text-align:left;color:#818b82}
}
@media(prefers-reduced-motion:reduce){body.v42-data-ui .v41-global-tape>div{animation:none!important}body.v42-data-ui *{scroll-behavior:auto!important}}
/* v11.42 data interface end */`;
await fs.writeFile(cssPath,`${css}\n\n${uiCss}\n`,'utf8');

const uiJs=String.raw`(()=>{
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wrappers=[...document.querySelectorAll('.table-scroll,.table-wrap,.v39-table-wrap')];
  const markOverflow=()=>wrappers.forEach(w=>w.classList.toggle('v42-scrollable',w.scrollWidth>w.clientWidth+4));
  markOverflow();addEventListener('resize',markOverflow,{passive:true});
  const body=document.body;
  if(!body.classList.contains('v25-home')&&!document.querySelector('.brand-toc')){
    const heads=[...document.querySelectorAll('main h2')].filter(h=>h.textContent.trim()&&!h.closest('footer')).slice(0,6);
    if(heads.length>=2){
      heads.forEach((h,i)=>{if(!h.id)h.id='v42-section-'+(i+1)});
      const nav=document.createElement('nav');nav.className='v42-jump';nav.setAttribute('aria-label','페이지 바로가기');
      const inner=document.createElement('div');
      heads.forEach(h=>{const a=document.createElement('a');a.href='#'+h.id;a.textContent=h.textContent.trim().replace(/\s+/g,' ');inner.appendChild(a)});nav.appendChild(inner);
      const anchor=document.querySelector('.v25-cathead,.page-head,.v34-workspace,.v36-title');
      if(anchor)anchor.insertAdjacentElement('afterend',nav);else{const c=document.querySelector('main .crumbs');if(c)c.insertAdjacentElement('afterend',nav)}
      const links=[...inner.querySelectorAll('a')];
      if('IntersectionObserver'in window){const io=new IntersectionObserver(es=>{const hit=es.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!hit)return;links.forEach(a=>a.classList.toggle('is-active',a.getAttribute('href')==='#'+hit.target.id))},{rootMargin:'-28% 0px -62% 0px',threshold:[0,.2,.6]});heads.forEach(h=>io.observe(h))}
    }
  }
  document.querySelectorAll('.v35-benchmark,.v35-comp-row,.v26-area-row,.v34-workspace,.v36-stage').forEach(el=>el.dataset.v42Data='1');
  if(reduce)document.documentElement.classList.add('v42-reduced-motion');
})();`;
await fs.writeFile(jsPath,uiJs,'utf8');

const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.42';
manifest.v11_42={dataFirstInterface:true,overlapGuard:true,photographyTrimmed:true,genericScenesRemoved:true,pointerParallaxRemoved:true,autoSectionNav:true,tableScanability:true,candidateSetChanged:false,indexPolicyChanged:false,dataSemanticsChanged:false,productionDeployed:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');

const report={schemaVersion:1,uiVersion:'11.42',generatedAt:new Date().toISOString(),allHtmlPages:htmlFiles.length,candidatePages:candidates.length,...counts,retainedPhotography:{homeHero:1,brandHeroes:136,categoryScenes:16},removedPhotographyPolicy:'REMOVE_GENERIC_AND_DUPLICATE_PHOTOS; RETAIN_CONTEXTUAL_HERO_ONLY',interface:['overlap guards','responsive KPI grid','compact benchmarks','scan-friendly tables','auto section navigation','mobile-safe comparison selectors','tool input hierarchy'],motionPolicy:'KEEP_REVEAL_COUNTUP_TICKER; REMOVE_POINTER_PARALLAX_AND_DECORATIVE_ORBITS',productionDeployed:false};
await fs.writeFile(path.join(out,'v11-42-data-interface.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
