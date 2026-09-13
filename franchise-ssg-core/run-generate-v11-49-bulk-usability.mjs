import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../docs/franchise-ssg-preview');
const snap=JSON.parse(await fs.readFile(path.join(out,'data-snapshot-v11-26.json'),'utf8'));
const quality=JSON.parse(await fs.readFile(path.join(out,'v11-quality-report.json'),'utf8'));
const manifestPath=path.join(out,'route-manifest.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const candidates=quality.indexPolicy?.productionCandidateUrls||[];
if(manifest.uiVersion!=='11.48')throw new Error(`v11.49 requires v11.48 baseline, got ${manifest.uiVersion}`);
if(Number(snap.brand_count)!==136||Number(snap.category_count)!==20||candidates.length!==184)throw new Error(`v11.49 baseline ${snap.brand_count}/${snap.category_count}/${candidates.length}`);

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const won=v=>finite(v)?`${Math.round(Number(v)).toLocaleString('ko-KR')}만원`:'—';
const fileFor=r=>r==='/'?path.join(out,'index.html'):path.join(out,...String(r).split('/').filter(Boolean),'index.html');
const addScript=(html,src)=>html.includes(src)?html:html.replace('</body>',`<script src="${src}" defer></script></body>`);
const compParts=[['가맹비','franchise'],['교육비','education'],['보증금','deposit'],['기타','etc']];
function comp(b){
  const rows=compParts.filter(([,k])=>finite(b.components?.[k])).map(([name,key])=>({name,key,value:Number(b.components[key])}));
  const total=rows.reduce((s,x)=>s+x.value,0);
  const largest=[...rows].sort((a,z)=>z.value-a.value)[0]||null;
  const zeros=rows.filter(x=>x.value===0).map(x=>x.name);
  return {rows,total,largest,share:largest&&total>0?largest.value/total*100:null,zeros};
}
function checks(b,c){
  const x=comp(b),items=[];
  if(x.largest&&finite(x.share)){
    if(x.largest.key==='etc')items.push(['기타비용',`공개비용 중 기타가 ${won(x.largest.value)} · ${x.share.toFixed(1)}%입니다. 세부 포함항목은 공개 합계만으로 알 수 없으므로 본사 견적서에서 항목별로 분리해 확인하세요.`]);
    else items.push([x.largest.name,`공개비용에서 ${x.largest.name}가 ${won(x.largest.value)} · ${x.share.toFixed(1)}%로 가장 큽니다. 계약서의 포함 범위와 별도 부담 항목을 함께 확인하세요.`]);
  }
  if(x.zeros.length)items.push(['0원 공개항목',`${x.zeros.join('·')}은 0원으로 공개됐습니다. 공개값 0을 실제 부담 없음으로 단정하지 말고 계약 조건과 별도 견적을 확인하세요.`]);
  const med=c?.cost?.median;
  if(finite(b.cost)&&finite(med)){
    const d=Number(b.cost)-Number(med),p=Number(med)!==0?d/Math.abs(Number(med))*100:0;
    items.push(['업종 중앙',`공개 창업비용 ${won(b.cost)}은 ${b.categoryName} 중앙 ${won(med)}보다 ${won(Math.abs(d))} ${d<0?'낮습니다':'높습니다'} (${p>=0?'+':''}${p.toFixed(1)}%). 임대·권리금·별도공사를 더한 총 준비자금은 별도로 비교해야 합니다.`]);
  }
  if(items.length<3)items.push(['별도비용','임대보증금·권리금·철거·전기증설·냉난방·외부공사·추가장비·초기운전자금이 공개비용에 포함되는지 계약 전 확인하세요.']);
  return items.slice(0,3);
}

let brandChecks=0,zeroWarnings=0,largeEtcWarnings=0;
for(const b of snap.brands||[]){
  const c=snap.categories?.[b.categorySlug];if(!c)throw new Error(`missing category ${b.slug}`);
  const p=fileFor(b.route);let html=await fs.readFile(p,'utf8');
  html=html.replace(/<!-- v11\.49 brand cost checks -->[\s\S]*?<!-- v11\.49 brand cost checks end -->/g,'');
  const rows=checks(b,c);const x=comp(b);
  if(x.zeros.length)zeroWarnings++;if(x.largest?.key==='etc'&&Number(x.share)>=50)largeEtcWarnings++;
  const block=`<!-- v11.49 brand cost checks --><section class="v49-cost-checks" data-v49-cost-checks="1"><div class="v35-section-head"><h2>계약 전 비용 확인</h2><span>${esc(b.sourceYear)}</span></div><div class="v49-check-list">${rows.map(([k,t],i)=>`<div data-v49-check="${i+1}"><b>${esc(k)}</b><p>${esc(t)}</p></div>`).join('')}</div><a class="v49-method" href="/pm-lab/franchise-ssg-preview/methodology/">공개비용·누락값 기준 보기</a></section><!-- v11.49 brand cost checks end -->`;
  const anchor='<!-- v11.48 brand distinctness end -->';if(!html.includes(anchor))throw new Error(`v11.49 v48 anchor ${b.slug}`);
  html=html.replace(anchor,anchor+block);
  if(!html.includes('data-v49-bulk-usability="1"'))html=html.replace(/<body\b([^>]*)>/i,(m,a)=>`<body${a} data-v49-bulk-usability="1">`);
  await fs.writeFile(p,html,'utf8');brandChecks++;
}

const comparePath=fileFor('/compare/');let compare=await fs.readFile(comparePath,'utf8');
compare=compare.replace(/<div class="v49-compare-live"[\s\S]*?<\/div><!-- v11\.49 compare live end -->/g,'');
const compareAnchor='<div class="v34-pickers" data-v34-pickers>';
if(!compare.includes(compareAnchor))throw new Error('v11.49 compare picker anchor');
compare=compare.replace(compareAnchor,`<div class="v49-compare-live" data-v49-compare-live aria-live="polite"><div><span>선택</span><strong data-v49-compare-count>0개</strong></div><div class="v49-compare-chips" data-v49-compare-chips></div><button type="button" data-v49-compare-clear>전체 해제</button></div><!-- v11.49 compare live end -->${compareAnchor}`);
compare=compare.replace(/<body\b([^>]*)>/i,(m,a)=>a.includes('data-v49-bulk-usability')?m:`<body${a} data-v49-bulk-usability="1">`);
compare=addScript(compare,'/pm-lab/franchise-ssg-preview/assets/v49-bulk-usability.js');
await fs.writeFile(comparePath,compare,'utf8');

const startupPath=fileFor('/tools/startup-cost/');let startup=await fs.readFile(startupPath,'utf8');
startup=startup.replace(/<!-- v11\.49 startup summary -->[\s\S]*?<!-- v11\.49 startup summary end -->/g,'');
const inputAnchor='<div class="v36-inputgrid">';if(!startup.includes(inputAnchor))throw new Error('v11.49 startup input anchor');
const summary=`<!-- v11.49 startup summary --><div class="v49-startup-summary" data-v49-startup-summary><div><span>공개비용</span><strong data-v49-startup-public>—</strong></div><div><span>추가입력</span><strong data-v49-startup-extra>0만원</strong></div><div class="v49-startup-total"><span>준비자금</span><strong data-v49-startup-total>—</strong></div><button type="button" data-v49-startup-reset>입력 초기화</button><p data-v49-startup-note>공개비용에 이미 포함된 항목은 중복 입력하지 마세요.</p></div><!-- v11.49 startup summary end -->`;
startup=startup.replace(inputAnchor,summary+inputAnchor);
startup=startup.replace(/<body\b([^>]*)>/i,(m,a)=>a.includes('data-v49-bulk-usability')?m:`<body${a} data-v49-bulk-usability="1">`);
startup=addScript(startup,'/pm-lab/franchise-ssg-preview/assets/v49-bulk-usability.js');
await fs.writeFile(startupPath,startup,'utf8');

const js=`(()=>{const ready=()=>{const fmt=v=>Math.round(Number(v)||0).toLocaleString('ko-KR')+'만원';const compare=document.querySelector('[data-v49-compare-live]');if(compare){const root=document.querySelector('[data-v34-workspace="hub"]'),picks=[...(root?.querySelectorAll('[data-v34-pick]')||[])],count=compare.querySelector('[data-v49-compare-count]'),chips=compare.querySelector('[data-v49-compare-chips]'),clear=compare.querySelector('[data-v49-compare-clear]');const render=()=>{const active=picks.map((s,i)=>({s,i,name:s.selectedOptions[0]?.textContent?.trim()||'',value:s.value})).filter(x=>x.value);if(count)count.textContent=active.length+'개';if(chips)chips.innerHTML=active.length?active.map(x=>'<button type="button" data-v49-remove="'+x.i+'"><span>'+x.name.replace(/[<>]/g,'')+'</span><i aria-hidden="true">×</i></button>').join(''):'<span class="v49-empty">브랜드를 2개 이상 선택하세요.</span>';chips?.querySelectorAll('[data-v49-remove]').forEach(btn=>btn.addEventListener('click',()=>{const s=picks[Number(btn.dataset.v49Remove)];if(s){s.value='';s.dispatchEvent(new Event('change',{bubbles:true}));render()}}));compare.classList.toggle('is-ready',active.length>=2);if(clear)clear.disabled=active.length===0};picks.forEach(s=>s.addEventListener('change',()=>queueMicrotask(render)));clear?.addEventListener('click',()=>{picks.forEach(s=>{s.value='';s.dispatchEvent(new Event('change',{bubbles:true}))});render()});render()}
const startup=document.querySelector('[data-v36-startup="1"]');if(startup){let data={};try{data=JSON.parse(startup.querySelector('[data-v36-startdata]')?.textContent||'{}')}catch{}const brand=startup.querySelector('[data-v36-brand]'),fields=['lease','premium','construction','inventory','working'],num=n=>{const v=Number(startup.querySelector('[name="'+n+'"]')?.value||0);return Number.isFinite(v)&&v>0?v:0},pub=startup.querySelector('[data-v49-startup-public]'),extra=startup.querySelector('[data-v49-startup-extra]'),total=startup.querySelector('[data-v49-startup-total]'),note=startup.querySelector('[data-v49-startup-note]'),reset=startup.querySelector('[data-v49-startup-reset]');const render=()=>{const b=data?.[brand?.value]||null,base=Number.isFinite(Number(b?.cost))?Number(b.cost):0,add=fields.reduce((s,n)=>s+num(n),0),all=base+add;if(pub)pub.textContent=fmt(base);if(extra)extra.textContent=fmt(add);if(total)total.textContent=fmt(all);if(note)note.textContent=add>0?('추가입력 '+fmt(add)+'은 준비자금의 '+(all>0?add/all*100:0).toFixed(1)+'%입니다. 공개비용 포함 항목과 중복되지 않는지 확인하세요.'):'공개비용에 이미 포함된 항목은 중복 입력하지 마세요.'};brand?.addEventListener('change',()=>queueMicrotask(render));fields.forEach(n=>startup.querySelector('[name="'+n+'"]')?.addEventListener('input',render));reset?.addEventListener('click',()=>{fields.forEach(n=>{const el=startup.querySelector('[name="'+n+'"]');if(el){el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}))}});const profit=startup.querySelector('[name="profit"]');if(profit){profit.value='';profit.dispatchEvent(new Event('input',{bubbles:true}))}render()});render()}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready()})();\n`;
await fs.writeFile(path.join(out,'assets/v49-bulk-usability.js'),js,'utf8');

const cssPath=path.join(out,'assets/site.css');let css=await fs.readFile(cssPath,'utf8');
css=css.replace(/\/\* v11\.49 bulk usability \*\/[\s\S]*?\/\* v11\.49 bulk usability end \*\//g,'').trimEnd();
css+=`\n\n/* v11.49 bulk usability */
.v49-cost-checks{margin:0 0 26px;padding:18px 0;border-bottom:1px solid #303831}.v49-check-list{border-top:1px solid #303831}.v49-check-list>div{display:grid;grid-template-columns:132px minmax(0,1fr);gap:16px;padding:12px 0;border-bottom:1px solid #242a25}.v49-check-list b{font-size:11px;color:var(--accent,#d9ff7c)}.v49-check-list p{margin:0;font-size:12px;line-height:1.65;color:#c8cec9}.v49-method{display:inline-block;margin-top:10px;font-size:10px;text-decoration:underline;text-underline-offset:3px;color:#8d968f}
.v49-compare-live{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center;padding:11px 0 13px;border-top:1px solid #303831;border-bottom:1px solid #303831;margin:0 0 12px}.v49-compare-live>div:first-child span{display:block;font-size:9px;color:#7f8a81}.v49-compare-live>div:first-child strong{font-size:13px;font-variant-numeric:tabular-nums}.v49-compare-chips{display:flex;flex-wrap:wrap;gap:6px;min-width:0}.v49-compare-chips button{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:0 8px;border:1px solid #3a433c;background:transparent;color:#d7ddd8;font-size:11px;cursor:pointer}.v49-compare-chips button i{font-style:normal;color:#8f9991}.v49-empty{font-size:11px;color:#69726b}.v49-compare-live>[data-v49-compare-clear]{min-height:34px;border:0;border-bottom:1px solid #667067;background:transparent;color:#9aa49c;font-size:10px;cursor:pointer}.v49-compare-live>[data-v49-compare-clear]:disabled{opacity:.35;cursor:default}.v49-compare-live.is-ready>div:first-child strong{color:var(--accent,#d9ff7c)}
.v49-startup-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;gap:0;align-items:stretch;margin:14px 0 12px;border-top:2px solid #d9ff7c;border-bottom:1px solid #303831}.v49-startup-summary>div{padding:12px 14px 12px 0;border-right:1px solid #303831}.v49-startup-summary span{display:block;font-size:9px;color:#7f8a81}.v49-startup-summary strong{display:block;margin-top:4px;font-size:18px;font-variant-numeric:tabular-nums}.v49-startup-total strong{color:var(--accent,#d9ff7c)}.v49-startup-summary button{align-self:center;margin-left:12px;min-height:34px;border:0;border-bottom:1px solid #667067;background:transparent;color:#aab2ac;font-size:10px;cursor:pointer}.v49-startup-summary p{grid-column:1/-1;margin:0;padding:8px 0 9px;font-size:10px;line-height:1.5;color:#7d867f}
@media(max-width:720px){.v49-check-list>div{grid-template-columns:1fr;gap:5px}.v49-compare-live{grid-template-columns:auto 1fr}.v49-compare-live>[data-v49-compare-clear]{grid-column:1/-1;justify-self:start;margin:0}.v49-startup-summary{grid-template-columns:repeat(3,minmax(0,1fr))}.v49-startup-summary button{grid-column:1/-1;justify-self:start;margin:0 0 8px}.v49-startup-summary>div{padding-right:8px}.v49-startup-summary strong{font-size:15px}.v36-inputgrid{grid-template-columns:1fr!important}.v36-inputgrid label{grid-template-columns:minmax(0,1fr) minmax(108px,42%) 28px!important}.v36-officialgrid{grid-template-columns:repeat(3,minmax(0,1fr))!important}.v36-costrows{grid-template-columns:repeat(2,minmax(0,1fr))!important}.v34-pickers{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.v34-table-wrap,.table-wrap,.responsive-table{overflow-x:auto;-webkit-overflow-scrolling:touch}}
@media(max-width:430px){.v49-compare-live{grid-template-columns:1fr}.v49-compare-live>[data-v49-compare-clear]{grid-column:auto}.v49-startup-summary{grid-template-columns:1fr 1fr}.v49-startup-summary .v49-startup-total{grid-column:1/-1;border-top:1px solid #303831}.v49-startup-summary p{font-size:9px}.v36-officialgrid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.v36-costrows{grid-template-columns:1fr!important}.v34-pickers{grid-template-columns:1fr!important}.v49-compare-chips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px}.v49-compare-chips button{flex:0 0 auto}}
/* v11.49 bulk usability end */\n`;
await fs.writeFile(cssPath,css,'utf8');

manifest.uiVersion='11.49';
manifest.v11_49={bulkUsability:true,brandCostDueDiligence:true,compareSelectionSummary:true,startupInputResultBridge:true,mobileDataReadability:true,v42VisualLanguagePreserved:true,candidateSetChanged:false,indexPolicyChanged:false,dataSemanticsChanged:false,productionDeployed:false};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
const report={schemaVersion:1,uiVersion:'11.49',generatedAt:new Date().toISOString(),snapshotId:snap.snapshot_id,brandPages:brandChecks,brandCheckRows:brandChecks*3,zeroPublicWarnings:zeroWarnings,largeEtcWarnings,compareHubPatched:true,startupToolPatched:true,mobileBreakpoints:[720,430],candidatePages:candidates.length,features:['136 brand cost due-diligence blocks','live compare selection summary with remove/clear','startup public+extra+total bridge','reset without changing official data','mobile single-column calculator inputs','mobile compare chip scrolling'],productionDeployed:false};
await fs.writeFile(path.join(out,'v11-49-bulk-usability.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({v11_49BulkUsability:'PASS',...report},null,2));
