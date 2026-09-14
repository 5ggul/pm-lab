(() => {
  'use strict';

  const VENDORS=['a','b','c'];
  const $=(s,r=document)=>r.querySelector(s);

  function ensureStyle(){
    if($('#v47-final-summary-style')) return;
    const style=document.createElement('style');
    style.id='v47-final-summary-style';
    style.textContent=`
      .v47-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.v47-summary-card{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:14px;min-width:0}.v47-summary-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.v47-summary-head h3{margin:0;font-size:17px}.v47-status{font-size:12px;color:var(--muted,#777168);white-space:nowrap}.v47-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0 12px}.v47-kpi{border:1px solid var(--line,#c9c4b8);background:#fff;padding:8px}.v47-kpi span{display:block;color:var(--muted,#777168);font-size:11px}.v47-kpi strong{display:block;margin-top:3px;font-size:16px}.v47-block{border-top:1px solid var(--line,#c9c4b8);padding-top:10px;margin-top:10px}.v47-block h4{margin:0 0 7px;font-size:14px}.v47-block ul{margin:0;padding-left:18px}.v47-block li{margin:5px 0;font-size:13px;line-height:1.5}.v47-note{margin-top:4px;padding:6px 8px;border-left:2px solid var(--line,#c9c4b8);background:#fff;font-size:12px;line-height:1.5;white-space:pre-wrap}.v47-empty{color:var(--muted,#777168);font-size:13px}.v47-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v47-actions button{min-height:40px;flex:1 1 160px}.v47-overall{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:13px;margin-bottom:12px}.v47-overall strong{font-size:18px}.v47-overall p{margin:5px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.5}
      @media(max-width:900px){.v47-summary-grid{grid-template-columns:1fr}}@media(max-width:520px){.v47-kpis{grid-template-columns:1fr 1fr 1fr}.v47-kpi strong{font-size:14px}}
      @media print{.v47-summary-grid{grid-template-columns:1fr}.v47-summary-card{break-inside:avoid}.v47-actions{display:none!important}.v47-block li,.v47-note{font-size:10px}}
    `;
    document.head.append(style);
  }

  function buildModel(){
    const progressApi=window.InteriorQuoteReview46;
    if(!progressApi?.currentGroups||!progressApi?.rowsFrom||!progressApi?.loadProgress) return {groups:[],rows:[],progress:{entries:{}},vendors:[]};
    const groups=progressApi.currentGroups();
    const rows=progressApi.rowsFrom(groups);
    const progress=progressApi.loadProgress();
    const vendors=VENDORS.map(vendor=>{
      const vendorRows=rows.filter(row=>row.vendor===vendor);
      if(!vendorRows.length) return null;
      const completed=vendorRows.filter(row=>progress.entries[row.key]?.done);
      const pending=vendorRows.filter(row=>!progress.entries[row.key]?.done);
      const notes=vendorRows.filter(row=>(progress.entries[row.key]?.note||'').trim()).map(row=>({row,note:progress.entries[row.key].note.trim(),done:!!progress.entries[row.key]?.done}));
      const completedWithNote=notes.filter(item=>item.done);
      return {vendor,total:vendorRows.length,completed,pending,notes,completedWithNote,rows:vendorRows};
    }).filter(Boolean);
    return {groups,rows,progress,vendors};
  }

  function vendorFinalText(model,vendor){
    const item=model.vendors.find(v=>v.vendor===vendor);
    const lines=[`${vendor.toUpperCase()} 업체 계약 전 최종 확인`];
    if(!item){lines.push('현재 비교 저장값 기준으로 확인 질문이 없습니다.');return lines.join('\n')}
    lines.push(`확인 완료 ${item.completed.length} / ${item.total} · 미확인 ${item.pending.length} · 답변 메모 ${item.notes.length}`);
    if(item.completedWithNote.length){
      lines.push('', '[확인 완료 + 답변 메모]');
      for(const entry of item.completedWithNote){lines.push(`- ${entry.row.itemName}: ${entry.note}`)}
    }
    if(item.pending.length){
      lines.push('', '[아직 확인할 질문]');
      for(const row of item.pending){lines.push(`□ ${row.itemName}`);lines.push(`  - ${row.question}`);const note=(model.progress.entries[row.key]?.note||'').trim();if(note)lines.push(`  메모: ${note}`)}
    }else{
      lines.push('', '[아직 확인할 질문]', '현재 저장된 질문은 모두 확인 완료 상태입니다.');
    }
    lines.push('', '※ 저장된 질문·완료 체크·답변 메모를 정리한 요약이며 계약 적합성, 법률 판단, 가격 적정성 또는 업체 품질을 판정하지 않습니다.');
    return lines.join('\n');
  }

  function overallText(model){
    const lines=['인테리어 계약 전 최종 확인 요약'];
    const total=model.vendors.reduce((sum,v)=>sum+v.total,0);
    const completed=model.vendors.reduce((sum,v)=>sum+v.completed.length,0);
    const pending=total-completed;
    lines.push(`전체 확인 완료 ${completed} / ${total} · 미확인 ${pending}`);
    for(const vendor of model.vendors){lines.push('', vendorFinalText(model,vendor.vendor))}
    return lines.join('\n');
  }

  function ensureSection(){
    let section=$('[data-v47-final-section]');
    if(section) return section;
    const anchor=$('[data-v46-progress-section]')||$('[data-v45-vendor-section]')||$('[data-review-section]');
    if(!anchor) return null;
    section=document.createElement('section');
    section.className='tool-stage';
    section.dataset.v47FinalSection='';
    section.hidden=true;
    section.innerHTML='<div class="v10-section-head"><div><h2>계약 전 최종 확인 요약</h2><p>완료 체크와 업체 답변 메모를 읽어 업체별 완료·미완료 상태를 정리합니다. 이 요약은 계약 적합성이나 업체 우열을 판정하지 않습니다.</p></div></div><div class="v47-overall" data-v47-overall></div><div class="v47-summary-grid" data-v47-summary-grid></div><div class="v47-actions"><button type="button" data-v47-copy-all>전체 최종 확인본 복사</button></div>';
    anchor.after(section);
    return section;
  }

  function makeList(title,items,mode,progress){
    const block=document.createElement('div');block.className='v47-block';const h=document.createElement('h4');h.textContent=title;block.append(h);
    if(!items.length){const p=document.createElement('p');p.className='v47-empty';p.textContent=mode==='pending'?'현재 미확인 질문이 없습니다.':'기록된 답변 메모가 없습니다.';block.append(p);return block}
    const ul=document.createElement('ul');
    for(const item of items){
      const li=document.createElement('li');
      if(mode==='pending'){
        li.textContent=`${item.itemName}: ${item.question}`;
        const note=(progress.entries[item.key]?.note||'').trim();if(note){const noteEl=document.createElement('div');noteEl.className='v47-note';noteEl.textContent=`현재 메모: ${note}`;li.append(noteEl)}
      }else{
        li.textContent=`${item.row.itemName}`;const noteEl=document.createElement('div');noteEl.className='v47-note';noteEl.textContent=item.note;li.append(noteEl);
      }
      ul.append(li);
    }
    block.append(ul);return block;
  }

  function render(){
    ensureStyle();const section=ensureSection();if(!section)return {model:buildModel()};
    const model=buildModel();const grid=$('[data-v47-summary-grid]',section);const overall=$('[data-v47-overall]',section);grid.replaceChildren();
    if(!model.vendors.length){section.hidden=false;overall.innerHTML='<strong>최종 요약을 만들 비교 질문이 없습니다.</strong><p>견적 비교와 업체별 질문을 먼저 만든 뒤 답변 진행 상태를 기록하면 이곳에 최종 확인 요약이 표시됩니다.</p>';const p=document.createElement('p');p.className='v47-empty';p.textContent='현재 업체별 질문이 없습니다.';grid.append(p);return {model}}
    section.hidden=false;
    const total=model.vendors.reduce((sum,v)=>sum+v.total,0);const completed=model.vendors.reduce((sum,v)=>sum+v.completed.length,0);const pending=total-completed;const notes=model.vendors.reduce((sum,v)=>sum+v.notes.length,0);
    overall.innerHTML=`<strong>전체 ${completed} / ${total} 확인 완료</strong><p>미확인 ${pending}개 · 저장된 업체 답변 메모 ${notes}개. 미확인 질문이 0개여도 실제 계약서·견적서에 답변 내용이 반영됐는지는 별도로 확인해야 합니다.</p>`;
    for(const item of model.vendors){
      const card=document.createElement('article');card.className='v47-summary-card';card.dataset.vendor=item.vendor;
      const head=document.createElement('div');head.className='v47-summary-head';const h=document.createElement('h3');h.textContent=`${item.vendor.toUpperCase()} 업체`;const status=document.createElement('span');status.className='v47-status';status.textContent=item.pending.length?'확인 진행 중':'질문 확인 완료';head.append(h,status);card.append(head);
      const kpis=document.createElement('div');kpis.className='v47-kpis';for(const [label,value] of [['완료',item.completed.length],['미확인',item.pending.length],['메모',item.notes.length]]){const k=document.createElement('div');k.className='v47-kpi';const s=document.createElement('span');s.textContent=label;const strong=document.createElement('strong');strong.textContent=String(value);k.append(s,strong);kpis.append(k)}card.append(kpis);
      card.append(makeList('확인 완료 답변 메모',item.completedWithNote,'notes',model.progress));
      card.append(makeList('아직 확인할 질문',item.pending,'pending',model.progress));
      const actions=document.createElement('div');actions.className='v47-actions';const copy=document.createElement('button');copy.type='button';copy.dataset.v47CopyVendor=item.vendor;copy.textContent=`${item.vendor.toUpperCase()} 업체 최종 확인본 복사`;actions.append(copy);card.append(actions);grid.append(card);
    }
    section.querySelectorAll('[data-v47-copy-vendor]').forEach(button=>button.addEventListener('click',async()=>{const original=button.textContent;try{await navigator.clipboard.writeText(vendorFinalText(model,button.dataset.v47CopyVendor));button.textContent='복사됨'}catch{button.textContent='복사 실패'}setTimeout(()=>button.textContent=original,1200)}));
    const all=$('[data-v47-copy-all]',section);if(all)all.onclick=async()=>{const original=all.textContent;try{await navigator.clipboard.writeText(overallText(model));all.textContent='전체 확인본 복사됨'}catch{all.textContent='복사 실패'}setTimeout(()=>all.textContent=original,1200)};
    return {model};
  }

  function init(){let current=render();$('[data-refresh-report]')?.addEventListener('click',()=>{current=render()});return current}

  window.InteriorQuoteReview47={buildModel,vendorFinalText,overallText,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
