(() => {
  'use strict';

  const ITEMS=[['demolition','철거'],['waste','폐기물'],['waterproof','방수'],['bathroom','욕실'],['kitchen','주방'],['wallpaper','도배'],['flooring','바닥'],['carpentry','목공'],['electrical','전기'],['window','샷시'],['management','현장관리비'],['vat','VAT']];
  const VENDORS=['a','b','c'];
  const $=(s,r=document)=>r.querySelector(s);
  const safe=v=>v==null?'':String(v);
  const number=v=>{const t=safe(v).trim();if(!t)return null;const n=Number(t);return Number.isFinite(n)?n:null};
  const labelState=v=>v==='included'?'포함':v==='separate'?'별도':'미기재';
  const read=(compare,id,vendor,kind)=>safe(compare?.[`${id}:${vendor}:${kind}`]);

  function vendorActive(compare,vendor){
    return ITEMS.some(([id])=>{const state=read(compare,id,vendor,'state');const amount=read(compare,id,vendor,'amount');return (state&&state!=='missing')||amount.trim()});
  }

  function itemHasPeerData(compare,id,activeVendors){
    return activeVendors.some(v=>{const state=read(compare,id,v,'state');const amount=read(compare,id,v,'amount');return (state&&state!=='missing')||amount.trim()});
  }

  function questionsForVendor(data,vendor){
    const compare=data?.compare||{};
    const active=VENDORS.filter(v=>vendorActive(compare,v));
    if(!active.includes(vendor)) return [];
    const out=[];
    for(const [id,name] of ITEMS){
      if(!itemHasPeerData(compare,id,active)) continue;
      const state=read(compare,id,vendor,'state')||'missing';
      const rawAmount=read(compare,id,vendor,'amount');
      const n=number(rawAmount);
      const peers=active.filter(v=>v!==vendor);
      const peerStates=peers.map(v=>read(compare,id,v,'state')||'missing');
      const peerAmounts=peers.map(v=>number(read(compare,id,v,'amount'))).filter(v=>v!==null);
      const allStates=active.map(v=>read(compare,id,v,'state')||'missing');
      const allAmounts=active.map(v=>number(read(compare,id,v,'amount'))).filter(v=>v!==null);
      const questions=[];
      const add=text=>{if(text&&!questions.includes(text))questions.push(text)};

      if(state==='missing') add(`${name}: 포함인지 별도인지, 포함된다면 어느 범위까지인지 확인해 주세요.`);
      if(state==='separate') add(`${name}: 별도 항목으로 입력되어 있습니다. 별도 금액과 산정 기준, 추가되는 범위를 확인해 주세요.`);
      if((state==='included'||state==='separate')&&n===null) add(`${name}: 금액이 비어 있습니다. 금액 또는 수량·면적·식 등 산정 방식을 확인해 주세요.`);
      if(new Set(allStates).size>1) add(`${name}: 업체별 포함조건이 다릅니다. ${vendor.toUpperCase()} 업체 기준의 포함·별도·제외 범위를 견적서에 명확히 적어 달라고 확인해 주세요.`);
      if(n!==null&&allAmounts.length>=2){const min=Math.min(...allAmounts),max=Math.max(...allAmounts);if(max!==min)add(`${name}: 업체별 입력금액 차이가 있습니다. 수량·사양·자재·철거·운반·폐기 등 금액에 포함된 범위를 확인해 주세요.`)}
      if(n===null&&peerAmounts.length>0) add(`${name}: 다른 비교 견적에는 금액 입력이 있습니다. ${vendor.toUpperCase()} 업체의 금액과 포함 범위를 확인해 주세요.`);
      if(state!=='missing'&&peerStates.some(s=>s==='missing')) add(`${name}: 일부 비교 견적은 포함 여부가 미기재입니다. ${vendor.toUpperCase()} 업체의 현재 조건을 서면으로 명확히 남겨 주세요.`);

      if(questions.length) out.push({id,name,state,amount:n,questions});
    }
    return out;
  }

  function vendorText(data,vendor){
    const items=questionsForVendor(data,vendor);
    const lines=[`${vendor.toUpperCase()} 업체 확인 질문`];
    if(!items.length) lines.push('현재 비교 저장값 기준으로 별도 질문이 없습니다.');
    for(const item of items){lines.push(`□ ${item.name}`);for(const q of item.questions)lines.push(`  - ${q}`)}
    lines.push('※ 비교 저장값의 조건 차이를 질문으로 정리한 목록이며 가격 적정성이나 업체 품질을 판정하지 않습니다.');
    return lines.join('\n');
  }

  function ensureStyle(){
    if($('#v45-vendor-question-style')) return;
    const style=document.createElement('style');style.id='v45-vendor-question-style';style.textContent=`
      .v45-vendor-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.v45-vendor-card{border:1px solid var(--line,#c9c4b8);background:var(--paper,#fcfbf7);padding:14px;min-width:0}.v45-vendor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px}.v45-vendor-head h3{margin:0;font-size:17px}.v45-vendor-count{color:var(--muted,#777168);font-size:12px}.v45-vendor-items{display:grid;gap:10px}.v45-vendor-item{border-top:1px solid var(--line,#c9c4b8);padding-top:10px}.v45-vendor-item:first-child{border-top:0;padding-top:0}.v45-vendor-item strong{display:block;font-size:14px;margin-bottom:5px}.v45-vendor-item ul{margin:0;padding-left:18px}.v45-vendor-item li{margin:4px 0;line-height:1.5;font-size:13px}.v45-copy-vendor{margin-top:12px;width:100%;min-height:40px}.v45-empty{color:var(--muted,#777168)}
      @media(max-width:900px){.v45-vendor-grid{grid-template-columns:1fr}}@media print{.v45-copy-vendor{display:none!important}.v45-vendor-grid{grid-template-columns:1fr}.v45-vendor-card{break-inside:avoid}.v45-vendor-item li{font-size:10px}}
    `;document.head.append(style);
  }

  function ensureSection(){
    let section=$('[data-v45-vendor-section]');if(section)return section;
    const anchor=$('[data-v44-checklist-section]')||$('[data-review-section]');if(!anchor)return null;
    section=document.createElement('section');section.className='tool-stage';section.dataset.v45VendorSection='';section.hidden=true;section.innerHTML='<div class="v10-section-head"><div><h2>업체별 확인 질문</h2><p>A/B/C 비교 저장값을 바탕으로 실제 입력된 업체별 질문을 나눠 보여줍니다. 공통 체크리스트와 중복될 수 있으며 가격·품질 우열은 판단하지 않습니다.</p></div></div><div class="v45-vendor-grid" data-v45-vendor-grid></div>';
    anchor.after(section);return section;
  }

  function render(){
    const api=window.InteriorQuoteReview43;const section=ensureSection();const grid=$('[data-v45-vendor-grid]');
    if(!api?.loadData||!section||!grid)return {data:null,groups:[]};
    const data=api.loadData();const groups=VENDORS.map(v=>({vendor:v,items:questionsForVendor(data,v)})).filter(g=>g.items.length);
    grid.replaceChildren();
    if(!groups.length){section.hidden=false;const p=document.createElement('p');p.className='v45-empty';p.textContent='현재 A/B/C 비교 저장값 기준으로 업체별 질문을 만들 수 없습니다.';grid.append(p);return {data,groups}}
    section.hidden=false;
    for(const group of groups){
      const card=document.createElement('article');card.className='v45-vendor-card';card.dataset.vendor=group.vendor;
      const head=document.createElement('div');head.className='v45-vendor-head';const h=document.createElement('h3');h.textContent=`${group.vendor.toUpperCase()} 업체`;const count=document.createElement('span');count.className='v45-vendor-count';count.textContent=`${group.items.length}개 공종`;head.append(h,count);card.append(head);
      const items=document.createElement('div');items.className='v45-vendor-items';
      for(const item of group.items){const block=document.createElement('div');block.className='v45-vendor-item';block.dataset.item=item.id;const title=document.createElement('strong');title.textContent=`${item.name} · ${labelState(item.state)}${item.amount===null?'':` · ${item.amount.toLocaleString('ko-KR')}만원`}`;block.append(title);const ul=document.createElement('ul');for(const q of item.questions){const li=document.createElement('li');li.textContent=q;ul.append(li)}block.append(ul);items.append(block)}
      card.append(items);const button=document.createElement('button');button.type='button';button.className='v45-copy-vendor';button.dataset.copyVendor=group.vendor;button.textContent=`${group.vendor.toUpperCase()} 업체 질문 복사`;button.addEventListener('click',async()=>{const original=button.textContent;try{await navigator.clipboard.writeText(vendorText(data,group.vendor));button.textContent='복사됨'}catch{button.textContent='복사 실패'}setTimeout(()=>button.textContent=original,1200)});card.append(button);grid.append(card);
    }
    return {data,groups};
  }

  function init(){ensureStyle();let current=render();$('[data-refresh-report]')?.addEventListener('click',()=>{current=render()});return current}

  window.InteriorQuoteReview45={vendorActive,questionsForVendor,vendorText,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
