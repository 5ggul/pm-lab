(() => {
  'use strict';

  const QUOTE_KEY='interior-quote-v5';
  const COMPARE_KEYS=['interior-compare-v6','interior-compare-v5'];
  const ITEMS=[
    ['demolition','철거'],['waste','폐기물'],['waterproof','방수'],['bathroom','욕실'],['kitchen','주방'],['wallpaper','도배'],['flooring','바닥'],['carpentry','목공'],['electrical','전기'],['window','샷시'],['management','현장관리비'],['vat','VAT']
  ];
  const VENDORS=['a','b','c'];
  const $=(s,r=document)=>r.querySelector(s);

  function getJSON(key,fallback=null){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
  function safe(v){return v==null?'':String(v)}
  function amount(v){const text=safe(v).trim();if(!text)return null;const n=Number(text);return Number.isFinite(n)?n:null}
  function money(v){return `${Number(v||0).toLocaleString('ko-KR')}만원`}
  function stateLabel(v){return v==='included'?'포함':v==='separate'?'별도':'미기재'}
  function compareValue(compare,id,vendor,kind){return safe(compare?.[`${id}:${vendor}:${kind}`])}
  function hasOwnData(obj){return !!obj&&typeof obj==='object'&&Object.keys(obj).length>0}

  function loadData(){
    const quote=getJSON(QUOTE_KEY,null);
    let compare=null;
    for(const key of COMPARE_KEYS){const candidate=getJSON(key,null);if(hasOwnData(candidate)){compare=candidate;break}}
    return {quote,compare};
  }

  function quoteItem(quote,id){
    const item=quote?.items?.[id]||{};
    return {state:['included','separate','missing'].includes(item.state)?item.state:'missing',amount:safe(item.amount),qty:safe(item.qty),unit:safe(item.unit),spec:safe(item.spec),memo:safe(item.memo)};
  }

  function vendorActive(compare,vendor){
    return ITEMS.some(([id])=>compareValue(compare,id,vendor,'state')!=='missing'&&compareValue(compare,id,vendor,'state')!==''||compareValue(compare,id,vendor,'amount').trim()!=='');
  }

  function vendorSummary(compare,vendor){
    let total=0,used=0;
    for(const [id] of ITEMS){
      const state=compareValue(compare,id,vendor,'state')||'missing';
      const raw=compareValue(compare,id,vendor,'amount');
      const n=amount(raw);
      if(state!=='missing'||raw.trim())used++;
      if(n!==null)total+=n;
    }
    return {total,used,active:used>0};
  }

  function itemFlags(data,id){
    const flags=[];
    const q=data.quote?quoteItem(data.quote,id):null;
    if(q){
      if(q.state==='separate')flags.push('원본 견적 별도');
      if(q.state==='missing')flags.push('원본 견적 미기재');
      if(q.state!=='missing'&&!q.amount.trim())flags.push('원본 금액 미입력');
    }
    const active=VENDORS.filter(v=>vendorActive(data.compare,v));
    if(active.length>=2){
      const states=active.map(v=>compareValue(data.compare,id,v,'state')||'missing');
      if(new Set(states).size>1)flags.push('업체 포함조건 다름');
      const entered=active.map(v=>amount(compareValue(data.compare,id,v,'amount'))).filter(v=>v!==null);
      if(entered.length>=2){const min=Math.min(...entered),max=Math.max(...entered);if(max!==min)flags.push(`업체 금액 차이 ${money(max-min)}`)}
      const anyEntered=active.some(v=>compareValue(data.compare,id,v,'amount').trim());
      const anyBlank=active.some(v=>!compareValue(data.compare,id,v,'amount').trim());
      if(anyEntered&&anyBlank)flags.push('업체 금액 미입력 있음');
    }
    return flags;
  }

  function buildStateCell(state,rawAmount){
    const cell=document.createElement('div');
    const stateEl=document.createElement('span');stateEl.className='v43-state';stateEl.textContent=stateLabel(state||'missing');cell.append(stateEl);
    const amountEl=document.createElement('span');amountEl.className='v43-amount';const n=amount(rawAmount);amountEl.textContent=n===null?'—':money(n);cell.append(amountEl);
    return cell;
  }

  function contextText(quote){
    const labels={supply:'공급평수',exclusive:'전용평수',building:'건물유형',region:'지역',scope:'공사범위',bathrooms:'욕실 수'};
    const entries=Object.entries(quote?.context||{}).filter(([,v])=>safe(v).trim());
    return entries.map(([k,v])=>`${labels[k]||k} ${safe(v)}`);
  }

  function render(){
    const data=loadData();
    const hasQuote=hasOwnData(data.quote?.items)||hasOwnData(data.quote?.context);
    const hasCompare=hasOwnData(data.compare);
    const empty=$('[data-review-empty]'),main=$('[data-review-main]'),reviewSection=$('[data-review-section]'),detailSection=$('[data-detail-section]');
    if(!hasQuote&&!hasCompare){empty.hidden=false;main.hidden=true;reviewSection.hidden=true;detailSection.hidden=true;return {hasData:false}}
    empty.hidden=true;main.hidden=false;detailSection.hidden=false;

    let included=0,separate=0,missing=0,quoteTotal=0;
    if(hasQuote){for(const [id] of ITEMS){const item=quoteItem(data.quote,id);if(item.state==='included')included++;else if(item.state==='separate')separate++;else missing++;const n=amount(item.amount);if(n!==null)quoteTotal+=n}}
    $('[data-quote-total]').textContent=hasQuote?money(quoteTotal):'저장 없음';
    $('[data-included]').textContent=hasQuote?included:'—';$('[data-separate]').textContent=hasQuote?separate:'—';$('[data-missing]').textContent=hasQuote?missing:'—';

    const context=$('[data-context-summary]');context.replaceChildren();for(const text of contextText(data.quote)){const span=document.createElement('span');span.textContent=text;context.append(span)}

    for(const vendor of VENDORS){const summary=vendorSummary(data.compare,vendor);$(`[data-vendor-total="${vendor}"]`).textContent=summary.active?money(summary.total):'저장 없음';$(`[data-vendor-used="${vendor}"]`).textContent=summary.active?`${summary.used}개 항목 입력`:'비교값 없음'}

    const reviewItems=[];
    for(const [id,name] of ITEMS){const flags=itemFlags(data,id);if(flags.length)reviewItems.push({id,name,flags})}
    $('[data-review-count]').textContent=`${reviewItems.length}개`;
    const reviewList=$('[data-review-list]');reviewList.replaceChildren();
    if(reviewItems.length){reviewSection.hidden=false;for(const item of reviewItems){const article=document.createElement('article');article.className='v43-review-item';const h=document.createElement('h3');h.textContent=item.name;article.append(h);const flags=document.createElement('div');flags.className='v43-flags';for(const text of item.flags){const chip=document.createElement('span');chip.className='v43-flag';chip.textContent=text;flags.append(chip)}article.append(flags);reviewList.append(article)}}else{reviewSection.hidden=false;const p=document.createElement('p');p.className='v43-muted';p.textContent='현재 저장값 기준으로 별도 표시할 차이가 없습니다.';reviewList.append(p)}

    const tbody=$('[data-detail-body]');tbody.replaceChildren();
    for(const [id,name] of ITEMS){const tr=document.createElement('tr');const nameCell=document.createElement('th');nameCell.scope='row';nameCell.textContent=name;tr.append(nameCell);const q=hasQuote?quoteItem(data.quote,id):null;const qCell=document.createElement('td');qCell.append(buildStateCell(q?.state||'missing',q?.amount||''));tr.append(qCell);for(const vendor of VENDORS){const td=document.createElement('td');td.append(buildStateCell(compareValue(data.compare,id,vendor,'state')||'missing',compareValue(data.compare,id,vendor,'amount')));tr.append(td)}const point=document.createElement('td');const flags=itemFlags(data,id);point.textContent=flags.length?flags.join(' · '):'—';tr.append(point);tbody.append(tr)}

    return {hasData:true,hasQuote,hasCompare,quoteTotal,included,separate,missing,reviewItems,data};
  }

  function reportText(snapshot){
    if(!snapshot?.hasData)return '인테리어 견적 검수 리포트\n저장된 데이터가 없습니다.';
    const lines=['인테리어 견적 검수 리포트'];
    if(snapshot.hasQuote)lines.push(`저장 견적 합계 ${money(snapshot.quoteTotal)} · 기재 ${snapshot.included} · 별도 ${snapshot.separate} · 미기재 ${snapshot.missing}`);
    for(const vendor of VENDORS){const s=vendorSummary(snapshot.data.compare,vendor);if(s.active)lines.push(`${vendor.toUpperCase()} 업체 입력합계 ${money(s.total)} · ${s.used}개 항목 입력`)}
    lines.push(`확인 필요 항목 ${snapshot.reviewItems.length}개`);
    for(const item of snapshot.reviewItems)lines.push(`- ${item.name}: ${item.flags.join(', ')}`);
    lines.push('※ 저장된 조건 차이를 정리한 것이며 가격 적정성을 판정하지 않습니다.');
    return lines.join('\n');
  }

  let snapshot=render();
  $('[data-refresh-report]')?.addEventListener('click',()=>{snapshot=render()});
  $('[data-print-report]')?.addEventListener('click',()=>window.print());
  $('[data-copy-report]')?.addEventListener('click',async event=>{const button=event.currentTarget;const original=button.textContent;try{await navigator.clipboard.writeText(reportText(snapshot));button.textContent='복사됨'}catch{button.textContent='복사 실패'}setTimeout(()=>button.textContent=original,1200)});

  window.InteriorQuoteReview43={loadData,render,itemFlags,reportText,QUOTE_KEY,COMPARE_KEYS};
})();
