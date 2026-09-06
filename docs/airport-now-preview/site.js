const BASE='/pm-lab/airport-now-preview/';
let API_BASE=String(window.AIRPORT_NOW_API_BASE||document.querySelector('meta[name="airport-now-api-base"]')?.content||'').replace(/\/+$/,'');
let INDEX=[];
let liveSearchSeq=0;
const STATIC_INDEX=[
  {label:'인천공항 도착편 보는 법',meta:'가이드 · 착륙·도착·예상시간',url:'guide/incheon-arrival-check/',keys:['인천공항 도착','인천 도착','마중','착륙 도착']},
  {label:'공동운항(코드셰어) 찾는 법',meta:'가이드 · 실제 운항편 확인',url:'guide/codeshare/',keys:['공동운항','코드셰어','codeshare','운항사']},
  {label:'항공편 상태 용어',meta:'가이드 · 예정·지연·착륙·도착·결항',url:'guide/flight-status-terms/',keys:['항공편 상태','지연','결항','회항','착륙','도착']},
  {label:'METAR 읽는 법',meta:'가이드 · 풍속·돌풍·시정',url:'guide/metar-for-travelers/',keys:['METAR','메타','공항 날씨','항공기상']},
  {label:'CAVOK 뜻',meta:'가이드 · 항공기상',url:'guide/cavok/',keys:['CAVOK','카복','시정']},
  {label:'제주공항 바람과 결항 확인',meta:'가이드 · 강풍·돌풍',url:'guide/jeju-wind-and-flights/',keys:['제주공항 바람','제주 강풍','제주 결항']},
  {label:'비행기 지연됐을 때 확인할 것',meta:'가이드 · 지연 체크리스트',url:'guide/delay-check-order/',keys:['비행기 지연','항공편 지연','지연됐을때']},
  {label:'공항별 운항정보가 다른 이유',meta:'가이드 · 데이터 갱신 차이',url:'guide/airport-data-differences/',keys:['운항정보 다름','항공사 공항 시간 다름','갱신시간']},
  {label:'METAR 해석기',meta:'도구 · 풍향·풍속·돌풍·시정',url:'tools/metar/',keys:['METAR 해석기','METAR 계산','항공기상 해석']},
  {label:'항공편 지연시간 계산기',meta:'도구 · 예정시간 vs 변경시간',url:'tools/delay-check/',keys:['지연시간 계산','비행기 지연 계산','항공편 지연 계산기']},
  {label:'인천공항 마중시간 계산기',meta:'도구 · 도착예상 + 직접 선택한 여유시간',url:'tools/pickup-time/',keys:['인천공항 마중','마중시간','도착 마중']},
  {label:'항공편·공항기상 용어사전',meta:'자료 · 운항상태·METAR',url:'glossary/',keys:['항공 용어','공항 용어','METAR 용어','지연 용어']}
];
const STATUS_LABELS={SCHEDULED:'예정',BOARDING:'탑승중',DEPARTED:'출발',AIRBORNE:'비행중',LANDED:'착륙',ARRIVED:'도착',DELAYED:'지연',CANCELLED:'결항',DIVERTED:'회항',UNKNOWN:'상태 확인 중'};
function norm(v){return String(v||'').toLowerCase().replace(/\s+/g,'')}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function looksLikeFlightNumber(value){return /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(String(value||'').toUpperCase().replace(/\s+/g,''))}
function resultKey(item){return `${norm(item.label)}|${item.url||''}`}
function mergeResults(primary,secondary,limit=10){const seen=new Set(),out=[];for(const item of [...primary,...secondary]){const key=resultKey(item);if(seen.has(key))continue;seen.add(key);out.push(item);if(out.length>=limit)break}return out}
function liveFlightToIndex(row){const flight=String(row.flight_number||row.flightNumber||row.operating_flight_number||row.operatingFlightNumber||'').toUpperCase().replace(/\s+/g,'');if(!flight)return null;const origin=String(row.origin||'').toUpperCase(),destination=String(row.destination||'').toUpperCase();const route=origin&&destination?`${origin} → ${destination}`:'노선 확인';const status=STATUS_LABELS[String(row.status||'').toUpperCase()]||'상태 확인';return{label:flight,meta:`실시간 API · ${route} · ${status}`,url:`flights/?q=${encodeURIComponent(flight)}`,keys:[flight,origin,destination],live:true}}
async function loadRuntimeConfig(){
  if(API_BASE)return;
  try{
    const r=await fetch(BASE+'runtime-config.json',{cache:'no-store'});
    if(!r.ok)return;
    const config=await r.json();
    if(config.liveReadApiEnabled===true&&config.apiBase)API_BASE=String(config.apiBase).replace(/\/+$/,'');
  }catch(error){console.warn('Airport Now runtime config unavailable',error)}
}
async function searchLiveFlights(query){
  if(!API_BASE||!looksLikeFlightNumber(query))return [];
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),2500);
  try{
    const r=await fetch(`${API_BASE}/api/search/flights?q=${encodeURIComponent(query)}`,{cache:'no-store',signal:controller.signal});
    if(!r.ok)return [];
    const data=await r.json();
    return (data.results||[]).map(liveFlightToIndex).filter(Boolean);
  }catch(error){
    if(error?.name!=='AbortError')console.warn('Airport Now live search unavailable',error);
    return [];
  }finally{clearTimeout(timeout)}
}
async function loadIndex(){
  const [airportRes,flightRes]=await Promise.all([
    fetch(BASE+'data/preview-data.json',{cache:'no-store'}),
    fetch(BASE+'data/search-index.json',{cache:'no-store'})
  ]);
  if(!airportRes.ok)throw new Error('airport index unavailable');
  const d=await airportRes.json();
  const airports=d.airports.map(a=>({label:a.name,meta:`공항 · ${a.code} · ${a.icao}`,url:`airports/${a.slug}/`,keys:[a.name,a.name.replace('공항',''),a.code,a.icao]}));
  let flights=[];
  if(flightRes.ok){const f=await flightRes.json();flights=(f.flights||[]).map(x=>({...x,meta:`검증 스냅샷 · 항공편 · ${x.meta}`}));}
  INDEX=[...airports,...flights,...STATIC_INDEX];
}
function localResults(query){const q=norm(query);return INDEX.filter(x=>x.keys?.some(k=>norm(k).includes(q))||norm(x.label).includes(q)).slice(0,10)}
function renderResults(box,items,{query='',loadingLive=false}={}){
  if(items.length){box.innerHTML=items.map(x=>`<a href="${BASE+x.url}" data-search-choice><span>${escapeHtml(x.label)}</span><small>${escapeHtml(x.meta)}</small></a>`).join('')+(loadingLive?'<div style="padding:8px 16px;color:#8a8f96;font-size:12px">실시간 운항편 확인 중…</div>':'');}
  else if(loadingLive){box.innerHTML='<div style="padding:14px 16px;color:#6c7078">실시간 운항편을 확인하는 중입니다…</div>'}
  else{box.innerHTML=`<div style="padding:14px 16px;color:#6c7078">${looksLikeFlightNumber(query)?'현재 연결된 데이터에서 이 편명을 찾지 못했습니다. 항공사·공항 공식 운항조회도 확인하세요.':'현재 확인 가능한 공항·가이드·도착편에서 찾지 못했습니다.'}</div>`}
  box.classList.add('show');
}
function setupSearch(root){
  const input=root.querySelector('input'),box=root.querySelector('.search-results'),btn=root.querySelector('button');
  if(!input||!box)return;
  let timer=0;
  const run=async()=>{
    const raw=input.value.trim(),q=norm(raw);
    if(!q){box.classList.remove('show');box.innerHTML='';return}
    const local=localResults(raw);
    const shouldLive=Boolean(API_BASE&&looksLikeFlightNumber(raw));
    const seq=++liveSearchSeq;
    renderResults(box,local,{query:raw,loadingLive:shouldLive});
    if(!shouldLive)return;
    const live=await searchLiveFlights(raw);
    if(seq!==liveSearchSeq||norm(input.value)!==q)return;
    renderResults(box,mergeResults(live,local),{query:raw});
  };
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(run,180)};
  const submit=async()=>{clearTimeout(timer);await run();const a=box.querySelector('a');if(a)location.href=a.href};
  input.addEventListener('input',schedule);
  input.addEventListener('focus',()=>{if(input.value.trim())run()});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit()}else if(e.key==='Escape')box.classList.remove('show')});
  btn?.addEventListener('click',e=>{e.preventDefault();submit()});
  document.addEventListener('click',e=>{if(!root.contains(e.target))box.classList.remove('show')});
  const initial=new URLSearchParams(location.search).get('q');
  if(initial&&!input.value){input.value=initial;run()}
}
function setupArrivalFilters(root){
  const buttons=[...root.querySelectorAll('[data-status]')];
  const scope=root.closest('[data-arrivals-scope]')||document;
  const rows=[...scope.querySelectorAll('.board-row[data-flight-status]')];
  const count=scope.querySelector('[data-filter-count]');
  if(!buttons.length||!rows.length)return;
  const apply=status=>{
    let visible=0;
    rows.forEach(row=>{const show=status==='ALL'||row.dataset.flightStatus===status;row.hidden=!show;if(show)visible++});
    buttons.forEach(b=>b.classList.toggle('active',b.dataset.status===status));
    if(count)count.textContent=`${visible}편 표시`;
  };
  buttons.forEach(b=>b.addEventListener('click',()=>apply(b.dataset.status)));
  apply('ALL');
}
function setupSnapshotFreshness(){
  document.querySelectorAll('[data-snapshot-at]').forEach(el=>{
    const observed=Date.parse(el.dataset.snapshotAt||'');
    const maxAge=Number(el.dataset.maxAgeMinutes||180);
    if(!Number.isFinite(observed))return;
    const ageMinutes=Math.max(0,Math.round((Date.now()-observed)/60000));
    if(ageMinutes>maxAge){el.classList.add('snapshot-stale');el.setAttribute('aria-label',`검증 스냅샷 · 현재값 아님 · ${ageMinutes}분 전 캡처`)}
  });
}
document.addEventListener('DOMContentLoaded',async()=>{
  await loadRuntimeConfig();
  try{await loadIndex()}catch(e){console.warn(e)}
  document.querySelectorAll('[data-search]').forEach(setupSearch);
  document.querySelectorAll('[data-arrival-filters]').forEach(setupArrivalFilters);
  setupSnapshotFreshness();
});
