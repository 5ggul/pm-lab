(()=>{"use strict";
const SAVE_KEY="franchiseLabShortlistV1",RECENT_KEY="franchiseLabRecentV1",CHECK_KEY="franchiseLabChecklistV1:",NOTE_KEY="franchiseLabNoteV1:";
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const safeRead=(k,fallback)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):fallback}catch{return fallback}};
const safeWrite=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const base=()=>{const href=q(".logo")?.getAttribute("href")||"/";return href.replace(/\/$/,"")};
const fmt=(v,unit="")=>Number.isFinite(Number(v))?new Intl.NumberFormat("ko-KR",{maximumFractionDigits:1}).format(Number(v))+unit:"정보 없음";
const escHtml=v=>String(v??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
const dataset=()=>{const el=q("[data-v52-retention-dataset]");if(!el)return null;try{return JSON.parse(el.textContent)}catch{return null}};
const saved=()=>safeRead(SAVE_KEY,[]).filter(x=>x&&x.slug);
const writeSaved=v=>safeWrite(SAVE_KEY,v.slice(0,20));
const recent=()=>safeRead(RECENT_KEY,[]).filter(Boolean);
const writeRecent=v=>safeWrite(RECENT_KEY,[...new Set(v)].slice(0,8));
const noteFor=slug=>{const v=safeRead(NOTE_KEY+slug,"");return typeof v==="string"?v:""};
const checklistStats=slug=>{const state=safeRead(CHECK_KEY+slug,{}),keys=["disclosure","opening-cost","lease","construction","recurring","simulation"],done=keys.filter(k=>Boolean(state?.[k])).length;return{done,total:keys.length}};
const metricDiff=(oldV,newV)=>Number.isFinite(Number(oldV))&&Number.isFinite(Number(newV))?Number(newV)-Number(oldV):null;
const routeHref=r=>base()+(r||"/");
const currentRecord=(data,slug)=>data?.brands?.find?.(x=>x.slug===slug)||null;
const diffs=(item,cur)=>{
  if(!cur||!item?.metrics)return[];
  const rows=[];
  const add=(key,label,unit,dec=0)=>{const d=metricDiff(item.metrics[key],cur[key]);if(d===null||Math.abs(d)<1e-9)return;const sign=d>0?"+":"";rows.push({key,label,text:label+" "+sign+new Intl.NumberFormat("ko-KR",{maximumFractionDigits:dec}).format(d)+unit})};
  add("cost","공개비용","만원",1);add("stores","가맹점","개",0);add("sales","평균매출","만원",1);add("growth","점포변화","%p",1);
  return rows;
};
function captureRecord(el){
  return {slug:el.dataset.brandSlug,name:el.dataset.brandName,route:el.dataset.brandRoute,categoryName:el.dataset.brandCategory,snapshotId:el.dataset.snapshotId,sourceYear:Number(el.dataset.sourceYear),savedAt:new Date().toISOString(),metrics:{cost:Number(el.dataset.cost),stores:Number(el.dataset.stores),sales:Number(el.dataset.sales),growth:Number(el.dataset.growth)}};
}
function updateRecent(el){
  const slug=el.dataset.brandSlug;if(!slug)return;writeRecent([slug,...recent().filter(x=>x!==slug)]);
}
function updateBrandSaveUI(el){
  const button=q("[data-v52-save-brand]",el);if(!button)return;
  const list=saved(),found=list.find(x=>x.slug===el.dataset.brandSlug);
  button.setAttribute("aria-pressed",found?"true":"false");
  button.textContent=found?"저장됨 · 후보에서 빼기":"관심 브랜드 저장";
  const data=dataset(),cur=currentRecord(data,el.dataset.brandSlug)||captureRecord(el);
  const change=q("[data-v52-brand-change]",el);
  if(change){
    const rows=found?diffs(found,cur):[];
    if(rows.length){
      change.hidden=false;
      change.innerHTML='<strong>저장 후 공개값 변화</strong>'+rows.map(x=>'<span>'+x.text+'</span>').join("")+'<button type="button" class="v52-ack-button" data-v52-ack-change>현재값을 새 기준으로 저장</button>';
      q("[data-v52-ack-change]",change)?.addEventListener("click",()=>{const next=saved().map(x=>x.slug===cur.slug?{...x,snapshotId:data?.snapshotId||cur.snapshotId,savedAt:new Date().toISOString(),metrics:{cost:cur.cost,stores:cur.stores,sales:cur.sales,growth:cur.growth}}:x);writeSaved(next);updateBrandSaveUI(el);renderAll()});
    }else{change.hidden=true;change.textContent=""}
  }
}
function initBrand(){
  qa("[data-v52-brand-workspace]").forEach(el=>{
    updateRecent(el);updateBrandSaveUI(el);
    q("[data-v52-save-brand]",el)?.addEventListener("click",()=>{
      const cur=captureRecord(el),list=saved(),idx=list.findIndex(x=>x.slug===cur.slug);
      if(idx>=0)list.splice(idx,1);else list.unshift(cur);
      writeSaved(list);updateBrandSaveUI(el);renderAll();
    });
    const slug=el.dataset.brandSlug,key=CHECK_KEY+slug,checks=safeRead(key,{});
    qa("[data-v52-check]",el).forEach(input=>{
      input.checked=Boolean(checks[input.dataset.v52Check]);
      input.addEventListener("change",()=>{const state=safeRead(key,{});state[input.dataset.v52Check]=input.checked;safeWrite(key,state);updateProgress(el)});
    });
    const note=q("[data-v52-candidate-note]",el),count=q("[data-v52-note-count]",el);
    if(note){
      note.value=noteFor(slug).slice(0,240);
      const updateNoteCount=()=>{if(count)count.textContent=note.value.length+"/240"};
      updateNoteCount();
      note.addEventListener("input",()=>{const value=note.value.slice(0,240);if(note.value!==value)note.value=value;safeWrite(NOTE_KEY+slug,value);updateNoteCount()});
    }
    updateProgress(el);
  });
}
function updateProgress(el){
  const all=qa("[data-v52-check]",el),done=all.filter(x=>x.checked).length;
  const out=q("[data-v52-check-progress]",el);if(out)out.textContent=done+"/"+all.length;
}
function itemHtml(item,cur){
  const d=diffs(item,cur),change=d.length?d.slice(0,2).map(x=>x.text).join(" · "):"저장 후 확인된 수치 변화 없음";
  const stats=checklistStats(item.slug),note=noteFor(item.slug).trim(),noteText=note?(note.length>64?note.slice(0,64)+"…":note):"메모 없음";
  return '<div class="v52-retention-item"><a href="'+routeHref(item.route||cur?.route)+'">'+(cur?.name||item.name)+'</a><small>'+(cur?.categoryName||item.categoryName||"")+' · '+(cur?.sourceYear||item.sourceYear||"")+' 기준</small><span class="v52-retention-progress">계약 전 확인 '+stats.done+'/'+stats.total+' · '+escHtml(noteText)+'</span><em>'+change+'</em></div>';
}
function renderHomeLike(root){
  const data=dataset();if(!data)return;
  const list=saved(),savedBox=q("[data-v52-saved-list]",root),recentBox=q("[data-v52-recent-list]",root),alert=q("[data-v52-retention-alert]",root);
  if(savedBox){
    savedBox.innerHTML=list.length?list.map(item=>itemHtml(item,currentRecord(data,item.slug))).join(""):'<p class="v52-retention-empty">브랜드 상세에서 ‘관심 브랜드 저장’을 누르면 다음 방문에도 이 브라우저에서 이어볼 수 있습니다.</p>';
  }
  const rec=recent().map(slug=>currentRecord(data,slug)).filter(Boolean).slice(0,5);
  if(recentBox)recentBox.innerHTML=rec.length?rec.map(cur=>'<div class="v52-retention-item"><a href="'+routeHref(cur.route)+'">'+cur.name+'</a><small>'+cur.categoryName+' · 공개비용 '+fmt(cur.cost,"만원")+'</small><em>최근 확인</em></div>').join(""):'<p class="v52-retention-empty">아직 최근 본 브랜드가 없습니다.</p>';
  const stale=list.filter(item=>item.snapshotId&&item.snapshotId!==data.snapshotId);
  if(alert){
    alert.hidden=!stale.length;
    if(stale.length)alert.innerHTML='<span><strong>'+stale.length+'개 저장 후보</strong>가 저장 이후 다른 데이터 스냅샷을 사용 중입니다. 현재 공개값과 저장 당시 값을 비교해 보세요.</span><a href="'+base()+'/updates/">변화 레이더 보기</a>';
  }
}
function renderCompare(){
  const root=q("[data-v52-saved-compare]"),data=dataset();if(!root||!data)return;
  const list=saved().map(x=>currentRecord(data,x.slug)).filter(Boolean);
  const box=q("[data-v52-saved-compare-list]",root);
  if(box)box.innerHTML=list.length?list.map(x=>'<button type="button" class="v52-saved-compare-chip" data-v52-compare-chip="'+x.slug+'">'+x.name+'</button>').join(""):'<span class="v52-retention-empty">저장한 후보가 없습니다.</span>';
  qa("[data-v52-compare-chip]",root).forEach(btn=>btn.addEventListener("click",()=>loadSavedCompare([btn.dataset.v52CompareChip])));
  const load=q("[data-v52-load-saved]",root);if(load){load.disabled=list.length<2;load.textContent=list.length>=2?"저장 후보 최대 4개 불러오기":"후보 2개 이상 저장하면 불러올 수 있습니다";load.onclick=()=>loadSavedCompare(list.slice(0,4).map(x=>x.slug))}
}
function loadSavedCompare(slugs){
  const selects=qa("select[data-v34-pick]");if(!selects.length)return;
  const picks=[...new Set(slugs)].slice(0,4);
  selects.forEach(s=>{s.value=""});
  selects.forEach((s,i)=>{s.value=picks[i]||""});
  selects.forEach(s=>s.dispatchEvent(new Event("change",{bubbles:true})));
  q("[data-v34-workspace]")?.scrollIntoView({behavior:"smooth",block:"start"});
}
function renderAll(){
  qa("[data-v52-retention-home],[data-v52-retention-updates]").forEach(renderHomeLike);renderCompare();
}
initBrand();renderAll();
})();