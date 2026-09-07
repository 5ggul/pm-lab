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
function liveFlightToIndex(row){
 const age=Date.now()-Date.parse(row.last_collected_at||'');if(!Number.isFinite(age)||age<0||age>=30*60000||!['LIVE_CAPTURED','PARTIAL','ERROR'].includes(row.collection_readiness)||Date.parse(row.observed_at)>Date.parse(row.last_collected_at))return null;
 if(!row.service_date||new Date(Date.parse(row.last_collected_at)+9*3600000).toISOString().slice(0,10)!==row.service_date)return null;
 const flight=String(row.flight_number||row.operating_flight_number||'').toUpperCase().replace(/\s+/g,'');if(!flight)return null;
 const origin=String(row.origin||''),destination=String(row.destination||''),arrival=row.direction==='ARRIVAL';
 const airport=INDEX.find(x=>x.url?.startsWith('airports/')&&x.keys?.includes(arrival?destination:origin));
 const terminal=({T1:'제1터미널',T2:'제2터미널',CONCOURSE:'탑승동 · 입국장 확인 필요'})[row.terminal]||'터미널 미확인';
 const estimate=arrival?row.estimated_arrival:row.estimated_departure;
 return {label:flight+' · '+(STATUS_LABELS[row.status]||'상태 미확인'),meta:(row.service_date||'날짜 미확인')+' · '+origin+' → '+destination+' · '+terminal+' · 예상 '+formatKstDateTime(estimate)+' KST · 최근 수집 '+formatKstDateTime(row.last_collected_at)+' KST'+(row.collection_readiness==='ERROR'?' · 갱신 재시도 중':''),url:airport?.url||'airports/',pickupUrl:arrival&&destination==='ICN'&&row.flight_instance_id&&row.service_date?'tools/pickup-time/?id='+encodeURIComponent(row.flight_instance_id)+'&date='+encodeURIComponent(row.service_date):null,live:true,expiresAt:Date.parse(row.last_collected_at)+1800000};
}
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
async function searchLiveFlights(query,date){
  if(!API_BASE||!looksLikeFlightNumber(query))return [];
  const data=await fetchLiveJson(`/api/search/flights?q=${encodeURIComponent(query)}${date?'&date='+encodeURIComponent(date):''}`,2500);
  return (data?.results||[]).filter(row=>!date||row.service_date===date).map(liveFlightToIndex).filter(Boolean);
}
async function loadIndex(){
  const airportRes=await fetch(BASE+'data/preview-data.json',{cache:'no-store'});
  if(!airportRes.ok)throw new Error('airport index unavailable');
  const d=await airportRes.json();
  const airports=d.airports.map(a=>({label:a.name,meta:`공항 · ${a.code} · ${a.icao}`,url:`airports/${a.slug}/`,keys:[a.name,a.name.replace('공항',''),a.code,a.icao]}));
  INDEX=[...airports,...STATIC_INDEX];
}
function localResults(query){const q=norm(query);return INDEX.filter(x=>x.keys?.some(k=>norm(k).includes(q))||norm(x.label).includes(q)).slice(0,10)}
function renderResults(box,items,{query='',loadingLive=false}={}){
  box.dataset.expiresAt=String(Math.min(...items.filter(x=>x.live).map(x=>x.expiresAt)));
  if(items.length){box.innerHTML=items.map(x=>`<div class="search-result-item"><a href="${escapeHtml(BASE+x.url)}" data-search-choice><span>${escapeHtml(x.label)}</span><small>${escapeHtml(x.meta)}</small></a>${x.pickupUrl?`<a class="search-pickup" href="${escapeHtml(BASE+x.pickupUrl)}">이 도착편으로 마중 계획</a>`:''}</div>`).join('')+(loadingLive?'<div style="padding:8px 16px;color:#8a8f96;font-size:12px">실시간 운항편 확인 중…</div>':'');}
  else if(loadingLive){box.innerHTML='<div style="padding:14px 16px;color:#6c7078">실시간 운항편을 확인하는 중입니다…</div>'}
  else{box.innerHTML=`<div style="padding:14px 16px;color:#6c7078">${looksLikeFlightNumber(query)?'선택한 날짜에 최신성이 확인된 운항편을 찾지 못했습니다. 과거·미래 운항표는 제공 범위가 제한됩니다. 항공사·공항 공식 조회를 확인하세요.':'현재 확인 가능한 공항·가이드·도착편에서 찾지 못했습니다.'}</div>`}
  box.classList.add('show');
}
function setupSearch(root){
  const input=root.querySelector('input'),box=root.querySelector('.search-results'),btn=root.querySelector('button');
  if(!input||!box)return;
  let timer=0;
  const dateInput=root.querySelector('[data-search-date]');
  if(dateInput){const param=new URLSearchParams(location.search).get('date');dateInput.value=/^\d{4}-\d{2}-\d{2}$/.test(param||'')?param:new Date(Date.now()+9*3600000).toISOString().slice(0,10);}
  const run=async()=>{
    const raw=input.value.trim(),q=norm(raw),date=dateInput?.value;
    if(dateInput&&!date){box.textContent='조회 날짜를 선택해 주세요.';box.classList.add('show');return;}
    if(!q){box.classList.remove('show');box.innerHTML='';return}
    const local=localResults(raw);
    const shouldLive=Boolean(API_BASE&&looksLikeFlightNumber(raw));
    const seq=++liveSearchSeq;
    renderResults(box,local,{query:raw,loadingLive:shouldLive});
    if(!shouldLive)return;
    const live=await searchLiveFlights(raw,date);
    if(seq!==liveSearchSeq||norm(input.value)!==q||date!==dateInput?.value)return;
    renderResults(box,mergeResults(live,local),{query:raw});
  };
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(run,180)};
  setInterval(()=>{if(Number(box.dataset.expiresAt)<=Date.now()){box.innerHTML='';delete box.dataset.expiresAt;if(!document.hidden)run();}},1000);
  setInterval(()=>{if(!document.hidden&&box.classList.contains('show')&&looksLikeFlightNumber(input.value))run();},60000);
  const submit=async()=>{clearTimeout(timer);await run();};
  dateInput?.addEventListener('change',()=>{++liveSearchSeq;clearTimeout(timer);box.innerHTML='';delete box.dataset.expiresAt;run();});
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
  if(rate)rate.textContent=temp===null?'—':`${temp}°C`;
  if(compare)compare.textContent=formatWind(weather);
  if(state)state.textContent=formatVisibility(weather.visibility);
  if(small)small.textContent=`${codes.iata} · ${codes.icao} · 최신`;
  row.dataset.liveWeather='true';
}
function applyWeatherToDetail(weather){
  const strip=document.querySelector('.weather-strip');if(!strip)return false;
  [...strip.querySelectorAll('.weather-cell')].forEach(cell=>{
    const label=cell.querySelector('span')?.textContent.trim(),value=cell.querySelector('b');if(!value)return;
    if(label==='기온'){const n=numberOrNull(weather.air_temperature);value.textContent=n===null?'—':`${n}°C`}
    else if(label==='바람')value.textContent=formatWind(weather).replace(/^바람\s*/, '');
    else if(label==='시정')value.textContent=formatVisibility(weather.visibility).replace(/^시정\s*/, '');
    else if(label==='QNH'){const n=numberOrNull(weather.qnh);value.textContent=n===null?'—':`${n} hPa`}
  });
  const section=strip.closest('.section'),time=section?.querySelector('.data-time');
  if(time){time.textContent=`실시간 METAR 관측: ${formatKstDateTime(weather.phenomenon_time)} KST`;time.classList.remove('snapshot-stale');time.removeAttribute('aria-label')}
  document.querySelectorAll('.quick-row').forEach(row=>{if(row.querySelector('dt')?.textContent.trim()==='항공기상 기준시각'){const value=row.querySelector('dd');if(value)value.textContent=formatKstDateTime(weather.phenomenon_time)+' KST';}});
  const updated=document.querySelector('.airport-head .updated');if(updated&&!document.querySelector('#arrivals'))updated.textContent=`실시간 METAR 관측 ${formatKstDateTime(weather.phenomenon_time)} KST`;
  const notice=section?.querySelector('.notice');if(notice)notice.textContent='표시된 관측시각 기준의 최신 METAR입니다. 운항정보와 관측시각이 다를 수 있으며, 이 기상값만으로 특정 항공편의 지연·결항을 단정하지 않습니다.';
  strip.dataset.liveWeather='true';
  return true;
}
const weatherCache=new Map();
function freshWeather(weather,now=Date.now()){const t=Date.parse(weather?.phenomenon_time||'');return Number.isFinite(t)&&now>=t&&now-t<90*60000;}
function showWeatherCache(){
 document.querySelectorAll('.airport-row').forEach(row=>{const codes=codesFromText(row.querySelector('small')?.textContent);if(!codes)return;const w=weatherCache.get(codes.icao);if(freshWeather(w)){applyWeatherToHomeRow(row,w,codes);row.querySelector('small').textContent=codes.iata+' · '+codes.icao+' · 관측 '+formatKstDateTime(w.phenomenon_time)+' KST'+(weatherRetrying?' · 갱신 재시도 중':'');}else{row.querySelector('small').textContent=codes.iata+' · '+codes.icao+' · 최신 관측 미확인';for(const cls of ['rate','compare','state']){const el=row.querySelector('.'+cls);if(el)el.textContent=cls==='rate'?'—':cls==='compare'?'최신 기상 미확인':'공식 안내를 확인하세요';}}});
 const strip=document.querySelector('.weather-strip'),codes=codesFromText(document.querySelector('.airport-code')?.textContent);if(!strip||!codes)return;
 const w=weatherCache.get(codes.icao);if(freshWeather(w)){applyWeatherToDetail(w);if(weatherRetrying){const n=strip.closest('.section')?.querySelector('.notice');if(n)n.textContent='갱신 재시도 중 · 마지막 정상 관측 '+formatKstDateTime(w.phenomenon_time)+' KST. 90분이 지나면 숫자를 숨깁니다.';}}else{strip.querySelectorAll('b').forEach(el=>el.textContent='—');strip.dataset.liveWeather='false';const section=strip.closest('.section');const n=section?.querySelector('.notice');if(n)n.textContent='최근 90분 이내 관측을 확인하지 못했습니다. 기상 숫자를 비웠으며, 항공편 상태는 공식 안내를 확인하세요.';const t=section?.querySelector('.data-time');if(t)t.textContent='기상 갱신 지연'+(w?' · 마지막 관측 '+formatKstDateTime(w.phenomenon_time)+' KST':'');const h=document.querySelector('.airport-head .updated');if(h&&!document.querySelector('#arrivals'))h.textContent='최신 항공기상 미확인';}
}
let weatherRetrying=false;
async function hydrateLiveWeather(){
 const codes=[...document.querySelectorAll('.airport-row small,.airport-code')].map(el=>codesFromText(el.textContent)).filter(Boolean);const icaos=[...new Set(codes.map(c=>c.icao))];if(!API_BASE||!icaos.length)return 0;
 try{const data=await fetchLiveJson('/api/weather?icaos='+encodeURIComponent(icaos.join(',')));if(!Array.isArray(data?.results))throw Error('WEATHER_UNAVAILABLE');weatherRetrying=false;for(const row of data.results)if(icaos.includes(row.icao)&&freshWeather(row))weatherCache.set(row.icao,row);}
 catch{weatherRetrying=true;}showWeatherCache();return weatherCache.size;
}
function renderLiveArrivalRows(items){
  return items.map(row=>{
    const status=String(row.status||'UNKNOWN').toUpperCase(),label=STATUS_LABELS[status]||STATUS_LABELS.UNKNOWN;
    const scheduled=formatKstTime(row.scheduled_arrival),estimated=formatKstTime(row.estimated_arrival),time=estimated!=='—'&&estimated!==scheduled?`${scheduled} → ${estimated}`:scheduled;
    const flight=String(row.flight_number||row.operating_flight_number||'—').toUpperCase(),origin=String(row.origin||'—').toUpperCase();
    const terminal=String(row.terminal||'—'),gate=row.gate?` · G${escapeHtml(row.gate)}`:'';
    return `<div class="board-row" data-flight-status="${escapeHtml(status)}"><span class="board-flight">${escapeHtml(flight)} <a href="${BASE}tools/pickup-time/?id=${encodeURIComponent(row.flight_instance_id)}&date=${encodeURIComponent(row.service_date)}">마중</a></span><span class="board-time">${escapeHtml(time)}</span><span class="board-route">${escapeHtml(origin)} → 인천</span><span class="board-gate">${escapeHtml(terminal)}${gate}</span><span class="board-status ${statusClass(status)}">${escapeHtml(label)}</span></div>`;
  }).join('');
}
function expireFlightBoard(section){
  section.dataset.state='unavailable';
  section.querySelectorAll('.flight-board,[data-arrival-filters],details').forEach(el=>el.hidden=true);
  const message=section.querySelector('[data-board-message],.notice');
  if(message)message.textContent='갱신 지연 · 마지막 정상 수집의 유효시간이 지나 목록을 숨겼습니다. 항공사와 공항 공식 안내를 확인하세요.';
  if(section.id==='arrivals'){
    const metric=document.querySelector('.airport-summary .primary-metric');
    const number=metric?.querySelector('.num'),label=metric?.querySelector('.eyebrow');
    if(number)number.textContent='—';if(label)label.textContent='운항정보 갱신 지연';
  }
}
function armFlightExpiry(section,observedAt){
  clearTimeout(section._flightExpiry);
  section._flightExpiry=setTimeout(()=>expireFlightBoard(section),Math.max(0,Date.parse(observedAt)+30*60000-Date.now()));
}
async function loadFreshBoard(iata,direction){
  const items=[],ids=new Set();let date=null,complete=false,observedAt=null,updateDelayed=false;
    for(let page=0;page<20;page++){
      const data=await fetchLiveJson('/api/airports/'+iata+'/flights?direction='+direction+'&limit=200&offset='+page*200+(date?'&date='+date:''));
      if(!Array.isArray(data?.results)||!data.date||!data.collection?.current||!data.collection.lastSuccessAt)return false;
      if(observedAt&&observedAt!==data.collection.lastSuccessAt)return false;observedAt=data.collection.lastSuccessAt;
      updateDelayed=updateDelayed||Boolean(data.collection.updateDelayed);
      if(date&&date!==data.date)return false;date=data.date;
      for(const row of data.results){
        if(!row.flight_instance_id||ids.has(row.flight_instance_id)||Date.parse(row.observed_at)>Date.parse(observedAt))return false;
        ids.add(row.flight_instance_id);items.push(row);
      }
      if(data.results.length<200){complete=true;break;}
    }
    if(!complete)return false;
  return {items,observedAt,updateDelayed};
}
async function hydrateLiveArrivals(){
  if(!API_BASE)return false;
  const section=document.querySelector('#arrivals[data-arrivals-scope],#arrivals');if(!section)return false;
  const data=await loadFreshBoard('ICN','ARRIVAL');
  if(!data){
    expireFlightBoard(section);
    const board=section.querySelector('.flight-board');if(board)board.hidden=true;
    section.querySelectorAll('[data-arrival-filters]').forEach(root=>root.hidden=true);
    const notice=section.querySelector('.notice');if(notice)notice.textContent='갱신 지연 · 최신 도착편 전체 목록을 확인하지 못해 과거 목록을 숨겼습니다. 항공사와 공항 공식 안내를 확인하세요.';
    const metric=document.querySelector('.airport-summary .primary-metric .eyebrow');if(metric)metric.textContent='운항정보 갱신 지연';
    return false;
  }
  const {items,observedAt}=data;
  const board=section.querySelector('.flight-board');if(!board)return false;
  board.hidden=false;section.querySelectorAll('[data-arrival-filters]').forEach(root=>root.hidden=false);
  armFlightExpiry(section,observedAt);
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
    const label=metric.querySelector('.eyebrow');if(label)label.textContent='최근 수집된 인천 도착편';
    const num=metric.querySelector('.num');if(num)num.textContent=items.length+'편';
    const meta=metric.querySelectorAll('.summary-meta span');
    if(meta[0])meta[0].textContent='지연 '+counts.DELAYED;
    if(meta[1])meta[1].textContent='결항 '+counts.CANCELLED;
    if(meta[2])meta[2].textContent='공동운항 별칭 분리';
  }
  const updated=document.querySelector('.airport-head .updated');if(updated)updated.textContent='도착편 수집 '+formatKstDateTime(observedAt)+' KST';
  document.querySelectorAll('.quick-row').forEach(row=>{if(row.querySelector('dt')?.textContent.trim()==='도착편 기준시각'){const value=row.querySelector('dd');if(value)value.textContent=formatKstDateTime(observedAt)+' KST';}});
  if(snaps[3]){const label=snaps[3].querySelector('span'),value=snaps[3].querySelector('b');if(label)label.textContent='공동운항 처리';if(value)value.textContent='별칭 분리'}
  const notice=section.querySelector('.notice');if(notice)notice.textContent=(data.updateDelayed?'갱신 재시도 중 · 최근 30분 이내 마지막 정상 수집 목록입니다. ':'실시간 읽기 API 조회 결과입니다. ')+'탑승·마중 직전에는 항공사와 공항 공식 운항조회를 최종 확인하세요.';
  section.dataset.liveArrivals='true';section.dataset.state=data.updateDelayed?'degraded':'live';
  section.querySelectorAll('[data-arrival-filters]').forEach(root=>{if(root._airportNowApplyFilter)root._airportNowApplyFilter('ALL')});
  return true;
}
function markLiveApiConnected(){
  if(document.querySelector('[data-national-summary]'))return;
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
    armFlightExpiry(section,observedAt);
    message.textContent=(data.updateDelayed?'갱신 재시도 중 · 마지막 정상 ':'')+'수집 '+formatKstDateTime(observedAt)+' KST · 확인된 운항편 '+items.length+'편 · 지연 '+counts.DELAYED+'편 · 결항 '+counts.CANCELLED+'편';
    if(!items.length){message.textContent+=' · 목록이 비어 있어도 공항 운영 중단을 뜻하지 않습니다.';details.hidden=true;section.dataset.state='empty';return true;}
    list.innerHTML=renderAirportCards(items,section.dataset.direction);details.hidden=false;
    section.querySelectorAll('[data-board-filter]').forEach(button=>{button.onclick=()=>{
      const status=button.dataset.boardFilter;let count=0;
      list.querySelectorAll('[data-flight-status]').forEach(card=>{card.hidden=status!=='ALL'&&card.dataset.flightStatus!==status;if(!card.hidden)count++;});
      section.querySelectorAll('[data-board-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      section.querySelector('[data-board-count]').textContent=count+'편 표시';
    };});
    section.querySelector('[data-board-count]').textContent=items.length+'편 표시';
    section.querySelector('[data-board-filter][aria-pressed="true"]')?.click();
    section.dataset.state=data.updateDelayed?'degraded':'live';return true;
  }));
  return results.filter(Boolean).length;
}

async function hydrateLiveData(){
  const [weather,arrivals,boards]=await Promise.all([hydrateLiveWeather(),hydrateLiveArrivals(),hydrateAirportBoards(),hydrateNationalSummary(),hydrateComparisonReadiness()]);
  if(weather>0||arrivals||boards>0)markLiveApiConnected();
}
async function hydrateNationalSummary(){
  const section=document.querySelector('[data-national-summary]');if(!section)return;
  const data=await fetchLiveJson('/api/airports/summary');
  const airports=Array.isArray(data?.airports)?data.airports:[];
  const cards=[...section.querySelectorAll('[data-summary-airport]')],valid=[],weatherTimes=[],flightTimes=[];
  for(const card of cards){
    const airport=airports.find(a=>a.iata===card.dataset.summaryAirport);
    const directions=['departure','arrival'];
    card.querySelector('[data-summary-flights]').innerHTML=directions.map(direction=>{
      const board=airport?.[direction],label=direction==='departure'?'출발':'도착';
      if(!board?.current)return '<p class="national-unavailable"><b>'+label+'</b> · 갱신 지연'+(board?.lastSuccessAt?'<small>마지막 정상 수집 '+escapeHtml(formatKstDateTime(board.lastSuccessAt))+' KST</small>':'<small>최신 전체 수집을 확인하지 못했습니다.</small>')+'</p>';
      flightTimes.push(board.lastSuccessAt);
      return '<div class="national-direction"><div><b>'+label+' '+Number(board.operating)+'편</b><span>지연 '+Number(board.delayed)+' · 결항 '+Number(board.cancelled)+'</span></div><small>'+(board.updateDelayed?'갱신 재시도 중 · 마지막 정상 ':'')+'수집 '+escapeHtml(formatKstDateTime(board.lastSuccessAt))+' KST</small></div>';
    }).join('');
    if(airport?.departure.current&&airport?.arrival.current)valid.push(airport);
    const weather=airport?.weather;
    card.querySelector('[data-summary-weather]').textContent=weather?formatWind(weather)+' · '+formatVisibility(weather.visibility)+' · 관측 '+formatKstDateTime(weather.phenomenon_time)+' KST':'항공기상 · 최근 90분 이내 관측을 확인하지 못했습니다.';
    if(weather)weatherTimes.push(weather.phenomenon_time);
    if(airport)airport.displayName=card.dataset.airportName;
  }
  const degraded=airports.some(a=>a.departure?.current&&a.departure.updateDelayed||a.arrival?.current&&a.arrival.updateDelayed);
  const status=data?.cadence?.lateSources?.length?'수집 실행 지연':valid.length===cards.length&&!degraded?'최신 수집 확인':flightTimes.length?'일부 운항정보 갱신 지연':'운항정보 갱신 지연';
  const timeRange=times=>{const sorted=[...new Set(times)].sort();return sorted.length?(formatKstDateTime(sorted[0])+(sorted.length>1?' ~ '+formatKstDateTime(sorted.at(-1)):'')+' KST'):'확인 불가';};
  section.querySelector('[data-national-status]').textContent=status+' · 출발·도착 모두 확인 '+valid.length+'/'+cards.length+'개 공항 · 오늘 '+(data?.date||'')+' 기준';
  const hero=document.querySelector('[data-home-status]');if(hero){hero.textContent=status+' · 연결 공항 '+cards.length+'개 · 운항 수집 '+timeRange(flightTimes)+' · 항공기상 관측 '+timeRange(weatherTimes);hero.classList.toggle('snapshot-stale',valid.length!==cards.length||degraded);}
  const highlights=section.querySelector('[data-national-highlights]');
  const departures=airports.filter(a=>a.departure?.current);
  const top=(field)=>[...departures].sort((a,b)=>b.departure[field]-a.departure[field])[0];
  const weatherTop=airports.filter(a=>numberOrNull(a.weather?.mean_wind_speed)!==null).sort((a,b)=>Number(b.weather.mean_wind_speed)-Number(a.weather.mean_wind_speed))[0];
  const highlight=(label,value)=>'<div><small>'+label+'</small><strong>'+escapeHtml(value)+'</strong></div>';
  highlights.innerHTML=highlight('확인 가능한 공항 중 · 출발 지연',top('delayed')?top('delayed').displayName+' '+top('delayed').departure.delayed+'편':'집계 대기')+highlight('확인 가능한 공항 중 · 출발 결항',top('cancelled')?top('cancelled').displayName+' '+top('cancelled').departure.cancelled+'편':'집계 대기')+highlight('최근 관측 중 · 가장 강한 평균 바람',weatherTop?weatherTop.displayName+' '+formatWind(weatherTop.weather):'관측 대기');
  highlights.hidden=false;
}
function setupMobileMenu(){
  const nav=document.querySelector('.global nav');if(!nav)return;
  nav.id='global-navigation';const button=document.createElement('button');button.type='button';button.className='mobile-menu';button.textContent='☰ 메뉴';button.setAttribute('aria-controls',nav.id);button.setAttribute('aria-expanded','false');
  const close=()=>{button.setAttribute('aria-expanded','false');nav.classList.remove('is-open');};
  button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});
  nav.addEventListener('click',event=>{if(event.target.closest('a'))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){close();button.focus();}});
  nav.before(button);nav.classList.add('menu-enhanced');
}
document.addEventListener('DOMContentLoaded',async()=>{
  setupMobileMenu();
  showWeatherCache();
  setInterval(showWeatherCache,1000);
  document.addEventListener('visibilitychange',showWeatherCache);
  await loadRuntimeConfig();
  try{await loadIndex()}catch(e){console.warn(e)}
  document.querySelectorAll('[data-search]').forEach(setupSearch);
  document.querySelectorAll('[data-arrival-filters]').forEach(setupArrivalFilters);
  setupSnapshotFreshness();
  if(API_BASE)hydrateLiveData().catch(error=>console.warn('Airport Now live hydration failed',error));
  if(API_BASE&&document.querySelector('[data-national-summary]')){
    let refreshing=false;
    const refresh=async()=>{if(document.hidden||refreshing)return;refreshing=true;try{await hydrateNationalSummary();}finally{refreshing=false;}};
    setInterval(()=>refresh().catch(()=>{}),60000);
    document.addEventListener('visibilitychange',()=>refresh().catch(()=>{}));
  }else if(API_BASE&&document.querySelector('[data-live-board],#arrivals,.airport-row,.weather-strip')){
    let refreshing=false;
    const refresh=async()=>{if(document.hidden||refreshing)return;refreshing=true;try{await hydrateLiveData();}finally{refreshing=false;}};
    setInterval(()=>refresh().catch(()=>{}),300000);
    document.addEventListener('visibilitychange',()=>refresh().catch(()=>{}));
  }
});

async function hydrateComparisonReadiness(){
 const codes=codesFromText(document.querySelector('.airport-code')?.textContent);if(!codes||!API_BASE)return;
 let panel=document.getElementById('comparison-readiness');if(!panel){panel=document.createElement('section');panel.id='comparison-readiness';panel.className='section soft';document.querySelector('main')?.append(panel);}
 try{const d=await fetchLiveJson('/api/airports/'+codes.iata+'/comparison-readiness');if(!Array.isArray(d.results)||d.results.length!==2)throw Error();panel.replaceChildren();const wrap=document.createElement('div');wrap.className='wrap';const h=document.createElement('h2');h.textContent='지금 평소보다 지연이 많나요?';wrap.append(h);const intro=document.createElement('p');intro.textContent='아직 비교를 준비하고 있습니다. 같은 요일·시간대의 지난 4주 관측을 모으고 있으며, 표본이 부족하면 차이를 계산하지 않습니다.';wrap.append(intro);
 for(const r of d.results){const line=document.createElement('p');const reason={CURRENT_OBSERVATION_MISSING:'이번 구간 관측 미확인',CURRENT_SAMPLE_SMALL:'현재 표본 부족',CURRENT_UNKNOWN_STATUS:'미분류 상태 확인 필요',HISTORY_INSUFFICIENT:'과거 표본 축적 중',REVIEW_REQUIRED:'비교 공개 전 검증 필요'}[r.reason]||'확인 중';line.textContent=(r.direction==='DEPARTURE'?'출발':'도착')+' · '+r.scheduledHourKst+'시 예정편 / '+r.minuteBucket+'분 관측 · '+reason+' · 과거 적격 표본 '+r.qualifyingWeeks+'/4주'+(r.current?' · 현재 분류된 편 '+r.current.knownCount+'편, 미분류 '+r.current.unknownCount+'편':'');wrap.append(line);}
 const note=document.createElement('p');note.className='notice';note.textContent='각 표본은 분류된 운항 20편 이상이며 미분류 상태가 없어야 합니다. 이는 통계적 유의성을 보장하지 않습니다. 관측 당시 상태 비중이며 최종 지연률과 다릅니다. 확인 '+formatKstDateTime(d.asOf)+' KST';wrap.append(note);panel.append(wrap);
 }catch{panel.textContent='비교 준비 상태를 확인하지 못했습니다. 수집 상태 페이지에서 최신 기록을 확인하세요.';}
}
