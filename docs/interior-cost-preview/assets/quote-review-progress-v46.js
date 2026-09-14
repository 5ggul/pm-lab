(() => {
  'use strict';

  const PROGRESS_KEY='interior-review-progress-v46';
  const VENDORS=['a','b','c'];
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function getJSON(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
  function setJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
  function loadProgress(){const raw=getJSON(PROGRESS_KEY,null);return raw&&raw.version===1&&raw.entries&&typeof raw.entries==='object'?raw:{version:1,updatedAt:null,entries:{}}}
  function saveProgress(progress){progress.version=1;progress.updatedAt=new Date().toISOString();return setJSON(PROGRESS_KEY,progress)}
  function clearProgress(){try{localStorage.removeItem(PROGRESS_KEY);return true}catch{return false}}
  function hashText(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
  function entryKey(vendor,itemId,question){return `${vendor}:${itemId}:${hashText(question)}`}

  function currentGroups(){
    const report=window.InteriorQuoteReview43;
    const vendorApi=window.InteriorQuoteReview45;
    if(!report?.loadData||!vendorApi?.questionsForVendor)return [];
    const data=report.loadData();
    return VENDORS.map(vendor=>({vendor,items:vendorApi.questionsForVendor(data,vendor)})).filter(group=>group.items.length);
  }

  function rowsFrom(groups){
    const rows=[];
    for(const group of groups){
      for(const item of group.items){
        for(const question of item.questions){rows.push({vendor:group.vendor,itemId:item.id,itemName:item.name,question,key:entryKey(group.vendor,item.id,question)})}
      }
    }
    return rows;
  }

  function statsFor(rows,progress){
    const byVendor={};let done=0;
    for(const vendor of VENDORS)byVendor[vendor]={done:0,total:0};
    for(const row of rows){const entry=progress.entries[row.key]||{};byVendor[row.vendor].total++;if(entry.done){done++;byVendor[row.vendor].done++}}
    return {done,total:rows.length,byVendor};
  }

  function ensureStyle(){
    if($('#v46-review-progress-style'))return;
    const style=document.createElement('style');style.id='v46-review-progress-style';style.textContent=`
      .v46-progress-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.v46-progress-stat{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:12px}.v46-progress-stat span{display:block;color:var(--muted,#777168);font-size:12px}.v46-progress-stat strong{display:block;margin-top:4px;font-size:18px}.v46-progress-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.v46-progress-card{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:14px;min-width:0}.v46-progress-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:10px}.v46-progress-head h3{margin:0;font-size:17px}.v46-progress-count{font-size:12px;color:var(--muted,#777168)}.v46-progress-item{border-top:1px solid var(--line,#c9c4b8);padding-top:10px;margin-top:10px}.v46-progress-item:first-child{border-top:0;margin-top:0;padding-top:0}.v46-progress-item>strong{display:block;margin-bottom:7px;font-size:14px}.v46-question{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:flex-start;margin:8px 0}.v46-question input{width:18px;height:18px;margin:1px 0 0}.v46-question span{font-size:13px;line-height:1.5}.v46-question.is-done span{text-decoration:line-through;color:var(--muted,#777168)}.v46-note-label{display:block;margin:6px 0 12px;color:var(--muted,#777168);font-size:12px}.v46-note-label textarea{display:block;width:100%;min-height:64px;margin-top:5px;resize:vertical;border:1px solid var(--line,#c9c4b8);background:#fff;color:var(--ink,#171a18);padding:8px;font:inherit}.v46-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.v46-card-actions button{flex:1 1 100%;min-height:40px}.v46-progress-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v46-progress-note{margin:10px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}.v46-empty{color:var(--muted,#777168)}
      @media(max-width:900px){.v46-progress-grid{grid-template-columns:1fr}.v46-progress-summary{grid-template-columns:1fr 1fr}}@media(max-width:520px){.v46-progress-summary{grid-template-columns:1fr 1fr}.v46-progress-stat strong{font-size:16px}}
      @media print{.v46-progress-grid{grid-template-columns:1fr}.v46-progress-card{break-inside:avoid}.v46-progress-actions,.v46-card-actions{display:none!important}.v46-note-label textarea{border:0;min-height:36px;resize:none}.v46-question input{appearance:none;-webkit-appearance:none;border:1px solid #171a18;background:#fff}.v46-question input:checked::after{content:'✓';display:block;text-align:center;font-weight:700;line-height:16px}.v46-progress-note{font-size:10px}}
    `;document.head.append(style);
  }

  function ensureSection(){
    let section=$('[data-v46-progress-section]');if(section)return section;
    const anchor=$('[data-v45-vendor-section]')||$('[data-v44-checklist-section]')||$('[data-review-section]');if(!anchor)return null;
    section=document.createElement('section');section.className='tool-stage';section.dataset.v46ProgressSection='';section.hidden=true;section.innerHTML='<div class="v10-section-head"><div><h2>업체 답변 검수 진행</h2><p>업체별 질문을 확인 완료로 표시하고 답변 메모를 남깁니다. 진행 기록만 이 브라우저에 별도 저장되며 원본 견적과 비교표는 수정하지 않습니다.</p></div></div><div class="v46-progress-summary" data-v46-progress-summary></div><div class="v46-progress-grid" data-v46-progress-grid></div><div class="v46-progress-actions"><button type="button" data-v46-reset>진행 기록 초기화</button></div><p class="v46-progress-note">완료 체크와 메모는 <code>interior-review-progress-v46</code>에만 저장됩니다. 다른 기기나 브라우저와 자동 동기화되지 않습니다.</p>';
    anchor.after(section);return section;
  }

  function updateSummary(section,rows,progress){
    const host=$('[data-v46-progress-summary]',section);if(!host)return;
    const stats=statsFor(rows,progress);host.replaceChildren();
    const entries=[['전체 진행',`${stats.done} / ${stats.total}`],...VENDORS.map(v=>[`${v.toUpperCase()} 업체`,`${stats.byVendor[v].done} / ${stats.byVendor[v].total}`])];
    for(const [label,value] of entries){const card=document.createElement('div');card.className='v46-progress-stat';const span=document.createElement('span');span.textContent=label;const strong=document.createElement('strong');strong.textContent=value;card.append(span,strong);host.append(card)}
  }

  function unansweredText(vendor,rows,progress){
    const pending=rows.filter(row=>row.vendor===vendor&&!progress.entries[row.key]?.done);
    const lines=[`${vendor.toUpperCase()} 업체 미확인 질문`];
    if(!pending.length)lines.push('현재 질문은 모두 확인 완료 상태입니다.');
    else for(const row of pending){lines.push(`□ ${row.itemName}`);lines.push(`  - ${row.question}`);const note=(progress.entries[row.key]?.note||'').trim();if(note)lines.push(`  메모: ${note}`)}
    lines.push('※ 진행 기록은 현재 브라우저에만 저장됩니다.');
    return lines.join('\n');
  }

  function render(){
    ensureStyle();const section=ensureSection();if(!section)return {groups:[],rows:[],progress:loadProgress()};
    const groups=currentGroups();const rows=rowsFrom(groups);const progress=loadProgress();const grid=$('[data-v46-progress-grid]',section);grid.replaceChildren();
    if(!groups.length){section.hidden=false;updateSummary(section,rows,progress);const p=document.createElement('p');p.className='v46-empty';p.textContent='현재 업체별 질문이 없어 진행 기록을 만들 수 없습니다.';grid.append(p);return {groups,rows,progress}}
    section.hidden=false;updateSummary(section,rows,progress);
    for(const group of groups){
      const vendorRows=rows.filter(row=>row.vendor===group.vendor);const card=document.createElement('article');card.className='v46-progress-card';card.dataset.vendor=group.vendor;
      const head=document.createElement('div');head.className='v46-progress-head';const h=document.createElement('h3');h.textContent=`${group.vendor.toUpperCase()} 업체`;const count=document.createElement('span');count.className='v46-progress-count';const vendorStat=statsFor(rows,progress).byVendor[group.vendor];count.textContent=`${vendorStat.done} / ${vendorStat.total} 완료`;head.append(h,count);card.append(head);
      const itemMap=new Map();for(const row of vendorRows){if(!itemMap.has(row.itemId))itemMap.set(row.itemId,{name:row.itemName,rows:[]});itemMap.get(row.itemId).rows.push(row)}
      for(const [itemId,item] of itemMap){const block=document.createElement('div');block.className='v46-progress-item';block.dataset.item=itemId;const title=document.createElement('strong');title.textContent=item.name;block.append(title);
        for(const row of item.rows){const entry=progress.entries[row.key]||{};const label=document.createElement('label');label.className=`v46-question${entry.done?' is-done':''}`;const check=document.createElement('input');check.type='checkbox';check.checked=!!entry.done;check.dataset.v46Check=row.key;const text=document.createElement('span');text.textContent=row.question;label.append(check,text);block.append(label);const noteLabel=document.createElement('label');noteLabel.className='v46-note-label';noteLabel.textContent='업체 답변 메모';const textarea=document.createElement('textarea');textarea.dataset.v46Note=row.key;textarea.placeholder='예: 폐기물 반출 포함, VAT 별도라고 답변';textarea.value=entry.note||'';noteLabel.append(textarea);block.append(noteLabel)}
        card.append(block)}
      const actions=document.createElement('div');actions.className='v46-card-actions';const copy=document.createElement('button');copy.type='button';copy.dataset.v46CopyPending=group.vendor;copy.textContent='미확인 질문만 복사';actions.append(copy);card.append(actions);grid.append(card)}

    $$('[data-v46-check]',section).forEach(check=>check.addEventListener('change',()=>{const p=loadProgress();const current=p.entries[check.dataset.v46Check]||{};p.entries[check.dataset.v46Check]={done:check.checked,note:current.note||''};saveProgress(p);check.closest('.v46-question')?.classList.toggle('is-done',check.checked);updateSummary(section,rows,p);const card=check.closest('.v46-progress-card');if(card){const vendor=card.dataset.vendor;const s=statsFor(rows,p).byVendor[vendor];const countEl=$('.v46-progress-count',card);if(countEl)countEl.textContent=`${s.done} / ${s.total} 완료`}}));
    let noteTimer=null;$$('[data-v46-note]',section).forEach(textarea=>textarea.addEventListener('input',()=>{clearTimeout(noteTimer);noteTimer=setTimeout(()=>{const p=loadProgress();const current=p.entries[textarea.dataset.v46Note]||{};p.entries[textarea.dataset.v46Note]={done:!!current.done,note:textarea.value};saveProgress(p)},220)}));
    $$('[data-v46-copy-pending]',section).forEach(button=>button.addEventListener('click',async()=>{const original=button.textContent;try{const p=loadProgress();await navigator.clipboard.writeText(unansweredText(button.dataset.v46CopyPending,rows,p));button.textContent='미확인 질문 복사됨'}catch{button.textContent='복사 실패'}setTimeout(()=>button.textContent=original,1200)}));
    $('[data-v46-reset]',section)?.addEventListener('click',()=>{if(!confirm('업체 답변 완료 체크와 메모를 모두 지울까요?'))return;clearProgress();render()});
    return {groups,rows,progress};
  }

  function init(){let current=render();$('[data-refresh-report]')?.addEventListener('click',()=>{current=render()});return current}

  window.InteriorQuoteReview46={PROGRESS_KEY,entryKey,currentGroups,rowsFrom,loadProgress,saveProgress,statsFor,unansweredText,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
