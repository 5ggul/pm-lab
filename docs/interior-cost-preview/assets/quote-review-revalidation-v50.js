(() => {
  'use strict';

  const STATE_KEY='interior-review-revalidation-v50';
  const QUOTE_URL=window.INTERIOR_REVALIDATION_QUOTE_URL||'/pm-lab/interior-cost-preview/quote-check/';
  const COMPARE_URL=window.INTERIOR_REVALIDATION_COMPARE_URL||'/pm-lab/interior-cost-preview/quote-compare/';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  const TASK_DEFS={
    quote:{id:'quote',title:'견적 입력 다시 확인',description:'저장 견적의 포함·별도·미기재, 금액, 수량·사양이 바뀌었는지 다시 확인합니다.',sources:['quote'],route:QUOTE_URL},
    compare:{id:'compare',title:'A/B/C 비교 다시 확인',description:'업체별 포함조건과 금액 비교가 현재 견적 기준과 맞는지 다시 확인합니다.',sources:['compare5','compare6'],route:COMPARE_URL},
    progress:{id:'progress',title:'업체 답변 진행 다시 확인',description:'변경된 질문·답변 메모·완료 체크가 현재 비교 내용과 맞는지 다시 확인합니다.',sources:['progress'],target:'[data-v46-progress-section]'},
    reflection:{id:'reflection',title:'계약서 반영 기록 다시 확인',description:'업체 답변 변경 뒤 서면 반영 체크와 계약서·견적서 위치 메모가 여전히 맞는지 다시 확인합니다.',sources:['reflection'],target:'[data-v48-reflection-section]'}
  };

  function readJSON(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
  function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
  function clearState(){try{localStorage.removeItem(STATE_KEY);return true}catch{return false}}
  function hashText(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}

  function loadState(){const raw=readJSON(STATE_KEY,null);return raw&&raw.version===1&&raw.entries&&typeof raw.entries==='object'?raw:{version:1,updatedAt:null,entries:{}}}
  function saveState(state){state.version=1;state.updatedAt=new Date().toISOString();return writeJSON(STATE_KEY,state)}

  function changedIds(){
    const api=window.InteriorQuoteReview49;
    if(!api?.compareBaseline)return {state:'none',result:null,ids:[]};
    const result=api.compareBaseline();
    return {state:result.state,result,ids:(result.changed||[]).map(row=>row.id)};
  }

  function buildTasks(){
    const info=changedIds();
    if(info.state!=='changed')return {state:info.state,result:info.result,tasks:[]};
    const ids=new Set(info.ids);const tasks=[];const baselineStamp=info.result.baseline?.createdAt||'';
    for(const def of Object.values(TASK_DEFS)){
      const affected=def.sources.filter(id=>ids.has(id));if(!affected.length)continue;
      const signature=`${baselineStamp}|`+affected.map(id=>{const row=info.result.changed.find(x=>x.id===id);const before=row?.before||{};const now=row?.now||{};return `${id}:${before.present?'1':'0'}:${before.length||0}:${before.hash||''}>${now.present?'1':'0'}:${now.length||0}:${now.hash||''}`}).join('|');
      tasks.push({...def,affected,signature,entryKey:`${def.id}:${hashText(signature)}`});
    }
    return {state:info.state,result:info.result,tasks};
  }

  function taskStats(tasks,state){let done=0;for(const task of tasks){if(state.entries[task.entryKey]?.done)done++}return {done,total:tasks.length,pending:tasks.length-done}}

  function queueText(model=buildTasks(),state=loadState()){
    const lines=['인테리어 변경 후 재검수 큐'];
    if(model.state==='none')lines.push('검수 기준 스냅샷이 없어 재검수 대상을 계산할 수 없습니다.');
    else if(model.state==='clean')lines.push('검수 기준 이후 변경된 저장 영역이 없습니다.');
    else{
      const stats=taskStats(model.tasks,state);lines.push(`재검수 완료 ${stats.done} / ${stats.total} · 미완료 ${stats.pending}`);
      for(const task of model.tasks){const entry=state.entries[task.entryKey]||{};lines.push(`${entry.done?'☑':'□'} ${task.title}`);lines.push(`  변경 영역: ${task.affected.join(', ')}`);if((entry.note||'').trim())lines.push(`  재검수 메모: ${entry.note.trim()}`)}
      lines.push('모든 항목을 다시 확인한 뒤 필요하면 검수 기준 스냅샷을 새로 저장하세요.');
    }
    lines.push('※ 재검수 완료 체크는 사용자 확인 기록이며 가격 적정성, 계약 효력 또는 업체 품질을 판정하지 않습니다.');
    return lines.join('\n');
  }

  function ensureStyle(){
    if($('#v50-revalidation-style'))return;
    const style=document.createElement('style');style.id='v50-revalidation-style';style.textContent=`
      .v50-status{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:14px;margin-bottom:12px}.v50-status strong{display:block;font-size:18px}.v50-status p{margin:6px 0 0;color:var(--muted,#777168);font-size:13px;line-height:1.55}.v50-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.v50-card{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:14px;min-width:0}.v50-card.is-done{opacity:.72}.v50-check{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:flex-start;font-weight:800}.v50-check input{width:18px;height:18px;margin:1px 0 0}.v50-card p{margin:8px 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}.v50-chips{display:flex;gap:6px;flex-wrap:wrap}.v50-chip{border:1px solid var(--line,#c9c4b8);background:#fff;padding:3px 6px;font-size:11px}.v50-note-label{display:block;margin-top:10px;color:var(--muted,#777168);font-size:12px}.v50-note-label textarea{display:block;width:100%;min-height:60px;margin-top:5px;padding:8px;border:1px solid var(--line,#c9c4b8);background:#fff;color:var(--ink,#171a18);font:inherit;resize:vertical}.v50-card-actions,.v50-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.v50-card-actions a,.v50-card-actions button,.v50-actions button{min-height:40px}.v50-card-actions>*{flex:1 1 150px}.v50-actions button{flex:1 1 180px}.v50-note{margin:10px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}
      @media(max-width:760px){.v50-grid{grid-template-columns:1fr}}@media print{.v50-grid{grid-template-columns:1fr}.v50-card{break-inside:avoid}.v50-card-actions,.v50-actions{display:none!important}.v50-note-label textarea{border:0;min-height:30px;resize:none}.v50-check input{appearance:none;-webkit-appearance:none;border:1px solid #171a18;background:#fff}.v50-check input:checked::after{content:'✓';display:block;text-align:center;font-weight:700;line-height:16px}}
    `;document.head.append(style);
  }

  function ensureSection(){
    let section=$('[data-v50-revalidation-section]');if(section)return section;
    const anchor=$('[data-v49-baseline-section]')||$('[data-v48-reflection-section]')||$('[data-review-section]');if(!anchor)return null;
    section=document.createElement('section');section.className='tool-stage';section.dataset.v50RevalidationSection='';section.innerHTML='<div class="v10-section-head"><div><h2>변경 후 재검수 큐</h2><p>검수 기준 이후 바뀐 저장 영역을 실제로 다시 확인해야 할 작업으로 묶습니다. 완료 체크는 별도 기록이며 검수 기준을 자동 갱신하지 않습니다.</p></div></div><div class="v50-status" data-v50-status></div><div class="v50-grid" data-v50-grid></div><div class="v50-actions"><button type="button" data-v50-copy>재검수 목록 복사</button><button type="button" data-v50-reset>재검수 기록 초기화</button></div><p class="v50-note">재검수 체크·메모는 <code>interior-review-revalidation-v50</code>에만 저장됩니다. 기존 견적·비교·업체 답변·계약서 반영·v49 검수 기준은 수정하지 않습니다.</p>';
    anchor.after(section);return section;
  }

  function render(){
    ensureStyle();const section=ensureSection();const model=buildTasks();const state=loadState();if(!section)return {model,state};const status=$('[data-v50-status]',section);const grid=$('[data-v50-grid]',section);grid.replaceChildren();
    if(model.state==='none')status.innerHTML='<strong>검수 기준이 없어 재검수 큐를 만들 수 없습니다.</strong><p>먼저 “검수 기준 변경 감지”에서 기준을 저장하세요.</p>';
    else if(model.state==='clean')status.innerHTML='<strong>현재 재검수할 변경이 없습니다.</strong><p>검수 기준 이후 추적 중인 저장 영역이 바뀌지 않았습니다.</p>';
    else{const stats=taskStats(model.tasks,state);status.innerHTML=`<strong>재검수 ${stats.done} / ${stats.total} 완료</strong><p>미완료 ${stats.pending}개. 변경 내용이 다시 바뀌면 해당 작업은 새 변경 서명으로 별도 재검수 대상이 됩니다.</p>`}
    for(const task of model.tasks){const entry=state.entries[task.entryKey]||{};const card=document.createElement('article');card.className=`v50-card${entry.done?' is-done':''}`;card.dataset.task=task.id;const label=document.createElement('label');label.className='v50-check';const check=document.createElement('input');check.type='checkbox';check.checked=!!entry.done;check.dataset.v50Check=task.entryKey;const text=document.createElement('span');text.textContent=task.title;label.append(check,text);card.append(label);const desc=document.createElement('p');desc.textContent=task.description;card.append(desc);const chips=document.createElement('div');chips.className='v50-chips';for(const id of task.affected){const chip=document.createElement('span');chip.className='v50-chip';chip.textContent=id;chips.append(chip)}card.append(chips);const noteLabel=document.createElement('label');noteLabel.className='v50-note-label';noteLabel.textContent='재검수 메모';const textarea=document.createElement('textarea');textarea.dataset.v50Note=task.entryKey;textarea.placeholder='예: 비교표와 최종 견적서 금액·포함조건 다시 대조함';textarea.value=entry.note||'';noteLabel.append(textarea);card.append(noteLabel);const actions=document.createElement('div');actions.className='v50-card-actions';if(task.route){const a=document.createElement('a');a.href=task.route;a.textContent='해당 화면 보기';actions.append(a)}else if(task.target){const button=document.createElement('button');button.type='button';button.dataset.v50Target=task.target;button.textContent='해당 항목 보기';actions.append(button)}card.append(actions);grid.append(card)}
    $$('[data-v50-check]',section).forEach(check=>check.addEventListener('change',()=>{const next=loadState();const current=next.entries[check.dataset.v50Check]||{};next.entries[check.dataset.v50Check]={done:check.checked,note:current.note||''};saveState(next);render()}));
    const timers=new Map();$$('[data-v50-note]',section).forEach(textarea=>textarea.addEventListener('input',()=>{const key=textarea.dataset.v50Note;clearTimeout(timers.get(key));timers.set(key,setTimeout(()=>{const next=loadState();const current=next.entries[key]||{};next.entries[key]={done:!!current.done,note:textarea.value};saveState(next);timers.delete(key)},220))}));
    $$('[data-v50-target]',section).forEach(button=>button.addEventListener('click',()=>$(button.dataset.v50Target)?.scrollIntoView({behavior:'smooth',block:'start'})));
    $('[data-v50-copy]',section)?.addEventListener('click',async()=>{const button=$('[data-v50-copy]',section);const original=button.textContent;try{await navigator.clipboard.writeText(queueText(buildTasks(),loadState()));button.textContent='재검수 목록 복사됨'}catch{button.textContent='복사 실패'}setTimeout(()=>button.textContent=original,1200)});
    $('[data-v50-reset]',section)?.addEventListener('click',()=>{if(!confirm('재검수 완료 체크와 메모를 모두 지울까요?'))return;clearState();render()});
    return {model,state};
  }

  function init(){let current=render();$('[data-refresh-report]')?.addEventListener('click',()=>{current=render()});$('[data-v49-save]')?.addEventListener('click',()=>setTimeout(()=>{current=render()},0));$('[data-v49-clear]')?.addEventListener('click',()=>setTimeout(()=>{current=render()},0));return current}

  window.InteriorQuoteReview50={STATE_KEY,loadState,saveState,clearState,changedIds,buildTasks,taskStats,queueText,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
