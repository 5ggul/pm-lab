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

const stats={patchedHtmlPages:0,v43BodiesRemoved:0,v43ScriptsRemoved:0,homeTitleRestored:false};
function patchBody(html){return html.replace(/<body\b([^>]*)>/i,(full,attrs)=>{let a=attrs||'';a=a.replace(/\bclass="([^"]*)"/i,(m,c)=>{const list=c.split(/\s+/).filter(Boolean).filter(x=>x!=='v43-control-ui');if(!list.includes('v44-v42-refined'))list.push('v44-v42-refined');return `class="${list.join(' ')}"`});a=a.replace(/\sdata-v43-control-ux="[^"]*"/gi,'');if(!/\bdata-v44-v42-refined=/i.test(a))a+=' data-v44-v42-refined="1"';return `<body${a}>`})}

for(const file of htmlFiles){
  let html=await fs.readFile(file,'utf8');const before=html;
  if(/\bv43-control-ui\b/.test(html))stats.v43BodiesRemoved++;
  if(html.includes('/assets/v43-control-ux.js'))stats.v43ScriptsRemoved++;
  html=patchBody(html);
  html=html.replace(/<script defer src="\/pm-lab\/franchise-ssg-preview\/assets\/v43-control-ux\.js"><\/script>/g,'');
  if(file===path.join(out,'index.html')){
    const v43='<h1 class="v43-home-title"><span>프랜차이즈</span><span>비교</span></h1>';
    if(html.includes(v43)){html=html.replace(v43,'<h1 class="v44-home-title">프랜차이즈 비교</h1>');stats.homeTitleRestored=true}
  }
  if(!html.includes('/assets/v44-refinement.js'))html=html.replace('</body>','<script defer src="/pm-lab/franchise-ssg-preview/assets/v44-refinement.js"></script></body>');
  if(html!==before){await fs.writeFile(file,html,'utf8');stats.patchedHtmlPages++;}
}

let css=await fs.readFile(cssPath,'utf8');
css=css.replace(/\/\* v11\.43 control ux \*\/[\s\S]*?\/\* v11\.43 control ux end \*\//g,'');
css=css.replace(/\/\* v11\.44 v42 refinement \*\/[\s\S]*?\/\* v11\.44 v42 refinement end \*\//g,'').trimEnd();
css+=String.raw`

/* v11.44 v42 refinement */
body.v44-v42-refined{--v44-accent:#c8ff3d;--v44-line:#354036;--v44-muted:#929c93}
body.v44-v42-refined .v44-home-title{max-width:none!important;width:max-content;white-space:nowrap!important;text-wrap:nowrap!important;overflow-wrap:normal!important}
body.v44-v42-refined .v41-home-copy .v25-head h1.v44-home-title{max-width:none!important;font-size:clamp(46px,6.35vw,84px)!important;letter-spacing:-.065em!important}
body.v44-v42-refined input,body.v44-v42-refined select,body.v44-v42-refined textarea,body.v44-v42-refined button{font-family:inherit}
body.v44-v42-refined select{min-height:48px}
body.v44-v42-refined input:focus-visible,body.v44-v42-refined select:focus-visible,body.v44-v42-refined textarea:focus-visible,body.v44-v42-refined button:focus-visible,body.v44-v42-refined a:focus-visible{outline:2px solid var(--v44-accent);outline-offset:2px}
body.v44-v42-refined .v43-field-label{display:block;color:#8d978e;font-size:10px;font-weight:600;line-height:1.35;letter-spacing:0}
body.v44-v42-refined .v34-pickers label{padding:0!important;border:0!important;border-radius:0!important;background:transparent!important}
body.v44-v42-refined .v34-pickers label[data-v43-selected="true"]{border:0!important;background:transparent!important}
body.v44-v42-refined .v34-pickers label[data-v43-selected="true"] .v43-field-label::after{content:none!important}
body.v44-v42-refined .v36-fields label,body.v44-v42-refined .calculator label{padding:0;border:0;background:transparent}
body.v44-v42-refined .v25-search{border-radius:0!important;overflow:visible}
body.v44-v42-refined .v25-search input,body.v44-v42-refined .v25-search button{border-radius:0!important}
body.v44-v42-refined .v44-compare-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 0 12px;border-bottom:1px solid #293129}
body.v44-v42-refined .v44-selection-status{color:#7f8a80;font:600 10px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.03em}
body.v44-v42-refined .v44-reset{min-height:36px;padding:0;border:0;border-bottom:1px solid #465147;border-radius:0;background:transparent;color:#aab4ab;font-size:11px;font-weight:650;cursor:pointer}
body.v44-v42-refined .v44-reset:hover{border-color:#c8ff3d;color:#d9ff7c}
body.v44-v42-refined .v34-pickers select[data-v44-has-value="true"]{border-color:#566357}
body.v44-v42-refined details.v28-basis summary{min-height:auto;padding:8px 0;border:0;background:transparent;color:#8f9990;font-size:11px}
body.v44-v42-refined .v31-ranking-nav a,body.v44-v42-refined .brand-toc a{border-radius:0}
@media(max-width:760px){body.v44-v42-refined .v41-home-copy .v25-head h1.v44-home-title{font-size:clamp(36px,10.5vw,54px)!important;letter-spacing:-.07em!important}body.v44-v42-refined .v44-compare-tools{align-items:flex-start}.v44-selection-status{max-width:70%}}
@media(max-width:430px){body.v44-v42-refined .v41-home-copy .v25-head h1.v44-home-title{font-size:clamp(32px,9.8vw,42px)!important}body.v44-v42-refined .v44-compare-tools{gap:8px}body.v44-v42-refined .v44-reset{min-height:34px}}
@media(max-width:340px){body.v44-v42-refined .v41-home-copy .v25-head h1.v44-home-title{font-size:31px!important}}
/* v11.44 v42 refinement end */
`;
await fs.writeFile(cssPath,css,'utf8');

const js=String.raw`(()=>{const init=()=>{document.querySelectorAll('.v34-pickers').forEach(group=>{const picks=[...group.querySelectorAll('select[data-v34-pick]')];const count=document.querySelector('[data-v34-count]');let tools=group.nextElementSibling;if(!tools?.classList.contains('v44-compare-tools')){tools=document.createElement('div');tools.className='v44-compare-tools';const status=document.createElement('span');status.className='v44-selection-status';status.setAttribute('aria-live','polite');const reset=document.createElement('button');reset.type='button';reset.className='v44-reset';reset.textContent='초기화';reset.addEventListener('click',()=>{picks.forEach(s=>{s.selectedIndex=0;s.dispatchEvent(new Event('change',{bubbles:true}))});picks[0]?.focus()});tools.append(status,reset);group.after(tools)}const status=tools.querySelector('.v44-selection-status');const sync=()=>{const selected=picks.filter(s=>s.value).length;picks.forEach(s=>s.dataset.v44HasValue=s.value?'true':'false');if(count)count.textContent=selected+'/4';if(status)status.textContent=selected?selected+'개 브랜드 선택':'브랜드를 2~4개 선택하세요'};picks.forEach(s=>s.addEventListener('change',sync));sync()});document.querySelectorAll('select').forEach(s=>{if(!s.getAttribute('aria-label')){const label=s.closest('label');const txt=label?.querySelector('.v43-field-label')?.textContent?.trim()||label?.childNodes?.[0]?.textContent?.trim();if(txt)s.setAttribute('aria-label',txt)}})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init()})();`;
await fs.writeFile(path.join(out,'assets/v44-refinement.js'),js,'utf8');

const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
manifest.uiVersion='11.44';
manifest.v11_44={v42VisualBaseRestored:true,homeTitleSingleLine:true,minimalControlFeedback:true,compactReset:true,accessibilityFocus:true,candidateSetChanged:false,indexPolicyChanged:false,dataSemanticsChanged:false,productionDeployed:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
const report={schemaVersion:1,uiVersion:'11.44',generatedAt:new Date().toISOString(),allHtmlPages:htmlFiles.length,candidatePages:candidates.length,...stats,features:['v11.42 visual language restored','single-line home title','minimal selected-state feedback','compact reset action','48px select targets','keyboard focus visibility','mobile-safe controls'],productionDeployed:false};
await fs.writeFile(path.join(out,'v11-44-v42-refinement.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
