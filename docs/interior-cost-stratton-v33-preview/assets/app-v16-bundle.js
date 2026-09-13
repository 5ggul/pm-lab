/* app-v5.js */
(() => {
  const BASE='/pm-lab/interior-cost-stratton-v33-preview';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const fmt=n=>Number(n||0).toLocaleString('ko-KR');
  const toast=(text)=>{
    let el=$('#site-toast');
    if(!el){el=document.createElement('div');el.id='site-toast';el.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#171A18;color:#fff;padding:9px 13px;border-radius:2px;font-size:12px;z-index:100;';document.body.append(el)}
    el.textContent=text;el.hidden=false;clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,1200);
  };
  const storage={
    get(k,fallback=null){try{const v=localStorage.getItem(k);return v?JSON.parse(v):fallback}catch{return fallback}},
    set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}},
    del(k){try{localStorage.removeItem(k)}catch{}}
  };

  const menuBtn=$('[data-menu-btn]'), drawer=$('[data-mobile-drawer]');
  if(menuBtn&&drawer){
    menuBtn.addEventListener('click',()=>{
      const open=menuBtn.getAttribute('aria-expanded')==='true';
      menuBtn.setAttribute('aria-expanded',String(!open));
      drawer.hidden=open;
    });
  }

  $$('.facet-tabs [role=tab]').forEach(btn=>btn.addEventListener('click',()=>{
    const root=btn.closest('.facet-root');
    $$('.facet-tabs [role=tab]',root).forEach(x=>x.setAttribute('aria-selected','false'));
    btn.setAttribute('aria-selected','true');
    $$('.facet-panel',root).forEach(p=>p.hidden=p.id!==btn.dataset.panel);
  }));

  $$('[data-site-search]').forEach(searchForm=>{
    searchForm.addEventListener('submit',e=>{
      e.preventDefault();
      const q=$('input',searchForm)?.value.trim()||'';
      if(q) location.href=`${BASE}/search/?q=${encodeURIComponent(q)}`;
    });
  });

  async function initSearchPage(){
    const host=$('[data-search-results]'), input=$('[data-search-input]');
    if(!host||!input) return;
    let index=[];
    try{index=await fetch(`${BASE}/data/search-index.json`).then(r=>r.json())}catch{}
    const aliasMap={'화장실':'욕실','샤시':'샷시','창호':'샷시','싱크대':'주방','마루':'바닥','장판':'바닥','철거쓰레기':'폐기물','부가세':'vat','일괄공사':'1식'};
    const render=()=>{
      let q=input.value.trim().toLowerCase();
      if(aliasMap[q]) q=aliasMap[q].toLowerCase();
      const tokens=q.split(/\s+/).filter(Boolean);
      const rows=index.filter(x=>{
        const hay=[x.title,x.description,...(x.keywords||[]),...(x.aliases||[])].join(' ').toLowerCase();
        return tokens.every(t=>hay.includes(aliasMap[t]||t));
      }).slice(0,30);
      host.innerHTML=rows.length?rows.map(x=>`<a class="search-result" href="${x.url}"><span class="type">${x.type}</span><div><strong>${x.title}</strong><p>${x.description}</p></div><span>보기</span></a>`).join(''):'<p class="notice">일치하는 문서가 없습니다. “욕실”, “VAT”, “32평”, “폐기물”처럼 공종·조건으로 검색해 보세요.</p>';
    };
    const qp=new URLSearchParams(location.search).get('q')||'';
    input.value=qp;render();
    input.addEventListener('input',render);
    $('[data-search-form]')?.addEventListener('submit',e=>{e.preventDefault();render()});
  }

  const coreItems=[
    ['demolition','철거'],['waste','폐기물'],['waterproof','방수'],['bathroom','욕실'],
    ['kitchen','주방'],['wallpaper','도배'],['flooring','바닥'],['carpentry','목공'],
    ['electrical','전기'],['window','샷시'],['management','현장관리비'],['vat','VAT']
  ];

  function readQuoteState(){
    const out={context:{},items:{}};
    $$('[data-context]').forEach(el=>out.context[el.dataset.context]=el.value);
    coreItems.forEach(([id,name])=>{
      const row=$(`[data-qrow="${id}"]`);
      if(!row)return;
      out.items[id]={
        name,
        state:$(`[name="state-${id}"]:checked`,row)?.value||'missing',
        amount:$('[data-q-amount]',row)?.value||'',
        qty:$('[data-q-qty]',row)?.value||'',
        unit:$('[data-q-unit]',row)?.value||'',
        spec:$('[data-q-spec]',row)?.value||'',
        memo:$('[data-q-memo]',row)?.value||''
      };
    });
    return out;
  }
  function applyQuoteState(data){
    if(!data)return;
    Object.entries(data.context||{}).forEach(([k,v])=>{const el=$(`[data-context="${k}"]`);if(el)el.value=v});
    Object.entries(data.items||{}).forEach(([id,v])=>{
      const row=$(`[data-qrow="${id}"]`);if(!row)return;
      const r=$(`[name="state-${id}"][value="${v.state}"]`,row);if(r)r.checked=true;
      const map=[['amount','[data-q-amount]'],['qty','[data-q-qty]'],['unit','[data-q-unit]'],['spec','[data-q-spec]'],['memo','[data-q-memo]']];
      map.forEach(([key,sel])=>{const el=$(sel,row);if(el&&v[key]!=null)el.value=v[key]});
    });
  }
  function quoteQuestions(data){
    const qs=[];
    const add=(id,text)=>qs.push({id,text});
    const it=data.items||{};
    Object.entries(it).forEach(([id,v])=>{
      if(v.state==='missing') add(id,`${v.name} 항목이 견적서에 보이지 않습니다. 포함인지 별도인지 확인해 주세요.`);
      if(v.state==='separate') add(id,`${v.name}이 별도입니다. 추가 금액과 산정 기준을 확인해 주세요.`);
      if(['bathroom','kitchen','window','electrical','carpentry'].includes(id) && v.state==='included' && !String(v.spec||'').trim()){
        const detail={bathroom:'욕실 공사에 철거·방수·타일·도기·수전·천장·환풍기·배관이 어디까지 포함되는지',kitchen:'주방 가구 길이·상판·아일랜드·배관 이동 범위를',window:'샷시 창 개수·치수·유리 사양·양중 포함 여부를',electrical:'전기 회로·콘센트 개소·증설·분전반 작업 범위를',carpentry:'목공의 가벽·천장·몰딩·문틀 작업 범위를'}[id];
        add(id,`${detail} 확인해 주세요.`);
      }
      if(v.state==='included' && !v.qty && ['flooring','wallpaper','kitchen','window','electrical'].includes(id)) add(id,`${v.name} 수량 또는 면적이 없습니다. 다른 견적과 비교할 수 있는 수량을 확인해 주세요.`);
    });
    if(it.vat?.state==='missing') add('vat','VAT가 총액에 포함됐는지 별도인지 업체에 확인해 주세요.');
    if(it.waste?.state==='separate') add('waste','폐기물 반출·처리비의 추가 금액과 장비·엘리베이터 사용 조건을 확인해 주세요.');
    return [...new Map(qs.map(x=>[x.text,x])).values()];
  }
  function updateQuoteReport(){
    const report=$('[data-quote-report]');if(!report)return;
    const data=readQuoteState();
    let included=0,separate=0,missing=0,unclear=0,total=0;
    Object.values(data.items).forEach(v=>{
      if(v.state==='included')included++;
      if(v.state==='separate')separate++;
      if(v.state==='missing')missing++;
      if(v.state==='included' && ['bathroom','kitchen','window','electrical','carpentry'].includes(Object.keys(data.items).find(k=>data.items[k]===v)) && !v.spec) unclear++;
      total+=Number(v.amount||0);
    });
    $('[data-stat-included]',report).textContent=included;
    $('[data-stat-separate]',report).textContent=separate;
    $('[data-stat-missing]',report).textContent=missing;
    $('[data-stat-unclear]',report).textContent=unclear;
    $('[data-quote-total]',report).textContent=`${fmt(total)}만원`;
    const reasons=[];
    if(missing) reasons.push(`미기재 ${missing}개`);
    if(separate) reasons.push(`별도비용 ${separate}개`);
    if(unclear) reasons.push(`사양 불명확 ${unclear}개`);
    const comparable=!reasons.length;
    const comp=$('[data-comparable]',report);
    comp.textContent=comparable?'현재 입력 기준으로 조건 비교 가능':'단순 총액 비교 불가';
    comp.className='matrix-conclusion'+(comparable?'':' warning');
    const qs=quoteQuestions(data);
    $('[data-question-list]',report).innerHTML=qs.length?qs.map((q,i)=>`<div class="question-row"><span>${String(i+1).padStart(2,'0')}</span><span>${q.text}</span><button type="button" data-copy-question="${i}">복사</button></div>`).join(''):'<p class="notice">주요 항목의 상태와 사양이 입력되었습니다. 계약 전 최종 문서에서 같은 조건이 유지되는지 다시 확인하세요.</p>';
    $$('[data-copy-question]',report).forEach(btn=>btn.addEventListener('click',()=>{navigator.clipboard?.writeText(qs[Number(btn.dataset.copyQuestion)].text);toast('질문을 복사했습니다.')}));
    report.setAttribute('aria-live','polite');
  }
  function initQuoteCheck(){
    const form=$('[data-quote-form]');if(!form)return;
    const saved=storage.get('interior-quote-v5');applyQuoteState(saved);
    form.addEventListener('input',updateQuoteReport);form.addEventListener('change',updateQuoteReport);updateQuoteReport();
    $('[data-save-quote]')?.addEventListener('click',()=>{storage.set('interior-quote-v5',readQuoteState());toast('이 브라우저에 저장했습니다.')});
    $('[data-reset-quote]')?.addEventListener('click',()=>{storage.del('interior-quote-v5');location.reload()});
    $('[data-copy-report]')?.addEventListener('click',()=>{
      const d=readQuoteState(),qs=quoteQuestions(d);
      const lines=['인테리어 견적 검사',...Object.values(d.items).map(v=>`${v.name}: ${v.state==='included'?'기재':v.state==='separate'?'별도':'미기재'}${v.amount?` / ${v.amount}만원`:''}${v.spec?` / ${v.spec}`:''}`),'','업체에 확인할 질문',...qs.map((q,i)=>`${i+1}. ${q.text}`)];
      navigator.clipboard?.writeText(lines.join('\n'));toast('결과를 복사했습니다.');
    });
    $('[data-export-csv]')?.addEventListener('click',()=>{
      const d=readQuoteState();const rows=[['공종','상태','금액(만원)','수량','단위','사양','메모'],...Object.values(d.items).map(v=>[v.name,v.state,v.amount,v.qty,v.unit,v.spec,v.memo])];
      const csv='\ufeff'+rows.map(r=>r.map(x=>`"${String(x||'').replaceAll('"','""')}"`).join(',')).join('\n');
      const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='interior-quote-check.csv';a.click();URL.revokeObjectURL(a.href);
    });
    $('[data-print]')?.addEventListener('click',()=>window.print());
    const table=$('.quote-check-table');
    if(table){
      table.classList.add('mobile-wizard');
      let step=0;const rows=$$('.qrow',table), counter=$('[data-wizard-counter]'), label=$('[data-wizard-label]');
      const show=()=>{rows.forEach((r,i)=>r.classList.toggle('is-current',i===step));if(counter)counter.textContent=`${step+1} / ${rows.length}`;if(label)label.textContent=$('.qrow-title strong',rows[step])?.textContent||'';const p=$('[data-prev]'),n=$('[data-next]');if(p)p.disabled=step===0;if(n)n.textContent=step===rows.length-1?'결과 보기':'다음';};
      $('[data-prev]')?.addEventListener('click',()=>{if(step>0){step--;show()}});
      $('[data-next]')?.addEventListener('click',()=>{if(step<rows.length-1){step++;show()}else $('[data-quote-report]')?.scrollIntoView({behavior:'smooth'})});
      show();
    }
  }

  function readCompareVendor(vendor,id){
    const row=$(`[data-compare-row="${id}"]`);
    return {
      state:$(`[data-vendor="${vendor}"][data-state]`,row)?.value||'missing',
      amount:$(`[data-vendor="${vendor}"][data-amount]`,row)?.value||''
    };
  }
  function updateCompare(){
    const host=$('[data-compare-table]');if(!host)return;
    const vendors=['a','b','c'];let totals={a:0,b:0,c:0},diff=0;
    coreItems.forEach(([id])=>{
      const vals=vendors.map(v=>readCompareVendor(v,id));
      vals.forEach((x,i)=>totals[vendors[i]]+=Number(x.amount||0));
      const mismatch=new Set(vals.map(x=>x.state)).size>1;
      const row=$(`[data-compare-row="${id}"]`);
      row?.classList.toggle('has-diff',mismatch);
      const flag=$('[data-diff-flag]',row);if(flag)flag.textContent=mismatch?'조건 다름':'';
      if(mismatch)diff++;
    });
    vendors.forEach(v=>{const el=$(`[data-total="${v}"]`);if(el)el.textContent=`${fmt(totals[v])}만원`});
    const critical=['vat','waste','window','management'];
    const criticalDiff=critical.filter(id=>new Set(vendors.map(v=>readCompareVendor(v,id).state)).size>1);
    const summary=$('[data-compare-summary]');
    const hasAnyInput=coreItems.some(([id])=>vendors.some(v=>{const x=readCompareVendor(v,id);return x.state!=='missing'||Number(x.amount||0)>0;}));
    if(summary){
      summary.innerHTML=!hasAnyInput
        ? '<strong>아직 비교 전입니다.</strong><br>각 업체 견적의 포함·별도·미기재와 금액을 입력하면 조건 차이를 표시합니다.'
        : criticalDiff.length
          ? `<strong>단순 총액 비교 불가</strong><br>${criticalDiff.map(id=>coreItems.find(x=>x[0]===id)?.[1]).join(' · ')} 조건이 업체마다 다릅니다. 같은 조건으로 맞춘 뒤 금액을 비교하세요.`
          : '<strong>핵심 포함조건은 동일합니다.</strong><br>사양·수량이 같은지 확인한 뒤 금액 차이를 해석하세요.';
    }
    const diffOnly=$('[data-diff-only]')?.checked;
    $$('[data-compare-row]').forEach(r=>r.hidden=!!diffOnly&&!r.classList.contains('has-diff'));
  }
  function compareStorageKey(el){
    const row=el.closest('[data-compare-row]');
    const item=row?.dataset.compareRow||'';
    const vendor=el.dataset.vendor||'';
    const kind=el.hasAttribute('data-state')?'state':'amount';
    return `${item}:${vendor}:${kind}`;
  }
  function initCompare(){
    const host=$('[data-compare-table]');if(!host)return;
    const fields=$$('[data-vendor]',host);
    const saved=storage.get('interior-compare-v5',{});
    fields.forEach(el=>{
      const key=compareStorageKey(el);
      if(saved&&saved[key]!=null) el.value=saved[key];
      el.addEventListener('input',updateCompare);
      el.addEventListener('change',updateCompare);
    });
    $('[data-diff-only]')?.addEventListener('change',updateCompare);
    $('[data-save-compare]')?.addEventListener('click',()=>{
      const data={};fields.forEach(el=>data[compareStorageKey(el)]=el.value);
      storage.set('interior-compare-v5',data);toast('비교표를 저장했습니다.');
    });
    $('[data-reset-compare]')?.addEventListener('click',()=>{storage.del('interior-compare-v5');location.reload()});
    $('[data-print]')?.addEventListener('click',()=>window.print());
    updateCompare();
  }

  function budgetStorageKey(el){
    if(el.hasAttribute('data-vat')) return 'vat';
    const row=el.closest('[data-budget-row]');
    const item=row?.dataset.budgetRow||'';
    const kind=el.hasAttribute('data-qty')?'qty':el.hasAttribute('data-unit')?'unit':el.hasAttribute('data-unit-price')?'price':'included';
    return `${item}:${kind}`;
  }
  function initBudget(){
    const root=$('[data-budget-builder]');if(!root)return;
    const fields=$$('[data-qty],[data-unit],[data-unit-price],[data-included],[data-vat]',root);
    const saved=storage.get('interior-budget-v5',{});
    fields.forEach(el=>{const key=budgetStorageKey(el);if(saved&&saved[key]!=null)el.value=saved[key]});
    const calc=()=>{
      let subtotal=0;
      $$('[data-budget-row]',root).forEach(row=>{
        const qty=Number($('[data-qty]',row)?.value||0);
        const price=Number($('[data-unit-price]',row)?.value||0);
        const included=$('[data-included]',row)?.value!=='no';
        const line=qty*price;
        const out=$('[data-line-total]',row);
        if(out) out.textContent=included?`${fmt(Math.round(line))}만원`:'제외';
        if(included) subtotal+=line;
      });
      const vatMode=$('[data-vat]',root)?.value||'excluded';
      const total=vatMode==='add10'?subtotal*1.1:subtotal;
      const out=$('[data-budget-total]',root);
      if(out) out.textContent=vatMode==='excluded'?`${fmt(Math.round(total))}만원 + VAT 별도`:`${fmt(Math.round(total))}만원`;
    };
    fields.forEach(el=>{el.addEventListener('input',calc);el.addEventListener('change',calc)});
    $('[data-save-budget]')?.addEventListener('click',()=>{
      const data={};fields.forEach(el=>data[budgetStorageKey(el)]=el.value);
      storage.set('interior-budget-v5',data);toast('예산 시나리오를 저장했습니다.');
    });
    $('[data-reset-budget]')?.addEventListener('click',()=>{storage.del('interior-budget-v5');location.reload()});
    $('[data-print]')?.addEventListener('click',()=>window.print());
    calc();
  }

  function initChecklist(){
    const root=$('[data-checklist]');if(!root)return;
    const key='interior-checklist-v5';
    const checks=$$('input[data-check-id]',root);
    const saved=storage.get(key,{});
    checks.forEach(el=>{el.checked=!!saved[el.dataset.checkId]});
    const update=()=>{
      const done=checks.filter(x=>x.checked).length;
      const out=$('[data-check-progress]',root);
      if(out) out.textContent=`${done} / ${checks.length}`;
    };
    checks.forEach(el=>el.addEventListener('change',update));
    $('[data-save-check]')?.addEventListener('click',()=>{
      const data={};checks.forEach(el=>data[el.dataset.checkId]=el.checked);
      storage.set(key,data);toast('체크 상태를 저장했습니다.');
    });
    $('[data-reset-check]')?.addEventListener('click',()=>{storage.del(key);checks.forEach(x=>x.checked=false);update()});
    $('[data-print]')?.addEventListener('click',()=>window.print());
    update();
  }

  function initOneSet(){
    const root=$('[data-one-set]');if(!root)return;
    const select=$('[data-one-set-type]',root),amount=$('[data-one-set-amount]',root),host=$('[data-one-set-result]',root);
    if(!select||!amount||!host)return;
    const key='interior-one-set-v5',saved=storage.get(key,{});
    if(saved.type)select.value=saved.type;if(saved.amount!=null)amount.value=saved.amount;
    const sets={
      bathroom:['철거','폐기물','방수','타일 자재','타일 시공','도기','수전','천장','환풍기','젠다이','배관','전기'],
      kitchen:['기존 가구 철거','상부장','하부장','상판','키큰장','아일랜드','싱크볼','수전','후드','급배수 이동','전기 회로','벽 타일'],
      window:['창별 수량','가로×세로 치수','내창/외창','프레임','유리 사양','철거','실리콘·마감','양중','사다리차','폐기물']
    };
    const persist=()=>storage.set(key,{type:select.value,amount:amount.value});
    const render=()=>{
      const rows=sets[select.value]||[];
      const money=Number(amount.value||0);
      host.innerHTML=`${money?`<p><strong>표시 금액</strong> ${fmt(money)}만원 — 세부 금액으로 임의 배분하지 않습니다.</p>`:""}<h3>세부 확인 항목</h3><ol>${rows.map(x=>`<li>${x}</li>`).join("")}</ol>`;
      persist();
    };
    select.addEventListener('change',render);amount.addEventListener('input',render);render();
  }

  initSearchPage();initQuoteCheck();initCompare();initBudget();initChecklist();initOneSet();
})();
/* app-v6.js */
(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const fmt=n=>Number(n||0).toLocaleString('ko-KR',{maximumFractionDigits:2});
  const INDEX={'2026-01':133.28,'2026-02':133.69,'2026-03':134.42,'2026-04':136.88,'2026-05':137.67,'2026-06':138.22,'2026-07':138.59};
  const GROUPS={base:{label:'철거·기초',ids:['demolition','waste','waterproof']},room:{label:'욕실·주방',ids:['bathroom','kitchen']},finish:{label:'마감·전기',ids:['wallpaper','flooring','carpentry','electrical']},other:{label:'샷시·관리',ids:['window','management','vat']}};

  function compareKey(el){const row=el.closest('[data-compare-row]'),kind=el.hasAttribute('data-state')?'state':'amount';return `${row?.dataset.compareRow||'unknown'}:${el.dataset.vendor||'x'}:${kind}`}
  function readCompare(){const out={};$$('[data-compare-table] [data-vendor]').forEach(el=>out[compareKey(el)]=el.value);return out}
  function applyCompare(){let saved={};try{saved=JSON.parse(localStorage.getItem('interior-compare-v6')||'{}')}catch{};$$('[data-compare-table] [data-vendor]').forEach(el=>{const v=saved[compareKey(el)];if(v!=null)el.value=v})}
  function vendorAmounts(vendor){const grouped={base:0,room:0,finish:0,other:0};for(const [group,meta] of Object.entries(GROUPS))meta.ids.forEach(id=>{const row=$(`[data-compare-row="${id}"]`),el=row?.querySelector(`[data-vendor="${vendor}"][data-amount]`);grouped[group]+=Number(el?.value||0)});return grouped}
  function renderCompareChart(){const root=$('[data-v6-compare-chart]');if(!root)return;['a','b','c'].forEach(vendor=>{const groups=vendorAmounts(vendor),total=Object.values(groups).reduce((a,b)=>a+b,0),bar=$(`[data-v6-stack="${vendor}"]`,root),totalEl=$(`[data-v6-stack-total="${vendor}"]`,root),legacyTotal=$(`[data-total="${vendor}"]`);if(totalEl)totalEl.textContent=total?`${fmt(total)}만원`:'입력 전';if(legacyTotal)legacyTotal.textContent=`${fmt(total)}만원`;if(!bar)return;bar.innerHTML=Object.entries(groups).map(([key,value])=>`<span class="v6-stack-seg" data-group="${key}" style="width:${total?value/total*100:0}%" title="${GROUPS[key].label} ${fmt(value)}만원"></span>`).join('');bar.setAttribute('aria-label',total?`${vendor.toUpperCase()} 업체 입력금액 ${fmt(total)}만원`:`${vendor.toUpperCase()} 업체 금액 입력 전`)})}
  function initCompareV6(){const host=$('[data-compare-table]');if(!host)return;applyCompare();const rerender=()=>requestAnimationFrame(renderCompareChart);$$('[data-vendor]',host).forEach(el=>{el.addEventListener('input',rerender);el.addEventListener('change',rerender)});$('[data-save-compare]',host)?.addEventListener('click',()=>{try{localStorage.setItem('interior-compare-v6',JSON.stringify(readCompare()))}catch{}});$('[data-reset-compare]',host)?.addEventListener('click',()=>{try{localStorage.removeItem('interior-compare-v6')}catch{}},{capture:true});renderCompareChart()}

  function initIndexConverter(){const root=$('[data-v6-index-tool]');if(!root)return;const amount=$('[data-v6-index-amount]',root),from=$('[data-v6-index-from]',root),to=$('[data-v6-index-to]',root),result=$('[data-v6-index-result]',root),ratio=$('[data-v6-index-ratio]',root);const calc=()=>{const base=Number(amount?.value||0),a=INDEX[from?.value],b=INDEX[to?.value];if(!a||!b){if(result)result.textContent='—';return}const r=b/a;if(ratio)ratio.textContent=`지수비 ${r.toFixed(4)} · ${((r-1)*100).toFixed(2)}%`;if(result)result.textContent=base?`${fmt(Math.round(base*r))}만원`:'금액 입력'};[amount,from,to].filter(Boolean).forEach(el=>{el.addEventListener('input',calc);el.addEventListener('change',calc)});calc()}
  function initHomeSearch(){const form=$('[data-v6-search]');if(!form)return;form.addEventListener('submit',e=>{e.preventDefault();const q=$('input',form)?.value.trim();if(q)location.href=`/pm-lab/interior-cost-stratton-v33-preview/search/?q=${encodeURIComponent(q)}`})}
  initCompareV6();initIndexConverter();initHomeSearch();
})();

/* app-v6-4.js */
(() => {
  const BASE='/pm-lab/interior-cost-stratton-v33-preview';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const won=n=>`${Math.round(Number(n||0)).toLocaleString('ko-KR')}원`;
  const manwon=n=>`${(Number(n||0)/10000).toLocaleString('ko-KR',{maximumFractionDigits:2})}만원`;
  const STORE='interior-public-reference-v64';
  let payload=null;

  const readSaved=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch{return []}};
  const writeSaved=v=>{try{localStorage.setItem(STORE,JSON.stringify(v))}catch{}};
  const escapeText=v=>String(v??'');

  function currentItem(root){
    const code=$('[data-v64-item]',root)?.value;
    return payload?.items?.find(x=>x.code===code)||null;
  }
  function calculate(root){
    const item=currentItem(root),qty=Math.max(0,Number($('[data-v64-qty]',root)?.value||0));
    const unitPrice=$('[data-v64-unit-price]',root),unit=$('[data-v64-unit]',root),result=$('[data-v64-result]',root),resultWon=$('[data-v64-result-won]',root);
    const code=$('[data-v64-code]',root),spec=$('[data-v64-spec]',root),scope=$('[data-v64-scope]',root),exclude=$('[data-v64-exclude]',root),labor=$('[data-v64-labor]',root),source=$('[data-v64-source]',root);
    if(!item)return;
    if(unitPrice)unitPrice.value=won(item.price);
    if(unit)unit.textContent=item.unit;
    if(code)code.textContent=item.code;
    if(spec)spec.textContent=item.spec;
    if(scope)scope.textContent=item.scope;
    if(exclude)exclude.textContent=item.exclude;
    if(labor)labor.textContent=`${item.labor}%`;
    if(source)source.href=item.detail;
    const total=item.price*qty;
    if(result)result.textContent=qty?manwon(total):'수량 입력';
    if(resultWon)resultWon.textContent=qty?won(total):'공공 기준 단가 × 수량';
    root.dataset.currentTotal=String(total);
  }
  function renderSaved(root){
    const host=$('[data-v64-saved-list]',root),totalEl=$('[data-v64-saved-total]',root);
    if(!host||!totalEl)return;
    const rows=readSaved(),total=rows.reduce((a,x)=>a+Number(x.total||0),0);
    host.innerHTML='';
    if(!rows.length){const p=document.createElement('p');p.className='v64-ref-inline';p.textContent='저장한 참고 계산이 없습니다. 참고합계는 위 예산 합계와 자동으로 섞이지 않습니다.';host.append(p)}
    rows.forEach((row,i)=>{
      const el=document.createElement('div');el.className='v64-ref-saved-row';
      const label=document.createElement('div');const strong=document.createElement('strong');strong.textContent=row.name;const meta=document.createElement('div');meta.className='v64-ref-code';meta.textContent=`${row.code} · ${row.qty}${row.unit}`;label.append(strong,meta);
      const amount=document.createElement('span');amount.textContent=manwon(row.total);
      const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';remove.addEventListener('click',()=>{const next=readSaved();next.splice(i,1);writeSaved(next);$$('[data-v64-unit-ref]').forEach(renderSaved)});
      el.append(label,amount,remove);host.append(el);
    });
    totalEl.textContent=manwon(total);
  }
  function addSaved(root){
    const item=currentItem(root),qty=Math.max(0,Number($('[data-v64-qty]',root)?.value||0));if(!item||!qty)return;
    const rows=readSaved();rows.push({code:item.code,name:item.name,qty,unit:item.unit,price:item.price,total:item.price*qty,exclude:item.exclude});writeSaved(rows);$$('[data-v64-unit-ref]').forEach(renderSaved);
  }
  async function copyCurrent(root){
    const item=currentItem(root),qty=Math.max(0,Number($('[data-v64-qty]',root)?.value||0));if(!item||!qty)return;
    const total=item.price*qty;
    const text=[`[공공 공종 참고계산] ${item.name}`,`코드 ${item.code} / ${item.spec}`,`기준단가 ${won(item.price)}/${item.unit} × ${qty}${item.unit} = ${won(total)} (${manwon(total)})`,`조건: ${item.exclude}`,'주의: 공공 건설 예정가격 참고단가이며 민간 인테리어 시장평균이 아님.'].join('\n');
    try{await navigator.clipboard.writeText(text);const btn=$('[data-v64-copy]',root);if(btn){const before=btn.textContent;btn.textContent='복사됨';setTimeout(()=>btn.textContent=before,1000)}}catch{}
  }
  function initRoot(root){
    const select=$('[data-v64-item]',root);if(!select||!payload)return;
    select.innerHTML='';payload.items.forEach(item=>{const o=document.createElement('option');o.value=item.code;o.textContent=`${item.group} · ${item.name} · ${won(item.price)}/${item.unit}`;select.append(o)});
    const qp=new URLSearchParams(location.search).get('ref');if(qp&&payload.items.some(x=>x.code===qp))select.value=qp;
    select.addEventListener('change',()=>calculate(root));$('[data-v64-qty]',root)?.addEventListener('input',()=>calculate(root));
    $('[data-v64-add]',root)?.addEventListener('click',()=>addSaved(root));$('[data-v64-copy]',root)?.addEventListener('click',()=>copyCurrent(root));
    calculate(root);renderSaved(root);
  }
  async function init(){
    const roots=$$('[data-v64-unit-ref]');if(!roots.length)return;
    try{payload=await fetch(`${BASE}/data/public-unit-cost-2026-h2.json`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()})}catch{return}
    roots.forEach(initRoot);
  }
  init();
})();

/* app-v6-5.js */
(() => {
  const BASE='/pm-lab/interior-cost-stratton-v33-preview';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const won=n=>`${Math.round(Number(n||0)).toLocaleString('ko-KR')}원`;
  const pct=n=>`${n>=0?'+':''}${Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1})}%`;
  let data=null;

  function item(root){const code=$('[data-v65-item]',root)?.value;return data?.items?.find(x=>x.code===code)||null}
  function calc(root){
    const row=item(root),amountMan=Number($('[data-v65-amount]',root)?.value||0),qty=Number($('[data-v65-qty]',root)?.value||0);
    const userUnit=qty>0?amountMan*10000/qty:0,ref=row?.price||0;
    const userEl=$('[data-v65-user-unit]',root),refEl=$('[data-v65-ref-unit]',root),delta=$('[data-v65-delta]',root),deltaNote=$('[data-v65-delta-note]',root),itemNote=$('[data-v65-item-note]',root);
    if(userEl)userEl.textContent=userUnit?`${won(userUnit)}/${row?.unit||''}`:'금액·수량 입력';
    if(refEl)refEl.textContent=row?`${won(ref)}/${row.unit}`:'—';
    if(itemNote&&row)itemNote.textContent=`${row.code} · ${row.spec} · ${row.exclude}`;
    const scopeOk=!!$('[data-v65-scope-match]',root)?.checked,excludeOk=!!$('[data-v65-exclude-match]',root)?.checked;
    if(!delta)return;
    if(!userUnit||!ref){delta.dataset.state='blocked';delta.textContent='입력 필요';if(deltaNote)deltaNote.textContent='견적금액과 수량을 입력하세요.';return}
    if(!scopeOk||!excludeOk){delta.dataset.state='blocked';delta.textContent='조건 미확인';if(deltaNote)deltaNote.textContent='공정범위와 제외조건을 모두 확인해야 차이율을 표시합니다.';return}
    const d=(userUnit/ref-1)*100;delta.dataset.state='ready';delta.textContent=pct(d);if(deltaNote)deltaNote.textContent=`공공 참고단가 대비 단순 차이율 · 비율 ${(userUnit/ref).toFixed(2)}× · 적정가 판정 아님`;
  }
  function initRoot(root){
    const select=$('[data-v65-item]',root);if(!select||!data)return;
    select.innerHTML='';data.items.forEach(x=>{const o=document.createElement('option');o.value=x.code;o.textContent=`${x.group} · ${x.name} · ${won(x.price)}/${x.unit}`;select.append(o)});
    const ref=new URLSearchParams(location.search).get('ref');if(ref&&data.items.some(x=>x.code===ref))select.value=ref;
    $$('select,input',root).forEach(el=>{el.addEventListener('input',()=>calc(root));el.addEventListener('change',()=>calc(root))});calc(root);
  }
  async function init(){const roots=$$('[data-v65-normalizer]');if(!roots.length)return;try{data=await fetch(`${BASE}/data/public-unit-cost-2026-h2.json`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()})}catch{return}roots.forEach(initRoot)}
  init();
})();

/* app-v6-6.js */
(() => {
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const REQUIRED=['sample_id','quote_month','region_level1','supply_pyeong','building_type','scope','bathroom_count','window_scope','vat_state','waste_state','total_amount_manwon'];
  const OPTIONAL=['exclusive_pyeong','demolition_manwon','waste_manwon','waterproof_manwon','bathroom_manwon','kitchen_manwon','wallpaper_manwon','flooring_manwon','carpentry_manwon','electrical_manwon','window_manwon','management_manwon'];
  const ALLOWED=new Set([...REQUIRED,...OPTIONAL]);
  const REGIONS=new Set(['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주']);
  const BUILDINGS=new Set(['아파트','빌라','주택']);
  const SCOPES=new Set(['올수리','부분']);
  const WINDOWS=new Set(['전체','부분','제외','미기재']);
  const STATES=new Set(['포함','별도','미기재']);
  const ITEM_FIELDS=OPTIONAL.filter(x=>x.endsWith('_manwon'));
  const PUBLIC_N=30, SEGMENT_N=20;
  let last={valid:[],errors:[],headers:[]};

  function parseCsv(text){
    const rows=[];let row=[],cell='',quoted=false;
    const src=String(text||'').replace(/^\uFEFF/,'');
    for(let i=0;i<src.length;i++){
      const ch=src[i],next=src[i+1];
      if(quoted){if(ch==='"'&&next==='"'){cell+='"';i++}else if(ch==='"'){quoted=false}else cell+=ch;continue}
      if(ch==='"'){quoted=true;continue}
      if(ch===','){row.push(cell);cell='';continue}
      if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';continue}
      if(ch!=='\r')cell+=ch;
    }
    row.push(cell);if(row.some(x=>String(x).trim()!==''))rows.push(row);
    return rows;
  }
  function num(v){const x=String(v??'').trim();if(x==='')return null;const n=Number(x.replaceAll(',',''));return Number.isFinite(n)?n:NaN}
  function validMonth(v){const m=String(v||'').match(/^(\d{4})-(\d{2})$/);return !!m&&Number(m[2])>=1&&Number(m[2])<=12}
  function validate(text){
    const raw=parseCsv(text);const errors=[];if(raw.length<2)return {valid:[],errors:['헤더와 데이터 행이 필요합니다.'],headers:[]};
    const headers=raw[0].map(x=>x.trim());const missing=REQUIRED.filter(x=>!headers.includes(x)),unknown=headers.filter(x=>!ALLOWED.has(x));
    if(missing.length)errors.push(`필수 열 누락: ${missing.join(', ')}`);if(unknown.length)errors.push(`허용하지 않는 열: ${unknown.join(', ')} · 개인정보/업체명 열은 넣지 않습니다.`);
    if(new Set(headers).size!==headers.length)errors.push('중복 헤더가 있습니다.');
    if(errors.length)return {valid:[],errors,headers};
    const ids=new Set(),valid=[];
    raw.slice(1).forEach((cells,index)=>{
      if(cells.every(x=>String(x).trim()===''))return;
      const line=index+2,obj={};headers.forEach((h,i)=>obj[h]=String(cells[i]??'').trim());const rowErrors=[];
      if(!/^[A-Za-z0-9_-]{3,40}$/.test(obj.sample_id))rowErrors.push('sample_id는 영문·숫자·_- 3~40자');
      if(ids.has(obj.sample_id))rowErrors.push('sample_id 중복');ids.add(obj.sample_id);
      if(!validMonth(obj.quote_month))rowErrors.push('quote_month는 YYYY-MM');
      if(!REGIONS.has(obj.region_level1))rowErrors.push('region_level1은 17개 시도 약칭 중 하나');
      const supply=num(obj.supply_pyeong);if(!Number.isFinite(supply)||supply<5||supply>100)rowErrors.push('supply_pyeong 5~100');
      const exclusive=num(obj.exclusive_pyeong);if(exclusive!==null&&(!Number.isFinite(exclusive)||exclusive<0||exclusive>100))rowErrors.push('exclusive_pyeong 0~100 또는 공란');
      if(!BUILDINGS.has(obj.building_type))rowErrors.push('building_type: 아파트/빌라/주택');
      if(!SCOPES.has(obj.scope))rowErrors.push('scope: 올수리/부분');
      const bathrooms=num(obj.bathroom_count);if(!Number.isInteger(bathrooms)||bathrooms<0||bathrooms>5)rowErrors.push('bathroom_count 0~5 정수');
      if(!WINDOWS.has(obj.window_scope))rowErrors.push('window_scope: 전체/부분/제외/미기재');
      if(!STATES.has(obj.vat_state))rowErrors.push('vat_state: 포함/별도/미기재');
      if(!STATES.has(obj.waste_state))rowErrors.push('waste_state: 포함/별도/미기재');
      const total=num(obj.total_amount_manwon);if(!Number.isFinite(total)||total<=0||total>100000)rowErrors.push('total_amount_manwon 0 초과');
      ITEM_FIELDS.forEach(f=>{const n=num(obj[f]);if(n!==null&&(!Number.isFinite(n)||n<0||n>100000))rowErrors.push(`${f}는 0 이상 또는 공란`)});
      if(rowErrors.length){errors.push(`행 ${line}: ${rowErrors.join(' / ')}`);return}
      const normalized={sample_id:obj.sample_id,quote_month:obj.quote_month,region_level1:obj.region_level1,supply_pyeong:supply,exclusive_pyeong:exclusive,building_type:obj.building_type,scope:obj.scope,bathroom_count:bathrooms,window_scope:obj.window_scope,vat_state:obj.vat_state,waste_state:obj.waste_state,total_amount_manwon:total};
      ITEM_FIELDS.forEach(f=>normalized[f]=num(obj[f]));valid.push(normalized);
    });
    return {valid,errors,headers};
  }
  function quantile(values,p){const a=[...values].sort((x,y)=>x-y);if(!a.length)return null;const pos=(a.length-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(pos-lo)}
  function money(n){return n==null?'—':`${Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1})}만원`}
  function render(root,result){
    last=result;const valid=result.valid.length,invalid=result.errors.filter(x=>x.startsWith('행 ')).length;
    $('[data-v66-valid]',root).textContent=`${valid}건`;$('[data-v66-valid]',root).className=valid?'ok':'';
    $('[data-v66-invalid]',root).textContent=`${invalid}건`;$('[data-v66-invalid]',root).className=invalid?'bad':'';
    const status=$('[data-v66-status]',root),statusNote=$('[data-v66-status-note]',root);if(valid>=PUBLIC_N&&invalid===0){status.textContent='통계 미리보기 가능';status.className='ok';statusNote.textContent=`검수 통과 N=${valid}. 공개 정책 기준 N=${PUBLIC_N} 충족.`}else{status.textContent='통계 보류';status.className='';statusNote.textContent=`검수 통과 N=${valid}. 전체 분포 공개 기준 N=${PUBLIC_N} 미만이거나 오류가 남아 있습니다.`}
    const errors=$('[data-v66-errors]',root);errors.innerHTML='';if(result.errors.length){result.errors.slice(0,30).forEach(e=>{const li=document.createElement('li');const code=document.createElement('code');code.textContent=e;li.append(code);errors.append(li)})}else{const li=document.createElement('li');li.textContent='검증 오류가 없습니다.';errors.append(li)}
    const preview=$('[data-v66-stat-preview]',root);if(valid>=PUBLIC_N&&invalid===0){const vals=result.valid.map(x=>x.total_amount_manwon);preview.hidden=false;$('[data-v66-n]',preview).textContent=`${valid}건`;$('[data-v66-p25]',preview).textContent=money(quantile(vals,.25));$('[data-v66-median]',preview).textContent=money(quantile(vals,.5));$('[data-v66-p75]',preview).textContent=money(quantile(vals,.75))}else preview.hidden=true;
    const exportBtn=$('[data-v66-export]',root);if(exportBtn)exportBtn.disabled=!valid;
  }
  function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  function init(root){
    const area=$('[data-v66-csv]',root),validateBtn=$('[data-v66-validate]',root),exportBtn=$('[data-v66-export]',root);if(!area||!validateBtn)return;
    validateBtn.addEventListener('click',()=>render(root,validate(area.value)));
    exportBtn?.addEventListener('click',()=>{if(!last.valid.length)return;download('normalized-quote-samples.json',JSON.stringify({schema_version:'6.6.0',validated_count:last.valid.length,publication_threshold:{distribution_n:PUBLIC_N,segment_n:SEGMENT_N},rows:last.valid},null,2),'application/json')});
    const example=$('[data-v66-example]',root);example?.addEventListener('click',()=>{area.value='sample_id,quote_month,region_level1,supply_pyeong,exclusive_pyeong,building_type,scope,bathroom_count,window_scope,vat_state,waste_state,total_amount_manwon,bathroom_manwon,kitchen_manwon,wallpaper_manwon,flooring_manwon,window_manwon\nQ0001,2026-08,서울,32,25.7,아파트,올수리,2,제외,포함,포함,5200,900,850,320,450,';render(root,validate(area.value))});
    render(root,{valid:[],errors:[],headers:[]});
  }
  $$('[data-v66-pipeline]').forEach(init);
})();

/* app-v7.js */
(() => {
  const BASE='/pm-lab/interior-cost-stratton-v33-preview';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const NUMERIC=new Set(['supply_pyeong','exclusive_pyeong','bathroom_count','total_amount_manwon','demolition_manwon','waste_manwon','waterproof_manwon','bathroom_manwon','kitchen_manwon','wallpaper_manwon','flooring_manwon','carpentry_manwon','electrical_manwon','window_manwon','management_manwon']);
  const TRADE=[...NUMERIC].filter(x=>x.endsWith('_manwon')&&x!=='total_amount_manwon');
  const PUBLIC_N=30,SEGMENT_N=20;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;const src=String(text||'').replace(/^\ufeff/,'');for(let i=0;i<src.length;i++){const ch=src[i];if(quoted){if(ch==='"'&&src[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}else if(ch==='"')quoted=true;else if(ch===','){row.push(cell.trim());cell='';}else if(ch==='\n'){row.push(cell.trim());rows.push(row);row=[];cell='';}else if(ch!=='\r')cell+=ch;}if(cell.length||row.length){row.push(cell.trim());rows.push(row)}return rows.filter(r=>r.some(v=>String(v).trim()!==''));}
  function quantile(values,p){const a=values.filter(Number.isFinite).slice().sort((a,b)=>a-b);if(!a.length)return null;const i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(i-lo)}
  const fmt=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1});
  function download(name,type,text){const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
  function pyeongBand(v){const n=Number(v);if(n<20)return '20평 미만';if(n<30)return '20평대';if(n<40)return '30평대';if(n<50)return '40평대';return '50평 이상'}
  async function init(root){
    let schema;try{schema=await fetch(`${BASE}/data/quote-sample-schema.json`,{cache:'no-store'}).then(r=>r.json())}catch{return}
    const allowed=new Set(Object.keys(schema.properties||{})),required=schema.required||[];
    let rows=[],messages=[],header=[];
    const drop=$('[data-v7-drop]',root),file=$('[data-v7-file]',root),paste=$('[data-v7-paste]',root),run=$('[data-v7-run]',root),example=$('[data-v7-example]',root),exportJson=$('[data-v7-export-json]',root),exportCsv=$('[data-v7-export-csv]',root);
    const region=$('[data-v7-region]',root),band=$('[data-v7-band]',root),scope=$('[data-v7-scope]',root),building=$('[data-v7-building]',root);
    function validate(text){
      const matrix=parseCsv(text);messages=[];rows=[];header=[];if(!matrix.length){messages.push({row:'-',field:'CSV',message:'데이터가 비어 있음'});render();return}
      header=matrix[0].map(x=>x.trim());const unknown=header.filter(h=>!allowed.has(h)),missing=required.filter(h=>!header.includes(h));unknown.forEach(x=>messages.push({row:'-',field:x,message:'허용하지 않는 열'}));missing.forEach(x=>messages.push({row:'-',field:x,message:'필수 열 누락'}));if(messages.length){render();return}
      const seen=new Set();
      matrix.slice(1).forEach((cells,idx)=>{const raw={};header.forEach((h,i)=>raw[h]=(cells[i]??'').trim());const out={},errs=[];for(const [key,rule] of Object.entries(schema.properties||{})){const value=raw[key];if(value===''||value==null){out[key]=Array.isArray(rule.type)&&rule.type.includes('null')?null:'';if(required.includes(key))errs.push([key,'필수값 누락']);continue}let v=NUMERIC.has(key)?Number(value):String(value).trim();out[key]=v;if(rule.enum&&!rule.enum.includes(v))errs.push([key,'허용값 아님']);if(rule.pattern&&!(new RegExp(rule.pattern).test(String(v))))errs.push([key,'형식 불일치']);if(NUMERIC.has(key)){if(!Number.isFinite(v))errs.push([key,'숫자 아님']);if(rule.minimum!=null&&v<rule.minimum)errs.push([key,'최소값 미만']);if(rule.maximum!=null&&v>rule.maximum)errs.push([key,'최대값 초과']);if(rule.exclusiveMinimum!=null&&v<=rule.exclusiveMinimum)errs.push([key,'0보다 커야 함']);}}
        if(out.sample_id){if(seen.has(out.sample_id))errs.push(['sample_id','중복 ID']);else seen.add(out.sample_id)}
        const total=Number(out.total_amount_manwon),components=TRADE.map(f=>Number(out[f])).filter(Number.isFinite),sum=components.reduce((a,b)=>a+b,0);out._component_sum_manwon=sum;out._component_fields=components.length;out._vat_included_total_manwon=out.vat_state==='포함'?total:out.vat_state==='별도'?Number((total*1.1).toFixed(1)):null;out._per_supply_pyeong_manwon=Number(out.supply_pyeong)>0?Number((total/Number(out.supply_pyeong)).toFixed(2)):null;out._pyeong_band=pyeongBand(out.supply_pyeong);out._component_over_total=total>0&&sum>total*1.25;
        if(out._component_over_total)errs.push(['공종합계','공종별 합계가 총액의 125%를 초과']);
        if(errs.length)errs.forEach(e=>messages.push({row:idx+2,field:e[0],message:e[1]}));else rows.push(out);
      });render();populateFilters();applyFilters();
    }
    function render(){const valid=$('[data-v7-valid]',root),invalid=$('[data-v7-invalid]',root),table=$('[data-v7-error-body]',root);if(valid)valid.textContent=`${rows.length}건`;if(invalid)invalid.textContent=`${messages.length}건`;if(table)table.innerHTML=messages.slice(0,100).map(m=>`<tr><td>${esc(m.row)}</td><td>${esc(m.field)}</td><td>${esc(m.message)}</td></tr>`).join('')||'<tr><td colspan="3">오류 없음</td></tr>';if(exportJson)exportJson.disabled=!rows.length;if(exportCsv)exportCsv.disabled=!rows.length;const ratio=$('[data-v7-valid-ratio]',root);if(ratio){const total=rows.length+new Set(messages.filter(m=>Number.isFinite(Number(m.row))).map(m=>m.row)).size;ratio.textContent=total?`${Math.round(rows.length/total*100)}%`:'—'}const vat=$('[data-v7-vat-known]',root);if(vat)vat.textContent=rows.length?`${Math.round(rows.filter(r=>r.vat_state!=='미기재').length/rows.length*100)}%`:'—';const trade=$('[data-v7-trade-cover]',root);if(trade){const denom=rows.length*TRADE.length,filled=rows.reduce((n,r)=>n+TRADE.filter(f=>r[f]!=null&&r[f]!=='').length,0);trade.textContent=denom?`${Math.round(filled/denom*100)}%`:'—'}}
    function populateFilters(){const set=(el,vals,label)=>{if(!el)return;const current=el.value;el.innerHTML=`<option value="">${label}</option>`+[...new Set(vals.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ko')).map(v=>`<option>${esc(v)}</option>`).join('');if([...el.options].some(o=>o.value===current))el.value=current};set(region,rows.map(r=>r.region_level1),'전체 지역');set(band,rows.map(r=>r._pyeong_band),'전체 평수');set(scope,rows.map(r=>r.scope),'전체 범위');set(building,rows.map(r=>r.building_type),'전체 건물')}
    function filtered(){return rows.filter(r=>(!region?.value||r.region_level1===region.value)&&(!band?.value||r._pyeong_band===band.value)&&(!scope?.value||r.scope===scope.value)&&(!building?.value||r.building_type===building.value))}
    function applyFilters(){const list=filtered(),filteredMode=!!(region?.value||band?.value||scope?.value||building?.value),threshold=filteredMode?SEGMENT_N:PUBLIC_N,totals=list.map(r=>Number(r.total_amount_manwon)).filter(Number.isFinite),per=list.map(r=>Number(r._per_supply_pyeong_manwon)).filter(Number.isFinite),eligible=list.length>=threshold;const set=(sel,val)=>{const el=$(sel,root);if(el)el.textContent=val};set('[data-v7-n]',`${list.length}건`);set('[data-v7-p25]',eligible?`${fmt(quantile(totals,.25))}만원`:'보류');set('[data-v7-median]',eligible?`${fmt(quantile(totals,.5))}만원`:'보류');set('[data-v7-p75]',eligible?`${fmt(quantile(totals,.75))}만원`:'보류');set('[data-v7-per]',eligible?`${fmt(quantile(per,.5))}만원/평`:'보류');const note=$('[data-v7-gate-note]',root);if(note)note.textContent=eligible?`N=${list.length} · 공개 게이트 충족`:`N=${list.length} · ${filteredMode?'세그먼트':'전체'} 기준 N≥${threshold} 미달`;root.dataset.filtered=String(list.length)}
    async function readFile(f){if(!f)return;const text=await f.text();if(paste)paste.value=text;validate(text)}
    file?.addEventListener('change',e=>readFile(e.target.files?.[0]));['dragenter','dragover'].forEach(ev=>drop?.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('is-over')}));['dragleave','drop'].forEach(ev=>drop?.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('is-over')}));drop?.addEventListener('drop',e=>readFile(e.dataTransfer?.files?.[0]));run?.addEventListener('click',()=>validate(paste?.value||''));example?.addEventListener('click',async()=>{const t=await fetch(`${BASE}/data/quote-sample-template.csv`).then(r=>r.text());if(paste)paste.value=t;validate(t)});[region,band,scope,building].forEach(el=>el?.addEventListener('change',applyFilters));
    exportJson?.addEventListener('click',()=>download('interior-quotes-clean.json','application/json',JSON.stringify({version:'7.0.0',rows},null,2)));
    exportCsv?.addEventListener('click',()=>{if(!rows.length)return;const cols=[...header,'normalized_vat_included_manwon','per_supply_pyeong_manwon','pyeong_band'];const lines=[cols.join(','),...rows.map(r=>cols.map(c=>{const key=c==='normalized_vat_included_manwon'?'_vat_included_total_manwon':c==='per_supply_pyeong_manwon'?'_per_supply_pyeong_manwon':c==='pyeong_band'?'_pyeong_band':c;const v=r[key]??'';return /[",\n]/.test(String(v))?`"${String(v).replace(/"/g,'""')}"`:v}).join(','))];download('interior-quotes-clean.csv','text/csv;charset=utf-8','\ufeff'+lines.join('\n'))});
  }
  document.addEventListener('DOMContentLoaded',()=>$$('[data-v7-market]').forEach(init));
})();

/* app-v8.js */
(()=>{
'use strict';
const BASE='/pm-lab/interior-cost-stratton-v33-preview';
const won=n=>Number.isFinite(n)?`${Math.round(n).toLocaleString('ko-KR')}만원`:'—';
const num=v=>{const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const qs=(r,s)=>r.querySelector(s),qsa=(r,s)=>[...r.querySelectorAll(s)];

function quoteValue(card){
  const amount=num(qs(card,'[data-v8-total]')?.value);
  const vat=qs(card,'[data-v8-vat]')?.value||'unknown',vatAmount=num(qs(card,'[data-v8-vat-amount]')?.value);
  const waste=qs(card,'[data-v8-waste]')?.value||'unknown',wasteAmount=num(qs(card,'[data-v8-waste-amount]')?.value);
  const windowState=qs(card,'[data-v8-window]')?.value||'unknown',windowAmount=num(qs(card,'[data-v8-window-amount]')?.value);
  let normalized=amount,missing=[];
  if(amount==null||amount<=0)missing.push('총액');
  if(vat==='separate'){if(vatAmount!=null)normalized=(normalized??0)+vatAmount;else missing.push('VAT 별도금액')}
  else if(vat==='unknown')missing.push('VAT 조건');
  if(waste==='separate'){if(wasteAmount!=null)normalized=(normalized??0)+wasteAmount;else missing.push('폐기물 별도금액')}
  else if(waste==='unknown')missing.push('폐기물 조건');
  if(windowState==='excluded'){if(windowAmount!=null)normalized=(normalized??0)+windowAmount;else missing.push('창호 추가금액')}
  else if(windowState==='unknown')missing.push('창호 조건');
  return {amount,normalized:missing.length?null:normalized,missing,vat,waste,windowState,vatAmount,wasteAmount,windowAmount};
}
function stateLabel(type,v){
  const map={vat:{included:'포함',separate:'별도',unknown:'미기재'},waste:{included:'포함',separate:'별도',unknown:'미기재'},window:{included:'포함',excluded:'제외',none:'해당없음',unknown:'미기재'}};return map[type]?.[v]||v;
}
function toggleAddons(card){
  const vat=qs(card,'[data-v8-vat]')?.value,waste=qs(card,'[data-v8-waste]')?.value,windowState=qs(card,'[data-v8-window]')?.value;
  qs(card,'[data-v8-vat-addon]')?.classList.toggle('is-on',vat==='separate');
  qs(card,'[data-v8-waste-addon]')?.classList.toggle('is-on',waste==='separate');
  qs(card,'[data-v8-window-addon]')?.classList.toggle('is-on',windowState==='excluded');
}
function initTriple(root){
  const cards=qsa(root,'[data-v8-quote]'),storageKey='interior-v8-triple-quote';
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(Array.isArray(saved))cards.forEach((card,i)=>{const row=saved[i]||{};qsa(card,'[data-v8-field]').forEach(el=>{if(row[el.dataset.v8Field]!=null)el.value=row[el.dataset.v8Field]})})}catch{}
  const render=()=>{
    const vals=cards.map(card=>{toggleAddons(card);return quoteValue(card)}),complete=vals.filter(v=>v.normalized!=null),numbers=complete.map(v=>v.normalized),min=numbers.length?Math.min(...numbers):0,max=numbers.length?Math.max(...numbers):0;
    cards.forEach((card,i)=>{const v=vals[i],out=qs(card,'[data-v8-result]'),note=qs(card,'[data-v8-result-note]');if(out)out.textContent=v.normalized==null?'조건 미완성':won(v.normalized);if(note)note.textContent=v.missing.length?`확인: ${v.missing.join(' · ')}`:'비교조건 반영 완료'});
    const range=qs(root,'[data-v8-range]');if(range){range.innerHTML=vals.map((v,i)=>{const label=String.fromCharCode(65+i);if(v.normalized==null)return `<div class="v8-range-row"><span>견적 ${label}</span><div class="v8-track"></div><strong>보류</strong></div>`;const x=max===min?50:((v.normalized-min)/(max-min))*100;return `<div class="v8-range-row"><span>견적 ${label}</span><div class="v8-track"><i class="v8-dot" style="--x:${x.toFixed(1)}%"></i></div><strong>${won(v.normalized)}</strong></div>`}).join('')}
    const body=qs(root,'[data-v8-condition-body]');if(body){const row=(name,type,key)=>`<tr><th>${name}</th>${vals.map(v=>`<td>${esc(stateLabel(type,v[key]))}</td>`).join('')}</tr>`;body.innerHTML=row('VAT','vat','vat')+row('폐기물','waste','waste')+row('창호','window','windowState')}
    const status=qs(root,'[data-v8-compare-status]');if(status){if(complete.length<2)status.textContent='비교 가능한 견적이 2개 이상 필요';else{const spread=max-min;status.textContent=`조건 맞춘 총액 범위 ${won(min)} ~ ${won(max)} · 차이 ${won(spread)}`}}
    const save=cards.map(card=>Object.fromEntries(qsa(card,'[data-v8-field]').map(el=>[el.dataset.v8Field,el.value])));try{localStorage.setItem(storageKey,JSON.stringify(save))}catch{}
  };
  qsa(root,'input,select').forEach(el=>el.addEventListener('input',render));
  qs(root,'[data-v8-reset]')?.addEventListener('click',()=>{cards.forEach(card=>qsa(card,'input').forEach(x=>x.value=''));cards.forEach(card=>qsa(card,'select').forEach(x=>x.selectedIndex=0));try{localStorage.removeItem(storageKey)}catch{}render()});
  qs(root,'[data-v8-copy]')?.addEventListener('click',async()=>{const vals=cards.map(quoteValue);const lines=vals.map((v,i)=>`견적 ${String.fromCharCode(65+i)}: 입력 ${v.amount??'—'}만원 / 조건반영 ${v.normalized??'보류'}${v.missing.length?` / 미확인 ${v.missing.join(', ')}`:''}`);const text=['인테리어 3견적 비교',...lines,'※ 조건반영 총액은 입력한 별도금액만 더한 단순 비교값이며 적정가격 판정이 아닙니다.'].join('\n');try{await navigator.clipboard.writeText(text);const b=qs(root,'[data-v8-copy]');if(b){const old=b.textContent;b.textContent='복사됨';setTimeout(()=>b.textContent=old,1200)}}catch{}});
  render();
}

function initUnitExplorer(root){
  const rows=qsa(root,'[data-v8-unit-row]'),search=qs(root,'[data-v8-unit-search]'),group=qs(root,'[data-v8-unit-group]'),unit=qs(root,'[data-v8-unit-unit]'),count=qs(root,'[data-v8-unit-count]'),compare=qs(root,'[data-v8-unit-compare]');
  const filter=()=>{const q=(search?.value||'').trim().toLowerCase(),g=group?.value||'',u=unit?.value||'';let n=0;rows.forEach(r=>{const text=(r.dataset.search||r.textContent).toLowerCase(),show=(!q||text.includes(q))&&(!g||r.dataset.group===g)&&(!u||r.dataset.unit===u);r.hidden=!show;if(show)n++});if(count)count.textContent=`${n}개 표시`;renderCompare()};
  const renderCompare=()=>{if(!compare)return;const picked=rows.filter(r=>qs(r,'[data-v8-unit-pick]')?.checked);if(!picked.length){compare.innerHTML='<p class="v8-footnote">비교할 항목을 선택하세요. 같은 단위끼리만 막대가 표시됩니다.</p>';return}const units=[...new Set(picked.map(r=>r.dataset.unit))];if(units.length>1){compare.innerHTML='<p class="v8-footnote">㎡, m, ㎥ 등 단위가 다른 공종은 막대로 직접 비교하지 않습니다.</p>';return}const values=picked.map(r=>num(r.dataset.price)||0),max=Math.max(...values,1);compare.innerHTML=picked.map((r,i)=>`<div class="v8-unit-bar"><span><code>${esc(r.dataset.code)}</code> ${esc(r.dataset.name)}</span><div class="v8-unit-bar-track"><div class="v8-unit-bar-fill" style="--w:${(values[i]/max*100).toFixed(1)}%"></div></div><strong>${Math.round(values[i]).toLocaleString('ko-KR')}원/${esc(r.dataset.unit)}</strong></div>`).join('')+'<p class="v8-footnote">막대는 선택한 동일 단위 항목 사이의 금액 크기만 표시합니다. 공종 정의·포함재료가 달라 적정가격 순위가 아닙니다.</p>'};
  [search,group,unit].filter(Boolean).forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',filter));qsa(root,'[data-v8-unit-pick]').forEach(el=>el.addEventListener('change',renderCompare));filter();
}

document.querySelectorAll('[data-v8-triple]').forEach(initTriple);
document.querySelectorAll('[data-v8-unit-explorer]').forEach(initUnitExplorer);
})();

/* app-v9.js */
(()=>{
  const money=n=>Number.isFinite(n)?`${Math.round(n).toLocaleString('ko-KR')}만원`:'—';
  const text=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
  function rowState(row,vendor){
    const state=row.querySelector(`[data-vendor="${vendor}"][data-state]`)?.value||'missing';
    const amount=Number(row.querySelector(`[data-vendor="${vendor}"][data-amount]`)?.value||0);
    return {state,amount:Number.isFinite(amount)?amount:0};
  }
  function renderMatrix(){
    const host=document.querySelector('[data-v9-compare-matrix]');
    const root=document.querySelector('[data-compare-table]');
    if(!host||!root)return;
    const rows=[...root.querySelectorAll('[data-compare-row]')];
    const vendors=['a','b','c'];
    const summary={a:{included:0,separate:0,missing:0,amount:0},b:{included:0,separate:0,missing:0,amount:0},c:{included:0,separate:0,missing:0,amount:0}};
    const body=host.querySelector('[data-v9-matrix-body]');
    body.innerHTML=rows.map(row=>{
      const label=text(row.querySelector('h3')).replace(/조건 다름|차이/g,'').trim();
      const cells=vendors.map(v=>{
        const s=rowState(row,v);summary[v][s.state]=(summary[v][s.state]||0)+1;summary[v].amount+=s.amount;
        const cls=s.state==='missing'?'missing':s.state==='separate'?'separate':'included';
        const stateLabel=s.state==='included'?'포함':s.state==='separate'?'별도':'미기재';
        return `<td class="${cls}">${stateLabel}${s.amount>0?` · ${money(s.amount)}`:''}</td>`;
      }).join('');
      return `<tr><th>${label}</th>${cells}</tr>`;
    }).join('')||'<tr><td colspan="4">비교 항목 없음</td></tr>';
    vendors.forEach(v=>{
      const box=host.querySelector(`[data-v9-summary="${v}"]`);if(!box)return;
      const s=summary[v];box.querySelector('[data-v9-summary-main]').textContent=`미기재 ${s.missing} · 별도 ${s.separate}`;
      box.querySelector('[data-v9-summary-sub]').textContent=`입력금액 합계 ${money(s.amount)}`;
    });
    const flags=vendors.map(v=>summary[v].missing===0);
    const gate=host.querySelector('[data-v9-condition-gate]');
    if(gate)gate.textContent=flags.every(Boolean)?'A/B/C 조건 기재 완료 · 금액 구성 비교 가능':'미기재 조건 있음 · 최저가/적정가 판단 보류';
  }
  function bindMatrix(){
    if(!document.querySelector('[data-v9-compare-matrix]'))return;
    document.addEventListener('input',e=>{if(e.target.matches('[data-compare-table] input,[data-compare-table] select'))renderMatrix()});
    document.addEventListener('change',e=>{if(e.target.matches('[data-compare-table] input,[data-compare-table] select'))renderMatrix()});
    renderMatrix();
  }
  function bindTopicFilter(){
    const input=document.querySelector('[data-v9-topic-search]');if(!input)return;
    const cards=[...document.querySelectorAll('[data-v9-topic-item]')];
    const run=()=>{const q=input.value.trim().toLowerCase();cards.forEach(c=>c.hidden=q&&!c.dataset.v9TopicItem.toLowerCase().includes(q))};
    input.addEventListener('input',run);
  }
  function boot(){bindMatrix();bindTopicFilter()}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();

/* app-v10.js */
(()=>{
  const $$=(s,r=document)=>[...r.querySelectorAll(s)],$=(s,r=document)=>r.querySelector(s);
  const fmt=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1});
  const categories=[
    ['demolition','철거',['철거','철거비','철거공사']],['waste','폐기물',['폐기물','폐기','폐기비']],['waterproof','방수',['방수','액체방수','도막방수','시트방수']],['bathroom','욕실',['욕실','화장실','욕실공사']],['kitchen','주방',['주방','싱크','싱크대','상판']],['wallpaper','도배',['도배','벽지']],['flooring','바닥',['바닥','마루','장판','강마루']],['carpentry','목공',['목공','석고','천장','몰딩','걸레받이']],['electrical','전기',['전기','조명','콘센트','스위치']],['window','창호',['샷시','창호','창문','코킹']],['management','관리비',['현장관리','관리비','공과잡비','잡비']],['vat','VAT',['부가세','VAT','vat']]
  ];
  const numFrom=(line)=>{
    const m=String(line).match(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*(만원|원)?/);if(!m)return null;
    const raw=Number(m[1].replaceAll(',',''));if(!Number.isFinite(raw))return null;
    const unit=m[2]||'만원';return {raw,unit,manwon:unit==='원'?raw/10000:raw};
  };
  function classifyLine(line){
    const text=String(line).trim();if(!text)return null;
    const amount=numFrom(text),hits=categories.filter(([, ,keys])=>keys.some(k=>text.toLowerCase().includes(k.toLowerCase())));
    const selected=hits[0]||['unmatched','미분류',[]];
    return {line:text,key:selected[0],label:selected[1],amount_manwon:amount?Number(amount.manwon.toFixed(2)):null,amount_unit:amount?.unit||null,confidence:hits.length===1?'high':'review',matches:hits.map(x=>x[1])};
  }
  function renderPaste(root,rows){
    const body=$('[data-v10-paste-body]',root),valid=rows.filter(x=>x&&x.key!=='unmatched'),review=rows.filter(x=>x&&x.confidence==='review'),sum=valid.reduce((s,x)=>s+(Number.isFinite(x.amount_manwon)?x.amount_manwon:0),0);
    if(body)body.innerHTML=rows.length?rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r.line.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}</td><td>${r.label}</td><td>${Number.isFinite(r.amount_manwon)?fmt(r.amount_manwon)+'만원':'—'}</td><td class="${r.confidence==='high'?'v10-confidence-high':'v10-confidence-review'}">${r.confidence==='high'?'높음':'검토 필요'}</td></tr>`).join(''):'<tr><td colspan="5">분석 전</td></tr>';
    const set=(s,v)=>{const e=$(s,root);if(e)e.textContent=v};set('[data-v10-lines]',`${rows.length}줄`);set('[data-v10-matched]',`${valid.length}줄`);set('[data-v10-review]',`${review.length}줄`);set('[data-v10-sum]',`${fmt(sum)}만원`);
    root._v10Rows=rows;
    const send=$('[data-v10-send-a]',root),exp=$('[data-v10-export]',root);if(send)send.disabled=!valid.length;if(exp)exp.disabled=!valid.length;
  }
  function initPaste(){
    $$('[data-v10-paste-tool]').forEach(root=>{
      const ta=$('[data-v10-paste]',root),run=$('[data-v10-run]',root),example=$('[data-v10-example]',root),send=$('[data-v10-send-a]',root),exp=$('[data-v10-export]',root);
      const analyze=()=>renderPaste(root,String(ta?.value||'').split(/\r?\n/).map(classifyLine).filter(Boolean));
      run?.addEventListener('click',analyze);
      example?.addEventListener('click',()=>{if(ta)ta.value='철거 320만원\n폐기물 90만원\n욕실 2개 860만원\n주방 싱크대 780만원\n도배 310만원\n강마루 420만원\n전기 조명 210만원\n샷시 1,450만원\n부가세 별도';analyze()});
      exp?.addEventListener('click',()=>{const rows=(root._v10Rows||[]).filter(x=>x.key!=='unmatched');const blob=new Blob([JSON.stringify({version:'10.0.0',rows},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='normalized-quote-lines.json';a.click();URL.revokeObjectURL(a.href)});
      send?.addEventListener('click',()=>{const map={};for(const r of root._v10Rows||[]){if(r.key==='unmatched'||r.key==='vat'||!Number.isFinite(r.amount_manwon))continue;map[r.key]=(map[r.key]||0)+r.amount_manwon}localStorage.setItem('interior-v10-import-a',JSON.stringify(map));location.href='/pm-lab/interior-cost-stratton-v33-preview/quote-compare/#v10-import'});
    });
  }
  function hydrateCompareImport(){
    const raw=localStorage.getItem('interior-v10-import-a');if(!raw||!$('[data-compare-table]'))return;
    try{const map=JSON.parse(raw);for(const [key,val] of Object.entries(map)){const row=$(`[data-compare-row="${CSS.escape(key)}"]`);if(!row)continue;const amount=$('[data-vendor="a"][data-amount]',row),state=$('[data-vendor="a"][data-state]',row);if(amount){amount.value=String(Math.round(Number(val)*100)/100);amount.dispatchEvent(new Event('input',{bubbles:true}))}if(state){state.value='included';state.dispatchEvent(new Event('change',{bubbles:true}))}}localStorage.removeItem('interior-v10-import-a');const note=document.createElement('p');note.className='v10-import-note';note.textContent='붙여넣기에서 분류한 공종 금액을 A업체 칸에 반영했습니다. 자동 분류 결과를 원문 견적서와 다시 대조하세요.';const target=$('[data-v9-compare-matrix]')||$('[data-compare-table]');target?.prepend(note)}catch{}
  }
  function initIndexTool(){
    $$('[data-v10-index-tool]').forEach(root=>{
      let series=[];try{series=JSON.parse($('[data-v10-index-series]',root)?.textContent||'[]')}catch{}
      const start=$('[data-v10-index-start]',root),end=$('[data-v10-index-end]',root),res=$('[data-v10-index-result]',root),note=$('[data-v10-index-note]',root);
      const calc=()=>{const a=series.find(x=>x.month===start?.value),b=series.find(x=>x.month===end?.value);if(!a||!b||!res)return;const pct=(Number(b.value)/Number(a.value)-1)*100;res.textContent=`${pct>=0?'+':''}${pct.toFixed(2)}%`;if(note)note.textContent=`${a.month} ${a.value} → ${b.month} ${b.value} · 지수 변화 계산이며 개별 인테리어 견적 상승률이 아닙니다.`};
      start?.addEventListener('change',calc);end?.addEventListener('change',calc);calc();
    });
  }
  function initCombo(){
    $$('[data-v10-combo-tool]').forEach(root=>{
      const out=$('[data-v10-combo-output]',root),count=$('[data-v10-combo-count]',root);
      const render=()=>{const checked=$$('input[data-v10-combo]:checked',root);if(count)count.textContent=`${checked.length}개 공종군 선택`;if(out)out.innerHTML=checked.length?`<ul>${checked.map(x=>`<li><strong>${x.dataset.label}</strong> — ${x.dataset.note}</li>`).join('')}</ul><p>서로 다른 규격·단위의 공공단가를 한 금액으로 합산하지 않습니다. 선택 결과는 견적 범위 누락을 점검하는 용도입니다.</p>`:'<p>공종군을 선택하면 확인할 범위를 정리합니다.</p>'};
      $$('input[data-v10-combo]',root).forEach(x=>x.addEventListener('change',render));render();
    });
  }
  function initAnswerFilter(){
    $$('[data-v10-answer-hub]').forEach(root=>{
      const q=$('[data-v10-answer-q]',root),cat=$('[data-v10-answer-category]',root);const apply=()=>{const needle=String(q?.value||'').trim().toLowerCase(),c=cat?.value||'';$$('[data-v10-answer-card]',root).forEach(card=>{const okText=!needle||String(card.dataset.search||'').toLowerCase().includes(needle),okCat=!c||card.dataset.category===c;card.hidden=!(okText&&okCat)})};q?.addEventListener('input',apply);cat?.addEventListener('change',apply)
    });
  }
  function initRegionFilter(){
    $$('[data-v10-region-index]').forEach(root=>{const q=$('[data-v10-region-q]',root);q?.addEventListener('input',()=>{const n=q.value.trim().toLowerCase();$$('[data-v10-region-card]',root).forEach(x=>x.hidden=n&&!String(x.dataset.search||'').toLowerCase().includes(n))})})
  }
  document.addEventListener('DOMContentLoaded',()=>{initPaste();hydrateCompareImport();initIndexTool();initCombo();initAnswerFilter();initRegionFilter()});
})();

/* app-v11.js */
(()=>{
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const batchKey='interior-v11-intake-batch';
  const fields=['sample_id','quote_month','region_level1','supply_pyeong','exclusive_pyeong','building_type','scope','bathroom_count','window_scope','vat_state','waste_state','total_amount_manwon','demolition_manwon','waste_manwon','waterproof_manwon','bathroom_manwon','kitchen_manwon','wallpaper_manwon','flooring_manwon','carpentry_manwon','electrical_manwon','window_manwon','management_manwon'];
  const numeric=new Set(['supply_pyeong','exclusive_pyeong','bathroom_count','total_amount_manwon','demolition_manwon','waste_manwon','waterproof_manwon','bathroom_manwon','kitchen_manwon','wallpaper_manwon','flooring_manwon','carpentry_manwon','electrical_manwon','window_manwon','management_manwon']);
  const required=new Set(['sample_id','quote_month','region_level1','supply_pyeong','building_type','scope','bathroom_count','window_scope','vat_state','waste_state','total_amount_manwon']);
  const csvCell=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s};
  const loadBatch=()=>{try{return JSON.parse(localStorage.getItem(batchKey)||'[]')}catch{return []}};
  const saveBatch=rows=>localStorage.setItem(batchKey,JSON.stringify(rows));
  const id=()=>`Q${new Date().toISOString().slice(2,10).replaceAll('-','')}_${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  function collect(root){
    const row={},errors=[];
    for(const f of fields){const el=$(`[data-v11-field="${CSS.escape(f)}"]`,root);if(!el)continue;let v=String(el.value??'').trim();if(v===''&&!required.has(f)){row[f]='';continue}if(v===''&&required.has(f)){errors.push(`${f}: 필수`);continue}if(numeric.has(f)){const n=Number(v);if(!Number.isFinite(n)){errors.push(`${f}: 숫자`);continue}v=n}row[f]=v}
    if(row.sample_id&&!/^[A-Za-z0-9_-]{3,40}$/.test(row.sample_id))errors.push('sample_id: 영문·숫자·_·- 3~40자');
    if(row.quote_month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.quote_month))errors.push('quote_month: YYYY-MM');
    if(Number(row.supply_pyeong)<5||Number(row.supply_pyeong)>100)errors.push('supply_pyeong: 5~100');
    if(Number(row.total_amount_manwon)<=0)errors.push('total_amount_manwon: 0보다 커야 함');
    if(Number(row.bathroom_count)<0||Number(row.bathroom_count)>5||!Number.isInteger(Number(row.bathroom_count)))errors.push('bathroom_count: 0~5 정수');
    return {row,errors};
  }
  function renderBatch(root){
    const rows=loadBatch(),box=$('[data-v11-batch-list]',root),count=$('[data-v11-batch-count]',root);if(count)count.textContent=`${rows.length}건`;
    if(box)box.innerHTML=rows.length?rows.map((r,i)=>`<div class="v11-batch-row"><div><strong>${esc(r.sample_id)} · ${esc(r.region_level1)} · ${esc(r.supply_pyeong)}평</strong><span>${esc(r.quote_month)} · ${esc(r.scope)} · ${Number(r.total_amount_manwon).toLocaleString('ko-KR')}만원</span></div><button type="button" data-v11-remove="${i}">삭제</button></div>`).join(''):'<p>브라우저에 저장된 익명 견적 행이 없습니다.</p>';
    $$('[data-v11-remove]',box||root).forEach(btn=>btn.addEventListener('click',()=>{const a=loadBatch();a.splice(Number(btn.dataset.v11Remove),1);saveBatch(a);renderBatch(root)}));
    const exp=$('[data-v11-export-csv]',root),clear=$('[data-v11-clear-batch]',root);if(exp)exp.disabled=!rows.length;if(clear)clear.disabled=!rows.length;
  }
  function exportCsv(root){const rows=loadBatch();if(!rows.length)return;const text=[fields.join(','),...rows.map(r=>fields.map(f=>csvCell(r[f]??'')).join(','))].join('\n');const blob=new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='anonymous-interior-quotes.csv';a.click();URL.revokeObjectURL(a.href)}
  function initIntake(){
    $$('[data-v11-intake]').forEach(root=>{
      const sample=$('[data-v11-field="sample_id"]',root),month=$('[data-v11-field="quote_month"]',root),msg=$('[data-v11-message]',root);if(sample&&!sample.value)sample.value=id();if(month&&!month.value)month.value=new Date().toISOString().slice(0,7);
      $('[data-v11-new-id]',root)?.addEventListener('click',()=>{if(sample)sample.value=id()});
      $('[data-v11-add-row]',root)?.addEventListener('click',()=>{const {row,errors}=collect(root);if(errors.length){if(msg){msg.className='v11-message error';msg.textContent=errors.join(' · ')}return}const rows=loadBatch();if(rows.some(x=>x.sample_id===row.sample_id)){if(msg){msg.className='v11-message error';msg.textContent='같은 sample_id가 이미 있습니다.'}return}rows.push(row);saveBatch(rows);if(msg){msg.className='v11-message ok';msg.textContent='익명 견적 1건을 이 브라우저에 저장했습니다.'}if(sample)sample.value=id();renderBatch(root)});
      $('[data-v11-export-csv]',root)?.addEventListener('click',()=>exportCsv(root));
      $('[data-v11-clear-batch]',root)?.addEventListener('click',()=>{if(confirm('브라우저에 저장한 익명 견적 행을 모두 지울까요?')){saveBatch([]);renderBatch(root)}});
      $('[data-v11-load-example]',root)?.addEventListener('click',()=>{const vals={region_level1:'서울',supply_pyeong:'32',exclusive_pyeong:'25.7',building_type:'아파트',scope:'올수리',bathroom_count:'2',window_scope:'제외',vat_state:'포함',waste_state:'포함',total_amount_manwon:'4500',demolition_manwon:'350',waste_manwon:'80',bathroom_manwon:'850',kitchen_manwon:'700',wallpaper_manwon:'300',flooring_manwon:'400',electrical_manwon:'180'};for(const [k,v] of Object.entries(vals)){const el=$(`[data-v11-field="${CSS.escape(k)}"]`,root);if(el)el.value=v}});
      renderBatch(root);
    });
  }
  function initCoverage(){
    $$('[data-v11-coverage]').forEach(root=>{const sel=$('[data-v11-region-filter]',root);sel?.addEventListener('change',()=>{const v=sel.value;$$('[data-v11-coverage-row]',root).forEach(row=>row.hidden=!!v&&row.dataset.region!==v)})});
  }
  function initCopy(){
    $$('[data-v11-copy]').forEach(btn=>btn.addEventListener('click',async()=>{const text=btn.dataset.v11Copy||'';try{await navigator.clipboard.writeText(text);const old=btn.textContent;btn.textContent='복사됨';setTimeout(()=>btn.textContent=old,1200)}catch{}}));
  }
  document.addEventListener('DOMContentLoaded',()=>{initIntake();initCoverage();initCopy()});
})();

/* app-v12.js */
(()=>{
  const $$=(s,r=document)=>[...r.querySelectorAll(s)],$=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const splitCsv=text=>{const rows=[];let row=[],cell='',q=false;const src=String(text||'').replace(/^\ufeff/,'');for(let i=0;i<src.length;i++){const ch=src[i];if(q){if(ch==='"'&&src[i+1]==='"'){cell+='"';i++}else if(ch==='"')q=false;else cell+=ch}else if(ch==='"')q=true;else if(ch===','){row.push(cell);cell=''}else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell=''}else if(ch!=='\r')cell+=ch}if(cell.length||row.length){row.push(cell);rows.push(row)}return rows.filter(r=>r.some(x=>String(x).trim()!==''))};
  const csvCell=v=>{const s=String(v??'');return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s};
  const parseBatch=(text,schema)=>{const m=splitCsv(text);if(!m.length)return {errors:['CSV가 비어 있습니다.'],rows:[],header:[]};const header=m[0].map(x=>x.trim()),props=schema.properties||{},allowed=new Set(Object.keys(props)),unknown=header.filter(x=>!allowed.has(x)),missing=(schema.required||[]).filter(x=>!header.includes(x)),errors=[];if(unknown.length)errors.push(`허용하지 않는 열: ${unknown.join(', ')}`);if(missing.length)errors.push(`필수 열 누락: ${missing.join(', ')}`);if(errors.length)return {errors,rows:[],header};const ids=new Set(),rows=[];m.slice(1).forEach((cells,idx)=>{const r={};header.forEach((h,i)=>r[h]=String(cells[i]??'').trim());const errs=[];for(const k of schema.required||[])if(r[k]==='')errs.push(`${k} 필수`);if(r.sample_id){if(ids.has(r.sample_id))errs.push('sample_id 중복');ids.add(r.sample_id)}for(const [k,rule] of Object.entries(props)){if(r[k]===''||r[k]==null)continue;if(rule.enum&&!rule.enum.includes(r[k]))errs.push(`${k} 허용값 아님`);const types=Array.isArray(rule.type)?rule.type:[rule.type];if(types.includes('number')||types.includes('integer')){const n=Number(r[k]);if(!Number.isFinite(n))errs.push(`${k} 숫자 아님`);else{r[k]=n;if(types.includes('integer')&&!Number.isInteger(n))errs.push(`${k} 정수 아님`);if(rule.minimum!=null&&n<rule.minimum)errs.push(`${k} 최소값 미만`);if(rule.maximum!=null&&n>rule.maximum)errs.push(`${k} 최대값 초과`);if(rule.exclusiveMinimum!=null&&n<=rule.exclusiveMinimum)errs.push(`${k} 0보다 커야 함`)}}if(rule.pattern&&!new RegExp(rule.pattern).test(String(r[k])))errs.push(`${k} 형식 불일치`)}rows.push({row:r,line:idx+2,errors:errs})});return {errors:[],rows,header}};
  const signature=r=>[r.quote_month,r.region_level1,Number(r.supply_pyeong).toFixed(1),r.building_type,r.scope,r.bathroom_count,r.window_scope,r.vat_state,r.waste_state,Number(r.total_amount_manwon).toFixed(1)].join('|');
  const reviewRows=valid=>{const sig=new Map();valid.forEach(x=>{const k=signature(x.row);if(!sig.has(k))sig.set(k,[]);sig.get(k).push(x)});const dup=new Set([...sig.values()].filter(x=>x.length>1).flat());return valid.map(x=>{const r=x.row,reasons=[];if(dup.has(x))reasons.push('중복 의심');if(r.exclusive_pyeong!==''&&Number(r.exclusive_pyeong)>Number(r.supply_pyeong))reasons.push('전용>공급');const total=Number(r.total_amount_manwon),trades=Object.entries(r).filter(([k,v])=>k.endsWith('_manwon')&&k!=='total_amount_manwon'&&v!==''&&Number.isFinite(Number(v))).map(([,v])=>Number(v)),sum=trades.reduce((a,b)=>a+b,0);if(sum>total*1.05)reasons.push('공종합>총액');if(trades.some(v=>v>total))reasons.push('공종>총액');return {...x,reasons,status:x.errors.length?'blocked':reasons.length?'review':'clean'}})};
  function initBatch(){$$('[data-v12-batch]').forEach(async root=>{let schema={};try{schema=await fetch('/pm-lab/interior-cost-stratton-v33-preview/data/quote-sample-schema.json').then(r=>r.json())}catch{}const ta=$('[data-v12-batch-text]',root),file=$('[data-v12-batch-file]',root),run=$('[data-v12-batch-run]',root),body=$('[data-v12-batch-body]',root),msg=$('[data-v12-batch-msg]',root),exp=$('[data-v12-batch-export]',root);let last=null;file?.addEventListener('change',async()=>{const f=file.files?.[0];if(f&&ta)ta.value=await f.text()});run?.addEventListener('click',()=>{const p=parseBatch(ta?.value||'',schema);if(p.errors.length){msg.textContent=p.errors.join(' · ');body.innerHTML='<tr><td colspan="5">검증 차단</td></tr>';exp.disabled=true;return}const rows=reviewRows(p.rows),clean=rows.filter(x=>x.status==='clean'),review=rows.filter(x=>x.status==='review'),blocked=rows.filter(x=>x.status==='blocked');last={header:p.header,rows};msg.textContent=`전체 ${rows.length} · 정상 ${clean.length} · 검토 ${review.length} · 차단 ${blocked.length}`;body.innerHTML=rows.slice(0,100).map(x=>`<tr><td>${x.line}</td><td>${esc(x.row.sample_id||'')}</td><td>${x.status==='clean'?'정상':x.status==='review'?'검토':'차단'}</td><td>${esc((x.errors||[]).join(' / ')||(x.reasons||[]).join(' / ')||'—')}</td><td>${esc(x.row.region_level1||'')} · ${esc(x.row.supply_pyeong||'')}평</td></tr>`).join('')||'<tr><td colspan="5">행 없음</td></tr>';exp.disabled=!clean.length});exp?.addEventListener('click',()=>{if(!last)return;const usable=last.rows.filter(x=>x.status==='clean').map(x=>x.row),text=[last.header.join(','),...usable.map(r=>last.header.map(h=>csvCell(r[h])).join(','))].join('\n'),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.download='quote-batch-clean.csv';a.click();URL.revokeObjectURL(a.href)})})}
  function initTarget(){$$('[data-v12-targets]').forEach(root=>{const q=$('[data-v12-target-q]',root),state=$('[data-v12-target-state]',root);const apply=()=>{const n=(q?.value||'').trim().toLowerCase(),s=state?.value||'';$$('[data-v12-target-row]',root).forEach(x=>{const ok=(!n||(x.dataset.search||'').toLowerCase().includes(n))&&(!s||x.dataset.state===s);x.hidden=!ok})};q?.addEventListener('input',apply);state?.addEventListener('change',apply)})}
  function initProduction(){$$('[data-v12-prod-sim]').forEach(root=>{$$('[data-v12-prod-filter]',root).forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.v12ProdFilter;$$('[data-v12-prod-row]',root).forEach(r=>r.hidden=v!=='all'&&r.dataset.state!==v)}))})}
  document.addEventListener('DOMContentLoaded',()=>{initBatch();initTarget();initProduction()});
})();

/* app-v13.js */
(()=>{
  const $$=(s,r=document)=>[...r.querySelectorAll(s)],$=(s,r=document)=>r.querySelector(s);
  function initFilters(){
    $$('[data-v13-filter-root]').forEach(root=>{
      const q=$('[data-v13-q]',root),kind=$('[data-v13-kind]',root),rows=$$('[data-v13-row]',root);
      const apply=()=>{const n=(q?.value||'').trim().toLowerCase(),k=kind?.value||'';for(const row of rows){const okN=!n||(row.dataset.search||'').toLowerCase().includes(n),okK=!k||row.dataset.kind===k;row.hidden=!(okN&&okK)}};
      q?.addEventListener('input',apply);kind?.addEventListener('change',apply);apply();
    });
  }
  document.addEventListener('DOMContentLoaded',initFilters);
})();

/* v14 launch rehearsal: no extra runtime dependency */

/* v15 RC */

/* v16 staged index release */
