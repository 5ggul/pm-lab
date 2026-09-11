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
  let photos,searchTimer;
  const compareNames=new Intl.Collator('ko').compare;
  const searchIndex=new Map();
  const state={rows:[],images:new Map(),q:'',maker:'',fuel:'',origin:'',vehicleClass:'',sort:'photos',page:1};

  function isDomesticBrand(maker){
    const v=norm(maker);
    return domesticTokens.some(t=>v.includes(norm(t)));
  }
  function originLabel(f){return isDomesticBrand(f.maker)?'국내 브랜드':'해외 브랜드'}

  function injectStyle(){
    if(q('#catalogConsumerStyle'))return;
    const style=document.createElement('style');
    style.id='catalogConsumerStyle';
    style.textContent=`
      .allcar-controls,.view-switch,.allcar-table-wrap#tableHost,.pager#pager,.allcar-stats{display:none!important}
      .page-hero{padding-bottom:24px}.page-hero .allcar-head{display:block}.page-hero h1{margin-bottom:8px}.page-hero .allcar-head p{max-width:760px}
      .consumer-catalog{margin-top:-8px}.catalog-overview{display:grid;grid-template-columns:1.4fr repeat(3,1fr);margin:0 0 22px;border-top:2px solid #17232d;border-bottom:1px solid #cfd7dc;background:#f5f7f8}.catalog-overview-intro,.catalog-overview-stat{padding:20px 22px;min-width:0}.catalog-overview-intro{background:#17232d;color:#fff}.catalog-overview-intro strong{display:block;font-size:20px;letter-spacing:-.6px}.catalog-overview-intro span{display:block;margin-top:5px;color:#c7d0d5;font-size:12px;line-height:1.6}.catalog-overview-stat{border-right:1px solid #d8dee2}.catalog-overview-stat:last-child{border-right:0}.catalog-overview-stat b{display:block;font-size:28px;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-1px}.catalog-overview-stat span{display:block;margin-top:8px;color:#65717a;font-size:11px}.catalog-filter-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px}.catalog-filter-summary span{min-width:0;overflow-wrap:anywhere}.catalog-chip:focus-visible{outline:3px solid #174ea6;outline-offset:2px}.catalog-chip-row{scroll-padding-inline:12px;overscroll-behavior-inline:contain}.catalog-toolbar{border:0;border-top:2px solid #17232d;background:#f5f7f8;padding:22px;margin-bottom:16px}.catalog-search-row{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(170px,.65fr);gap:12px}.catalog-search-row input,.catalog-search-row select{width:100%;min-width:0;height:54px;border:1px solid #aeb8bf;background:#fff;padding:0 15px;font:inherit;font-size:16px;border-radius:2px}.catalog-search-row input:focus,.catalog-search-row select:focus{outline:2px solid #2369d5;outline-offset:1px;border-color:#2369d5}.catalog-label{display:block;font-size:11px;color:#5d6972;margin:0 0 7px;font-weight:700}.catalog-chip-row{display:flex;gap:7px;overflow:auto;padding:0 0 4px;scrollbar-width:thin}.catalog-filter-wrap{margin-top:16px}.catalog-chip{min-height:40px;padding:0 13px;border:1px solid #c1c9ce;background:#fff;white-space:nowrap;cursor:pointer;font:inherit;font-size:13px;border-radius:999px}.catalog-chip.active{background:#17232d;color:#fff;border-color:#17232d}.catalog-results-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:26px 0 14px;padding-bottom:12px;border-bottom:1px solid #ccd4da}.catalog-result-options{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.catalog-sort{display:flex;align-items:center;gap:8px;font-size:12px}.catalog-sort select{min-height:44px;max-width:100%;border:1px solid #b9c2c8;background:#fff;padding:0 10px;font:inherit}.catalog-results-head strong{font-size:23px;letter-spacing:-.7px}.catalog-results-head span{font-size:12px;color:#66727a}.vehicle-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.vehicle-card{border:1px solid #d3d9dd;background:#fff;min-width:0;display:flex;flex-direction:column;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.vehicle-card:hover{transform:translateY(-2px);border-color:#9eabb3;box-shadow:0 14px 30px rgba(24,38,48,.08)}.vehicle-card-media{position:relative;aspect-ratio:16/10;background:linear-gradient(150deg,#f6f7f7,#e8ecef);overflow:hidden;border-bottom:1px solid #d7dde1}.vehicle-card-media img{width:100%;height:100%;object-fit:contain;display:block;padding:8px}.vehicle-card-credit{position:absolute;left:auto;right:7px;bottom:7px;width:auto;max-width:calc(100% - 14px);padding:3px 6px;background:rgba(255,255,255,.92);font-size:9px;color:#5b656b;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vehicle-card-photo-placeholder{height:100%;position:relative;background:linear-gradient(160deg,#f7f7f7,#eceff1)}.vehicle-card-photo-placeholder:before{content:'';position:absolute;left:20%;right:20%;bottom:29%;height:19%;border:2px solid #bcc3c8;border-radius:48% 48% 22% 22%/55% 55% 28% 28%;transform:skewX(-7deg)}.vehicle-card-photo-placeholder:after{content:'';position:absolute;left:27%;right:27%;bottom:47%;height:14%;border:2px solid #c8ced2;border-bottom:0;border-radius:50% 50% 0 0}.vehicle-card-main{padding:20px;flex:1}.vehicle-card-maker{font-size:11px;color:#62717b;margin-bottom:5px;font-weight:700}.vehicle-card h2{font-size:24px;line-height:1.2;letter-spacing:-.045em;margin:0;overflow-wrap:anywhere}.vehicle-card-meta{font-size:12px;color:#68757e;margin:9px 0 14px}.vehicle-card-pills{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:17px}.vehicle-card-pill{font-size:10px;border:1px solid #d8dde0;padding:4px 7px;background:#f7f8f8}.vehicle-card-pill.origin{background:#fff}.vehicle-card-status{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #dfe4e7}.vehicle-card-status div{padding:12px 6px 11px 0}.vehicle-card-status div+div{padding-left:12px;border-left:1px solid #dfe4e7}.vehicle-card-status span{display:block;font-size:10px;color:#77828a}.vehicle-card-status b{display:block;font-size:14px;margin-top:4px;font-variant-numeric:tabular-nums}.vehicle-card-actions{display:grid;grid-template-columns:1.15fr 1fr 1fr;border-top:1px solid #d4dade;background:#fafbfb}.vehicle-card-actions a{min-height:52px;display:flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;color:#24313b;font-size:12px;font-weight:750;border-right:1px solid #d4dade}.vehicle-card-actions a:last-child{border-right:0}.vehicle-card-actions a.primary{background:#17232d;color:#fff}.catalog-empty{border-top:2px solid #17232d;padding:34px 0}.catalog-pager{display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin:30px 0}.catalog-pager button{height:44px;min-width:44px;border:1px solid #c1c9ce;background:#fff;cursor:pointer}.catalog-pager button.active{background:#17232d;color:#fff;border-color:#17232d}.catalog-pager button:disabled{opacity:.35}.source-strip{margin-top:24px}
      @media(max-width:920px){.vehicle-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:700px){.page-hero{padding-bottom:16px}.catalog-overview{grid-template-columns:1fr 1fr}.catalog-overview-intro{grid-column:1/-1}.catalog-overview-intro,.catalog-overview-stat{padding:16px}.catalog-overview-stat:last-child{grid-column:1/-1;border-top:1px solid #d8dee2}.catalog-toolbar{padding:16px;margin-left:-1px;margin-right:-1px}.catalog-search-row{grid-template-columns:minmax(0,1fr)}.catalog-search-row input,.catalog-search-row select{width:100%;min-width:0}.catalog-results-head{display:block}.catalog-results-head span{display:block;margin-top:5px}.vehicle-card-grid{grid-template-columns:minmax(0,1fr);gap:16px}.vehicle-card-main{padding:18px}.vehicle-card h2{font-size:23px}.catalog-chip{min-height:44px}.vehicle-card-actions a{min-height:52px}}
    `;
    document.head.appendChild(style);
  }

  function costLabel(f){
    if(f.full_ready_count>0)return '계산 가능';
    if(f.tax_ready_count>0||f.energy_ready_count>0)return '일부 가능';
    return '계산 사양 없음';
  }
  function generationLabel(f){
    const labels=(f.generation_labels||[]).filter(v=>v&&!/미분류|확인 중/.test(v));
    if(!labels.length)return '연식별 사양';
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
      if(nq&&!searchIndex.get(f.family_id).includes(nq))return false;
      return true;
    }).sort((a,b)=>{
      const relevance=f=>{
        if(!nq)return 0;
        const name=norm(f.family_name),makerName=norm(`${f.maker} ${f.family_name}`);
        if(name===nq||makerName===nq)return 4;
        if(name.startsWith(nq)||makerName.startsWith(nq))return 3;
        return name.includes(nq)?2:1;
      };
      const relevanceDiff=relevance(b)-relevance(a);
      const maker=compareNames(String(a.maker),String(b.maker));
      const model=compareNames(String(a.family_name),String(b.family_name));
      const photo=state.sort==='photos'?Number(state.images.has(b.family_id))-Number(state.images.has(a.family_id)):0;
      const depth=state.sort==='photos'?Number(b.full_ready_count||0)-Number(a.full_ready_count||0)||Number(b.energy_ready_count||0)-Number(a.energy_ready_count||0)||Number(b.tax_ready_count||0)-Number(a.tax_ready_count||0):0;
      const alphabetical=state.sort==='name'?maker||model:model||maker;
      return relevanceDiff||photo||depth||alphabetical||compareNames(a.family_id,b.family_id);
    });
  }
  function setUrl(){
    const u=new URL(location.href);
    ['q','maker','fuel','origin','class','page','view','filter','sort'].forEach(k=>u.searchParams.delete(k));
    if(state.q)u.searchParams.set('q',state.q);
    if(state.maker)u.searchParams.set('maker',state.maker);
    if(state.fuel)u.searchParams.set('fuel',state.fuel);
    if(state.origin)u.searchParams.set('origin',state.origin);
    if(state.vehicleClass)u.searchParams.set('class',state.vehicleClass);
    if(state.sort!=='photos')u.searchParams.set('sort',state.sort);
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
  function media(f,index){return photos.photoMarkup(f,state.images.get(f.family_id),false,index<2);}
  function efficiencyFacts(f){
    const rows=(f.powertrains||[]).filter(p=>['gasoline','diesel','hybrid','lpg','electric'].includes(p.powertrain)&&p.combined_efficiency?.min>0&&p.combined_efficiency?.max>0);
    rows.sort((a,b)=>Number(b.powertrain===state.fuel)-Number(a.powertrain===state.fuel)||ptOrder.indexOf(a.powertrain)-ptOrder.indexOf(b.powertrain));
    return rows.slice(0,2).map(p=>{const e=p.combined_efficiency;return '<div><span>'+ptLabel[p.powertrain]+(p.powertrain==='electric'?' 전비':' 연비')+'</span><b>'+e.min+(e.min===e.max?'':'–'+e.max)+' <small>'+(p.powertrain==='electric'?'km/kWh':'km/L')+'</small></b></div>';}).join('')||'<div><span>연비·전비</span><b>공개값 없음</b></div>';
  }
  function card(f,index){
    const pts=[...new Set((f.powertrains||[]).map(p=>p.powertrain))].filter(Boolean);
    const pills=pts.slice(0,4).map(p=>`<span class="vehicle-card-pill">${esc(ptLabel[p]||p)}</span>`).join('');
    const more=pts.length>4?`<span class="vehicle-card-pill">+${pts.length-4}</span>`:'';
    const spec=f.manufacturer_detail?'제공':'미수록';
    const classes=f.vehicle_classes||[];
    const visibleClasses=state.vehicleClass?[state.vehicleClass,...classes.filter(v=>v!==state.vehicleClass)]:classes;
    const category=visibleClasses.slice(0,2).join(' · ')||f.category||'';
    const id=encodeURIComponent(f.family_id);
    const details=f.path?'../'+f.path:'./family/?id='+id;
    return `<article class="vehicle-card" data-family-id="${esc(f.family_id)}">${media(f,index)}<div class="vehicle-card-main"><div class="vehicle-card-maker">${esc(f.maker)}${category?' · '+esc(category):''}</div><h2>${esc(f.family_name)}</h2><div class="vehicle-card-meta">${esc(generationLabel(f))}</div><div class="vehicle-card-pills"><span class="vehicle-card-pill origin">${esc(originLabel(f))}</span>${pills}${more||(!pills?'<span class="vehicle-card-pill">기타 동력</span>':'')}</div><div class="vehicle-card-status">${efficiencyFacts(f)}</div><div class="card-scope">등록 사양 범위 · 연식별 차이</div><div class="card-availability">세금·에너지비 ${costLabel(f)} · 제조사 제원 ${spec}</div></div><div class="vehicle-card-actions"><a class="primary" href="${esc(details)}">차량 보기</a><a href="../tools/annual-cost/?fa=${id}">비용 계산</a><a href="../compare/?fa=${id}">비교</a></div></article>`;
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
    q('#catalogActiveFilters').textContent=[state.q?'검색: '+state.q:'',state.maker,ptLabel[state.fuel],state.origin==='domestic'?'국내 브랜드':state.origin==='overseas'?'해외 브랜드':'',state.vehicleClass].filter(Boolean).join(' · ')||'모든 차량';
    const rows=filtered();
    const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
    if(!Number.isSafeInteger(state.page)||state.page<1)state.page=1;
    if(state.page>pages)state.page=pages;
    const slice=rows.slice((state.page-1)*PAGE_SIZE,state.page*PAGE_SIZE);
    q('#catalogCount').textContent=`${rows.length.toLocaleString('ko-KR')}대의 차량`;
    q('#catalogPageInfo').textContent=rows.length?`${state.page} / ${pages} 페이지`:'조건에 맞는 차량이 없습니다';
    q('#catalogGrid').innerHTML=slice.length?slice.map(card).join(''):`<div class="catalog-empty"><strong>조건에 맞는 차량이 없습니다.</strong><p>차량명이나 제조사, 브랜드 구분, 차량 종류, 연료 조건을 바꿔보세요.</p></div>`;
    renderPager(pages);renderMakerChips();renderOriginChips();renderClassChips();renderFuelChips();setUrl();
    window.__catalogVisible=slice;document.dispatchEvent(new CustomEvent("catalog:render",{detail:{rows:slice}}));
  }

  async function init(){
    injectStyle();
    photos=await import('./vehicle-photos.js?v=expanded-20260908');photos.installPhotoStyles();
    const hero=q('.page-hero .allcar-head>div:first-child');
    if(hero){const kicker=q('.db-kicker',hero),h1=q('h1',hero),p=q('p',hero);if(kicker)kicker.textContent='차량';if(h1)h1.textContent='차량 찾기';if(p)p.textContent='차종을 선택하면 제원과 사양별 연비를 볼 수 있습니다.';}
    const oldSection=q('.db-section .db-shell');if(!oldSection)return;
    const consumer=document.createElement('div');consumer.className='consumer-catalog';
    consumer.innerHTML=`<section class="catalog-overview" aria-label="차량 데이터 범위"><div class="catalog-overview-intro"><strong>차를 고르면 바로 확인됩니다</strong><span>공식 연비·전비, 자동차세, 주행거리별 에너지비, 차량 비교</span></div><div class="catalog-overview-stat"><b id="catalogAllCount">422</b><span>찾을 수 있는 차종</span></div><div class="catalog-overview-stat"><b id="catalogPhotoCount">383</b><span>대표 사진 보유</span></div><div class="catalog-overview-stat"><b id="catalogCalcCount">—</b><span>비용 계산 가능</span></div></section><div class="catalog-toolbar"><div class="catalog-search-row"><label><span class="catalog-label">차량 검색</span><input id="catalogSearch" type="search" placeholder="예: 쏘렌토, 아이오닉, BMW" autocomplete="off"></label><label><span class="catalog-label">제조사</span><select id="catalogMaker"><option value="">모든 제조사</option></select></label></div><div class="catalog-filter-wrap"><span class="catalog-label">주요 제조사</span><div id="catalogMakerChips" class="catalog-chip-row"></div></div><details class="catalog-extra"><summary>브랜드·차량 종류</summary><div class="catalog-filter-wrap"><span class="catalog-label">브랜드 구분</span><div id="catalogOriginChips" class="catalog-chip-row"></div></div><div class="catalog-filter-wrap"><span class="catalog-label">공식 차종 분류</span><div id="catalogClassChips" class="catalog-chip-row"></div></div></details><div class="catalog-filter-wrap"><span class="catalog-label">연료·동력</span><div id="catalogFuelChips" class="catalog-chip-row"></div></div></div><div class="catalog-filter-summary"><span id="catalogActiveFilters" aria-live="polite"></span><button id="catalogReset" class="catalog-chip" type="button">필터 초기화</button></div><div class="catalog-results-head"><strong id="catalogCount">전체 차량</strong><div class="catalog-result-options"><span id="catalogPageInfo"></span><label class="catalog-sort"><span>정렬</span><select id="catalogSort"><option value="photos">사진 있는 차량 먼저</option><option value="name">제조사순</option><option value="model">차량명순</option></select></label></div></div><div id="catalogGrid" class="vehicle-card-grid"></div><div id="catalogPager" class="catalog-pager"></div>`;
    oldSection.insertBefore(consumer,q('#tableHost'));
    consumer.querySelector('.catalog-extra').open=matchMedia('(min-width: 1000px)').matches;
    const src=q('.source-strip');if(src)src.textContent='차량 데이터: 한국에너지공단 · 차량 사진: 라이선스가 확인된 Wikimedia Commons 파일만 사용';
    const summary=q('#resultCount')?.closest('.allcar-summary');if(summary)summary.style.display='none';
    const params=new URLSearchParams(location.search);state.q=params.get('q')||'';state.maker=params.get('maker')||'';state.fuel=params.get('fuel')||'';state.origin=params.get('origin')||'';state.vehicleClass=params.get('class')||'';state.page=Math.max(1,Number(params.get('page')||1));state.sort=['name','model'].includes(params.get('sort'))?params.get('sort'):'photos';
    const photoRequest=photos.loadPhotos();
    let data;try{const r=await fetch('../data/generated/catalog-list-index.json',{cache:'no-cache'});if(!r.ok)throw new Error('load');data=await r.json();}catch{q('#catalogGrid').innerHTML='<div class="catalog-empty">차량 목록을 불러오지 못했습니다.</div>';return;}
    state.images=await photoRequest;
    photos.bindPhotoFallback(q('#catalogGrid'));
    state.rows=(data.families||[]).slice().sort((a,b)=>compareNames(String(a.maker),String(b.maker))||compareNames(String(a.family_name),String(b.family_name)));
    q('#catalogAllCount').textContent=state.rows.length.toLocaleString('ko-KR');
    q('#catalogPhotoCount').textContent=state.images.size.toLocaleString('ko-KR');
    q('#catalogCalcCount').textContent=state.rows.filter(f=>Number(f.full_ready_count||0)>0).length.toLocaleString('ko-KR');
    for(const f of state.rows)searchIndex.set(f.family_id,familySearchText(f));
    const makerMap=new Map();for(const f of state.rows)makerMap.set(f.maker,(makerMap.get(f.maker)||0)+1);
    const makers=[...makerMap].map(([maker,count])=>({maker,count})).sort((a,b)=>b.count-a.count||a.maker.localeCompare(b.maker,'ko'));window.__consumerMakers=makers;
    q('#catalogMaker').innerHTML='<option value="">모든 제조사</option>'+makers.map(m=>`<option value="${esc(m.maker)}">${esc(m.maker)} (${m.count})</option>`).join('');
    if(state.fuel&&!ptOrder.includes(state.fuel))state.fuel='';
    if(state.maker&&!makerMap.has(state.maker))state.maker='';
    if(!['','domestic','overseas'].includes(state.origin))state.origin='';
    const classSet=new Set(state.rows.flatMap(f=>f.vehicle_classes||[]));if(state.vehicleClass&&!classSet.has(state.vehicleClass))state.vehicleClass='';
    q('#catalogMaker').value=state.maker;q('#catalogSearch').value=state.q;q('#catalogSort').value=state.sort;
    q('#catalogSort').addEventListener('change',e=>{state.sort=e.target.value;state.page=1;renderAll();});
    q('#catalogSearch').addEventListener('input',e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.q=e.target.value.trim();state.page=1;renderAll();},180)});
    q('#catalogMaker').addEventListener('change',e=>{state.maker=e.target.value;state.page=1;renderAll();});
    q('#catalogReset').onclick=()=>{clearTimeout(searchTimer);Object.assign(state,{q:'',maker:'',fuel:'',origin:'',vehicleClass:'',sort:'photos',page:1});q('#catalogSort').value='photos';q('#catalogSearch').value='';q('#catalogMaker').value='';renderAll();q('#catalogSearch').focus();};
    renderAll();q('#catalogStatic')?.setAttribute('hidden','');root.dataset.consumerCatalog='ready';root.dataset.vehicleImages=String(state.images.size);
  }
  init().catch(()=>{});
})();
