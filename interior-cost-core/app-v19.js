(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const num=v=>Number(String(v??'').replace(/,/g,''))||0;
  const txt=el=>(el?.textContent||'').trim();
  const create=(html)=>{const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild};
  const summary=(id,title,stats,actions='')=>create(`<section class="v19-ux-summary" data-v19-summary="${id}"><div class="v19-ux-summary__head"><div><span>LIVE CHECK</span><strong>${title}</strong></div></div><div class="v19-ux-summary__stats">${stats.map(([k,v,a])=>`<div class="v19-ux-summary__stat"><span>${k}</span><strong ${a||''}>${v}</strong></div>`).join('')}</div>${actions?`<div class="v19-ux-summary__actions">${actions}</div>`:''}</section>`);

  function setupBudget(){
    const root=$('[data-budget-builder]');if(!root||$('[data-v19-summary="budget"]',root))return;
    const rows=$$('[data-budget-row]',root);
    const box=summary('budget','입력한 공종만 합산합니다.',[['입력 공종','0 / '+rows.length,'data-v19-budget-filled'],['입력 시나리오 합계','0만원','data-v19-budget-total'],['VAT','별도','data-v19-budget-vat']],`<button type="button" data-v19-budget-filter aria-pressed="false">입력 항목만</button><button type="button" data-v19-budget-focus>첫 미입력 단가</button>`);
    root.prepend(box);
    const update=()=>{
      const filled=rows.filter(r=>num($('[data-qty]',r)?.value)>0||num($('[data-unit-price]',r)?.value)>0||String($('[data-unit]',r)?.value||'').trim()).length;
      $('[data-v19-budget-filled]',box).textContent=`${filled} / ${rows.length}`;
      $('[data-v19-budget-total]',box).textContent=txt($('[data-budget-total]',root))||'0만원';
      const vat=$('[data-vat]',root);const vatLabel=vat?.selectedOptions?.[0]?.textContent?.trim()||'별도';
      $('[data-v19-budget-vat]',box).textContent=vatLabel;
      const only=$('[data-v19-budget-filter]',box).getAttribute('aria-pressed')==='true';
      if(only)rows.forEach(r=>{const on=num($('[data-qty]',r)?.value)>0||num($('[data-unit-price]',r)?.value)>0||String($('[data-unit]',r)?.value||'').trim();r.classList.toggle('v19-row-hidden',!on)});
    };
    root.addEventListener('input',()=>requestAnimationFrame(update));root.addEventListener('change',()=>requestAnimationFrame(update));
    $('[data-v19-budget-filter]',box).addEventListener('click',e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(on));e.currentTarget.textContent=on?'전체 항목 보기':'입력 항목만';if(!on)rows.forEach(r=>r.classList.remove('v19-row-hidden'));update()});
    $('[data-v19-budget-focus]',box).addEventListener('click',()=>{const target=rows.map(r=>$('[data-unit-price]',r)).find(x=>x&&!x.value);target?.focus();target?.scrollIntoView({block:'center'})});
    update();
  }

  function setupCompare(){
    const root=$('[data-compare-table]');if(!root||$('[data-v19-summary="compare"]',root))return;
    const rows=$$('[data-compare-row]',root);const vendors=['a','b','c'];
    const box=summary('compare','금액보다 조건 차이를 먼저 확인합니다.',[['금액 입력','0','data-v19-compare-amounts'],['조건 기재','0','data-v19-compare-states'],['조건 차이','0개','data-v19-compare-diffs']],`<button type="button" data-v19-compare-diff aria-pressed="false">다른 조건만</button><button type="button" data-v19-compare-focus>첫 미입력 금액</button>`);
    root.prepend(box);
    const rowDiff=r=>{const states=vendors.map(v=>$(`select[data-vendor="${v}"][data-state]`,r)?.value||'missing');return new Set(states).size>1};
    const update=()=>{
      const amountCount=$$('input[data-amount]',root).filter(x=>num(x.value)>0).length;
      const stateCount=$$('select[data-state]',root).filter(x=>x.value!=='missing').length;
      const diffCount=rows.filter(rowDiff).length;
      $('[data-v19-compare-amounts]',box).textContent=String(amountCount);
      $('[data-v19-compare-states]',box).textContent=String(stateCount);
      $('[data-v19-compare-diffs]',box).textContent=`${diffCount}개`;
    };
    root.addEventListener('input',()=>requestAnimationFrame(update));root.addEventListener('change',()=>requestAnimationFrame(update));
    $('[data-v19-compare-diff]',box).addEventListener('click',e=>{const cb=$('[data-diff-only]',root);if(!cb)return;cb.checked=!cb.checked;cb.dispatchEvent(new Event('change',{bubbles:true}));e.currentTarget.setAttribute('aria-pressed',String(cb.checked));e.currentTarget.textContent=cb.checked?'전체 항목 보기':'다른 조건만';update()});
    $('[data-v19-compare-focus]',box).addEventListener('click',()=>{const target=$$('input[data-amount]',root).find(x=>!x.value);target?.focus();target?.scrollIntoView({block:'center'})});
    update();
  }

  function setupQuoteCheck(){
    const root=$('[data-quote-form]');if(!root||$('[data-v19-summary="quote-check"]',root))return;
    const rows=$$('[data-qrow]',root),contexts=$$('[data-context]',root);
    const box=summary('quote-check','미기재를 먼저 줄여 비교 가능한 견적을 만듭니다.',[['확인 공종','0 / '+rows.length,'data-v19-quote-done'],['미기재',''+rows.length,'data-v19-quote-missing'],['조건 입력','0 / '+contexts.length,'data-v19-context-done']],`<button type="button" data-v19-quote-filter aria-pressed="false">미기재만 보기</button><button type="button" data-v19-quote-focus>첫 미기재 항목</button>`);
    const anchor=$('.context-grid',root);(anchor?.parentNode||root).insertBefore(box,anchor?anchor.nextSibling:root.firstChild);
    const state=r=>$('input[type="radio"]:checked',r)?.value||'missing';
    const touched=r=>state(r)!=='missing'||$$('input[data-q-amount],input[data-q-qty],input[data-q-unit],input[data-q-spec],input[data-q-memo]',r).some(x=>String(x.value||'').trim());
    const update=()=>{
      const done=rows.filter(touched).length,missing=rows.filter(r=>state(r)==='missing').length,ctx=contexts.filter(x=>String(x.value||'').trim()).length;
      $('[data-v19-quote-done]',box).textContent=`${done} / ${rows.length}`;$('[data-v19-quote-missing]',box).textContent=String(missing);$('[data-v19-context-done]',box).textContent=`${ctx} / ${contexts.length}`;
      const only=$('[data-v19-quote-filter]',box).getAttribute('aria-pressed')==='true';if(only)rows.forEach(r=>r.classList.toggle('v19-row-hidden',state(r)!=='missing'));
    };
    root.addEventListener('input',()=>requestAnimationFrame(update));root.addEventListener('change',()=>requestAnimationFrame(update));
    $('[data-v19-quote-filter]',box).addEventListener('click',e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(on));e.currentTarget.textContent=on?'전체 항목 보기':'미기재만 보기';if(!on)rows.forEach(r=>r.classList.remove('v19-row-hidden'));update()});
    $('[data-v19-quote-focus]',box).addEventListener('click',()=>{const row=rows.find(r=>state(r)==='missing');const target=row?.querySelector('input[data-q-amount]')||row?.querySelector('input');target?.focus();row?.scrollIntoView({block:'center'})});
    update();
  }

  function setupChecklist(){
    const root=$('[data-checklist]');if(!root||$('[data-v19-summary="checklist"]',root))return;
    const checks=$$('input[data-check-id]',root);if(!checks.length)return;
    const box=summary('checklist','계약 전 확인 상태를 한눈에 봅니다.',[['확인 완료','0 / '+checks.length,'data-v19-check-done'],['남은 항목',''+checks.length,'data-v19-check-left'],['진행률','0%','data-v19-check-rate']],`<button type="button" data-v19-check-focus>첫 미확인 항목</button>`);
    root.prepend(box);
    const update=()=>{const done=checks.filter(x=>x.checked).length;$('[data-v19-check-done]',box).textContent=`${done} / ${checks.length}`;$('[data-v19-check-left]',box).textContent=String(checks.length-done);$('[data-v19-check-rate]',box).textContent=`${Math.round(done/checks.length*100)}%`};
    root.addEventListener('change',update);$('[data-v19-check-focus]',box).addEventListener('click',()=>{const target=checks.find(x=>!x.checked);target?.focus();target?.scrollIntoView({block:'center'})});update();
  }

  function setupPaste(){
    const root=$('[data-v10-paste-tool]');if(!root||$('[data-v19-summary="paste"]',root))return;
    const box=summary('paste','분류 결과에서 검토 필요 줄을 먼저 확인합니다.',[['입력','0줄','data-v19-paste-lines'],['매칭','0줄','data-v19-paste-match'],['검토 필요','0줄','data-v19-paste-review']],`<button type="button" data-v19-paste-focus>텍스트 입력</button>`);
    root.prepend(box);
    const update=()=>{$('[data-v19-paste-lines]',box).textContent=txt($('[data-v10-lines]',root))||'0줄';$('[data-v19-paste-match]',box).textContent=txt($('[data-v10-matched]',root))||'0줄';$('[data-v19-paste-review]',box).textContent=txt($('[data-v10-review]',root))||'0줄'};
    root.addEventListener('input',()=>requestAnimationFrame(update));
    root.addEventListener('change',()=>requestAnimationFrame(update));
    root.addEventListener('click',()=>setTimeout(update,0));
    $('[data-v19-paste-focus]',box).addEventListener('click',()=>$('#v10-paste',root)?.focus());
    update();
  }

  function markReady(){document.body?.classList.add('v19-runtime');if(document.body)document.body.dataset.v19Ready='1'}
  function init(){setupBudget();setupCompare();setupQuoteCheck();setupChecklist();setupPaste();markReady()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
