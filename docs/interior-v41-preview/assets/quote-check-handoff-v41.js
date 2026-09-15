(() => {
  'use strict';
  const QUOTE_KEY='interior-quote-source-v41';
  const HANDOFF_KEY='interior-quote-compare-handoff-v41';
  const COMPARE_URL='/pm-lab/interior-v41-preview/quote-compare/';
  const ITEMS=['demolition','waste','waterproof','bathroom','kitchen','wallpaper','flooring','carpentry','electrical','window','management','vat'];
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const safeText=v=>v==null?'':String(v);

  function readCurrentQuote(){
    const form=$('[data-quote-form]');
    if(!form) throw new Error('견적 입력 폼을 찾지 못했습니다.');
    const out={context:{},items:{}};
    $$('[data-context]',form).forEach(el=>out.context[el.dataset.context]=safeText(el.value));
    for(const id of ITEMS){
      const row=$(`[data-qrow="${id}"]`,form);
      if(!row) throw new Error(`${id} 항목을 찾지 못했습니다.`);
      out.items[id]={
        name:$('.qrow-title strong',row)?.textContent?.trim()||id,
        state:$(`[name="state-${id}"]:checked`,row)?.value||'missing',
        amount:safeText($('[data-q-amount]',row)?.value),
        qty:safeText($('[data-q-qty]',row)?.value),
        unit:safeText($('[data-q-unit]',row)?.value),
        spec:safeText($('[data-q-spec]',row)?.value),
        memo:safeText($('[data-q-memo]',row)?.value)
      };
    }
    return out;
  }

  function canStore(){
    try{const k='__interior_handoff_probe__';localStorage.setItem(k,'1');localStorage.removeItem(k);return true;}catch{return false;}
  }

  function saveAndRequest(target){
    if(!['a','b','c'].includes(target)) throw new Error('보낼 업체 칸을 선택해 주세요.');
    if(!canStore()) throw new Error('브라우저 저장소를 사용할 수 없습니다.');
    const quote=readCurrentQuote();
    localStorage.setItem(QUOTE_KEY,JSON.stringify(quote));
    localStorage.setItem(HANDOFF_KEY,JSON.stringify({version:1,target,createdAt:new Date().toISOString()}));
    location.assign(COMPARE_URL);
  }

  function inject(){
    const actions=$('[data-quote-report] .tool-actions');
    if(!actions||$('[data-send-to-compare]',actions)) return;
    const wrap=document.createElement('div');wrap.className='v40-send-wrap';
    const btn=document.createElement('button');btn.type='button';btn.dataset.sendToCompare='';btn.textContent='비교표로 보내기';btn.className='v40-send-button';
    wrap.append(btn);actions.prepend(wrap);

    const style=document.createElement('style');style.textContent=`
      .v40-send-wrap{display:inline-flex;align-items:center}.v40-send-button{font-weight:750}
      .v40-handoff-dialog{max-width:min(520px,calc(100% - 32px));border:1px solid var(--ink,#171A18);padding:22px;background:var(--paper,#FCFBF7);color:var(--ink,#171A18)}
      .v40-handoff-dialog::backdrop{background:var(--ink,#171A18)66}.v40-handoff-dialog h2{margin:0 0 8px;font-size:20px}.v40-handoff-dialog p{margin:0 0 16px;color:var(--muted,#777168);font-size:13px}
      .v40-targets{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;border:0;padding:0;margin:0 0 18px}.v40-targets label{border:1px solid var(--line,#C9C4B8);padding:10px;text-align:center;cursor:pointer}.v40-targets input{margin-right:5px}.v40-dialog-actions{display:flex;justify-content:flex-end;gap:8px}
      @media(max-width:560px){.v40-send-wrap{display:flex;width:100%}.v40-send-button{width:100%}.v40-handoff-dialog{padding:18px}.v40-targets label{padding:10px 4px}}
    `;document.head.append(style);

    const dialog=document.createElement('dialog');dialog.className='v40-handoff-dialog';dialog.setAttribute('aria-labelledby','v40-handoff-title');
    dialog.innerHTML='<h2 id="v40-handoff-title">어느 업체 칸으로 보낼까요?</h2><p>현재 견적을 검수용 브라우저 저장소에 저장한 뒤 비교표에서 미리보기로 확인합니다. URL에는 견적 내용이 포함되지 않습니다.</p><fieldset class="v40-targets"><legend class="sr-only">업체 선택</legend><label><input type="radio" name="v40-target" value="a" checked>A 업체</label><label><input type="radio" name="v40-target" value="b">B 업체</label><label><input type="radio" name="v40-target" value="c">C 업체</label></fieldset><div class="v40-dialog-actions"><button type="button" data-v40-cancel>취소</button><button type="button" data-v40-confirm>저장하고 비교표 열기</button></div>';
    document.body.append(dialog);
    btn.addEventListener('click',()=>dialog.showModal());
    $('[data-v40-cancel]',dialog).addEventListener('click',()=>dialog.close());
    $('[data-v40-confirm]',dialog).addEventListener('click',()=>{
      const target=$('input[name="v40-target"]:checked',dialog)?.value||'a';
      try{saveAndRequest(target);}catch(e){dialog.close();window.dispatchEvent(new CustomEvent('interior-handoff-error',{detail:{message:e.message}}));alert('비교표로 보내지 못했습니다. '+e.message);}
    });
  }

  window.InteriorQuoteHandoff41={readCurrentQuote,saveAndRequest,inject,QUOTE_KEY,HANDOFF_KEY};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject();
})();
