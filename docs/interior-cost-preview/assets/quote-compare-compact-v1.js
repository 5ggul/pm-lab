(()=>{
  'use strict';

  const ITEMS=[
    ['demolition','철거'],['waste','폐기물'],['waterproof','방수'],['bathroom','욕실'],
    ['kitchen','주방'],['wallpaper','도배'],['flooring','바닥'],['carpentry','목공'],
    ['electrical','전기'],['window','샷시'],['management','현장관리비'],['vat','VAT']
  ];
  const VENDORS=['a','b','c'];
  const CRITICAL=['vat','waste','window','management'];
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const fmt=n=>Number(n||0).toLocaleString('ko-KR',{maximumFractionDigits:2});

  function readVendor(vendor,id,host=document){
    const row=$(`[data-compare-row="${id}"]`,host);
    return {
      state:$(`[data-vendor="${vendor}"][data-state]`,row)?.value||'missing',
      amount:$(`[data-vendor="${vendor}"][data-amount]`,row)?.value||''
    };
  }

  function hasInput(host){
    return ITEMS.some(([id])=>VENDORS.some(v=>{
      const x=readVendor(v,id,host);
      return x.state!=='missing'||Number(x.amount||0)>0;
    }));
  }

  function criticalDiffs(host){
    return CRITICAL.filter(id=>new Set(VENDORS.map(v=>readVendor(v,id,host).state)).size>1);
  }

  function vendorSummary(vendor,host){
    const out={total:0,included:0,separate:0,missing:0};
    for(const [id] of ITEMS){
      const x=readVendor(vendor,id,host);
      out.total+=Number(x.amount||0);
      if(x.state==='included')out.included++;
      else if(x.state==='separate')out.separate++;
      else out.missing++;
    }
    return out;
  }

  function mismatchCount(host){
    let count=0;
    for(const [id] of ITEMS){
      const states=VENDORS.map(v=>readVendor(v,id,host).state);
      if(new Set(states).size>1)count++;
    }
    return count;
  }

  function createGridHead(){
    const head=document.createElement('div');
    head.className='compact-compare-head';
    head.dataset.compactCompareHead='';
    head.setAttribute('aria-hidden','true');
    for(const text of ['공종','A 업체','B 업체','C 업체']){
      const span=document.createElement('span');span.textContent=text;head.append(span);
    }
    return head;
  }

  function createResult(){
    const section=document.createElement('section');
    section.className='compact-compare-result';
    section.dataset.compactCompareResult='';
    section.innerHTML=`
      <div class="compact-result-head">
        <div><h2>비교 결과</h2><p>입력한 금액과 포함조건만 요약합니다. 미기재는 0원으로 보지 않습니다.</p></div>
        <strong data-compact-mismatch>조건 차이 0개</strong>
      </div>
      <div class="compact-result-table-wrap">
        <table class="compact-result-table">
          <thead><tr><th>업체</th><th>입력합계</th><th>포함</th><th>별도</th><th>미기재</th></tr></thead>
          <tbody>
            ${VENDORS.map(v=>`<tr data-compact-vendor="${v}"><th>${v.toUpperCase()}</th><td data-compact-total>0만원</td><td data-compact-included>0</td><td data-compact-separate>0</td><td data-compact-missing>12</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="compact-result-note" data-compact-result-note>아직 비교 전입니다.</p>
    `;
    return section;
  }

  function injectStyle(){
    if($('#compact-compare-style-v1'))return;
    const style=document.createElement('style');
    style.id='compact-compare-style-v1';
    style.textContent=`
      [data-compare-table].compact-compare-v1>.compare-top,
      [data-compare-table].compact-compare-v1>[data-v6-compare-chart],
      [data-compare-table].compact-compare-v1>[data-compare-summary]{display:none!important}

      .compact-compare-head{
        display:grid;grid-template-columns:minmax(88px,120px) repeat(3,minmax(0,1fr));
        gap:8px;align-items:center;margin:10px 0 0;padding:8px 10px;
        border:1px solid var(--line,#d8d3c8);border-bottom:0;
        background:var(--paper-soft,#f6f3ed);font-size:12px;font-weight:800;text-align:center
      }
      .compact-compare-head span:first-child{text-align:left}
      [data-compare-table].compact-compare-v1 .compare-row{
        display:grid!important;grid-template-columns:minmax(88px,120px) minmax(0,1fr)!important;
        gap:8px!important;align-items:stretch!important;margin:0!important;padding:8px 10px!important;
        border:1px solid var(--line,#d8d3c8)!important;border-top:0!important;border-radius:0!important;
        background:var(--paper,#fff)!important
      }
      [data-compare-table].compact-compare-v1 .compare-row h3{
        margin:0!important;display:flex;flex-direction:column;justify-content:center;gap:4px;
        font-size:14px!important;line-height:1.25
      }
      [data-compare-table].compact-compare-v1 [data-diff-flag]{
        font-size:10px;line-height:1.2
      }
      [data-compare-table].compact-compare-v1 .vendor-grid{
        display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;
        gap:8px!important;min-width:0
      }
      [data-compare-table].compact-compare-v1 .vendor-cell{
        display:grid!important;grid-template-columns:minmax(88px,.9fr) minmax(105px,1.1fr)!important;
        gap:6px!important;align-items:center!important;min-width:0;padding:0!important;
        border:0!important;background:transparent!important
      }
      [data-compare-table].compact-compare-v1 .vendor-cell>strong{
        position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;
        overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important
      }
      [data-compare-table].compact-compare-v1 .vendor-cell select,
      [data-compare-table].compact-compare-v1 .vendor-cell input{
        width:100%!important;min-width:0!important;min-height:42px!important;margin:0!important
      }
      [data-compare-table].compact-compare-v1 .vendor-cell label{
        margin:0!important;font-size:0!important;min-width:0
      }
      [data-compare-table].compact-compare-v1 .vendor-cell label input{font-size:14px!important}
      [data-compare-table].compact-compare-v1 .difference-filter{
        margin:10px 0!important;padding:8px 10px!important
      }

      .compact-compare-result{
        margin:14px 0;padding:14px;border:1px solid var(--line,#d8d3c8);background:var(--paper-soft,#f8f6f1)
      }
      .compact-result-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
      .compact-result-head h2{margin:0 0 4px;font-size:18px}.compact-result-head p{margin:0;font-size:12px;color:var(--muted,#6f6a61)}
      .compact-result-head>strong{white-space:nowrap;font-size:12px;padding:5px 8px;border:1px solid var(--line,#d8d3c8);background:#fff}
      .compact-result-table-wrap{overflow-x:auto}
      .compact-result-table{width:100%;border-collapse:collapse;font-size:13px}
      .compact-result-table th,.compact-result-table td{padding:8px;border-bottom:1px solid var(--line,#ddd8ce);text-align:right}
      .compact-result-table th:first-child,.compact-result-table td:first-child{text-align:left}
      .compact-result-table tbody tr:last-child th,.compact-result-table tbody tr:last-child td{border-bottom:0}
      .compact-result-note{margin:10px 0 0;font-size:13px;line-height:1.55}
      .compact-result-note.is-warning{font-weight:700}

      @media(max-width:720px){
        .compact-compare-head{grid-template-columns:58px repeat(3,minmax(0,1fr));gap:4px;padding:7px 6px;font-size:11px}
        [data-compare-table].compact-compare-v1 .compare-row{
          grid-template-columns:58px minmax(0,1fr)!important;gap:4px!important;padding:6px!important
        }
        [data-compare-table].compact-compare-v1 .compare-row h3{font-size:12px!important;word-break:keep-all}
        [data-compare-table].compact-compare-v1 .vendor-grid{gap:4px!important}
        [data-compare-table].compact-compare-v1 .vendor-cell{
          grid-template-columns:minmax(0,1fr)!important;gap:4px!important
        }
        [data-compare-table].compact-compare-v1 .vendor-cell select,
        [data-compare-table].compact-compare-v1 .vendor-cell input{
          min-height:44px!important;font-size:12px!important;padding-left:6px!important;padding-right:6px!important
        }
        .compact-result-head{display:block}.compact-result-head>strong{display:inline-block;margin-top:8px}
        .compact-result-table{font-size:12px}.compact-result-table th,.compact-result-table td{padding:7px 5px}
        .compact-compare-result{padding:10px}
      }
    `;
    document.head.append(style);
  }

  function render(host,result){
    const summaries=Object.fromEntries(VENDORS.map(v=>[v,vendorSummary(v,host)]));
    for(const v of VENDORS){
      const row=$(`[data-compact-vendor="${v}"]`,result),s=summaries[v];
      if(!row)continue;
      $('[data-compact-total]',row).textContent=`${fmt(s.total)}만원`;
      $('[data-compact-included]',row).textContent=String(s.included);
      $('[data-compact-separate]',row).textContent=String(s.separate);
      $('[data-compact-missing]',row).textContent=String(s.missing);
    }
    const mismatch=mismatchCount(host);
    const mismatchEl=$('[data-compact-mismatch]',result);
    if(mismatchEl)mismatchEl.textContent=`조건 차이 ${mismatch}개`;
    const note=$('[data-compact-result-note]',result);
    if(!note)return;
    const critical=criticalDiffs(host);
    if(!hasInput(host)){
      note.textContent='아직 비교 전입니다. 각 업체의 상태와 금액을 입력하면 결과가 여기 한 곳에 정리됩니다.';
      note.classList.remove('is-warning');
    }else if(critical.length){
      const names=critical.map(id=>ITEMS.find(x=>x[0]===id)?.[1]||id);
      note.textContent=`단순 총액 비교 불가 · ${names.join(' · ')} 조건이 업체마다 다릅니다. 같은 조건으로 맞춘 뒤 금액을 비교하세요.`;
      note.classList.add('is-warning');
    }else{
      note.textContent='핵심 포함조건은 동일합니다. 사양·수량이 같은지 확인한 뒤 입력합계 차이를 해석하세요.';
      note.classList.remove('is-warning');
    }
  }

  function init(){
    const host=$('[data-compare-table]');
    if(!host||host.classList.contains('compact-compare-v1'))return;
    injectStyle();
    host.classList.add('compact-compare-v1');

    const firstRow=$('[data-compare-row]',host);
    if(firstRow)firstRow.before(createGridHead());

    const result=createResult();
    const anchor=$('[data-local-quote-import="compare"]',host)||$('.tool-actions',host);
    if(anchor)anchor.before(result);else host.append(result);

    const rerender=()=>requestAnimationFrame(()=>render(host,result));
    host.addEventListener('input',rerender);
    host.addEventListener('change',rerender);
    window.addEventListener('storage',e=>{
      if(['interior-compare-v7','interior-compare-v7-reset-v1','interior-compare-v5','interior-compare-v6'].includes(e.key))rerender();
    });
    render(host,result);
  }

  window.InteriorCompactCompareV1={ITEMS,VENDORS,readVendor,vendorSummary,mismatchCount,criticalDiffs,init};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();