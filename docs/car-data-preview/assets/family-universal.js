(function(){
  const requestedId=new URLSearchParams(location.search).get('id');
  let id=window.__carFamilyId||requestedId;
  if(!requestedId)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n).toLocaleString('ko-KR');
  const ptLabel={gasoline:'휘발유',diesel:'경유',lpg:'LPG',hybrid:'하이브리드',phev:'플러그인 하이브리드',electric:'전기',hydrogen:'수소',unknown:'확인 중'};
  const waitFor=(selector,timeout=10000)=>new Promise((resolve,reject)=>{
    const found=document.querySelector(selector);if(found)return resolve(found);
    const obs=new MutationObserver(()=>{const el=document.querySelector(selector);if(el){obs.disconnect();resolve(el)}});obs.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>{obs.disconnect();reject(new Error('timeout'))},timeout);
  });
  function injectStyle(){
    if(document.getElementById('familyUniversalStyle'))return;
    const style=document.createElement('style');style.id='familyUniversalStyle';style.textContent=`
      .family-stats.consumer-summary{grid-template-columns:repeat(4,1fr)}.family-stats.consumer-summary b{font-size:15px;line-height:1.35;word-break:keep-all}.universal-panel{border-top:2px solid #111;margin:30px 0 38px;padding-top:18px}.universal-head{display:flex;justify-content:space-between;gap:20px;align-items:start}.universal-head h2{font-size:24px;margin:0 0 7px}.universal-head p{font-size:12px;color:#666;margin:0;max-width:560px}.official-pt-table{border-top:1px solid #bbb}.official-powertrain-row{display:grid;grid-template-columns:minmax(145px,1.2fr) minmax(115px,.9fr) minmax(115px,.9fr) minmax(115px,.9fr);gap:10px;padding:11px 0;border-bottom:1px solid #e5e5e5;font-size:13px;align-items:center}.official-powertrain-row.head{font-size:11px;color:#777}.official-note{font-size:11px;color:#777;margin-top:12px}.official-note a{color:#174ea6}.mobile-car-cta{display:none}
      @media(max-width:700px){body{padding-bottom:76px}.family-stats.consumer-summary{grid-template-columns:repeat(2,1fr)}.universal-head{display:block}.universal-head p{margin-top:8px}.official-powertrain-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:5px 10px}.official-powertrain-row.head{display:none}.official-powertrain-row>div:first-child{grid-column:1/-1;font-weight:700}.mobile-car-cta{position:fixed;z-index:50;left:0;right:0;bottom:0;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);border-top:1px solid #ccc;backdrop-filter:blur(8px)}.mobile-car-cta a{display:flex;align-items:center;justify-content:center;min-height:48px;border:1px solid #111;text-decoration:none;font-weight:700;color:#111;background:#fff}.mobile-car-cta a.primary{background:#111;color:#fff}}
    `;document.head.appendChild(style);
  }
  const val=n=>Number.isInteger(Number(n))?fmt(Number(n)):Number(Number(n).toFixed(2)).toLocaleString('ko-KR');
  const mm=(obj,suffix='')=>!obj?'—':`${val(obj.min)}${obj.min===obj.max?'':' ~ '+val(obj.max)}${suffix}`;
  function efficiency(kind,obj){
    if(!obj)return'—';
    const unit=kind==='electric'?' km/kWh':['gasoline','diesel','lpg','hybrid'].includes(kind)?' km/L':'';
    return mm(obj,unit);
  }
  function addMobileCta(){
    if(document.querySelector('.mobile-car-cta'))return;
    const bar=document.createElement('nav');bar.className='mobile-car-cta';bar.setAttribute('aria-label','차량 도구');
    bar.innerHTML=`<a class="primary" href="../../tools/annual-cost/?fa=${encodeURIComponent(id)}">세금·에너지비</a><a href="../../compare/?fa=${encodeURIComponent(id)}">차량 비교</a>`;
    document.body.appendChild(bar);
  }
  function compactTopSummary(family){
    document.querySelectorAll('section.generation').forEach(section=>{
      const detail=document.createElement('details');detail.className='generation';
      const oldHead=section.querySelector('.generation-head'),summary=document.createElement('summary');summary.className='generation-head';
      if(oldHead){while(oldHead.firstChild)summary.appendChild(oldHead.firstChild);oldHead.remove();}
      const meta=summary.querySelector('.generation-meta');if(meta)meta.textContent='사양 보기';
      const title=summary.querySelector('h2');if(title)title.textContent=title.textContent.replace('세대 미분류','세대 확인 중');
      detail.appendChild(summary);while(section.firstChild)detail.appendChild(section.firstChild);section.replaceWith(detail);
    });
    document.querySelectorAll('.raw-sub').forEach(el=>{el.textContent=el.textContent.split(' · 세금')[0];});
    document.querySelectorAll('.raw-actions a').forEach(el=>{if(el.textContent==='신고 데이터')el.textContent='사양 보기';});
    document.querySelectorAll('p.note').forEach(el=>el.remove());
    const powertrains=[...new Set((family.powertrains||[]).map(p=>ptLabel[p.powertrain]||p.powertrain).filter(Boolean))];
    const generationLabels=(family.generation_labels||[]).filter(Boolean).map(v=>v.replace('세대 미분류','세대 확인 중'));
    const generationText=generationLabels.length?`${generationLabels.slice(0,2).join(' · ')}${generationLabels.length>2?` 외 ${generationLabels.length-2}`:''}`:'확인 중';
    const costText=family.full_ready_count>0?'계산 가능':(family.tax_ready_count>0||family.energy_ready_count>0?'일부 가능':'확인 중');
    const manufacturer=!!document.querySelector('.spec-panel .spec-source');
    const stats=document.querySelector('.family-stats');
    if(stats){
      stats.classList.add('consumer-summary');
      stats.innerHTML=`<div><span>연료·동력</span><b>${esc(powertrains.join(' · ')||'확인 중')}</b></div><div><span>세대</span><b>${esc(generationText)}</b></div><div><span>세금·에너지비</span><b>${costText}</b></div><div><span>제조사 제원</span><b>${manufacturer?'제공':'확인 중'}</b></div>`;
    }
    const strip=document.querySelector('.calc-strip');
    if(strip){
      const title=costText==='계산 가능'?'이 차량은 자동차세와 에너지비를 계산할 수 있습니다':costText==='일부 가능'?'일부 사양은 자동차세와 에너지비를 계산할 수 있습니다':'세금·에너지비 계산에 필요한 항목을 확인 중입니다';
      strip.innerHTML=`<strong>자동차세·에너지비 ${costText}</strong><span>주행거리와 단가를 바꿔 계산할 수 있습니다.</span>`;
    }
    const manufacturerPanel=[...document.querySelectorAll('.spec-panel')].find(el=>el.querySelector('.spec-source'));
    if(manufacturerPanel){
      const p=manufacturerPanel.querySelector('.spec-head p');
      if(p)p.textContent='차체 크기 · 출력 · 토크';
    }
    document.querySelectorAll('.generation-meta').forEach(el=>{el.textContent='등록된 세부 사양'});
    document.querySelectorAll('.pt').forEach(el=>{el.textContent=(el.textContent||'').replace(/\s+\d+\s*$/,'').trim()});
  }
  async function render(){
    if(!window.__carFamilyId){
      try{
        const hierarchyResponse=await fetch('../../data/generated/service-hierarchy.json',{cache:'no-store'});
        if(hierarchyResponse.ok){const hierarchy=await hierarchyResponse.json();id=hierarchy.family_aliases?.[requestedId]||requestedId;}
      }catch{}
    }else id=window.__carFamilyId;
    injectStyle();addMobileCta();
    const anchor=await waitFor('.calc-strip');
    const res=await fetch('../../data/generated/family-detail-index.json',{cache:'no-store'});if(!res.ok)return;
    const index=await res.json(),family=(index.families||[]).find(f=>f.family_id===id);if(!family)return;
    compactTopSummary(family);
    // Reserve the photo area before the optional manifest request completes.
    const photos=await import('./vehicle-photos.js?v=expanded-20260908');photos.installPhotoStyles();
    const head=document.querySelector('.family-head');
    if(head){
      head.classList.add('has-photo');
      const heading=document.createElement('div');heading.className='family-heading';
      while(head.firstChild)heading.appendChild(head.firstChild);
      head.appendChild(heading);
      const media=document.createElement('div');media.className='family-photo-host';
      photos.bindPhotoFallback(media);media.innerHTML=photos.photoMarkup(family,null,true);head.appendChild(media);
      photos.loadPhotos().then(images=>{media.innerHTML=photos.photoMarkup(family,images.get(id),true);media.dataset.photosReady='true';});
    }
    const section=document.createElement('section');section.className='universal-panel';section.dataset.familyUniversal='ready';
    const body=(family.powertrains||[]).map(p=>{
      const cc=mm(p.displacement_cc,' cc'),eff=efficiency(p.powertrain,p.combined_efficiency),driving=mm(p.range_km,' km');
      const grade=(p.efficiency_grades||[]).length?`${p.efficiency_grades.join(', ')}등급`:'—';
      return `<div class="official-powertrain-row"><div>${esc(ptLabel[p.powertrain]||p.powertrain)}</div><div>${esc(cc)}</div><div>${esc(eff)}</div><div>${esc(driving!=='—'?driving:grade)}</div></div>`;
    }).join('');
    section.innerHTML=`<div class="universal-head"><div><div class="db-kicker">공식 연비·전비 정보</div><h2>${esc(family.family_name||'차량')} 연비와 주요 사양</h2></div><p>한국에너지공단 · 사양별 표시연비·전비</p></div><div class="official-pt-table"><div class="official-powertrain-row head"><div>연료·동력</div><div>배기량</div><div>복합 연비·전비</div><div>주행거리 / 등급</div></div>${body}</div><div class="official-note">출처: 한국에너지공단 자동차 표시연비·에너지효율 데이터 · <a href="../../data-sources/">출처와 계산 기준</a></div>`;
    const manufacturer=[...document.querySelectorAll('.spec-panel')].find(el=>el.querySelector('.spec-source'));
    (manufacturer||anchor).insertAdjacentElement('afterend',section);
    const fallback=[...document.querySelectorAll('.spec-panel h2')].find(el=>/공식 데이터 확인되지 않음|보강 대기/.test(el.textContent||''));
    if(fallback){fallback.textContent='추가 제원 확인 중';const p=fallback.closest('.spec-panel')?.querySelector('.spec-head p');if(p)p.textContent='전장·전폭·전고·축거·출력·토크처럼 제조사 자료에서 추가 확인되는 제원은 순차적으로 반영합니다.'}
  }
  render().catch(()=>{});
})();
