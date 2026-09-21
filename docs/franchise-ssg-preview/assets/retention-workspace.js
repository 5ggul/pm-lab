(()=>{"use strict";
const SAVE_KEY="franchiseLabShortlistV1",RECENT_KEY="franchiseLabRecentV1",CHECK_KEY="franchiseLabChecklistV1:",NOTE_KEY="franchiseLabNoteV1:",PLAN_KEY="franchiseLabPlanV1:";
const BACKUP_SCHEMA="franchiseLabShortlistBackup",BACKUP_VERSION=1,CHECK_KEYS=["disclosure","opening-cost","lease","construction","recurring","simulation"];
const STATUS_LABELS={review:"검토 중",hq:"본사 문의",site:"입지 확인",hold:"보류"};
let activeStatusFilter="all",changeOnly=false;
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
const noteFor=slug=>{const v=safeRead(NOTE_KEY+slug,"");return typeof v==="string"?v.slice(0,240):""};
const checklistFor=slug=>{const raw=safeRead(CHECK_KEY+slug,{}),out={};CHECK_KEYS.forEach(k=>out[k]=Boolean(raw?.[k]));return out};
const checklistStats=slug=>{const state=checklistFor(slug),done=CHECK_KEYS.filter(k=>state[k]).length;return{done,total:CHECK_KEYS.length}};
const planFor=slug=>{const raw=safeRead(PLAN_KEY+slug,{}),status=STATUS_LABELS[raw?.status]?raw.status:"review",nextAction=typeof raw?.nextAction==="string"?raw.nextAction.slice(0,120):"";return{status,nextAction}};
const writePlan=(slug,plan)=>safeWrite(PLAN_KEY+slug,{status:STATUS_LABELS[plan?.status]?plan.status:"review",nextAction:String(plan?.nextAction||"").slice(0,120)});
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
function acceptCurrentBaseline(slug,data){
  const cur=currentRecord(data,slug);if(!cur)return false;
  let found=false;
  const next=saved().map(item=>{
    if(item.slug!==slug)return item;found=true;
    return {...item,name:cur.name,route:cur.route,categoryName:cur.categoryName,snapshotId:data?.snapshotId||item.snapshotId,sourceYear:cur.sourceYear,savedAt:new Date().toISOString(),metrics:{cost:cur.cost,stores:cur.stores,sales:cur.sales,growth:cur.growth}};
  });
  if(found)writeSaved(next);return found;
}
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
      q("[data-v52-ack-change]",change)?.addEventListener("click",()=>{acceptCurrentBaseline(cur.slug,data);updateBrandSaveUI(el);renderAll()});
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
    const slug=el.dataset.brandSlug,key=CHECK_KEY+slug,checks=checklistFor(slug);
    qa("[data-v52-check]",el).forEach(input=>{
      input.checked=Boolean(checks[input.dataset.v52Check]);
      input.addEventListener("change",()=>{const state=checklistFor(slug);state[input.dataset.v52Check]=input.checked;safeWrite(key,state);updateProgress(el);renderAll()});
    });
    const note=q("[data-v52-candidate-note]",el),count=q("[data-v52-note-count]",el);
    if(note){
      note.value=noteFor(slug);
      const updateNoteCount=()=>{if(count)count.textContent=note.value.length+"/240"};
      updateNoteCount();
      note.addEventListener("input",()=>{const value=note.value.slice(0,240);if(note.value!==value)note.value=value;safeWrite(NOTE_KEY+slug,value);updateNoteCount();renderAll()});
    }
    const status=q("[data-v52-candidate-status]",el),nextAction=q("[data-v52-next-action]",el),summary=q("[data-v52-plan-summary]",el),plan=planFor(slug);
    if(status&&nextAction){
      status.value=plan.status;nextAction.value=plan.nextAction;
      const persist=()=>{const next={status:status.value,nextAction:nextAction.value.slice(0,120)};writePlan(slug,next);if(nextAction.value!==next.nextAction)nextAction.value=next.nextAction;if(summary)summary.textContent=STATUS_LABELS[next.status]||STATUS_LABELS.review;renderAll()};
      if(summary)summary.textContent=STATUS_LABELS[plan.status];
      status.addEventListener("change",persist);nextAction.addEventListener("input",persist);
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
  const plan=planFor(item.slug),nextText=plan.nextAction?(plan.nextAction.length>64?plan.nextAction.slice(0,64)+"…":plan.nextAction):"다음 행동 미정";
  return '<div class="v52-retention-item" data-v52-plan-status="'+plan.status+'"><a href="'+routeHref(item.route||cur?.route)+'">'+escHtml(cur?.name||item.name)+'</a><small>'+escHtml(cur?.categoryName||item.categoryName||"")+' · '+escHtml(cur?.sourceYear||item.sourceYear||"")+' 기준 · '+escHtml(STATUS_LABELS[plan.status])+'</small><span class="v52-retention-progress">계약 전 확인 '+stats.done+'/'+stats.total+' · '+escHtml(noteText)+'</span><span class="v52-retention-next">다음: '+escHtml(nextText)+'</span><em>'+change+'</em></div>';
}
function changeInboxItemHtml(item,cur){
  const d=diffs(item,cur),plan=planFor(item.slug),nextText=plan.nextAction?plan.nextAction:"다음 행동 미정";
  return '<div class="v52-change-inbox-item" data-v52-change-item="'+escHtml(item.slug)+'"><div><a href="'+routeHref(cur?.route||item.route)+'">'+escHtml(cur?.name||item.name)+'</a><small>'+d.map(x=>escHtml(x.text)).join(" · ")+'</small><span>'+escHtml(STATUS_LABELS[plan.status])+' · '+escHtml(nextText)+'</span></div><button type="button" data-v52-ack-saved-change="'+escHtml(item.slug)+'">현재값 확인 완료</button></div>';
}
function changedEntries(list,data){
  return list.map(item=>({item,cur:currentRecord(data,item.slug)})).filter(x=>x.cur&&diffs(x.item,x.cur).length>0);
}
function renderChangeInboxes(){
  const data=dataset();if(!data)return;
  const entries=changedEntries(saved(),data);
  qa("[data-v52-change-inbox]").forEach(root=>{
    const box=q("[data-v52-change-inbox-list]",root),ackAll=q("[data-v52-ack-all-changes]",root);
    root.hidden=entries.length===0;
    if(box)box.innerHTML=entries.map(x=>changeInboxItemHtml(x.item,x.cur)).join("");
    if(ackAll){
      ackAll.disabled=entries.length===0;
      ackAll.onclick=()=>{entries.forEach(x=>acceptCurrentBaseline(x.item.slug,data));qa("[data-v52-brand-workspace]").forEach(updateBrandSaveUI);renderAll()};
    }
    qa("[data-v52-ack-saved-change]",root).forEach(btn=>btn.addEventListener("click",()=>{acceptCurrentBaseline(btn.dataset.v52AckSavedChange,data);qa("[data-v52-brand-workspace]").forEach(updateBrandSaveUI);renderAll()}));
  });
}
function renderDashboard(root,list,data){
  const dash=q("[data-v52-shortlist-dashboard]",root);if(!dash)return;
  const done=list.reduce((sum,item)=>sum+checklistStats(item.slug).done,0),total=list.length*CHECK_KEYS.length,changed=changedEntries(list,data).length;
  const savedOut=q("[data-v52-dashboard-saved]",dash),checksOut=q("[data-v52-dashboard-checks]",dash),changesOut=q("[data-v52-dashboard-changes]",dash),changeCount=q("[data-v52-change-filter-count]",dash),changeButton=q("[data-v52-change-only]",dash);
  if(savedOut)savedOut.textContent=String(list.length);if(checksOut)checksOut.textContent=done+"/"+total;if(changesOut)changesOut.textContent=String(changed);if(changeCount)changeCount.textContent=String(changed);if(changeButton)changeButton.setAttribute("aria-pressed",changeOnly?"true":"false");
  qa("[data-v52-status-filter]",dash).forEach(btn=>btn.setAttribute("aria-pressed",btn.dataset.v52StatusFilter===activeStatusFilter?"true":"false"));
}
function renderHomeLike(root){
  const data=dataset();if(!data)return;
  const list=saved(),savedBox=q("[data-v52-saved-list]",root),recentBox=q("[data-v52-recent-list]",root),alert=q("[data-v52-retention-alert]",root),hasDashboard=Boolean(q("[data-v52-shortlist-dashboard]",root)),changedSlugs=new Set(changedEntries(list,data).map(x=>x.item.slug));
  renderDashboard(root,list,data);
  const visible=list.filter(item=>(!hasDashboard||activeStatusFilter==="all"||planFor(item.slug).status===activeStatusFilter)&&(!hasDashboard||!changeOnly||changedSlugs.has(item.slug)));
  if(savedBox){
    const empty=changeOnly?"저장 후 달라진 후보가 없습니다.":"선택한 상태의 저장 후보가 없습니다.";
    savedBox.innerHTML=visible.length?visible.map(item=>itemHtml(item,currentRecord(data,item.slug))).join(""):(list.length?'<p class="v52-retention-empty">'+empty+'</p>':'<p class="v52-retention-empty">브랜드 상세에서 ‘관심 브랜드 저장’을 누르면 다음 방문에도 이 브라우저에서 이어볼 수 있습니다.</p>');
  }
  const rec=recent().map(slug=>currentRecord(data,slug)).filter(Boolean).slice(0,5);
  if(recentBox)recentBox.innerHTML=rec.length?rec.map(cur=>'<div class="v52-retention-item"><a href="'+routeHref(cur.route)+'">'+escHtml(cur.name)+'</a><small>'+escHtml(cur.categoryName)+' · 공개비용 '+fmt(cur.cost,"만원")+'</small><em>최근 확인</em></div>').join(""):'<p class="v52-retention-empty">아직 최근 본 브랜드가 없습니다.</p>';
  const stale=list.filter(item=>item.snapshotId&&item.snapshotId!==data.snapshotId);
  if(alert){
    alert.hidden=!stale.length;
    if(stale.length)alert.innerHTML='<span><strong>'+stale.length+'개 저장 후보</strong>가 저장 이후 다른 데이터 스냅샷을 사용 중입니다. 현재 공개값과 저장 당시 값을 비교해 보세요.</span><a href="'+base()+'/updates/">변화 레이더 보기</a>';
  }
}
function decisionBoardRow(item,cur){
  const stats=checklistStats(item.slug),plan=planFor(item.slug),d=diffs(item,cur),change=d.length?d.map(x=>x.text).join(" · "):"변경 없음";
  const sales=Number.isFinite(Number(cur?.sales))&&Number(cur.sales)>0?fmt(cur.sales,"만원"):"정보 없음";
  const growth=Number.isFinite(Number(cur?.growth))?(Number(cur.growth)>0?"+":"")+new Intl.NumberFormat("ko-KR",{maximumFractionDigits:1}).format(Number(cur.growth))+"%":"정보 없음";
  const next=plan.nextAction||"다음 행동 미정";
  return '<div class="v52-decision-board-row" data-v52-decision-row="'+escHtml(item.slug)+'"><span class="v52-board-brand"><a href="'+routeHref(cur?.route||item.route)+'">'+escHtml(cur?.name||item.name)+'</a><small>'+escHtml(cur?.categoryName||item.categoryName||"")+' · '+escHtml(cur?.sourceYear||item.sourceYear||"")+' 기준 · 다음: '+escHtml(next)+'</small></span><span>'+escHtml(STATUS_LABELS[plan.status])+'</span><span>'+stats.done+'/'+stats.total+'</span><span>'+fmt(cur?.cost,"만원")+'</span><span>'+fmt(cur?.stores,"개")+'</span><span>'+sales+'</span><span>'+growth+'</span><span class="'+(d.length?"is-changed":"")+'">'+escHtml(change)+'</span></div>';
}
const csvNeutral=v=>{
  let text=String(v??"").replace(/\r?\n/g," ").trim();
  if(/^[=+\-@]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
};
function exportDecisionCsv(root,data,list){
  const button=q("[data-v52-export-decision-csv]",root);if(!list.length)return;
  const header=["브랜드","업종","상태","확인완료","확인전체","공개비용만원","가맹점수","연평균매출만원","점포변화율","저장후변화","다음행동","메모","기준연도","브랜드URL"];
  const rows=list.map(item=>{
    const cur=currentRecord(data,item.slug);if(!cur)return null;
    const stats=checklistStats(item.slug),plan=planFor(item.slug),d=diffs(item,cur).map(x=>x.text).join(" · ");
    return [cur.name,cur.categoryName,STATUS_LABELS[plan.status],stats.done,stats.total,Number.isFinite(Number(cur.cost))?cur.cost:"",Number.isFinite(Number(cur.stores))?cur.stores:"",Number.isFinite(Number(cur.sales))&&Number(cur.sales)>0?cur.sales:"",Number.isFinite(Number(cur.growth))?cur.growth:"",d||"변경 없음",plan.nextAction,noteFor(item.slug),cur.sourceYear,location.origin+routeHref(cur.route)];
  }).filter(Boolean);
  const csv="\ufeff"+[header,...rows].map(row=>row.map(csvNeutral).join(",")).join("\r\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),href=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=href;a.download="franchise-shortlist-decision-board.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
  if(button)button.textContent="CSV 저장 완료";
  setTimeout(()=>{if(button)button.textContent="CSV 내보내기"},1200);
}
function renderCompare(){
  const root=q("[data-v52-saved-compare]"),data=dataset();if(!root||!data)return;
  const savedItems=saved(),list=savedItems.map(x=>currentRecord(data,x.slug)).filter(Boolean);
  const box=q("[data-v52-saved-compare-list]",root);
  if(box)box.innerHTML=list.length?list.map(x=>'<button type="button" class="v52-saved-compare-chip" data-v52-compare-chip="'+escHtml(x.slug)+'">'+escHtml(x.name)+'</button>').join(""):'<span class="v52-retention-empty">저장한 후보가 없습니다.</span>';
  qa("[data-v52-compare-chip]",root).forEach(btn=>btn.addEventListener("click",()=>loadSavedCompare([btn.dataset.v52CompareChip])));
  const load=q("[data-v52-load-saved]",root);if(load){load.disabled=list.length<2;load.textContent=list.length>=2?"저장 후보 최대 4개 불러오기":"후보 2개 이상 저장하면 불러올 수 있습니다";load.onclick=()=>loadSavedCompare(list.slice(0,4).map(x=>x.slug))}
  const board=q("[data-v52-decision-board]",root),rows=q("[data-v52-decision-board-rows]",root),csv=q("[data-v52-export-decision-csv]",root);
  if(board&&rows){
    const usable=savedItems.filter(item=>currentRecord(data,item.slug));
    rows.innerHTML=usable.length?usable.map(item=>decisionBoardRow(item,currentRecord(data,item.slug))).join(""):'<p class="v52-retention-empty">저장한 후보가 없습니다.</p>';
    board.dataset.count=String(usable.length);
    if(csv){csv.disabled=!usable.length;csv.onclick=()=>exportDecisionCsv(root,data,usable)}
  }
}
function loadSavedCompare(slugs){
  const selects=qa("select[data-v34-pick]");if(!selects.length)return;
  const picks=[...new Set(slugs)].slice(0,4);
  selects.forEach(s=>{s.value=""});
  selects.forEach((s,i)=>{s.value=picks[i]||""});
  selects.forEach(s=>s.dispatchEvent(new Event("change",{bubbles:true})));
  q("[data-v34-workspace]")?.scrollIntoView({behavior:"smooth",block:"start"});
}
function normalizedSavedItem(raw,cur){
  const metric=(k)=>Number.isFinite(Number(raw?.metrics?.[k]))?Number(raw.metrics[k]):Number(cur[k]);
  return {slug:cur.slug,name:cur.name,route:cur.route,categoryName:cur.categoryName,snapshotId:typeof raw?.snapshotId==="string"?raw.snapshotId.slice(0,120):"",sourceYear:Number.isFinite(Number(raw?.sourceYear))?Number(raw.sourceYear):Number(cur.sourceYear),savedAt:typeof raw?.savedAt==="string"?raw.savedAt.slice(0,40):new Date().toISOString(),metrics:{cost:metric("cost"),stores:metric("stores"),sales:metric("sales"),growth:metric("growth")}};
}
function buildBackup(data){
  const list=saved(),slugs=list.map(x=>x.slug);
  const checks={},notes={},plans={};
  slugs.forEach(slug=>{checks[slug]=checklistFor(slug);notes[slug]=noteFor(slug);plans[slug]=planFor(slug)});
  return {schema:BACKUP_SCHEMA,version:BACKUP_VERSION,exportedAt:new Date().toISOString(),snapshotId:data?.snapshotId||"",saved:list,recent:recent(),checks,notes,plans};
}
function exportBackup(root){
  const data=dataset(),status=q("[data-v52-backup-status]",root);if(!data)return;
  try{
    const payload=buildBackup(data),blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),href=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=href;a.download="franchise-shortlist-backup.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
    if(status)status.textContent="후보 백업 파일을 저장했습니다.";
  }catch{if(status)status.textContent="백업 파일을 만들지 못했습니다."}
}
function clearOwnedStorage(){
  const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k)keys.push(k)}
  keys.filter(k=>k===SAVE_KEY||k===RECENT_KEY||k.startsWith(CHECK_KEY)||k.startsWith(NOTE_KEY)||k.startsWith(PLAN_KEY)).forEach(k=>localStorage.removeItem(k));
}
function importBackupPayload(payload,data){
  if(!payload||payload.schema!==BACKUP_SCHEMA||Number(payload.version)!==BACKUP_VERSION)throw new Error("backup schema");
  const map=new Map((data?.brands||[]).map(x=>[x.slug,x])),seen=new Set(),restored=[];
  for(const raw of Array.isArray(payload.saved)?payload.saved:[]){
    const slug=typeof raw?.slug==="string"?raw.slug:"",cur=map.get(slug);if(!cur||seen.has(slug))continue;seen.add(slug);restored.push(normalizedSavedItem(raw,cur));if(restored.length>=20)break;
  }
  const known=new Set(map.keys()),rec=(Array.isArray(payload.recent)?payload.recent:[]).filter(x=>typeof x==="string"&&known.has(x)).slice(0,8);
  clearOwnedStorage();writeSaved(restored);writeRecent(rec);
  restored.forEach(item=>{
    const slug=item.slug,rawChecks=payload.checks?.[slug]||{},checks={};CHECK_KEYS.forEach(k=>checks[k]=Boolean(rawChecks?.[k]));safeWrite(CHECK_KEY+slug,checks);
    const note=typeof payload.notes?.[slug]==="string"?payload.notes[slug].slice(0,240):"";safeWrite(NOTE_KEY+slug,note);
    const rawPlan=payload.plans?.[slug]||{};writePlan(slug,{status:STATUS_LABELS[rawPlan?.status]?rawPlan.status:"review",nextAction:typeof rawPlan?.nextAction==="string"?rawPlan.nextAction.slice(0,120):""});
  });
  return restored.length;
}
async function importBackup(file,root){
  const status=q("[data-v52-backup-status]",root),input=q("[data-v52-import-file]",root),data=dataset();
  try{
    if(!file||file.size>131072)throw new Error("backup size");
    const payload=JSON.parse(await file.text()),count=importBackupPayload(payload,data);activeStatusFilter="all";changeOnly=false;renderAll();
    if(status)status.textContent="복원 완료 · 후보 "+count+"개";
  }catch{if(status)status.textContent="올바른 후보 백업 파일이 아닙니다."}
  if(input)input.value="";
}
function initDashboard(){
  const root=q("[data-v52-retention-home]"),dash=root&&q("[data-v52-shortlist-dashboard]",root);if(!dash)return;
  qa("[data-v52-status-filter]",dash).forEach(btn=>btn.addEventListener("click",()=>{activeStatusFilter=btn.dataset.v52StatusFilter||"all";renderHomeLike(root)}));
  q("[data-v52-change-only]",dash)?.addEventListener("click",()=>{changeOnly=!changeOnly;renderHomeLike(root)});
  q("[data-v52-export-shortlist]",dash)?.addEventListener("click",()=>exportBackup(root));
  const input=q("[data-v52-import-file]",dash);
  q("[data-v52-import-shortlist]",dash)?.addEventListener("click",()=>input?.click());
  input?.addEventListener("change",()=>importBackup(input.files?.[0],root));
}
function renderAll(){
  qa("[data-v52-retention-home],[data-v52-retention-updates]").forEach(renderHomeLike);renderChangeInboxes();renderCompare();
}
initBrand();initDashboard();renderAll();
})();