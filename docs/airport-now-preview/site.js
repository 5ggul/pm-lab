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
const KST_TIME=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const KST_DATE_TIME=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function norm(v){return String(v||'').toLowerCase().replace(/\s+/g,'')}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function numberOrNull(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function looksLikeFlightNumber(value){return /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(String(value||'').toUpperCase().replace(/\s+/g,''))}
function resultKey(item){return `${norm(item.label)}|${item.url||''}`}
function mergeResults(primary,secondary,limit=10){const seen=new Set(),out=[];for(const item of [...primary,...secondary]){const key=resultKey(item);if(seen.has(key))continue;seen.add(key);out.push(item);if(out.length>=limit)break}return out}
function liveFlightToIndex(row){const age=Date.now()-Date.parse(row.last_collected_at||'');if(!Number.isFinite(age)||age<0||age>30*60*1000||!['LIVE_CAPTURED','PARTIAL'].includes(row.collection_readiness))return null;const flight=String(row.flight_number||row.flightNumber||row.operating_flight_number||row.operatingFlightNumber||'').toUpperCase().replace(/\s+/g,'');if(!flight)return null;const origin=String(row.origin||'').toUpperCase(),destination=String(row.destination||'').toUpperCase();const route=origin&&destination?`${origin} → ${destination}`:'노선 확인';const status=STATUS_LABELS[String(row.status||'').toUpperCase()]||'상태 확인';return{label:flight,meta:`실시간 API · ${route} · ${status}`,url:`flights/?q=${encodeURIComponent(flight)}`,keys:[flight,origin,destination],live:true}}
function formatKstTime(value){const text=String(value||'');if(/^\d{4}$/.test(text))return `${text.slice(0,2)}:${text.slice(2,4)}`;const ms=Date.parse(text);return Number.isFinite(ms)?KST_TIME.format(new Date(ms)):'—'}
function formatKstDateTime(value){const ms=Date.parse(String(value||''));return Number.isFinite(ms)?KST_DATE_TIME.format(new Date(ms)).replace(/\. /g,'.').replace(/\.$/,''):'—'}
function statusClass(status){if(status==='DELAYED')return 'delay';if(status==='CANCELLED')return 'cancel';return 'ok'}
function formatWind(row){const speed=numberOrNull(row.mean_wind_speed),direction=numberOrNull(row.mean_wind_direction),gust=numberOrNull(row.wind_gust_speed);if(speed===null)return '바람 —';const speedText=Number.isInteger(speed)?speed:String(speed);const directionText=direction===null?'':`${Math.round(direction)}° · `;const gustText=gust===null?'':` · 돌풍 ${Number.isInteger(gust)?gust:String(gust)}m/s`;return `바람 ${directionText}${speedText}m/s${gustText}`}
function formatVisibility(value){const m=numberOrNull(value);if(m===null)return '시정 —';if(m>=10000)return '시정 10km+';const km=m/1000;return `시정 ${km>=1?km.toFixed(1):km.toFixed(2)}km`}
function codesFromText(value){const m=String(value||'').toUpperCase().match(/\b([A-Z0-9]{3})\s*·\s*([A-Z0-9]{4})\b/);return m?{iata:m[1],icao:m[2]}:null}
async function fetchLiveJson(path,timeoutMs=3500){
  if(!API_BASE)return null;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{const r=await fetch(`${API_BASE}${path}`,{cache:'no-store',signal:controller.signal});if(!r.ok)return null;return await r.json()}
  catch(error){if(error?.name!=='AbortError')console.warn('Airport Now live API unavailable',path,error);return null}
  finally{clearTimeout(timeout)}
}
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
  const data=await fetchLiveJson(`/api/search/flights?q=${encodeURIComponent(query)}`,2500);
  return (data?.results||[]).map(liveFlightToIndex).filter(Boolean);
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
  if(!buttons.length)return;
  const apply=status=>{
    const rows=[...scope.querySelectorAll('.board-row[data-flight-status]')];
    let visible=0;
    rows.forEach(row=>{const show=status==='ALL'||row.dataset.flightStatus===status;row.hidden=!show;if(show)visible++});
    buttons.forEach(b=>b.classList.toggle('active',b.dataset.status===status));
    const count=scope.querySelector('[data-filter-count]');if(count)count.textContent=`${visible}편 표시`;
  };
  root._airportNowApplyFilter=apply;
  if(root.dataset.filtersBound!=='true'){
    buttons.forEach(b=>b.addEventListener('click',()=>apply(b.dataset.status)));
    root.dataset.filtersBound='true';
  }
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
function applyWeatherToHomeRow(row,weather,codes){
  const rate=row.querySelector('.rate'),compare=row.querySelector('.compare'),state=row.querySelector('.state'),small=row.querySelector('small');
  const temp=numberOrNull(weather.air_temperature);
  if(rate&&temp!==null)rate.textContent=`${Number.isInteger(temp)?temp:String(temp)}°C`;
  if(compare)compare.textContent=formatWind(weather);
  if(state)state.textContent=formatVisibility(weather.visibility);
  if(small)small.textContent=`${codes.iata} · ${codes.icao} · 최신`;
  row.dataset.liveWeather='true';
}
function applyWeatherToDetail(weather){
  const strip=document.querySelector('.weather-strip');if(!strip)return false;
  [...strip.querySelectorAll('.weather-cell')].forEach(cell=>{
    const label=cell.querySelector('span')?.textContent.trim(),value=cell.querySelector('b');if(!value)return;
    if(label==='기온'){const n=numberOrNull(weather.air_temperature);if(n!==null)value.textContent=`${Number.isInteger(n)?n:String(n)}°C`}
    else if(label==='바람')value.textContent=formatWind(weather).replace(/^바람\s*/, '');
    else if(label==='시정')value.textContent=formatVisibility(weather.visibility).replace(/^시정\s*/, '');
    else if(label==='QNH'){const n=numberOrNull(weather.qnh);if(n!==null)value.textContent=`${n} hPa`}
  });
  const section=strip.closest('.section'),time=section?.querySelector('.data-time');
  if(time){time.textContent=`실시간 METAR 관측: ${formatKstDateTime(weather.phenomenon_time)} KST`;time.classList.remove('snapshot-stale');time.removeAttribute('aria-label')}
  document.querySelectorAll('.quick-row').forEach(row=>{if(row.querySelector('dt')?.textContent.trim()==='항공기상 기준시각'){const value=row.querySelector('dd');if(value)value.textContent=formatKstDateTime(weather.phenomenon_time)+' KST';}});
  const updated=document.querySelector('.airport-head .updated');if(updated&&!document.querySelector('#arrivals'))updated.textContent=`실시간 METAR 관측 ${formatKstDateTime(weather.phenomenon_time)} KST`;
  strip.dataset.liveWeather='true';
  return true;
}
async function hydrateLiveWeather(){
  if(!API_BASE)return 0;
  const homeRows=[...document.querySelectorAll('.airport-row')];
  const targets=[];
  for(const row of homeRows){const small=row.querySelector('small'),codes=codesFromText(small?.textContent);if(codes)targets.push({row,codes})}
  const detailCodes=codesFromText(document.querySelector('.airport-code')?.textContent);
  const icaos=[...new Set([...targets.map(x=>x.codes.icao),...(detailCodes?[detailCodes.icao]:[])])];
  if(!icaos.length)return 0;
  const data=await fetchLiveJson(`/api/weather?icaos=${encodeURIComponent(icaos.join(','))}`);
  const results=Array.isArray(data?.results)?data.results:[];if(!results.length)return 0;
  const byIcao=new Map(results.map(x=>[String(x.icao||'').toUpperCase(),x]));
  let updatedCount=0;
  targets.forEach(({row,codes})=>{const weather=byIcao.get(codes.icao);if(weather){applyWeatherToHomeRow(row,weather,codes);updatedCount++}});
  if(detailCodes){const weather=byIcao.get(detailCodes.icao);if(weather&&applyWeatherToDetail(weather))updatedCount++}
  const heading=[...document.querySelectorAll('.section-head h2')].find(x=>x.textContent.includes('전국 공항 항공기상'));
  const intro=heading?.closest('.section-head')?.querySelector('p');
  if(intro&&updatedCount)intro.textContent='실시간 API에서 90분 이내 최신 METAR가 있는 공항은 자동 갱신하고, 없는 공항은 검증 스냅샷을 유지합니다.';
  return updatedCount;
}
function renderLiveArrivalRows(items){
  return items.map(row=>{
    const status=String(row.status||'UNKNOWN').toUpperCase(),label=STATUS_LABELS[status]||STATUS_LABELS.UNKNOWN;
    const scheduled=formatKstTime(row.scheduled_arrival),estimated=formatKstTime(row.estimated_arrival),time=estimated!=='—'&&estimated!==scheduled?`${scheduled} → ${estimated}`:scheduled;
    const flight=String(row.flight_number||row.operating_flight_number||'—').toUpperCase(),origin=String(row.origin||'—').toUpperCase();
    const terminal=String(row.terminal||'—'),gate=row.gate?` · G${escapeHtml(row.gate)}`:'';
    return `<div class="board-row" data-flight-status="${escapeHtml(status)}"><span class="board-flight">${escapeHtml(flight)}</span><span class="board-time">${escapeHtml(time)}</span><span class="board-route">${escapeHtml(origin)} → 인천</span><span class="board-gate">${escapeHtml(terminal)}${gate}</span><span class="board-status ${statusClass(status)}">${escapeHtml(label)}</span></div>`;
  }).join('');
}
async function loadFreshBoard(iata,direction){
  const items=[],ids=new Set();let date=null,complete=false,observedAt=null;
    for(let page=0;page<20;page++){
      const data=await fetchLiveJson('/api/airports/'+iata+'/flights?direction='+direction+'&limit=200&offset='+page*200+(date?'&date='+date:''));
      if(!Array.isArray(data?.results)||!data.date||!data.collection?.current||!data.collection.lastSuccessAt)return false;
      if(observedAt&&observedAt!==data.collection.lastSuccessAt)return false;observedAt=data.collection.lastSuccessAt;
      if(date&&date!==data.date)return false;date=data.date;
      for(const row of data.results){
        if(!row.flight_instance_id||ids.has(row.flight_instance_id)||Date.parse(row.observed_at)>Date.parse(observedAt))return false;
        ids.add(row.flight_instance_id);items.push(row);
      }
      if(data.results.length<200){complete=true;break;}
    }
    if(!complete)return false;
  return {items,observedAt};
}
async function hydrateLiveArrivals(){
  if(!API_BASE)return false;
  const section=document.querySelector('#arrivals[data-arrivals-scope],#arrivals');if(!section)return false;
  const data=await loadFreshBoard('ICN','ARRIVAL');
  if(!data||!data.items.length){
    const board=section.querySelector('.flight-board');if(board)board.hidden=true;
    section.querySelectorAll('[data-arrival-filters]').forEach(root=>root.hidden=true);
    const notice=section.querySelector('.notice');if(notice)notice.textContent='갱신 지연 · 최신 도착편 전체 목록을 확인하지 못해 과거 목록을 숨겼습니다. 항공사와 공항 공식 안내를 확인하세요.';
    const metric=document.querySelector('.airport-summary .primary-metric .eyebrow');if(metric)metric.textContent='검증 스냅샷 · 현재 운항편 수 아님';
    return false;
  }
  const {items,observedAt}=data;
  const board=section.querySelector('.flight-board');if(!board)return false;
  board.querySelectorAll('.board-row[data-flight-status]').forEach(row=>row.remove());
  board.insertAdjacentHTML('beforeend',renderLiveArrivalRows(items));
  const latest=Date.parse(observedAt);
  const top=board.querySelector('.board-top span');if(top)top.textContent=latest?`실시간 API · 관측 ${formatKstDateTime(new Date(latest).toISOString())} KST`:'실시간 API 조회';
  const intro=section.querySelector('.section-head p');if(intro)intro.textContent='실시간 읽기 API에서 조회한 현재 인천공항 도착편입니다. 각 상태는 원본 제공 시각 기준입니다.';
  const snaps=[...section.querySelectorAll('.snapshot .snap')];
  const counts={DELAYED:0,CANCELLED:0};items.forEach(x=>{const s=String(x.status||'').toUpperCase();if(s in counts)counts[s]++});
  if(snaps[0]?.querySelector('b'))snaps[0].querySelector('b').textContent=String(items.length);
  if(snaps[1]?.querySelector('b'))snaps[1].querySelector('b').textContent=String(counts.DELAYED);
  if(snaps[2]?.querySelector('b'))snaps[2].querySelector('b').textContent=String(counts.CANCELLED);
  const metric=document.querySelector('.airport-summary .primary-metric');
  if(metric){
    const num=metric.querySelector('.num');if(num)num.textContent=items.length+'편';
    const meta=metric.querySelectorAll('.summary-meta span');
    if(meta[0])meta[0].textContent='지연 '+counts.DELAYED;
    if(meta[1])meta[1].textContent='결항 '+counts.CANCELLED;
    if(meta[2])meta[2].textContent='공동운항 별칭 분리';
  }
  const updated=document.querySelector('.airport-head .updated');if(updated)updated.textContent='도착편 수집 '+formatKstDateTime(observedAt)+' KST';
  document.querySelectorAll('.quick-row').forEach(row=>{if(row.querySelector('dt')?.textContent.trim()==='도착편 기준시각'){const value=row.querySelector('dd');if(value)value.textContent=formatKstDateTime(observedAt)+' KST';}});
  if(snaps[3]){const label=snaps[3].querySelector('span'),value=snaps[3].querySelector('b');if(label)label.textContent='공동운항 처리';if(value)value.textContent='별칭 분리'}
  const notice=section.querySelector('.notice');if(notice)notice.textContent='실시간 읽기 API 조회 결과입니다. 탑승·마중 직전에는 항공사와 공항 공식 운항조회를 최종 확인하세요.';
  section.dataset.liveArrivals='true';
  section.querySelectorAll('[data-arrival-filters]').forEach(root=>{if(root._airportNowApplyFilter)root._airportNowApplyFilter('ALL')});
  return true;
}
function markLiveApiConnected(){
  const status=document.querySelector('.hero-product .data-time');if(!status)return;
  status.textContent='최신 관측이 확인된 항목을 갱신했습니다 · 항공사·공항 공식 안내가 최종 기준';
  status.classList.remove('snapshot-stale');status.removeAttribute('aria-label');
}

function renderAirportCards(items,direction){
  const depart=direction==='DEPARTURE';
  return items.map(row=>{
    const status=String(row.status||'UNKNOWN').toUpperCase();
    const scheduled=depart?row.scheduled_departure:row.scheduled_arrival;
    const estimated=depart?row.estimated_departure:row.estimated_arrival;
    const actual=depart?row.actual_departure:row.actual_arrival;
    const label=STATUS_LABELS[status]||STATUS_LABELS.UNKNOWN;
    const flight=row.operating_flight_number||row.flight_number||'—';
    const escape=escapeHtml;
    return '<article class="live-flight-card" data-flight-status="'+escape(status)+'"><div class="live-card-heading"><strong>'+escape(flight)+'</strong><span>'+escape(label)+'</span></div><p>'+escape(row.origin||'—')+' → '+escape(row.destination||'—')+'</p><dl><div><dt>예정</dt><dd>'+escape(formatKstTime(scheduled))+'</dd></div><div><dt>'+(actual?'실제':'예상')+'</dt><dd>'+escape(formatKstTime(actual||estimated))+'</dd></div><div><dt>터미널 · 게이트</dt><dd>'+escape(row.terminal||'—')+' · '+escape(row.gate||'—')+'</dd></div><div><dt>지연시간</dt><dd>'+(Number.isFinite(row.delay_minutes)?Math.max(0,row.delay_minutes)+'분':'확인 중')+'</dd></div></dl></article>';
  }).join('');
}
async function hydrateAirportBoards(){
  const boards=[...document.querySelectorAll('[data-live-board]')];
  const results=await Promise.all(boards.map(async section=>{
    const message=section.querySelector('[data-board-message]'),list=section.querySelector('[data-board-list]'),details=section.querySelector('details');
    const data=await loadFreshBoard(section.dataset.airport,section.dataset.direction);
    if(!data){message.textContent='갱신 지연 · 최근 30분 이내 수집된 전체 운항편을 확인하지 못했습니다. 항공사와 공항 공식 안내를 확인하세요.';details.hidden=true;section.dataset.state='unavailable';return false;}
    const {items,observedAt}=data,counts={DELAYED:0,CANCELLED:0};items.forEach(row=>{if(row.status in counts)counts[row.status]++});
    message.textContent='수집 '+formatKstDateTime(observedAt)+' KST · 확인된 운항편 '+items.length+'편 · 지연 '+counts.DELAYED+'편 · 결항 '+counts.CANCELLED+'편';
    if(!items.length){message.textContent+=' · 목록이 비어 있어도 공항 운영 중단을 뜻하지 않습니다.';details.hidden=true;section.dataset.state='empty';return true;}
    list.innerHTML=renderAirportCards(items,section.dataset.direction);details.hidden=false;
    section.querySelectorAll('[data-board-filter]').forEach(button=>button.addEventListener('click',()=>{
      const status=button.dataset.boardFilter;let count=0;
      list.querySelectorAll('[data-flight-status]').forEach(card=>{card.hidden=status!=='ALL'&&card.dataset.flightStatus!==status;if(!card.hidden)count++;});
      section.querySelectorAll('[data-board-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      section.querySelector('[data-board-count]').textContent=count+'편 표시';
    }));
    section.querySelector('[data-board-count]').textContent=items.length+'편 표시';section.dataset.state='live';return true;
  }));
  return results.filter(Boolean).length;
}

async function hydrateLiveData(){
  const [weather,arrivals,boards]=await Promise.all([hydrateLiveWeather(),hydrateLiveArrivals(),hydrateAirportBoards()]);
  if(weather>0||arrivals||boards>0)markLiveApiConnected();
}
document.addEventListener('DOMContentLoaded',async()=>{
  await loadRuntimeConfig();
  try{await loadIndex()}catch(e){console.warn(e)}
  document.querySelectorAll('[data-search]').forEach(setupSearch);
  document.querySelectorAll('[data-arrival-filters]').forEach(setupArrivalFilters);
  setupSnapshotFreshness();
  if(API_BASE)hydrateLiveData().catch(error=>console.warn('Airport Now live hydration failed',error));
});
