(() => {
  const BASE='/pm-lab/interior-cost-preview';
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

  const searchForm=$('[data-site-search]');
  if(searchForm){
    searchForm.addEventListener('submit',e=>{
      e.preventDefault();
      const q=$('input',searchForm).value.trim();
      if(q) location.href=`${BASE}/search/?q=${encodeURIComponent(q)}`;
    });
  }

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
    if(summary){
      summary.innerHTML=criticalDiff.length
        ? `<strong>단순 총액 비교 불가</strong><br>${criticalDiff.map(id=>coreItems.find(x=>x[0]===id)?.[1]).join(' · ')} 조건이 업체마다 다릅니다. 같은 조건으로 맞춘 뒤 금액을 비교하세요.`
        : `<strong>핵심 포함조건은 동일합니다.</strong><br>사양·수량이 같은지 확인한 뒤 금액 차이를 해석하세요.`;
    }
    const diffOnly=$('[data-diff-only]')?.checked;
    $$('[data-compare-row]').forEach(r=>r.hidden=!!diffOnly&&!r.classList.contains('has-diff'));
  }
  function initCompare(){
    if(!$('[data-compare-table]'))return;
    const saved=storage.get('interior-compare-v5');
    if(saved){
      Object.entries(saved).forEach(([key,v])=>{const el=$(`[data-compare-key="${key}"]`);if(el)el.value=v});
    }
    $$('[data-compare-key]').forEach(el=>el.addEventListener('input',updateCompare));
    $$('[data-compare-key]').forEach(el=>el.addEventListener('change',updateCompare));
    $('[data-diff-only]')?.addEventListener('change',updateCompare);
    $('[data-save-compare]')?.addEventListener('click',()=>{
      const d={};$$('[data-compare-key]').forEach(el=>d[el.dataset.compareKey]=el.value);storage.set('interior-compare-v5',d);toast('비교표를 저장했습니다.');
    });
    $('[data-reset-compare]')?.addEventListener('click',()=>{storage.del('interior-compare-v5');location.reload()});
    $('[data-print]')?.addEventListener('click',()=>window.print());
    updateCompare();
  }

  function initBudget(){
    const form=$('[data-budget-form]');if(!form)return;
    const saved=storage.get('interior-budget-v5',{});Object.entries(saved).forEach(([k,v])=>{const el=$(`[data-budget-key="${k}"]`);if(el)el.value=v});
    const calc=()=>{
      let subtotal=0;$$('[data-line-budget]',form).forEach(el=>subtotal+=Number(el.value||0));
      const vatMode=$('[data-vat-mode]',form)?.value||'included';
      const management=Number($('[data-management]',form)?.value||0);
      const reserve=Number($('[data-reserve]',form)?.value||0);
      const mgmt=subtotal*management/100, vat=vatMode==='separate'?(subtotal+mgmt)*0.10:0, buffer=(subtotal+mgmt+vat)*reserve/100, total=subtotal+mgmt+vat+buffer;
      $('[data-budget-subtotal]').textContent=`${fmt(Math.round(subtotal))}만원`;
      $('[data-budget-mgmt]').textContent=`${fmt(Math.round(mgmt))}만원`;
      $('[data-budget-vat]').textContent=`${fmt(Math.round(vat))}만원`;
      $('[data-budget-buffer]').textContent=`${fmt(Math.round(buffer))}만원`;
      $('[data-budget-total]').textContent=`${fmt(Math.round(total))}만원`;
    };
    form.addEventListener('input',calc);form.addEventListener('change',calc);calc();
    $('[data-save-budget]')?.addEventListener('click',()=>{const d={};$$('[data-budget-key]').forEach(el=>d[el.dataset.budgetKey]=el.value);storage.set('interior-budget-v5',d);toast('예산 시나리오를 저장했습니다.')});
    $('[data-reset-budget]')?.addEventListener('click',()=>{storage.del('interior-budget-v5');location.reload()});
    $('[data-print]')?.addEventListener('click',()=>window.print());
  }

  function initChecklist(){
    const root=$('[data-checklist]');if(!root)return;
    const key='interior-checklist-v5',saved=storage.get(key,{});
    $$('input[type=checkbox]',root).forEach(el=>{el.checked=!!saved[el.value];el.addEventListener('change',()=>{const d={};$$('input[type=checkbox]',root).forEach(x=>d[x.value]=x.checked);storage.set(key,d);update()})});
    const update=()=>{const all=$$('input[type=checkbox]',root),done=all.filter(x=>x.checked).length,pct=all.length?Math.round(done/all.length*100):0;$('[data-check-progress]').textContent=`${done} / ${all.length}`;$('[data-progress-bar]').style.width=`${pct}%`};
    update();$('[data-reset-checklist]')?.addEventListener('click',()=>{storage.del(key);$$('input[type=checkbox]',root).forEach(x=>x.checked=false);update()});$('[data-print]')?.addEventListener('click',()=>window.print());
  }

  function initOneSet(){
    const select=$('[data-one-set-select]'),host=$('[data-one-set-output]');if(!select||!host)return;
    const sets={
      bathroom:['철거','폐기물','방수','타일 자재','타일 시공','도기','수전','천장','환풍기','젠다이','배관','전기'],
      kitchen:['기존 가구 철거','상부장','하부장','상판','키큰장','아일랜드','싱크볼','수전','후드','급배수 이동','전기 회로','벽 타일'],
      window:['창별 수량','가로×세로 치수','내창/외창','프레임','유리 사양','철거','실리콘·마감','양중','사다리차','폐기물']
    };
    const render=()=>{const rows=sets[select.value]||[];host.innerHTML=`<ol>${rows.map(x=>`<li>${x}</li>`).join('')}</ol>`};select.addEventListener('change',render);render();
  }

  initSearchPage();initQuoteCheck();initCompare();initBudget();initChecklist();initOneSet();
})();