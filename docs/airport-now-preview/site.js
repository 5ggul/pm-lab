const BASE='/pm-lab/airport-now-preview/';
let INDEX=[];
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
async function loadIndex(){
  const [airportRes,flightRes]=await Promise.all([
    fetch(BASE+'data/preview-data.json',{cache:'no-store'}),
    fetch(BASE+'data/search-index.json',{cache:'no-store'})
  ]);
  if(!airportRes.ok)throw new Error('airport index unavailable');
  const d=await airportRes.json();
  const airports=d.airports.map(a=>({label:a.name,meta:`공항 · ${a.code} · ${a.icao}`,url:`airports/${a.slug}/`,keys:[a.name,a.name.replace('공항',''),a.code,a.icao]}));
  let flights=[];
  if(flightRes.ok){const f=await flightRes.json();flights=(f.flights||[]).map(x=>({...x,meta:`항공편 · ${x.meta}`}));}
  INDEX=[...airports,...flights,...STATIC_INDEX];
}
function norm(v){return String(v||'').toLowerCase().replace(/\s+/g,'')}
function setupSearch(root){
  const input=root.querySelector('input'),box=root.querySelector('.search-results'),btn=root.querySelector('button');
  if(!input||!box)return;
  const render=()=>{
    const q=norm(input.value);
    if(!q){box.classList.remove('show');box.innerHTML='';return}
    const found=INDEX.filter(x=>x.keys?.some(k=>norm(k).includes(q))||norm(x.label).includes(q)).slice(0,10);
    box.innerHTML=found.length?found.map(x=>`<a href="${BASE+x.url}" data-search-choice><span>${x.label}</span><small>${x.meta}</small></a>`).join(''):'<div style="padding:14px 16px;color:#6c7078">현재 확인 가능한 공항·가이드·도착편에서 찾지 못했습니다.</div>';
    box.classList.add('show');
  };
  input.addEventListener('input',render);
  input.addEventListener('focus',()=>{if(input.value.trim())render()});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){const a=box.querySelector('a');if(a)location.href=a.href}else if(e.key==='Escape')box.classList.remove('show')});
  btn?.addEventListener('click',()=>{const a=box.querySelector('a');if(a)location.href=a.href;else render()});
  document.addEventListener('click',e=>{if(!root.contains(e.target))box.classList.remove('show')});
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
document.addEventListener('DOMContentLoaded',async()=>{
  try{await loadIndex()}catch(e){console.warn(e)}
  document.querySelectorAll('[data-search]').forEach(setupSearch);
  document.querySelectorAll('[data-arrival-filters]').forEach(setupArrivalFilters);
});
