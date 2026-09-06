(function(){
  const root=document.documentElement;
  const q=(sel,ctx=document)=>ctx.querySelector(sel);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s??'').toLowerCase().replace(/[\s_.\-/()]+/g,'');
  const ptLabel={gasoline:'휘발유',diesel:'경유',lpg:'LPG',hybrid:'하이브리드',phev:'플러그인 하이브리드',electric:'전기',hydrogen:'수소',unknown:'기타'};
  const ptOrder=['gasoline','diesel','lpg','hybrid','phev','electric','hydrogen','unknown'];
  const classOrder=['승용차','승합차','화물차','특수차'];
  const domesticTokens=['현대','기아','제네시스','kg모빌리티','케이지모빌리티','쌍용','르노코리아','르노삼성','한국지엠','한국gm'];
  const PAGE_SIZE=24;
  const state={rows:[],images:new Map(),q:'',maker:'',fuel:'',origin:'',vehicleClass:'',page:1};

  function isDomesticBrand(maker){
    const v=norm(maker);
    return domesticTokens.some(t=>v.includes(norm(t)));
  }
  function originLabel(f){return isDomesticBrand(f.maker)?'국내 브랜드':'해외 브랜드'}
  function imageUrl(file){return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}?width=960`}

  function injectStyle(){
    if(q('#catalogConsumerStyle'))return;
    const style=document.createElement('style');
    style.id='catalogConsumerStyle';
    style.textContent=`
      .allcar-controls,.view-switch,.allcar-table-wrap#tableHost,.pager#pager,.allcar-stats{display:none!important}
      .page-hero{padding-bottom:24px}.page-hero .allcar-head{display:block}.page-hero h1{margin-bottom:8px}.page-hero .allcar-head p{max-width:760px}
      .consumer-catalog{margin-top:-8px}.catalog-toolbar{border:1px solid #ddd;background:#fff;padding:16px;margin-bottom:18px}.catalog-search-row{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(170px,.65fr);gap:10px}.catalog-search-row input,.catalog-search-row select{height:48px;border:1px solid #bbb;background:#fff;padding:0 13px;font:inherit;border-radius:0}.catalog-label{display:block;font-size:11px;color:#666;margin:0 0 6px}.catalog-chip-row{display:flex;gap:7px;overflow:auto;padding:0 0 4px;scrollbar-width:thin}.catalog-filter-wrap{margin-top:14px}.catalog-chip{min-height:40px;padding:0 12px;border:1px solid #ccc;background:#fff;white-space:nowrap;cursor:pointer;font:inherit;font-size:13px}.catalog-chip.active{background:#111;color:#fff;border-color:#111}.catalog-results-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:20px 0 12px}.catalog-results-head strong{font-size:20px}.catalog-results-head span{font-size:12px;color:#666}.vehicle-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.vehicle-card{border:1px solid #ddd;background:#fff;min-width:0;display:flex;flex-direction:column;overflow:hidden}.vehicle-card-media{position:relative;aspect-ratio:16/9;background:#f0f2f4;overflow:hidden;border-bottom:1px solid #ddd}.vehicle-card-media img{width:100%;height:100%;object-fit:cover;display:block}.vehicle-card-credit{position:absolute;left:6px;right:6px;bottom:6px;width:max-content;max-width:calc(100% - 12px);padding:3px 5px;background:rgba(255,255,255,.9);font-size:9px;color:#555;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vehicle-card-photo-placeholder{height:100%;position:relative;background:linear-gradient(160deg,#f7f7f7,#eceff1)}.vehicle-card-photo-placeholder:before{content:'';position:absolute;left:20%;right:20%;bottom:29%;height:19%;border:2px solid #bcc3c8;border-radius:48% 48% 22% 22%/55% 55% 28% 28%;transform:skewX(-7deg)}.vehicle-card-photo-placeholder:after{content:'';position:absolute;left:27%;right:27%;bottom:47%;height:14%;border:2px solid #c8ced2;border-bottom:0;border-radius:50% 50% 0 0}.vehicle-card-main{padding:18px;flex:1}.vehicle-card-maker{font-size:11px;color:#666;margin-bottom:5px}.vehicle-card h2{font-size:21px;line-height:1.2;letter-spacing:-.035em;margin:0;overflow-wrap:anywhere}.vehicle-card-meta{font-size:12px;color:#666;margin:9px 0 12px}.vehicle-card-pills{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:15px}.vehicle-card-pill{font-size:11px;border:1px solid #d7d7d7;padding:4px 7px;background:#fafafa}.vehicle-card-pill.origin{background:#fff}.vehicle-card-status{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #eee;border-left:1px solid #eee}.vehicle-card-status div{padding:9px;border-right:1px solid #eee;border-bottom:1px solid #eee}.vehicle-card-status span{display:block;font-size:10px;color:#777}.vehicle-card-status b{display:block;font-size:12px;margin-top:3px}.vehicle-card-actions{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid #ddd}.vehicle-card-actions a{min-height:48px;display:flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;color:#111;font-size:12px;font-weight:700;border-right:1px solid #ddd}.vehicle-card-actions a:last-child{border-right:0}.vehicle-card-actions a.primary{background:#111;color:#fff}.catalog-empty{border-top:2px solid #111;padding:30px 0}.catalog-pager{display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin:24px 0}.catalog-pager button{height:44px;min-width:44px;border:1px solid #ccc;background:#fff;cursor:pointer}.catalog-pager button.active{background:#111;color:#fff;border-color:#111}.catalog-pager button:disabled{opacity:.35}.source-strip{margin-top:20px}
      @media(max-width:920px){.vehicle-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:700px){.page-hero{padding-bottom:16px}.catalog-toolbar{padding:12px;margin-left:-1px;margin-right:-1px}.catalog-search-row{grid-template-columns:minmax(0,1fr)}.catalog-search-row input,.catalog-search-row select{width:100%;min-width:0}.catalog-results-head{display:block}.catalog-results-head span{display:block;margin-top:5px}.vehicle-card-grid{grid-template-columns:minmax(0,1fr)}.vehicle-card-main{padding:16px}.vehicle-card h2{font-size:20px}.catalog-chip{min-height:44px}.vehicle-card-actions a{min-height:48px}}
    `;
    document.head.appendChild(style);
  }

  function costLabel(f){
    if(f.full_ready_count>0)return '계산 가능';
    if(f.tax_ready_count>0||f.energy_ready_count>0)return '일부 가능';
    return '확인 중';
  }
  function generationLabel(f){
    const labels=(f.generation_labels||[]).filter(Boolean);
    if(!labels.length)return '세대 정보 확인 중';
    if(labels.length===1)return labels[0];
    return `${labels[0]} 외 ${labels.length-1}`;
  }
  function familySearchText(f){
    return norm([f.maker,f.family_name,f.category,originLabel(f),...(f.generation_labels||[]),...(f.vehicle_classes||[]),...(f.powertrains||[]).map(p=>ptLabel[p.powertrain]||p.powertrain)].join(' '));
  }
  function filtered(){
    const nq=norm(state.q);
    return state.rows.filter(f=>{
      if(state.maker&&f.maker!==state.maker)return false;
      if(state.fuel&&!(f.powertrains||[]).some(p=>p.powertrain===state.fuel))return false;
      if(state.origin==='domestic'&&!isDomesticBrand(f.maker))return false;
      if(state.origin==='overseas'&&isDomesticBrand(f.maker))return false;
      if(state.vehicleClass&&!(f.vehicle_classes||[]).includes(state.vehicleClass))return false;
      if(nq&&!familySearchText(f).includes(nq))return false;
      return true;
    });
  }
  function setUrl(){
    const u=new URL(location.href);
    ['q','maker','fuel','origin','class','page','view','filter'].forEach(k=>u.searchParams.delete(k));
    if(state.q)u.searchParams.set('q',state.q);
    if(state.maker)u.searchParams.set('maker',state.maker);
    if(state.fuel)u.searchParams.set('fuel',state.fuel);
    if(state.origin)u.searchParams.set('origin',state.origin);
    if(state.vehicleClass)u.searchParams.set('class',state.vehicleClass);
    if(state.page>1)u.searchParams.set('page',String(state.page));
    history.replaceState(null,'',u);
  }
  function bindChipHost(host,attr,key,after){
    host.onclick=e=>{const btn=e.target.closest(`[data-${attr}]`);if(!btn)return;state[key]=btn.dataset[attr]||'';state.page=1;if(after)after();renderAll();};
  }
  function renderMakerChips(){
    const host=q('#catalogMakerChips');if(!host)return;
    const popular=(window.__consumerMakers||[]).slice(0,10);
    host.innerHTML=`<button class="catalog-chip${state.maker?'':' active'}" data-maker="">전체</button>`+popular.map(m=>`<button class="catalog-chip${state.maker===m.maker?' active':''}" data-maker="${esc(m.maker)}">${esc(m.maker)}</button>`).join('');
    bindChipHost(host,'maker','maker',()=>{q('#catalogMaker').value=state.maker});
  }
  function renderOriginChips(){
    const host=q('#catalogOriginChips');if(!host)return;
    const items=[['','전체'],['domestic','국내 브랜드'],['overseas','해외 브랜드']];
    host.innerHTML=items.map(([v,label])=>`<button class="catalog-chip${state.origin===v?' active':''}" data-origin="${v}">${label}</button>`).join('');
    bindChipHost(host,'origin','origin');
  }
  function renderClassChips(){
    const host=q('#catalogClassChips');if(!host)return;
    const present=[...new Set(state.rows.flatMap(f=>f.vehicle_classes||[]).filter(Boolean))];
    const classes=[...classOrder.filter(v=>present.includes(v)),...present.filter(v=>!classOrder.includes(v)).sort((a,b)=>a.localeCompare(b,'ko'))];
    host.innerHTML=`<button class="catalog-chip${state.vehicleClass?'':' active'}" data-class="">전체</button>`+classes.map(v=>`<button class="catalog-chip${state.vehicleClass===v?' active':''}" data-class="${esc(v)}">${esc(v)}</button>`).join('');
    host.onclick=e=>{const btn=e.target.closest('[data-class]');if(!btn)return;state.vehicleClass=btn.dataset.class||'';state.page=1;renderAll();};
  }
  function renderFuelChips(){
    const host=q('#catalogFuelChips');if(!host)return;
    const present=new Set(state.rows.flatMap(f=>(f.powertrains||[]).map(p=>p.powertrain)));
    const fuels=ptOrder.filter(k=>present.has(k)&&k!=='unknown');
    host.innerHTML=`<button class="catalog-chip${state.fuel?'':' active'}" data-fuel="">전체</button>`+fuels.map(k=>`<button class="catalog-chip${state.fuel===k?' active':''}" data-fuel="${k}">${ptLabel[k]||k}</button>`).join('');
    bindChipHost(host,'fuel','fuel');
  }
  function media(f){
    const img=state.images.get(f.family_id);
    if(!img)return '<div class="vehicle-card-media"><div class="vehicle-card-photo-placeholder" aria-hidden="true"></div></div>';
    const credit=`사진: ${img.author} · ${img.license}`;
    return `<div class="vehicle-card-media"><img src="${esc(imageUrl(img.file))}" alt="${esc(f.family_name)} 차량 사진" loading="lazy" decoding="async"><a class="vehicle-card-credit" href="${esc(img.source_page)}" target="_blank" rel="noopener noreferrer">${esc(credit)}</a></div>`;
  }
  function card(f){
    const pts=[...new Set((f.powertrains||[]).map(p=>p.powertrain))].filter(Boolean);
    const pills=pts.slice(0,4).map(p=>`<span class="vehicle-card-pill">${esc(ptLabel[p]||p)}</span>`).join('');
    const more=pts.length>4?`<span class="vehicle-card-pill">+${pts.length-4}</span>`:'';
    const spec=f.manufacturer_detail?'제공':'확인 중';
    const category=(f.vehicle_classes||[]).slice(0,2).join(' · ')||f.category||'';
    const id=encodeURIComponent(f.family_id);
    return `<article class="vehicle-card" data-family-id="${esc(f.family_id)}">${media(f)}<div class="vehicle-card-main"><div class="vehicle-card-maker">${esc(f.maker)}${category?' · '+esc(category):''}</div><h2>${esc(f.family_name)}</h2><div class="vehicle-card-meta">${esc(generationLabel(f))}</div><div class="vehicle-card-pills"><span class="vehicle-card-pill origin">${esc(originLabel(f))}</span>${pills}${more||(!pills?'<span class="vehicle-card-pill">동력 정보 확인 중</span>':'')}</div><div class="vehicle-card-status"><div><span>1년 유지비</span><b>${costLabel(f)}</b></div><div><span>제조사 제원</span><b>${spec}</b></div></div></div><div class="vehicle-card-actions"><a class="primary" href="./family/?id=${id}">차량 보기</a><a href="../tools/annual-cost/?fa=${id}">유지비</a><a href="../compare/?fa=${id}">비교</a></div></article>`;
  }
  function renderPager(totalPages){
    const host=q('#catalogPager');host.innerHTML='';if(totalPages<=1)return;
    const add=(label,p,active=false,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;if(active)b.className='active';b.onclick=()=>{state.page=p;renderAll();scrollTo({top:q('.consumer-catalog').offsetTop-70,behavior:'smooth'});};host.appendChild(b)};
    add('‹',Math.max(1,state.page-1),false,state.page===1);
    const start=Math.max(1,Math.min(state.page-2,totalPages-4)),end=Math.min(totalPages,start+4);
    for(let p=start;p<=end;p++)add(String(p),p,p===state.page,false);
    add('›',Math.min(totalPages,state.page+1),false,state.page===totalPages);
  }
  function renderAll(){
    const rows=filtered();
    const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
    if(state.page>pages)state.page=pages;
    const slice=rows.slice((state.page-1)*PAGE_SIZE,state.page*PAGE_SIZE);
    q('#catalogCount').textContent=`${rows.length.toLocaleString('ko-KR')}대의 차량`;
    q('#catalogPageInfo').textContent=rows.length?`${state.page} / ${pages} 페이지`:'조건에 맞는 차량이 없습니다';
    q('#catalogGrid').innerHTML=slice.length?slice.map(card).join(''):`<div class="catalog-empty"><strong>조건에 맞는 차량이 없습니다.</strong><p>차량명이나 제조사, 브랜드 구분, 공식 차종 분류, 연료 조건을 바꿔보세요.</p></div>`;
    renderPager(pages);renderMakerChips();renderOriginChips();renderClassChips();renderFuelChips();setUrl();
  }

  async function init(){
    injectStyle();
    const hero=q('.page-hero .allcar-head>div:first-child');
    if(hero){const kicker=q('.db-kicker',hero),h1=q('h1',hero),p=q('p',hero);if(kicker)kicker.textContent='공식 데이터 기반 자동차 찾기';if(h1)h1.textContent='차량 찾기';if(p)p.textContent='제조사, 국내·해외 브랜드, 공식 차종 분류와 연료 종류로 찾아보고 연비·전비, 주요 제원, 1년 유지비와 비교 도구로 바로 이동할 수 있습니다.';}
    const oldSection=q('.db-section .db-shell');if(!oldSection)return;
    const consumer=document.createElement('div');consumer.className='consumer-catalog';
    consumer.innerHTML=`<div class="catalog-toolbar"><div class="catalog-search-row"><label><span class="catalog-label">차량 검색</span><input id="catalogSearch" type="search" placeholder="예: 쏘렌토, 아이오닉, BMW" autocomplete="off"></label><label><span class="catalog-label">제조사</span><select id="catalogMaker"><option value="">모든 제조사</option></select></label></div><div class="catalog-filter-wrap"><span class="catalog-label">주요 제조사</span><div id="catalogMakerChips" class="catalog-chip-row"></div></div><div class="catalog-filter-wrap"><span class="catalog-label">브랜드 구분</span><div id="catalogOriginChips" class="catalog-chip-row"></div></div><div class="catalog-filter-wrap"><span class="catalog-label">공식 차종 분류</span><div id="catalogClassChips" class="catalog-chip-row"></div></div><div class="catalog-filter-wrap"><span class="catalog-label">연료·동력</span><div id="catalogFuelChips" class="catalog-chip-row"></div></div></div><div class="catalog-results-head"><strong id="catalogCount">차량 불러오는 중…</strong><span id="catalogPageInfo"></span></div><div id="catalogGrid" class="vehicle-card-grid"></div><div id="catalogPager" class="catalog-pager"></div>`;
    oldSection.insertBefore(consumer,q('#tableHost'));
    const src=q('.source-strip');if(src)src.textContent='차량 데이터: 한국에너지공단 · 차량 사진: 라이선스가 확인된 Wikimedia Commons 파일만 사용';
    const summary=q('#resultCount')?.closest('.allcar-summary');if(summary)summary.style.display='none';
    const params=new URLSearchParams(location.search);state.q=params.get('q')||'';state.maker=params.get('maker')||'';state.fuel=params.get('fuel')||'';state.origin=params.get('origin')||'';state.vehicleClass=params.get('class')||'';state.page=Math.max(1,Number(params.get('page')||1));
    let data,imageData;try{const [r,ir]=await Promise.all([fetch('../data/generated/family-detail-index.json',{cache:'no-store'}),fetch('../data/vehicle-image-sources.json',{cache:'no-store'})]);if(!r.ok)throw new Error('load');data=await r.json();imageData=ir.ok?await ir.json():{records:[]};}catch{q('#catalogGrid').innerHTML='<div class="catalog-empty">차량 목록을 불러오지 못했습니다.</div>';return;}
    state.images=new Map((imageData.records||[]).map(v=>[v.family_id,v]));
    state.rows=(data.families||[]).slice().sort((a,b)=>String(a.maker).localeCompare(String(b.maker),'ko')||String(a.family_name).localeCompare(String(b.family_name),'ko'));
    const makerMap=new Map();for(const f of state.rows)makerMap.set(f.maker,(makerMap.get(f.maker)||0)+1);
    const makers=[...makerMap].map(([maker,count])=>({maker,count})).sort((a,b)=>b.count-a.count||a.maker.localeCompare(b.maker,'ko'));window.__consumerMakers=makers;
    q('#catalogMaker').innerHTML='<option value="">모든 제조사</option>'+makers.map(m=>`<option value="${esc(m.maker)}">${esc(m.maker)} (${m.count})</option>`).join('');
    if(state.maker&&!makerMap.has(state.maker))state.maker='';
    if(!['','domestic','overseas'].includes(state.origin))state.origin='';
    const classSet=new Set(state.rows.flatMap(f=>f.vehicle_classes||[]));if(state.vehicleClass&&!classSet.has(state.vehicleClass))state.vehicleClass='';
    q('#catalogMaker').value=state.maker;q('#catalogSearch').value=state.q;
    let timer;q('#catalogSearch').addEventListener('input',e=>{clearTimeout(timer);timer=setTimeout(()=>{state.q=e.target.value.trim();state.page=1;renderAll();},180)});
    q('#catalogMaker').addEventListener('change',e=>{state.maker=e.target.value;state.page=1;renderAll();});
    renderAll();root.dataset.consumerCatalog='ready';root.dataset.vehicleImages=String(state.images.size);
  }
  init().catch(()=>{});
})();
