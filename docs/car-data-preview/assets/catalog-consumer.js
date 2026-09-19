(function(){
  const root=document.documentElement;
  const q=(sel,ctx=document)=>ctx.querySelector(sel);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s??'').toLowerCase().replace(/[\s_.\-/()]+/g,'');
  const ptLabel={gasoline:'휘발유',diesel:'경유',lpg:'LPG',hybrid:'하이브리드',phev:'플러그인 하이브리드',electric:'전기',hydrogen:'수소',unknown:''};
  const ptOrder=['gasoline','diesel','lpg','hybrid','phev','electric','hydrogen','unknown'];
  const classOrder=['승용차','승합차','화물차','특수차'];
  const domesticTokens=['현대','기아','제네시스','kg모빌리티','케이지모빌리티','쌍용','르노코리아','르노삼성','한국지엠','한국gm'];
  const PAGE_SIZE=24;
  let photos,searchTimer;
  const compareNames=new Intl.Collator('ko').compare;
  const searchIndex=new Map();
  const state={rows:[],images:new Map(),calcRows:new Map(),fuelPrice:null,q:'',maker:'',fuel:'',origin:'',vehicleClass:'',sort:'photos',page:1};

  function isDomesticBrand(maker){
    const v=norm(maker);
    return domesticTokens.some(t=>v.includes(norm(t)));
  }
  function originLabel(f){return isDomesticBrand(f.maker)?'국내 브랜드':'해외 브랜드'}

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
  function representative(f){
    const rows=state.calcRows.get(f.family_id)||[];
    const preferred=['gasoline','diesel','lpg','hybrid','electric'];
    return rows.filter(row=>row.full_cost_ready).sort((a,b)=>preferred.indexOf(a.powertrain)-preferred.indexOf(b.powertrain)||Number(b.combined_efficiency||0)-Number(a.combined_efficiency||0))[0]
      || rows.filter(row=>row.energy_cost_ready||row.tax_ready).sort((a,b)=>Number(b.energy_cost_ready&&b.tax_ready)-Number(a.energy_cost_ready&&a.tax_ready))[0]
      || rows[0]
      || null;
  }
  function decisionCost(f){
    const row=representative(f);if(!row)return null;
    const price=row.fuel_price_key&&state.fuelPrice?.prices?.[row.fuel_price_key];
    const energy=row.energy_cost_ready&&price?CAR_COST_MATH.energyCost(20000,Number(row.combined_efficiency),Number(price)):null;
    const tax=row.tax_ready?CAR_COST_MATH.annualTax(Number(row.displacement_cc),row.powertrain==='electric','2026-01',2026):null;
    return {row,energy,tax:tax?.total??null,total:energy!==null&&tax?.total!==undefined?energy+tax.total:null};
  }
  const won=value=>Number.isFinite(value)?`${Math.round(value).toLocaleString('ko-KR')}원`:'계산 조건 확인';
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
      const costA=decisionCost(a),costB=decisionCost(b);
      const metricSort=state.sort==='cost'?(costA?.total??Number.MAX_SAFE_INTEGER)-(costB?.total??Number.MAX_SAFE_INTEGER)
        :state.sort==='tax'?(costA?.tax??Number.MAX_SAFE_INTEGER)-(costB?.tax??Number.MAX_SAFE_INTEGER)
        :state.sort==='efficiency'?Number(costB?.row?.combined_efficiency||-1)-Number(costA?.row?.combined_efficiency||-1):0;
      const photo=state.sort==='photos'?Number(state.images.has(b.family_id))-Number(state.images.has(a.family_id)):0;
      const depth=state.sort==='photos'?Number(b.full_ready_count||0)-Number(a.full_ready_count||0)||Number(b.energy_ready_count||0)-Number(a.energy_ready_count||0)||Number(b.tax_ready_count||0)-Number(a.tax_ready_count||0):0;
      const alphabetical=state.sort==='name'?maker||model:model||maker;
      return relevanceDiff||metricSort||photo||depth||alphabetical||compareNames(a.family_id,b.family_id);
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
    const preferred=['현대','기아','제네시스','케이지모빌리티','KG모빌리티','르노코리아','한국지엠'];
    const all=window.__consumerMakers||[],byName=new Map(all.map(item=>[item.maker,item]));
    const popular=preferred.map(name=>byName.get(name)).filter(Boolean).filter((item,index,items)=>items.findIndex(v=>v.maker===item.maker)===index);
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
    const rows=(f.powertrains||[]).filter(p=>['gasoline','diesel','hybrid','lpg','phev','electric','hydrogen'].includes(p.powertrain)&&p.combined_efficiency?.min>0&&p.combined_efficiency?.max>0);
    rows.sort((a,b)=>Number(b.powertrain===state.fuel)-Number(a.powertrain===state.fuel)||ptOrder.indexOf(a.powertrain)-ptOrder.indexOf(b.powertrain));
    return rows.slice(0,2).map(p=>{const e=p.combined_efficiency,isElectricEfficiency=p.powertrain==='electric'||p.powertrain==='phev'&&p.range_km?.min>0,unit=isElectricEfficiency?'km/kWh':p.powertrain==='hydrogen'?'km/kg':'km/L';return '<div><span>'+ptLabel[p.powertrain]+(isElectricEfficiency?' 전비':p.powertrain==='hydrogen'?' 효율':' 연비')+'</span><b>'+e.min+(e.min===e.max?'':'–'+e.max)+' <small>'+unit+'</small></b></div>';}).join('')||'<div><span>연비·전비</span><b>공개값 없음</b></div>';
  }
  function decisionFacts(f){
    const data=decisionCost(f),row=data?.row;
    if(!row)return '<div class="vehicle-card-annual"><span>연 2만km 총비용</span><strong>계산 조건 확인</strong></div>';
    const unit=row.powertrain==='electric'||row.powertrain==='phev'&&row.range_km>0?'km/kWh':row.powertrain==='hydrogen'?'km/kg':'km/L';
    const efficiency=Number.isFinite(Number(row.combined_efficiency))?`${Number(row.combined_efficiency).toFixed(1)} ${unit}`:'공개값 없음';
    return `<div class="vehicle-card-annual"><span>세금+에너지비 · 2만km</span><strong>${data.total!==null?won(data.total)+'/년':'직접 계산'}</strong></div><dl class="vehicle-card-kpis"><div><dt>복합</dt><dd>${esc(efficiency)}</dd></div><div><dt>자동차세</dt><dd>${data.tax!==null?won(data.tax):'—'}</dd></div><div><dt>에너지비</dt><dd>${data.energy!==null?won(data.energy):'—'}</dd></div></dl>`;
  }
  function card(f,index){
    const pts=[...new Set((f.powertrains||[]).map(p=>p.powertrain))].filter(Boolean);
    const pillLabels=pts.map(p=>ptLabel[p]||'').filter(Boolean);
    const pills=pillLabels.slice(0,4).map(label=>`<span class="vehicle-card-pill">${esc(label)}</span>`).join('');
    const more=pillLabels.length>4?`<span class="vehicle-card-pill">+${pillLabels.length-4}</span>`:'';
    const spec=f.manufacturer_detail?'제공':'미수록';
    const classes=f.vehicle_classes||[];
    const visibleClasses=state.vehicleClass?[state.vehicleClass,...classes.filter(v=>v!==state.vehicleClass)]:classes;
    const category=visibleClasses.slice(0,2).join(' · ')||f.category||'';
    const id=encodeURIComponent(f.family_id);
    const detailAction=f.path?`<a class="primary" href="../${esc(f.path)}">차량 보기</a>`:`<a class="primary" href="./family/?id=${id}">신고 사양</a>`;
    const costAction=f.full_ready_count>0?`<a href="../tools/annual-cost/?fa=${id}">비용 계산</a>`:`<a href="./family/?id=${id}">계산 조건 확인</a>`;
    return `<article class="vehicle-card" data-family-id="${esc(f.family_id)}">${media(f,index)}<div class="vehicle-card-main"><div class="vehicle-card-maker">${esc(f.maker)}${category?' · '+esc(category):''}</div><h2>${esc(f.family_name)}</h2><div class="vehicle-card-meta">${esc(generationLabel(f))} · ${Number(f.record_count||0).toLocaleString('ko-KR')}개 트림</div><div class="vehicle-card-pills"><span class="vehicle-card-pill origin">${esc(originLabel(f))}</span>${pills}${more}</div><div class="vehicle-card-status">${decisionFacts(f)}</div><div class="card-scope">등록 사양 범위 · 연식별 차이</div><div class="card-availability">세금·에너지비 ${costLabel(f)} · 제조사 제원 ${spec}</div></div><div class="vehicle-card-actions">${detailAction}${costAction}<button type="button" data-compare-pick data-compare-mode="all" data-compare-id="${esc(f.family_id)}" data-compare-label="${esc(f.family_name)}">비교에 담기</button></div></article>`;
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

    photos=await import('./vehicle-photos.js?v=expanded-20260908');photos.installPhotoStyles();
    const hero=q('.page-hero .allcar-head>div:first-child');
    if(hero){const kicker=q('.db-kicker',hero),h1=q('h1',hero),p=q('p',hero);if(kicker)kicker.textContent='차량';if(h1)h1.textContent='차량 찾기';if(p)p.textContent='차종을 선택하면 제원과 사양별 연비를 볼 수 있습니다.';}
    const oldSection=q('.db-section .db-shell');if(!oldSection)return;
    const consumer=document.createElement('div');consumer.className='consumer-catalog';
    consumer.innerHTML=`<div class="catalog-toolbar"><div class="catalog-search-row"><label><span class="catalog-label">차량 검색</span><input id="catalogSearch" type="search" placeholder="그랜저, 아이오닉 5, 쏘렌토…" autocomplete="off"></label><label><span class="catalog-label">제조사</span><select id="catalogMaker"><option value="">모든 제조사</option></select></label></div><div class="catalog-filter-wrap"><span class="catalog-label">주요 제조사</span><div id="catalogMakerChips" class="catalog-chip-row"></div></div><details class="catalog-extra"><summary>브랜드·차량 종류</summary><div class="catalog-filter-wrap"><span class="catalog-label">브랜드 구분</span><div id="catalogOriginChips" class="catalog-chip-row"></div></div><div class="catalog-filter-wrap"><span class="catalog-label">공식 차종 분류</span><div id="catalogClassChips" class="catalog-chip-row"></div></div></details><div class="catalog-filter-wrap"><span class="catalog-label">연료·동력</span><div id="catalogFuelChips" class="catalog-chip-row"></div></div></div><div class="catalog-filter-summary"><span id="catalogActiveFilters" aria-live="polite"></span><button id="catalogReset" class="catalog-chip" type="button">필터 초기화</button></div><div class="catalog-results-head"><strong id="catalogCount">전체 차량</strong><div class="catalog-result-options"><span id="catalogPageInfo"></span><label class="catalog-sort"><span>정렬</span><select id="catalogSort"><option value="photos">사진 있는 차량 먼저</option><option value="cost">연간 총비용 낮은 순</option><option value="efficiency">연비·전비 높은 순</option><option value="tax">자동차세 낮은 순</option><option value="name">제조사순</option><option value="model">차량명순</option></select></label></div></div><div id="catalogGrid" class="vehicle-card-grid"></div><div id="catalogPager" class="catalog-pager"></div>`;
    oldSection.insertBefore(consumer,q('#tableHost'));
    consumer.querySelector('.catalog-extra').open=matchMedia('(min-width: 1000px)').matches;
    const src=q('.source-strip');if(src)src.textContent='차량 데이터: 한국에너지공단 · 차량 사진: 라이선스가 확인된 Wikimedia Commons 파일만 사용';
    const summary=q('#resultCount')?.closest('.allcar-summary');if(summary)summary.style.display='none';
    const params=new URLSearchParams(location.search);state.q=params.get('q')||'';state.maker=params.get('maker')||'';state.fuel=params.get('fuel')||'';state.origin=params.get('origin')||'';state.vehicleClass=params.get('class')||'';state.page=Math.max(1,Number(params.get('page')||1));state.sort=['cost','efficiency','tax','name','model'].includes(params.get('sort'))?params.get('sort'):'photos';
    const photoRequest=photos.loadPhotos();
    let data,calc;try{const [listResponse,calcResponse]=await Promise.all([fetch('../data/generated/catalog-list-index.json',{cache:'no-cache'}),fetch('../data/generated/all-car-calc-index.json',{cache:'no-cache'})]);if(!listResponse.ok||!calcResponse.ok)throw new Error('load');[data,calc]=await Promise.all([listResponse.json(),calcResponse.json()]);}catch{q('#catalogGrid').innerHTML='<div class="catalog-empty">차량 목록을 불러오지 못했습니다.</div>';return;}
    state.images=await photoRequest;
    photos.bindPhotoFallback(q('#catalogGrid'));
    state.rows=(data.families||[]).slice().sort((a,b)=>compareNames(String(a.maker),String(b.maker))||compareNames(String(a.family_name),String(b.family_name)));
    state.fuelPrice=calc.fuel_price||null;
    for(const row of calc.rows||[]){if(!state.calcRows.has(row.family_id))state.calcRows.set(row.family_id,[]);state.calcRows.get(row.family_id).push(row);}
    for(const f of state.rows)searchIndex.set(f.family_id,familySearchText(f));
    const makerMap=new Map();for(const f of state.rows)makerMap.set(f.maker,(makerMap.get(f.maker)||0)+1);
    const domesticOrder=['현대','기아','제네시스','케이지모빌리티','KG모빌리티','르노코리아','한국지엠'];
    const domesticRank=maker=>{const index=domesticOrder.indexOf(maker);return index<0?Number.MAX_SAFE_INTEGER:index};
    const makers=[...makerMap].map(([maker,count])=>({maker,count})).sort((a,b)=>domesticRank(a.maker)-domesticRank(b.maker)||a.maker.localeCompare(b.maker,'ko'));window.__consumerMakers=makers;
    const domesticMakers=makers.filter(m=>domesticRank(m.maker)<Number.MAX_SAFE_INTEGER),overseasMakers=makers.filter(m=>domesticRank(m.maker)===Number.MAX_SAFE_INTEGER);
    const makerOptions=rows=>rows.map(m=>`<option value="${esc(m.maker)}">${esc(m.maker)} (${m.count})</option>`).join('');
    q('#catalogMaker').innerHTML='<option value="">모든 제조사</option>'+`<optgroup label="국내 브랜드">${makerOptions(domesticMakers)}</optgroup><optgroup label="해외 브랜드">${makerOptions(overseasMakers)}</optgroup>`;
    if(state.fuel&&!ptOrder.includes(state.fuel))state.fuel='';
    if(state.maker&&!makerMap.has(state.maker))state.maker='';
    if(!['','domestic','overseas'].includes(state.origin))state.origin='';
    const classSet=new Set(state.rows.flatMap(f=>f.vehicle_classes||[]));if(state.vehicleClass&&!classSet.has(state.vehicleClass))state.vehicleClass='';
    q('#catalogMaker').value=state.maker;q('#catalogSearch').value=state.q;q('#catalogSort').value=state.sort;
    q('#catalogSort').addEventListener('change',e=>{state.sort=e.target.value;state.page=1;renderAll();});
    q('#catalogSearch').addEventListener('input',e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.q=e.target.value.trim();state.page=1;renderAll();},180)});
    q('#catalogMaker').addEventListener('change',e=>{state.maker=e.target.value;state.page=1;renderAll();});
    q('#catalogReset').onclick=()=>{clearTimeout(searchTimer);Object.assign(state,{q:'',maker:'',fuel:'',origin:'',vehicleClass:'',sort:'photos',page:1});q('#catalogSort').value='photos';q('#catalogSearch').value='';q('#catalogMaker').value='';renderAll();q('#catalogSearch').focus();};
    renderAll();root.dataset.consumerCatalog='ready';root.dataset.vehicleImages=String(state.images.size);
  }
  init().catch(()=>{});
})();
