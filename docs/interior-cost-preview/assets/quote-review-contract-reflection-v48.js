(() => {
  'use strict';

  const REFLECTION_KEY='interior-contract-reflection-v48';
  const VENDORS=['a','b','c'];
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function getJSON(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
  function setJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
  function loadReflection(){const raw=getJSON(REFLECTION_KEY,null);return raw&&raw.version===1&&raw.entries&&typeof raw.entries==='object'?raw:{version:1,updatedAt:null,entries:{}}}
  function saveReflection(state){state.version=1;state.updatedAt=new Date().toISOString();return setJSON(REFLECTION_KEY,state)}
  function clearReflection(){try{localStorage.removeItem(REFLECTION_KEY);return true}catch{return false}}

  function buildCandidates(){
    const api=window.InteriorQuoteReview47;
    if(!api?.buildModel)return [];
    const model=api.buildModel();
    const out=[];
    for(const vendor of model.vendors){
      for(const item of vendor.completedWithNote||[]){
        out.push({vendor:vendor.vendor,key:item.row.key,itemId:item.row.itemId,itemName:item.row.itemName,question:item.row.question,answer:item.note});
      }
    }
    return out;
  }

  function statsFor(candidates,state){
    const byVendor={};let reflected=0;
    for(const vendor of VENDORS)byVendor[vendor]={reflected:0,total:0};
    for(const row of candidates){const entry=state.entries[row.key]||{};byVendor[row.vendor].total++;if(entry.reflected){reflected++;byVendor[row.vendor].reflected++}}
    return {reflected,total:candidates.length,byVendor};
  }

  function reflectionText(candidates,state,vendor=null){
    const rows=vendor?candidates.filter(row=>row.vendor===vendor):candidates;
    const lines=[vendor?`${vendor.toUpperCase()} 업체 계약서 반영 확인`:'인테리어 계약서 반영 확인 요약'];
    if(!rows.length){lines.push('현재 반영 여부를 확인할 완료 답변 메모가 없습니다.');}
    else{
      const reflected=rows.filter(row=>state.entries[row.key]?.reflected).length;
      lines.push(`서면 반영 확인 ${reflected} / ${rows.length} · 미반영/미확인 ${rows.length-reflected}`);
      for(const row of rows){
        const entry=state.entries[row.key]||{};
        lines.push(`${entry.reflected?'☑':'□'} ${row.itemName} · ${row.vendor.toUpperCase()} 업체`);
        lines.push(`  업체 답변: ${row.answer}`);
        if((entry.documentNote||'').trim())lines.push(`  서면 반영 메모: ${entry.documentNote.trim()}`);
      }
    }
    lines.push('※ 업체 답변이 견적서·계약서 등 서면에 반영됐는지 사용자가 기록하는 체크이며 계약의 유효성, 법률 효과, 가격 적정성 또는 업체 품질을 판정하지 않습니다.');
    return lines.join('\n');
  }

  function pendingText(candidates,state,vendor){
    const rows=candidates.filter(row=>row.vendor===vendor&&!state.entries[row.key]?.reflected);
    const lines=[`${vendor.toUpperCase()} 업체 서면 미반영/미확인 항목`];
    if(!rows.length)lines.push('현재 반영 확인 대상은 모두 체크되어 있습니다.');
    else for(const row of rows){const entry=state.entries[row.key]||{};lines.push(`□ ${row.itemName}`);lines.push(`  업체 답변: ${row.answer}`);if((entry.documentNote||'').trim())lines.push(`  현재 메모: ${entry.documentNote.trim()}`)}
    lines.push('※ 실제 견적서·계약서 문구와 다시 대조하기 위한 기록입니다.');
    return lines.join('\n');
  }

  function ensureStyle(){
    if($('#v48-contract-reflection-style'))return;
    const style=document.createElement('style');style.id='v48-contract-reflection-style';style.textContent=`
      .v48-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.v48-stat{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:12px}.v48-stat span{display:block;color:var(--muted,#777168);font-size:12px}.v48-stat strong{display:block;margin-top:4px;font-size:18px}.v48-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.v48-card{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:14px;min-width:0}.v48-card h3{margin:0 0 10px;font-size:17px}.v48-row{border-top:1px solid var(--line,#c9c4b8);padding-top:10px;margin-top:10px}.v48-row:first-of-type{border-top:0;padding-top:0;margin-top:0}.v48-check{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:flex-start;font-weight:700;font-size:13px}.v48-check input{width:18px;height:18px;margin:1px 0 0}.v48-answer{margin:7px 0;padding:7px 8px;background:#fff;border-left:2px solid var(--line,#c9c4b8);font-size:12px;line-height:1.5;white-space:pre-wrap}.v48-note-label{display:block;color:var(--muted,#777168);font-size:12px}.v48-note-label textarea{display:block;width:100%;min-height:62px;margin-top:5px;padding:8px;border:1px solid var(--line,#c9c4b8);background:#fff;color:var(--ink,#171a18);font:inherit;resize:vertical}.v48-card-actions,.v48-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v48-card-actions button{width:100%;min-height:40px}.v48-actions button{min-height:40px;flex:1 1 180px}.v48-empty{color:var(--muted,#777168);font-size:13px}.v48-note{margin:10px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}
      @media(max-width:900px){.v48-grid{grid-template-columns:1fr}.v48-summary{grid-template-columns:1fr 1fr}}@media print{.v48-grid{grid-template-columns:1fr}.v48-card{break-inside:avoid}.v48-card-actions,.v48-actions{display:none!important}.v48-note-label textarea{border:0;min-height:32px;resize:none}.v48-check input{appearance:none;-webkit-appearance:none;border:1px solid #171a18;background:#fff}.v48-check input:checked::after{content:'✓';display:block;text-align:center;font-weight:700;line-height:16px}.v48-answer,.v48-note-label{font-size:10px}}
    `;document.head.append(style);
  }

  function ensureSection(){
    let section=$('[data-v48-reflection-section]');if(section)return section;
    const anchor=$('[data-v47-final-section]')||$('[data-v46-progress-section]')||$('[data-review-section]');if(!anchor)return null;
    section=document.createElement('section');section.className='tool-stage';section.dataset.v48ReflectionSection='';section.hidden=true;section.innerHTML='<div class="v10-section-head"><div><h2>계약서 반영 확인</h2><p>확인 완료된 업체 답변 메모가 실제 견적서·계약서 등 서면에 반영됐는지 별도로 기록합니다. 법률 효과나 계약 적합성은 판단하지 않습니다.</p></div></div><div class="v48-summary" data-v48-summary></div><div class="v48-grid" data-v48-grid></div><div class="v48-actions"><button type="button" data-v48-copy-all>전체 반영 확인본 복사</button><button type="button" data-v48-reset>반영 기록 초기화</button></div><p class="v48-note">반영 체크와 문서 위치 메모는 <code>interior-contract-reflection-v48</code>에만 저장됩니다. 원본 견적·비교표·업체 답변 진행 기록은 수정하지 않습니다.</p>';
    anchor.after(section);return section;
  }

  function updateSummary(section,candidates,state){
    const host=$('[data-v48-summary]',section);if(!host)return;const stats=statsFor(candidates,state);host.replaceChildren();
    const entries=[['전체 반영',`${stats.reflected} / ${stats.total}`],...VENDORS.map(v=>[`${v.toUpperCase()} 업체`,`${stats.byVendor[v].reflected} / ${stats.byVendor[v].total}`])];
    for(const [label,value] of entries){const card=document.createElement('div');card.className='v48-stat';const span=document.createElement('span');span.textContent=label;const strong=document.createElement('strong');strong.textContent=value;card.append(span,strong);host.append(card)}
  }

  function render(){
    ensureStyle();const section=ensureSection();const candidates=buildCandidates();const state=loadReflection();if(!section)return {candidates,state};const grid=$('[data-v48-grid]',section);grid.replaceChildren();section.hidden=false;updateSummary(section,candidates,state);
    if(!candidates.length){const p=document.createElement('p');p.className='v48-empty';p.textContent='현재 반영 여부를 확인할 완료 답변 메모가 없습니다. 업체 답변을 확인 완료로 표시하고 메모를 남기면 이곳에 반영 확인 항목이 생깁니다.';grid.append(p);return {candidates,state}}
    for(const vendor of VENDORS){
      const rows=candidates.filter(row=>row.vendor===vendor);if(!rows.length)continue;const card=document.createElement('article');card.className='v48-card';card.dataset.vendor=vendor;const h=document.createElement('h3');h.textContent=`${vendor.toUpperCase()} 업체`;card.append(h);
      for(const row of rows){const entry=state.entries[row.key]||{};const block=document.createElement('div');block.className='v48-row';const label=document.createElement('label');label.className='v48-check';const check=document.createElement('input');check.type='checkbox';check.checked=!!entry.reflected;check.dataset.v48Reflect=row.key;const text=document.createElement('span');text.textContent=`${row.itemName} · 서면 반영 확인`;label.append(check,text);block.append(label);const answer=document.createElement('div');answer.className='v48-answer';answer.textContent=`업체 답변: ${row.answer}`;block.append(answer);const noteLabel=document.createElement('label');noteLabel.className='v48-note-label';noteLabel.textContent='계약서/견적서 위치·문구 메모';const textarea=document.createElement('textarea');textarea.dataset.v48DocNote=row.key;textarea.placeholder='예: 계약서 특약 3항에 폐기물 반출 포함 문구 확인';textarea.value=entry.documentNote||'';noteLabel.append(textarea);block.append(noteLabel);card.append(block)}
      const actions=document.createElement('div');actions.className='v48-card-actions';const copy=document.createElement('button');copy.type='button';copy.dataset.v48CopyPending=vendor;copy.textContent='미반영 항목만 복사';actions.append(copy);card.append(actions);grid.append(card)}

    $$('[data-v48-reflect]',section).forEach(check=>check.addEventListener('change',()=>{const next=loadReflection();const current=next.entries[check.dataset.v48Reflect]||{};next.entries[check.dataset.v48Reflect]={reflected:check.checked,documentNote:current.documentNote||''};saveReflection(next);updateSummary(section,candidates,next)}));
    const timers=new Map();$$('[data-v48-doc-note]',section).forEach(textarea=>textarea.addEventListener('input',()=>{const key=textarea.dataset.v48DocNote;clearTimeout(timers.get(key));timers.set(key,setTimeout(()=>{const next=loadReflection();const current=next.entries[key]||{};next.entries[key]={reflected:!!current.reflected,documentNote:textarea.value};saveReflection(next);timers.delete(key)},220))}));
    $$('[data-v48-copy-pending]',section).forEach(button=>button.addEventListener('click',async()=>{const original=button.textContent;try{await navigator.clipboard.writeText(pendingText(candidates,loadReflection(),button.dataset.v48CopyPending));button.textContent='미반영 항목 복사됨'}catch{button.textContent='복사 실패'}setTimeout(()=>button.textContent=original,1200)}));
    const copyAll=$('[data-v48-copy-all]',section);if(copyAll)copyAll.onclick=async()=>{const original=copyAll.textContent;try{await navigator.clipboard.writeText(reflectionText(candidates,loadReflection()));copyAll.textContent='전체 확인본 복사됨'}catch{copyAll.textContent='복사 실패'}setTimeout(()=>copyAll.textContent=original,1200)};
    $('[data-v48-reset]',section)?.addEventListener('click',()=>{if(!confirm('계약서 반영 체크와 문서 메모를 모두 지울까요?'))return;clearReflection();render()});
    return {candidates,state};
  }

  function init(){let current=render();$('[data-refresh-report]')?.addEventListener('click',()=>{current=render()});return current}

  window.InteriorQuoteReview48={REFLECTION_KEY,loadReflection,saveReflection,buildCandidates,statsFor,reflectionText,pendingText,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
