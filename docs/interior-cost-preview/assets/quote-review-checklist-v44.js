(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);

  function ensureStyle(){
    if($('#v44-checklist-style')) return;
    const style=document.createElement('style');
    style.id='v44-checklist-style';
    style.textContent=`
      .v44-checklist-list{display:grid;gap:10px}.v44-checklist-item{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:14px}.v44-checklist-item h3{display:flex;align-items:flex-start;gap:8px;margin:0 0 8px;font-size:16px}.v44-check-box{flex:0 0 18px;width:18px;height:18px;border:1px solid var(--ink,#171a18);margin-top:1px;background:#fff}.v44-checklist-item ul{margin:0;padding-left:20px}.v44-checklist-item li{margin:5px 0;line-height:1.55}.v44-checklist-note{margin:10px 0 0;color:var(--muted,#777168);font-size:12px;line-height:1.55}.v44-checklist-empty{color:var(--muted,#777168)}
      @media(max-width:760px){.v44-checklist-item{padding:12px}.v44-checklist-item li{font-size:14px}}
      @media print{.v44-checklist-item{break-inside:avoid}.v44-check-box{print-color-adjust:exact;-webkit-print-color-adjust:exact}.v44-checklist-note{font-size:10px}}
    `;
    document.head.append(style);
  }

  function questionsFor(item){
    const name=item?.name||'해당 항목';
    const out=[];
    const add=text=>{if(text&&!out.includes(text))out.push(text)};
    for(const flag of item?.flags||[]){
      if(flag==='원본 견적 미기재') add(`${name}이 견적 총액에 포함되는지, 제외 또는 별도라면 추가 비용 산정 기준을 확인하세요.`);
      else if(flag==='원본 견적 별도') add(`${name}의 별도 비용과 산정 기준, 실제 결제 시점에 추가되는 범위를 확인하세요.`);
      else if(flag==='원본 금액 미입력') add(`${name}의 금액 또는 수량·면적·식 등 금액 산정 방식을 확인하세요.`);
      else if(flag==='업체 포함조건 다름') add(`${name}의 포함·별도 범위를 A/B/C 업체가 같은 기준으로 답하도록 맞춰 확인하세요.`);
      else if(flag.startsWith('업체 금액 차이 ')) add(`${name}의 금액 차이가 생긴 이유를 수량·사양·자재·철거·운반·폐기 등 포함 범위 기준으로 각 업체에 확인하세요.`);
      else if(flag==='업체 금액 미입력 있음') add(`${name} 금액이 비어 있는 업체에 금액과 포함 여부를 함께 확인하세요.`);
    }
    return out;
  }

  function checklist(snapshot){
    if(!snapshot?.hasData||!Array.isArray(snapshot.reviewItems)) return [];
    return snapshot.reviewItems.map(item=>({id:item.id,name:item.name,questions:questionsFor(item)})).filter(item=>item.questions.length);
  }

  function checklistText(snapshot){
    const items=checklist(snapshot);
    const lines=['인테리어 견적 업체 확인 체크리스트'];
    if(!items.length){lines.push('현재 저장값 기준으로 별도 확인이 필요한 항목이 없습니다.');}
    else{
      for(const item of items){
        lines.push(`□ ${item.name}`);
        for(const question of item.questions) lines.push(`  - ${question}`);
      }
    }
    lines.push('※ 저장된 견적의 조건 차이를 질문으로 바꾼 목록이며 가격 적정성이나 업체 품질을 판정하지 않습니다.');
    return lines.join('\n');
  }

  function ensureSection(){
    let section=$('[data-v44-checklist-section]');
    if(section) return section;
    const review=$('[data-review-section]');
    if(!review) return null;
    section=document.createElement('section');
    section.className='tool-stage';
    section.dataset.v44ChecklistSection='';
    section.hidden=true;
    section.innerHTML='<div class="v10-section-head"><div><h2>업체 확인 체크리스트</h2><p>확인 필요 플래그를 실제 업체에 물어볼 질문으로 바꿉니다. 가격 적정성이나 업체 품질은 판정하지 않습니다.</p></div></div><div class="v44-checklist-list" data-v44-checklist-list></div><p class="v44-checklist-note">체크리스트는 현재 저장값을 읽어 화면에만 구성합니다. 별도 저장하거나 서버로 전송하지 않습니다.</p>';
    review.after(section);
    return section;
  }

  function ensureCopyButton(){
    const actions=$('[data-review-main] .v43-report-actions');
    if(!actions) return null;
    let button=$('[data-copy-checklist]',actions);
    if(button) return button;
    button=document.createElement('button');
    button.type='button';
    button.dataset.copyChecklist='';
    button.textContent='업체 확인 목록 복사';
    const summaryCopy=$('[data-copy-report]',actions);
    if(summaryCopy) summaryCopy.after(button); else actions.prepend(button);
    return button;
  }

  function renderChecklist(){
    const api=window.InteriorQuoteReview43;
    if(!api?.render) return {snapshot:null,items:[]};
    const snapshot=api.render();
    const section=ensureSection();
    const list=$('[data-v44-checklist-list]');
    const items=checklist(snapshot);
    if(!section||!list) return {snapshot,items};
    list.replaceChildren();
    if(!snapshot?.hasData){section.hidden=true;return {snapshot,items}}
    section.hidden=false;
    if(!items.length){const p=document.createElement('p');p.className='v44-checklist-empty';p.textContent='현재 저장값 기준으로 별도 확인이 필요한 항목이 없습니다.';list.append(p);return {snapshot,items}}
    for(const item of items){
      const article=document.createElement('article');article.className='v44-checklist-item';article.dataset.item=item.id;
      const h=document.createElement('h3');const box=document.createElement('span');box.className='v44-check-box';box.setAttribute('aria-hidden','true');const title=document.createElement('span');title.textContent=item.name;h.append(box,title);article.append(h);
      const ul=document.createElement('ul');for(const question of item.questions){const li=document.createElement('li');li.textContent=question;ul.append(li)}article.append(ul);list.append(article);
    }
    return {snapshot,items};
  }

  function init(){
    ensureStyle();
    const button=ensureCopyButton();
    let current=renderChecklist();
    $('[data-refresh-report]')?.addEventListener('click',()=>{current=renderChecklist()});
    button?.addEventListener('click',async()=>{
      const original=button.textContent;
      try{current=renderChecklist();await navigator.clipboard.writeText(checklistText(current.snapshot));button.textContent='확인 목록 복사됨'}catch{button.textContent='복사 실패'}
      setTimeout(()=>button.textContent=original,1200);
    });
  }

  window.InteriorQuoteReview44={questionsFor,checklist,checklistText,renderChecklist};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
