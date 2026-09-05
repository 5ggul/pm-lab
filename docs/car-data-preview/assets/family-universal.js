(function(){
  const id=new URLSearchParams(location.search).get('id');
  if(!id)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n).toLocaleString('ko-KR');
  const ptLabel={gasoline:'휘발유',diesel:'경유',lpg:'LPG',hybrid:'하이브리드',phev:'플러그인 하이브리드',electric:'전기',hydrogen:'수소',unknown:'유형 미분류'};
  const finite=(rows,key,positive=false)=>rows.map(r=>Number(r[key])).filter(n=>Number.isFinite(n)&&(!positive||n>0));
  const uniq=arr=>[...new Set(arr)];
  const range=(values,suffix='')=>{
    const v=uniq(values).sort((a,b)=>a-b);if(!v.length)return'—';
    const a=v[0],b=v[v.length-1],f=n=>Number.isInteger(n)?fmt(n):Number(n.toFixed(2)).toLocaleString('ko-KR');
    return `${f(a)}${a===b?'':' ~ '+f(b)}${suffix}`;
  };
  const waitFor=(selector,timeout=10000)=>new Promise((resolve,reject)=>{
    const found=document.querySelector(selector);if(found)return resolve(found);
    const obs=new MutationObserver(()=>{const el=document.querySelector(selector);if(el){obs.disconnect();resolve(el)}});obs.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>{obs.disconnect();reject(new Error('timeout'))},timeout);
  });
  function injectStyle(){
    if(document.getElementById('familyUniversalStyle'))return;
    const style=document.createElement('style');style.id='familyUniversalStyle';style.textContent=`
      .universal-panel{border-top:2px solid #111;margin:30px 0 38px;padding-top:18px}.universal-head{display:flex;justify-content:space-between;gap:20px;align-items:start}.universal-head h2{font-size:24px;margin:0 0 7px}.universal-head p{font-size:12px;color:#666;margin:0;max-width:560px}.universal-summary{display:grid;grid-template-columns:repeat(4,1fr);border-left:1px solid #ddd;border-top:1px solid #ddd;margin:18px 0}.universal-summary>div{padding:13px;border-right:1px solid #ddd;border-bottom:1px solid #ddd}.universal-summary span{display:block;font-size:11px;color:#777}.universal-summary b{display:block;font-size:17px;margin-top:5px}.official-pt-table{border-top:1px solid #bbb}.official-powertrain-row{display:grid;grid-template-columns:minmax(145px,1.2fr) 84px minmax(115px,.9fr) minmax(115px,.9fr) minmax(115px,.9fr);gap:10px;padding:11px 0;border-bottom:1px solid #e5e5e5;font-size:13px;align-items:center}.official-powertrain-row.head{font-size:11px;color:#777}.official-note{font-size:11px;color:#777;margin-top:12px}.official-note a{color:#174ea6}@media(max-width:700px){.universal-head{display:block}.universal-head p{margin-top:8px}.universal-summary{grid-template-columns:repeat(2,1fr)}.official-powertrain-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:5px 10px}.official-powertrain-row.head{display:none}.official-powertrain-row>div:first-child{grid-column:1/-1;font-weight:700}}
    `;document.head.appendChild(style);
  }
  function groupRows(rows){
    const map=new Map();
    for(const r of rows){const key=r.powertrain||'unknown';if(!map.has(key))map.set(key,[]);map.get(key).push(r)}
    return [...map.entries()].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0]));
  }
  function efficiencyText(kind,rows){
    const values=finite(rows,'combined_efficiency',true);if(!values.length)return'—';
    const unit=kind==='electric'?' km/kWh':['gasoline','diesel','lpg','hybrid'].includes(kind)?' km/L':'';
    return range(values,unit);
  }
  async function render(){
    injectStyle();
    const anchor=await waitFor('.calc-strip');
    const [calcRes,hRes]=await Promise.all([fetch('../../data/generated/all-car-calc-index.json',{cache:'no-store'}),fetch('../../data/generated/service-hierarchy.json',{cache:'no-store'})]);
    if(!calcRes.ok||!hRes.ok)return;
    const [calc,h]=await Promise.all([calcRes.json(),hRes.json()]);
    const rows=(calc.rows||[]).filter(r=>r.family_id===id);if(!rows.length)return;
    const family=(h.families||[]).find(f=>f.family_id===id)||{};
    const classes=uniq(rows.map(r=>r.vehicle_class).filter(Boolean));
    const models=uniq(rows.map(r=>r.raw_model).filter(Boolean));
    const gens=uniq(rows.map(r=>r.generation_label).filter(Boolean));
    const ptGroups=groupRows(rows);
    const section=document.createElement('section');section.className='universal-panel';section.dataset.familyUniversal='ready';
    const body=ptGroups.map(([kind,rs])=>{
      const cc=range(finite(rs,'displacement_cc',true),' cc');
      const eff=efficiencyText(kind,rs);
      const driving=range(finite(rs,'range_km',true),' km');
      const grade=uniq(rs.map(r=>r.efficiency_grade).filter(v=>v!=null&&String(v).trim()!==''));
      return `<div class="official-powertrain-row"><div>${esc(ptLabel[kind]||kind)}</div><div>${fmt(rs.length)}개</div><div>${esc(cc)}</div><div>${esc(eff)}</div><div>${esc(driving!=='—'?driving:(grade.length?grade.join(', ')+'등급':'—'))}</div></div>`;
    }).join('');
    section.innerHTML=`<div class="universal-head"><div><div class="db-kicker">한국에너지공단 공식 신고 제원</div><h2>${esc(family.family_name||rows[0].family_name||'차량')} 전체 사양</h2></div><p>이 영역은 서비스의 모든 차종군에 공통 적용됩니다. 한국에너지공단 공식 신고행을 그대로 집계하며, 서로 다른 사양의 값을 임의로 하나로 합치지 않습니다.</p></div><div class="universal-summary"><div><span>공식 신고 사양</span><b>${fmt(rows.length)}개</b></div><div><span>원문 모델</span><b>${fmt(models.length)}개</b></div><div><span>세대</span><b>${fmt(gens.length)}개</b></div><div><span>차종 분류</span><b>${esc(classes.join(' · ')||'공식 분류 미표기')}</b></div></div><div class="official-pt-table"><div class="official-powertrain-row head"><div>파워트레인</div><div>사양 수</div><div>배기량</div><div>복합 연비·전비</div><div>1회충전거리 / 등급</div></div>${body}</div><div class="official-note">출처: 한국에너지공단 자동차 표시연비·에너지효율 공식 데이터 · 원문 신고행 ${fmt(rows.length)}개를 보존 · <a href="../../data-sources/">데이터 출처와 계산 기준</a></div>`;
    anchor.insertAdjacentElement('afterend',section);
    const fallback=[...document.querySelectorAll('.spec-panel h2')].find(el=>/공식 데이터 확인되지 않음/.test(el.textContent||''));
    if(fallback){fallback.textContent='차체 치수·출력 제조사 원문 보강 대기';const p=fallback.closest('.spec-panel')?.querySelector('.spec-head p');if(p)p.textContent='이 차종의 한국에너지공단 공식 신고 제원은 위에 모두 구현되어 있습니다. 전장·전폭·전고·축거·출력·토크처럼 KEA에 없는 항목만 제조사 공식 원문 보강 대상입니다.'}
  }
  render().catch(()=>{});
})();
