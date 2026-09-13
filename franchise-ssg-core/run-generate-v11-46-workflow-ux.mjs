import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const cssPath=path.join(out,'assets/site.css');
const manifestPath=path.join(out,'route-manifest.json');
const snapshot=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
const htmlFiles=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()&&e.name.endsWith('.html'))htmlFiles.push(p)}}
await walk(out);

const snapshotDate=String(snapshot.snapshot_id||'').match(/(\d{4}-\d{2}-\d{2})$/)?.[1]||String(snapshot.fetched_at||'').slice(0,10);
if(manifest.uiVersion!=='11.45')throw new Error(`v11.46 requires v11.45 baseline, got ${manifest.uiVersion}`);
if(Number(snapshot.brand_count)!==136||Number(snapshot.category_count)!==20||candidates.length!==184)throw new Error(`v11.46 baseline ${snapshot.brand_count}/${snapshot.category_count}/${candidates.length}`);
if(!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate))throw new Error('v11.46 snapshot date unavailable');

const stats={patchedHtmlPages:0,bodyCoverage:0,compareQuickAdd:false,startupLiveTotal:false,brandFreshnessPatched:0,brandActionsVerified:0};
function patchBody(html){
  return html.replace(/<body\b([^>]*)>/i,(full,attrs)=>{
    let a=attrs||'';
    a=a.replace(/\bclass="([^"]*)"/i,(m,c)=>{
      const list=c.split(/\s+/).filter(Boolean);
      if(!list.includes('v46-workflow-ux'))list.push('v46-workflow-ux');
      return `class="${list.join(' ')}"`;
    });
    a=a.replace(/\sdata-v46-workflow-ux="[^"]*"/gi,'');
    a+=' data-v46-workflow-ux="1"';
    return `<body${a}>`;
  });
}
const scriptTag='<script defer src="/pm-lab/franchise-ssg-preview/assets/v46-workflow-ux.js"></script>';

for(const file of htmlFiles){
  let html=await fs.readFile(file,'utf8');
  const before=html;
  html=patchBody(html);
  if(!html.includes('/assets/v46-workflow-ux.js'))html=html.replace('</body>',`${scriptTag}</body>`);
  if(/<body\b[^>]*data-v46-workflow-ux="1"/i.test(html))stats.bodyCoverage++;
  if(html!==before){await fs.writeFile(file,html,'utf8');stats.patchedHtmlPages++;}
}

const comparePath=path.join(out,'compare/index.html');
let compare=await fs.readFile(comparePath,'utf8');
if(!compare.includes('data-v34-workspace="hub"'))throw new Error('v11.46 compare hub workspace missing');
if(!compare.includes('data-v46-compare-add')){
  const block='<div class="v46-compare-add" data-v46-compare-add><label><span>브랜드 빠른 추가</span><input type="search" autocomplete="off" list="v46-brand-options" placeholder="브랜드명을 입력하세요" data-v46-compare-search></label><button type="button" data-v46-compare-add-button>추가</button><datalist id="v46-brand-options"></datalist><span class="v46-compare-note" data-v46-compare-note aria-live="polite"></span></div>';
  const marker='<div class="v34-pickers" data-v34-pickers>';
  if(!compare.includes(marker))throw new Error('v11.46 compare pickers missing');
  compare=compare.replace(marker,block+marker);
  stats.compareQuickAdd=true;
  await fs.writeFile(comparePath,compare,'utf8');
}

const startupPath=path.join(out,'tools/startup-cost/index.html');
let startup=await fs.readFile(startupPath,'utf8');
if(!startup.includes('data-v36-startup="1"'))throw new Error('v11.46 startup workspace missing');
if(!startup.includes('data-v46-live-total')){
  const block='<div class="v46-live-total" data-v46-live-total><div><span>공개비용</span><strong data-v46-public>—</strong></div><div><span>추가입력</span><strong data-v46-extra>0만원</strong></div><div><span>총 준비자금</span><strong data-v46-total>—</strong></div><button type="button" data-v46-input-reset>입력 초기화</button></div>';
  const re=/(<details class="v36-extra">[\s\S]*?<\/details>)/;
  if(!re.test(startup))throw new Error('v11.46 startup extra input boundary missing');
  startup=startup.replace(re,`$1${block}`);
  stats.startupLiveTotal=true;
  await fs.writeFile(startupPath,startup,'utf8');
}

for(const brand of snapshot.brands||[]){
  const route=String(brand.route||`/brands/${brand.slug}/`);
  const file=path.join(out,...route.split('/').filter(Boolean),'index.html');
  let html=await fs.readFile(file,'utf8');
  const before=html;
  const encodedSlug=encodeURIComponent(String(brand.slug));
  const calc=`/tools/startup-cost/?brand=${encodedSlug}`;
  const comp=`/compare/?a=${encodedSlug}`;
  if(html.includes(calc)&&html.includes(comp))stats.brandActionsVerified++;
  html=html.replace(/(<span><b>갱신<\/b>\s*)\d{4}-\d{2}-\d{2}(<\/span>)/,`$1${snapshotDate}$2`);
  html=html.replace(/("dateModified":")\d{4}-\d{2}-\d{2}(")/g,`$1${snapshotDate}$2`);
  if(html!==before){await fs.writeFile(file,html,'utf8');stats.brandFreshnessPatched++;}
}

let css=await fs.readFile(cssPath,'utf8');
css=css.replace(/\/\* v11\.46 workflow ux \*\/[\s\S]*?\/\* v11\.46 workflow ux end \*\//g,'').trimEnd();
css+=String.raw`

/* v11.46 workflow ux */
body.v46-workflow-ux .v46-compare-add{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 10px;align-items:end;padding:14px 0 4px;border-bottom:1px solid #293129}
body.v46-workflow-ux .v46-compare-add label{display:grid;gap:5px}
body.v46-workflow-ux .v46-compare-add label>span{color:#8d978e;font-size:10px;font-weight:600}
body.v46-workflow-ux .v46-compare-add input{min-height:44px;width:100%;border:1px solid #354036;border-radius:0;background:transparent;color:inherit;padding:0 10px}
body.v46-workflow-ux .v46-compare-add button{min-height:44px;padding:0 14px;border:1px solid #465147;border-radius:0;background:transparent;color:#cbd3cb;font-weight:700;cursor:pointer}
body.v46-workflow-ux .v46-compare-add button:hover{border-color:#c8ff3d;color:#d9ff7c}
body.v46-workflow-ux .v46-compare-note{grid-column:1/-1;min-height:16px;color:#8d978e;font-size:11px}
body.v46-workflow-ux .v34-pickers option:disabled{color:#626a63}
body.v46-workflow-ux .v46-live-total{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;align-items:stretch;margin-top:12px;border-top:2px solid var(--ink,#171717);border-bottom:1px solid var(--line,#d8d5cf)}
body.v46-workflow-ux .v46-live-total>div{padding:12px 14px 12px 0;border-right:1px solid var(--line,#d8d5cf)}
body.v46-workflow-ux .v46-live-total span{display:block;color:var(--muted,#68655f);font-size:11px}
body.v46-workflow-ux .v46-live-total strong{display:block;margin-top:4px;font-size:18px;font-variant-numeric:tabular-nums}
body.v46-workflow-ux .v46-live-total [data-v46-total]{font-size:22px}
body.v46-workflow-ux .v46-live-total button{align-self:center;min-height:36px;margin-left:14px;padding:0;border:0;border-bottom:1px solid #465147;border-radius:0;background:transparent;color:#8d978e;font-size:11px;font-weight:700;cursor:pointer}
body.v46-workflow-ux .v46-live-total button:hover{border-color:#c8ff3d;color:#d9ff7c}
body.v46-workflow-ux [data-v34-status].is-v46-error{color:#d9ff7c}
body.v46-workflow-ux .v36-stage,.v46-workflow-ux .v34-zone{scroll-margin-top:72px}
@media(max-width:760px){
  body.v46-workflow-ux .v46-compare-add{grid-template-columns:1fr auto}
  body.v46-workflow-ux .v46-live-total{grid-template-columns:repeat(3,minmax(0,1fr))}
  body.v46-workflow-ux .v46-live-total>div{padding:10px 8px 10px 0}
  body.v46-workflow-ux .v46-live-total strong{font-size:16px}
  body.v46-workflow-ux .v46-live-total [data-v46-total]{font-size:18px}
  body.v46-workflow-ux .v46-live-total button{grid-column:1/-1;justify-self:start;margin:0 0 8px;min-height:32px}
}
@media(max-width:430px){
  body.v46-workflow-ux .v46-compare-add{grid-template-columns:1fr}
  body.v46-workflow-ux .v46-compare-add button{justify-self:start;min-width:76px}
  body.v46-workflow-ux .v46-live-total{grid-template-columns:1fr}
  body.v46-workflow-ux .v46-live-total>div{display:flex;align-items:baseline;justify-content:space-between;gap:16px;border-right:0;padding:9px 0;border-bottom:1px solid var(--line,#d8d5cf)}
  body.v46-workflow-ux .v46-live-total strong,body.v46-workflow-ux .v46-live-total [data-v46-total]{margin:0;font-size:17px}
}
/* v11.46 workflow ux end */
`;
await fs.writeFile(cssPath,css,'utf8');

const js=String.raw`(()=>{const ready=()=>{const money=v=>Number.isFinite(Number(v))?Math.round(Number(v)).toLocaleString('ko-KR')+'만원':'—';const params=new URLSearchParams(location.search);

const compare=document.querySelector('[data-v34-workspace="hub"]');
if(compare){
  const picks=[...compare.querySelectorAll('[data-v34-pick]')];
  const note=compare.querySelector('[data-v46-compare-note]');
  const status=compare.querySelector('[data-v34-status]');
  let data={brands:{}};try{data=JSON.parse(compare.querySelector('[data-v34-comparedata]')?.textContent||'{}')}catch{}
  const brands=Object.values(data.brands||{});
  const byName=new Map(brands.map(b=>[String(b.name||'').trim().toLowerCase(),b]));
  const list=compare.querySelector('#v46-brand-options');
  if(list){list.innerHTML=brands.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko')).map(b=>'<option value="'+String(b.name||'').replace(/"/g,'&quot;')+'">'+String(b.categoryName||b.category?.name||'')+'</option>').join('')}
  const current=()=>picks.map(s=>s.value).filter(Boolean);
  const show=msg=>{if(note)note.textContent=msg||''};
  const syncDisabled=()=>{const selected=current();picks.forEach(sel=>{[...sel.options].forEach(opt=>{if(!opt.value)return;opt.disabled=selected.includes(opt.value)&&sel.value!==opt.value})})};
  const syncUrl=()=>{const p=new URLSearchParams(location.search);['a','b','c','d'].forEach(k=>p.delete(k));current().slice(0,4).forEach((v,i)=>p.set(['a','b','c','d'][i],v));history.replaceState(null,'',location.pathname+(p.size?'?'+p.toString():'')+location.hash)};
  const normalizeDuplicates=changed=>{const vals=current();if(changed?.value&&vals.filter(v=>v===changed.value).length>1){changed.value='';show('이미 선택한 브랜드입니다.');changed.dispatchEvent(new Event('change',{bubbles:true}));return false}return true};
  picks.forEach(sel=>sel.addEventListener('change',()=>{if(!normalizeDuplicates(sel))return;syncDisabled();syncUrl();if(status)status.classList.remove('is-v46-error')}));
  const incoming=['a','b','c','d'].map(k=>params.get(k)).filter(v=>v&&data.brands?.[v]);
  if(!incoming.length&&params.get('brand')&&data.brands?.[params.get('brand')])incoming.push(params.get('brand'));
  if(incoming.length){picks.forEach(s=>s.value='');incoming.slice(0,4).forEach((v,i)=>{if(picks[i])picks[i].value=v});if(incoming.length<2){const fallback=['mega-mgc-coffee','compose-coffee',...Object.keys(data.brands||{})].find(v=>v&&!incoming.includes(v)&&data.brands?.[v]);if(fallback&&picks[1])picks[1].value=fallback}picks.forEach(s=>s.dispatchEvent(new Event('change',{bubbles:true})));show('링크의 브랜드 선택을 불러왔습니다.')}
  syncDisabled();
  const search=compare.querySelector('[data-v46-compare-search]'),add=compare.querySelector('[data-v46-compare-add-button]');
  const addBrand=()=>{const term=String(search?.value||'').trim().toLowerCase();if(!term){show('브랜드명을 입력하세요.');return}let b=byName.get(term);if(!b){const hits=brands.filter(x=>String(x.name||'').toLowerCase().includes(term));if(hits.length===1)b=hits[0];else{show(hits.length?'검색 결과가 여러 개입니다. 브랜드명을 더 입력하세요.':'일치하는 브랜드가 없습니다.');return}}if(current().includes(b.slug)){show('이미 선택한 브랜드입니다.');return}const empty=picks.find(s=>!s.value);if(!empty){show('최대 4개까지 비교할 수 있습니다.');return}empty.value=b.slug;empty.dispatchEvent(new Event('change',{bubbles:true}));if(search)search.value='';show(b.name+' 추가됨')};
  add?.addEventListener('click',addBrand);search?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addBrand()}});
}

const startup=document.querySelector('[data-v36-startup="1"]');
if(startup){
  let data={};try{data=JSON.parse(startup.querySelector('[data-v36-startdata]')?.textContent||'{}')}catch{}
  const brand=startup.querySelector('[data-v36-brand]');
  const fields=['lease','premium','construction','inventory','working'];
  const num=name=>{const el=startup.querySelector('[name="'+name+'"]');const n=Number(el?.value||0);return Number.isFinite(n)&&n>0?n:0};
  const render=()=>{const b=data?.[brand?.value]||null;const base=Number.isFinite(Number(b?.cost))?Number(b.cost):Number(startup.dataset.v36DefaultCost)||0;const extra=fields.reduce((s,n)=>s+num(n),0);const set=(sel,val)=>{const el=startup.querySelector(sel);if(el)el.textContent=val};set('[data-v46-public]',money(base));set('[data-v46-extra]',money(extra));set('[data-v46-total]',money(base+extra))};
  const incoming=params.get('brand');if(incoming&&brand&&data?.[incoming]){brand.value=incoming;brand.dispatchEvent(new Event('change',{bubbles:true}))}
  brand?.addEventListener('change',()=>{const p=new URLSearchParams(location.search);if(brand.value)p.set('brand',brand.value);else p.delete('brand');history.replaceState(null,'',location.pathname+(p.size?'?'+p.toString():'')+location.hash);render()});
  fields.forEach(n=>startup.querySelector('[name="'+n+'"]')?.addEventListener('input',render));
  startup.querySelector('[data-v46-input-reset]')?.addEventListener('click',()=>{fields.forEach(n=>{const el=startup.querySelector('[name="'+n+'"]');if(el){el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}))}});const profit=startup.querySelector('[name="profit"]');if(profit){profit.value='';profit.dispatchEvent(new Event('input',{bubbles:true}))}render()});
  render();
}
};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready()})();`;
await fs.writeFile(path.join(out,'assets/v46-workflow-ux.js'),js,'utf8');

manifest.uiVersion='11.46';
manifest.v11_46={v42VisualLanguagePreserved:true,detailActionHandoff:true,compareQueryHydration:true,compareQuickAdd:true,compareDuplicateGuard:true,startupQueryHydration:true,startupLiveTotal:true,detailFreshnessSync:true,brandCount:136,categoryCount:20,snapshotDate,candidateSetChanged:false,indexPolicyChanged:false,dataSemanticsChanged:false,productionDeployed:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');

const report={schemaVersion:1,uiVersion:'11.46',generatedAt:new Date().toISOString(),snapshotId:snapshot.snapshot_id,snapshotDate,allHtmlPages:htmlFiles.length,candidatePages:candidates.length,brandPages:(snapshot.brands||[]).length,...stats,features:['brand detail → compare query handoff','brand detail → startup calculator query handoff','compare quick add search','compare duplicate selection guard','startup live total','startup input reset','brand freshness sync'],productionDeployed:false};
await fs.writeFile(path.join(out,'v11-46-workflow-ux.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
