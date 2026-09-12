import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const cssPath=path.join(out,'assets/site.css');
const manifestPath=path.join(out,'route-manifest.json');
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);

const stats={patchedHtmlPages:0,homeTitleFixed:false,compareLabels:0,toolBrandLabels:0,basisLabels:0};
function patchBody(html){return html.replace(/<body\b([^>]*)>/i,(full,attrs)=>{let a=attrs||'';if(/\bclass="[^"]*"/i.test(a))a=a.replace(/\bclass="([^"]*)"/i,(m,c)=>{const list=c.split(/\s+/).filter(Boolean);if(!list.includes('v43-control-ui'))list.push('v43-control-ui');return `class="${list.join(' ')}"`});else a=` class="v43-control-ui"${a}`;if(!/\bdata-v43-control-ux=/i.test(a))a+=' data-v43-control-ux="1"';return `<body${a}>`})}

for(const file of htmlFiles){
  let html=await fs.readFile(file,'utf8');const before=html;
  html=patchBody(html);
  if(file===path.join(out,'index.html')){
    const old='<h1>프랜차이즈 비교</h1>';
    const next='<h1 class="v43-home-title"><span>프랜차이즈</span><span>비교</span></h1>';
    if(html.includes(old)){html=html.replace(old,next);stats.homeTitleFixed=true}
    html=html.replace('placeholder="브랜드명 또는 업종"','placeholder="브랜드 또는 업종을 검색하세요"');
  }
  html=html.replace(/<label>브랜드([1-4])<select/g,(m,n)=>{stats.compareLabels++;return `<label><span class="v43-field-label">비교 브랜드 ${n}</span><select`});
  html=html.replace(/<label>브랜드<select/g,m=>{stats.toolBrandLabels++;return '<label><span class="v43-field-label">브랜드 선택</span><select'});
  html=html.replace(/<summary>기준<\/summary>/g,m=>{stats.basisLabels++;return '<summary>비교 기준 보기</summary>'});
  if(!html.includes('/assets/v43-control-ux.js'))html=html.replace('</body>','<script defer src="/pm-lab/franchise-ssg-preview/assets/v43-control-ux.js"></script></body>');
  if(html!==before){await fs.writeFile(file,html,'utf8');stats.patchedHtmlPages++;}
}

let css=await fs.readFile(cssPath,'utf8');
css=css.replace(/\/\* v11\.43 control ux \*\/[\s\S]*?\/\* v11\.43 control ux end \*\//g,'').trimEnd();
css+=String.raw`

/* v11.43 control ux */
body.v43-control-ui{--v43-control:#111612;--v43-control-hover:#161d17;--v43-focus:#d8ff73}
body.v43-control-ui button,body.v43-control-ui .button,body.v43-control-ui .text-button,body.v43-control-ui input,body.v43-control-ui select,body.v43-control-ui textarea,body.v43-control-ui summary{font-family:inherit}
body.v43-control-ui button,body.v43-control-ui .button,body.v43-control-ui .text-button{min-height:46px;padding:0 16px;border-radius:6px;font-size:14px;font-weight:700;letter-spacing:-.015em;cursor:pointer;transition:background-color .16s ease,border-color .16s ease,color .16s ease,transform .08s ease}
body.v43-control-ui button:active,body.v43-control-ui .button:active,body.v43-control-ui .text-button:active{transform:translateY(1px)}
body.v43-control-ui input,body.v43-control-ui select,body.v43-control-ui textarea{min-height:48px;padding:0 14px;border:1px solid #374138!important;border-radius:6px!important;background:#0e130f!important;font-size:15px;line-height:1.3}
body.v43-control-ui select{padding-right:38px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a8b2a9' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")!important;background-repeat:no-repeat!important;background-position:right 12px center!important;appearance:none}
body.v43-control-ui input:hover,body.v43-control-ui select:hover,body.v43-control-ui textarea:hover{border-color:#566258!important;background-color:#111712!important}
body.v43-control-ui input:focus,body.v43-control-ui select:focus,body.v43-control-ui textarea:focus{border-color:#c8ff3d!important;box-shadow:0 0 0 3px rgba(200,255,61,.12)!important;outline:0}
body.v43-control-ui label{display:grid;gap:8px;min-width:0;color:#cbd2cc;font-size:13px;font-weight:650}
body.v43-control-ui .v43-field-label{display:flex;align-items:center;min-height:18px;color:#c7cec8;font-size:12px;font-weight:700;letter-spacing:-.01em}
body.v43-control-ui .nav-toggle{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:86px;padding-inline:12px}
body.v43-control-ui .nav-toggle::before{content:"";width:15px;height:10px;border-top:2px solid currentColor;border-bottom:2px solid currentColor;box-shadow:inset 0 3px transparent}
body.v43-control-ui .v25-search{grid-template-columns:minmax(0,1fr) 94px;border-radius:7px;overflow:hidden}
body.v43-control-ui .v25-search input{min-height:52px;border:0!important;border-radius:0!important;font-size:16px}
body.v43-control-ui .v25-search button{min-height:52px;border:0!important;border-left:1px solid #2b332c!important;border-radius:0!important;font-size:14px}
body.v43-control-ui .v43-home-title{display:flex!important;flex-wrap:nowrap!important;align-items:baseline;gap:.17em;max-width:none!important;width:max-content;white-space:nowrap!important;text-wrap:nowrap!important}
body.v43-control-ui .v43-home-title span{display:inline!important;white-space:nowrap!important}
body.v43-control-ui .v41-home-copy .v25-head h1{max-width:none!important}
body.v43-control-ui details.v28-basis{border-top:1px solid #242b25;border-bottom:1px solid #242b25;background:#0b0f0c}
body.v43-control-ui details.v28-basis summary{display:flex;align-items:center;justify-content:space-between;min-height:42px;padding:0 12px;border:0;border-radius:0;color:#aeb8af;font-size:12px;font-weight:650;cursor:pointer;list-style:none}
body.v43-control-ui details.v28-basis summary::-webkit-details-marker{display:none}
body.v43-control-ui details.v28-basis summary::after{content:"＋";font-size:16px;color:#c8ff3d}
body.v43-control-ui details.v28-basis[open] summary::after{content:"−"}
body.v43-control-ui details.v28-basis p{margin:0;padding:12px;border-top:1px solid #242b25;color:#909a91}
body.v43-control-ui .v34-pickers{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
body.v43-control-ui .v34-pickers label{position:relative;padding:12px;border:1px solid #2b332c;border-radius:8px;background:#0b0f0c;transition:border-color .15s ease,background-color .15s ease}
body.v43-control-ui .v34-pickers label[data-v43-selected="true"]{border-color:#7d9b35;background:#11170f}
body.v43-control-ui .v34-pickers label[data-v43-selected="true"] .v43-field-label::after{content:"선택됨";margin-left:auto;padding:2px 6px;border:1px solid #526b25;border-radius:999px;color:#c8ff3d;font-size:9px;font-weight:700}
body.v43-control-ui .v43-compare-actions{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:10px;padding:10px 0 2px}
body.v43-control-ui .v43-compare-actions span{color:#7f8980;font-size:12px}
body.v43-control-ui .v43-reset-button{min-height:38px;padding:0 12px;border:1px solid #39423a;background:transparent;color:#cbd2cc;font-size:12px}
body.v43-control-ui .v43-reset-button:hover{border-color:#6c796e;background:#151b16;color:#fff}
body.v43-control-ui .v36-brandbar{align-items:end}
body.v43-control-ui .v36-brandbar label{min-width:min(100%,420px)}
body.v43-control-ui .v36-brandbar select{font-weight:650}
body.v43-control-ui .v36-fields label,body.v43-control-ui .calculator label{padding:12px;border:1px solid #283029;border-radius:7px;background:#0b0f0c}
body.v43-control-ui .v31-ranking-nav,body.v43-control-ui .brand-toc nav{scrollbar-width:none}
body.v43-control-ui .v31-ranking-nav::-webkit-scrollbar,body.v43-control-ui .brand-toc nav::-webkit-scrollbar{display:none}
body.v43-control-ui .v31-ranking-nav a,body.v43-control-ui .brand-toc a{min-height:40px;display:inline-flex;align-items:center;padding-inline:12px;border:1px solid #2e372f;border-radius:999px;background:#0c110d;color:#b6c0b7;white-space:nowrap}
body.v43-control-ui .v31-ranking-nav a:hover,body.v43-control-ui .brand-toc a:hover{border-color:#718031;background:#12180f;color:#dfff8b}
@media(min-width:761px){body.v43-control-ui .v43-home-title{font-size:clamp(46px,6vw,86px)!important}}
@media(max-width:900px){body.v43-control-ui .v34-pickers{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){body.v43-control-ui .v43-home-title{font-size:clamp(34px,10.8vw,42px)!important;letter-spacing:-.07em!important;gap:.12em}body.v43-control-ui .v25-search{grid-template-columns:minmax(0,1fr) 82px}body.v43-control-ui .v25-search button{padding-inline:10px}body.v43-control-ui .v34-pickers{grid-template-columns:1fr;gap:8px}body.v43-control-ui .v34-pickers label{padding:10px}body.v43-control-ui .v43-compare-actions{align-items:stretch;flex-direction:column-reverse}body.v43-control-ui .v43-reset-button{width:100%}body.v43-control-ui button,body.v43-control-ui .button,body.v43-control-ui .text-button{min-height:48px}body.v43-control-ui input,body.v43-control-ui select{font-size:16px}}
@media(max-width:340px){body.v43-control-ui .v43-home-title{font-size:33px!important;gap:.08em}body.v43-control-ui .v25-search{grid-template-columns:minmax(0,1fr) 74px}}
/* v11.43 control ux end */
`;
await fs.writeFile(cssPath,css,'utf8');

const js=`(()=>{const init=()=>{document.querySelectorAll('select').forEach(s=>{s.classList.add('v43-control');const label=s.closest('label');if(!s.getAttribute('aria-label')&&label){const t=label.querySelector('.v43-field-label')?.textContent?.trim()||label.childNodes[0]?.textContent?.trim();if(t)s.setAttribute('aria-label',t)}});document.querySelectorAll('.v34-pickers').forEach(group=>{const picks=[...group.querySelectorAll('select[data-v34-pick]')];const sync=()=>picks.forEach(s=>{const l=s.closest('label');if(l)l.dataset.v43Selected=s.value?'true':'false'});picks.forEach(s=>s.addEventListener('change',sync));sync();if(!group.nextElementSibling?.classList.contains('v43-compare-actions')){const row=document.createElement('div');row.className='v43-compare-actions';const note=document.createElement('span');note.textContent='2~4개 브랜드를 선택하면 같은 기준으로 바로 비교됩니다.';const reset=document.createElement('button');reset.type='button';reset.className='v43-reset-button';reset.textContent='선택 초기화';reset.addEventListener('click',()=>{picks.forEach(s=>{s.selectedIndex=0;s.dispatchEvent(new Event('change',{bubbles:true}))});picks[0]?.focus()});row.append(note,reset);group.after(row)}});document.querySelectorAll('button:not([aria-label])').forEach(b=>{const t=b.textContent.trim();if(t)b.setAttribute('aria-label',t)});document.querySelectorAll('input:not([aria-label])').forEach(i=>{if(i.placeholder)i.setAttribute('aria-label',i.placeholder)});};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init()})();`;
await fs.writeFile(path.join(out,'assets/v43-control-ux.js'),js,'utf8');

const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.43';
manifest.v11_43={controlUx:true,homeTitleSingleLine:true,friendlyLabels:true,compareReset:true,touchTargets:true,candidateSetChanged:false,indexPolicyChanged:false,dataSemanticsChanged:false,productionDeployed:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
const report={schemaVersion:1,uiVersion:'11.43',generatedAt:new Date().toISOString(),allHtmlPages:htmlFiles.length,candidatePages:candidates.length,...stats,features:['single-line home title','48px touch targets','clear select affordance','selected state','compare reset','expanded criteria controls','mobile-safe controls'],productionDeployed:false};
await fs.writeFile(path.join(out,'v11-43-control-ux.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
