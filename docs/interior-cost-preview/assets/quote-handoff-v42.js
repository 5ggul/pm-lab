(() => {
  'use strict';

  const BASE=window.INTERIOR_HANDOFF_BASE||'/pm-lab/interior-cost-preview';
  const COMPARE_URL=window.INTERIOR_HANDOFF_COMPARE_URL||`${BASE}/quote-compare/`;
  const QUOTE_KEY='interior-quote-v5';
  const HANDOFF_KEY='interior-quote-compare-handoff-v42';
  const COMPARE_KEYS=['interior-compare-v5','interior-compare-v6'];
  const HANDOFF_MAX_AGE_MS=30*60*1000;
  const ITEMS=['demolition','waste','waterproof','bathroom','kitchen','wallpaper','flooring','carpentry','electrical','window','management','vat'];
  const VENDORS=['a','b','c'];
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function safeText(v){return v==null?'':String(v)}
  function getJSON(key,fallback=null){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
  function setJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
  function del(key){try{localStorage.removeItem(key)}catch{}}
  function canStore(){try{const key='__interior_handoff_probe_v42__';localStorage.setItem(key,'1');localStorage.removeItem(key);return true}catch{return false}}

  function readQuote(){
    const form=$('[data-quote-form]');
    if(!form) throw new Error('견적 입력 폼을 찾지 못했습니다.');
    const out={context:{},items:{}};
    $$('[data-context]',form).forEach(el=>out.context[el.dataset.context]=safeText(el.value));
    for(const id of ITEMS){
      const row=$(`[data-qrow="${id}"]`,form);
      if(!row) continue;
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

  function makeDialog(){
    const dialog=document.createElement('dialog');
    dialog.className='v42-handoff-dialog';
    dialog.innerHTML='<div data-v42-dialog-body></div>';
    document.body.append(dialog);
    return dialog;
  }

  function injectStyles(){
    if($('#v42-handoff-style')) return;
    const style=document.createElement('style');
    style.id='v42-handoff-style';
    style.textContent=`
      .v42-handoff-wrap{display:inline-flex;align-items:center}.v42-handoff-button{font-weight:800}
      .v42-handoff-dialog{width:min(540px,calc(100% - 32px));max-width:540px;border:1px solid var(--ink,#171A18);padding:0;background:var(--paper,#FCFBF7);color:var(--ink,#171A18)}
      .v42-handoff-dialog::backdrop{background:rgba(23,26,24,.48)}.v42-handoff-dialog [data-v42-dialog-body]{padding:22px}
      .v42-handoff-dialog h2{margin:0 0 8px;font-size:20px;letter-spacing:-.03em}.v42-handoff-dialog p{margin:0 0 16px;color:var(--muted,#777168);font-size:13px;line-height:1.6}
      .v42-targets{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;border:0;padding:0;margin:0 0 18px}.v42-targets label{border:1px solid var(--line,#C9C4B8);padding:11px 8px;text-align:center;cursor:pointer;font-weight:700}.v42-targets input{margin-right:5px}
      .v42-dialog-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.v42-handoff-summary{border-top:1px solid var(--line,#C9C4B8);border-bottom:1px solid var(--line,#C9C4B8);padding:12px 0;margin:14px 0 18px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .v42-handoff-summary span{display:block;color:var(--muted,#777168);font-size:12px}.v42-handoff-summary strong{display:block;margin-top:3px;font-size:16px}
      @media(max-width:640px){.v42-handoff-wrap{display:flex;width:100%}.v42-handoff-button{width:100%}.v42-handoff-dialog [data-v42-dialog-body]{padding:18px}.v42-targets label{padding:10px 4px}.v42-dialog-actions button{flex:1 1 0}.v42-handoff-summary{grid-template-columns:1fr 1fr 1fr}}
    `;
    document.head.append(style);
  }

  function initQuoteCheck(){
    const actions=$('[data-quote-report] .tool-actions');
    if(!actions||$('[data-v42-send-to-compare]',actions)) return;
    injectStyles();
    const wrap=document.createElement('div');wrap.className='v42-handoff-wrap';
    const button=document.createElement('button');button.type='button';button.className='v42-handoff-button';button.dataset.v42SendToCompare='';button.textContent='비교표로 보내기';wrap.append(button);actions.prepend(wrap);
    const dialog=makeDialog();const body=$('[data-v42-dialog-body]',dialog);
    body.innerHTML='<h2 id="v42-send-title">어느 업체 칸으로 보낼까요?</h2><p>현재 입력값을 이 브라우저에 저장하고 비교표에서 미리보기로 확인합니다. URL에는 견적 내용이 포함되지 않습니다.</p><fieldset class="v42-targets"><legend class="sr-only">업체 선택</legend><label><input type="radio" name="v42-target" value="a" checked>A 업체</label><label><input type="radio" name="v42-target" value="b">B 업체</label><label><input type="radio" name="v42-target" value="c">C 업체</label></fieldset><div class="v42-dialog-actions"><button type="button" data-v42-close>취소</button><button type="button" data-v42-send>저장하고 비교표 열기</button></div>';
    dialog.setAttribute('aria-labelledby','v42-send-title');
    button.addEventListener('click',()=>dialog.showModal());
    $('[data-v42-close]',dialog).addEventListener('click',()=>dialog.close());
    $('[data-v42-send]',dialog).addEventListener('click',()=>{
      try{
        if(!canStore()) throw new Error('브라우저 저장소를 사용할 수 없습니다.');
        const target=$('input[name="v42-target"]:checked',dialog)?.value||'a';
        if(!VENDORS.includes(target)) throw new Error('업체 칸을 선택해 주세요.');
        const quote=readQuote();
        if(!setJSON(QUOTE_KEY,quote)) throw new Error('견적을 저장하지 못했습니다.');
        if(!setJSON(HANDOFF_KEY,{version:1,target,createdAt:new Date().toISOString()})) throw new Error('비교표 전달 정보를 저장하지 못했습니다.');
        location.assign(COMPARE_URL);
      }catch(error){dialog.close();alert(`비교표로 보내지 못했습니다. ${error.message}`);}
    });
  }

  function isFreshHandoff(handoff){if(!handoff||!VENDORS.includes(handoff.target)) return false;const created=Date.parse(handoff.createdAt||'');return Number.isFinite(created)&&Date.now()-created>=0&&Date.now()-created<=HANDOFF_MAX_AGE_MS;}
  function compareKey(el){const row=el.closest('[data-compare-row]');const item=row?.dataset.compareRow||'';const vendor=el.dataset.vendor||'';const kind=el.hasAttribute('data-state')?'state':'amount';return `${item}:${vendor}:${kind}`;}
  function readCompareDOM(){const out={};$$('[data-compare-table] [data-vendor]').forEach(el=>out[compareKey(el)]=el.value);return out;}
  function saveCompareDOM(){const data=readCompareDOM();return COMPARE_KEYS.every(key=>setJSON(key,data));}
  function applyQuoteToVendor(quote,target){
    for(const id of ITEMS){
      const row=$(`[data-compare-row="${id}"]`);if(!row) continue;
      const item=quote.items?.[id]||{};const state=$(`[data-vendor="${target}"][data-state]`,row);const amount=$(`[data-vendor="${target}"][data-amount]`,row);
      if(state) state.value=['included','separate','missing'].includes(item.state)?item.state:'missing';if(amount) amount.value=safeText(item.amount);
      for(const el of [state,amount]){if(!el) continue;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
    }
    return saveCompareDOM();
  }
  function quoteSummary(quote){let entered=0,total=0,missing=0;for(const id of ITEMS){const item=quote.items?.[id]||{};if(item.state!=='missing'||safeText(item.amount).trim()) entered++;if(item.state==='missing') missing++;total+=Number(item.amount||0);}return {entered,total,missing};}

  function initQuoteCompare(){
    const host=$('[data-compare-table]');if(!host) return;injectStyles();
    let handoff=getJSON(HANDOFF_KEY,null);const quote=getJSON(QUOTE_KEY,null);
    if(handoff&&!isFreshHandoff(handoff)){del(HANDOFF_KEY);handoff=null;return;}
    if(!handoff||!quote||!VENDORS.includes(handoff.target)) return;
    const target=handoff.target;const summary=quoteSummary(quote);const dialog=makeDialog();const body=$('[data-v42-dialog-body]',dialog);
    body.innerHTML=`<h2 id="v42-import-title">${target.toUpperCase()} 업체 칸으로 가져오기</h2><p>견적 확인에서 저장한 값을 바로 덮어쓰지 않고 먼저 확인합니다. 적용하면 ${target.toUpperCase()} 업체의 포함상태와 금액만 바뀝니다.</p><div class="v42-handoff-summary"><div><span>입력 항목</span><strong>${summary.entered} / ${ITEMS.length}</strong></div><div><span>입력 금액 합계</span><strong>${Number(summary.total).toLocaleString('ko-KR')}만원</strong></div><div><span>미기재</span><strong>${summary.missing}개</strong></div></div><div class="v42-dialog-actions"><button type="button" data-v42-import-cancel>취소</button><button type="button" data-v42-import-apply>이 칸에 적용</button></div>`;
    dialog.setAttribute('aria-labelledby','v42-import-title');
    const cancelImport=()=>{del(HANDOFF_KEY);if(dialog.open) dialog.close();dialog.remove();};
    dialog.addEventListener('cancel',event=>{event.preventDefault();cancelImport();});
    $('[data-v42-import-cancel]',dialog).addEventListener('click',cancelImport);
    $('[data-v42-import-apply]',dialog).addEventListener('click',()=>{if(!applyQuoteToVendor(quote,target)){alert('비교표 저장에 실패했습니다. 브라우저 저장소를 확인해 주세요.');return;}del(HANDOFF_KEY);dialog.close();dialog.remove();const total=$(`[data-total="${target}"]`);total?.scrollIntoView({behavior:'smooth',block:'center'});});
    requestAnimationFrame(()=>dialog.showModal());
  }

  function init(){initQuoteCheck();initQuoteCompare();}
  window.InteriorQuoteHandoff42={readQuote,readCompareDOM,applyQuoteToVendor,QUOTE_KEY,HANDOFF_KEY,COMPARE_KEYS,COMPARE_URL};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
