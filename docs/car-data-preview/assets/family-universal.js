(function(){
  const id=new URLSearchParams(location.search).get('id');
  if(!id)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n).toLocaleString('ko-KR');
  const ptLabel={gasoline:'휘발유',diesel:'경유',lpg:'LPG',hybrid:'하이브리드',phev:'플러그인 하이브리드',electric:'전기',hydrogen:'수소',unknown:'유형 미분류'};
  const waitFor=(selector,timeout=10000)=>new Promise((resolve,reject)=>{
    const found=document.querySelector(selector);if(found)return resolve(found);
    const obs=new MutationObserver(()=>{const el=document.querySelector(selector);if(el){obs.disconnect();resolve(el)}});obs.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>{obs.disconnect();reject(new Error('timeout'))},timeout);
  });
  function injectStyle(){
    if(document.getElementById('familyUniversalStyle'))return;
    const style=document.createElement('style');style.id='familyUniversalStyle';style.textContent=`
      .universal-panel{border-top:2px solid #111;margin:30px 0 38px;padding-top:18px}.universal-head{display:flex;justify-content:space-between;gap:20px;align-items:start}.universal-head h2{font-size:24px;margin:0 0 7px}.universal-head p{font-size:12px;color:#666;margin:0;max-width:560px}.universal-summary{display:grid;grid-template-columns:repeat(4,1fr);border-left:1px solid #ddd;border-top:1px solid #ddd;margin:18px 0}.universal-summary>div{padding:13px;border-right:1px solid #ddd;border-bottom:1px solid #ddd}.universal-summary span{display:block;font-size:11px;color:#777}.universal-summary b{display:block;font-size:17px;margin-top:5px}.official-pt-table{border-top:1px solid #bbb}.official-powertrain-row{display:grid;grid-template-columns:minmax(145px,1.2fr) 84px minmax(115px,.9fr) minmax(160px,1.25fr) minmax(115px,.9fr);gap:10px;padding:11px 0;border-bottom:1px solid #e5e5e5;font-size:13px;align-items:center}.official-powertrain-row.head{font-size:11px;color:#777}.eff-sub{display:block;font-size:10px;color:#777;margin-top:3px;line-height:1.45}.official-note{font-size:11px;color:#777;margin-top:12px}.official-note a{color:#174ea6}.vehicle-checks{display:flex;justify-content:space-between;gap:18px;align-items:center;border:1px solid #d8d8d8;background:#fafafa;padding:14px;margin-top:18px}.vehicle-checks strong{display:block;font-size:14px}.vehicle-checks span{display:block;font-size:11px;color:#666;margin-top:4px;line-height:1.5}.vehicle-check-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.vehicle-check-actions a{display:inline-flex;align-items:center;min-height:42px;padding:0 11px;border:1px solid #aaa;background:#fff;color:#111;text-decoration:none;font-size:12px}.vehicle-check-actions a.primary{background:#111;color:#fff;border-color:#111}@media(max-width:700px){.universal-head{display:block}.universal-head p{margin-top:8px}.universal-summary{grid-template-columns:repeat(2,1fr)}.official-powertrain-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:5px 10px}.official-powertrain-row.head{display:none}.official-powertrain-row>div:first-child{grid-column:1/-1;font-weight:700}.vehicle-checks{display:block}.vehicle-check-actions{justify-content:flex-start;margin-top:12px}.vehicle-check-actions a{min-height:44px}}
    `;document.head.appendChild(style);
  }
  const val=n=>Number.isInteger(Number(n))?fmt(Number(n)):Number(Number(n).toFixed(2)).toLocaleString('ko-KR');
  const mm=(obj,suffix='')=>!obj?'—':`${val(obj.min)}${obj.min===obj.max?'':' ~ '+val(obj.max)}${suffix}`;
  const efficiencyUnit=kind=>kind==='electric'?' km/kWh':['gasoline','diesel','lpg','hybrid'].includes(kind)?' km/L':'';
  const efficiency=(kind,obj)=>!obj?'—':mm(obj,efficiencyUnit(kind));
  const detailEfficiency=(kind,p)=>{
    const combined=efficiency(kind,p.combined_efficiency),city=efficiency(kind,p.city_efficiency),highway=efficiency(kind,p.highway_efficiency);
    const extras=[];if(city!=='—')extras.push(`도심 ${city}`);if(highway!=='—')extras.push(`고속 ${highway}`);
    return `${esc(combined)}${extras.length?`<span class="eff-sub">${esc(extras.join(' · '))}</span>`:''}`;
  };
  async function render(){
    injectStyle();
    const anchor=await waitFor('.calc-strip');
    const res=await fetch('../../data/generated/family-detail-index.json',{cache:'no-store'});if(!res.ok)return;
    const index=await res.json(),family=(index.families||[]).find(f=>f.family_id===id);if(!family)return;
    const name=family.family_name||'차량';
    const officialRecall=`https://www.car.go.kr/ri/stat/list.do?ctype=O&currentPageNo=1&searchProductName=${encodeURIComponent(name)}`;
    const officialService=`https://www.car.go.kr/ri/grts/list.do?currentPageNo=1&searchFld=3&searchWord=${encodeURIComponent(name)}`;
    const localRecall=`../../recalls/?q=${encodeURIComponent(name)}`;
    const section=document.createElement('section');section.className='universal-panel';section.dataset.familyUniversal='ready';
    const body=(family.powertrains||[]).map(p=>{
      const cc=mm(p.displacement_cc,' cc'),driving=mm(p.range_km,' km');
      const grade=(p.efficiency_grades||[]).length?`${p.efficiency_grades.join(', ')}등급`:'—';
      return `<div class="official-powertrain-row"><div>${esc(ptLabel[p.powertrain]||p.powertrain)}</div><div>${fmt(p.row_count)}개</div><div>${esc(cc)}</div><div>${detailEfficiency(p.powertrain,p)}</div><div>${esc(driving!=='—'?driving:grade)}</div></div>`;
    }).join('');
    section.innerHTML=`<div class="universal-head"><div><div class="db-kicker">한국에너지공단 공식 신고 제원</div><h2>${esc(name)} 전체 사양</h2></div><p>모든 차종에 공통으로 제공하는 공식 데이터입니다. 한국에너지공단 신고 값을 차종별로 묶어 보여주며 서로 다른 사양의 값을 임의로 하나로 합치지 않습니다.</p></div><div class="universal-summary"><div><span>공식 신고 사양</span><b>${fmt(family.active_record_count)}개</b></div><div><span>원문 모델</span><b>${fmt(family.raw_model_count)}개</b></div><div><span>세대</span><b>${fmt(family.generation_labels?.length||family.generation_count||0)}개</b></div><div><span>차종 분류</span><b>${esc((family.vehicle_classes||[]).join(' · ')||'공식 분류 미표기')}</b></div></div><div class="official-pt-table"><div class="official-powertrain-row head"><div>파워트레인</div><div>사양 수</div><div>배기량</div><div>복합·도심·고속 연비/전비</div><div>1회충전거리 / 등급</div></div>${body}</div><div class="official-note">출처: 한국에너지공단 자동차 표시연비·에너지효율 공식 데이터 · 세금 계산 ${fmt(family.tax_ready_count)}개 · 에너지비 계산 ${fmt(family.energy_ready_count)}개 · 둘 다 ${fmt(family.full_ready_count)}개 · <a href="../../data-sources/">데이터 출처와 계산 기준</a></div><div class="vehicle-checks"><div><strong>${esc(name)} 리콜·무상수리 확인</strong><span>모델 검색 결과와 내 차량의 실제 대상 여부는 다를 수 있습니다. 최종 대상 여부는 자동차리콜센터에서 차량번호 또는 VIN으로 확인하세요.</span></div><div class="vehicle-check-actions"><a href="${localRecall}">리콜 정보 보기</a><a class="primary official-recall-link" href="${officialRecall}" target="_blank" rel="noopener">공식 리콜 검색</a><a class="official-service-link" href="${officialService}" target="_blank" rel="noopener">공식 무상수리 검색</a></div></div>`;
    anchor.insertAdjacentElement('afterend',section);
    const fallback=[...document.querySelectorAll('.spec-panel h2')].find(el=>/공식 데이터 확인되지 않음/.test(el.textContent||''));
    if(fallback){fallback.textContent='제조사 상세제원 확인 중';const p=fallback.closest('.spec-panel')?.querySelector('.spec-head p');if(p)p.textContent='위 공식 신고 제원 외에 전장·전폭·전고·축거·출력·토크 등은 제조사 공식 자료에서 확인되는 대로 추가합니다.'}
  }
  render().catch(()=>{});
})();
