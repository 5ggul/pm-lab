(()=>{
 const byId=id=>document.getElementById(id),date=byId('pickup-date'),input=byId('arrival'),source=byId('pickup-source'),choices=byId('pickup-choices'),result=byId('result'),model=AirportPickup;
 const params=new URLSearchParams(location.search);date.value=params.get('date')||model.format(Date.now()).slice(0,10);
 let api='',seq=0,selectedId=null,connected=null,blocked='';
 function clear(message){connected=null;blocked=message;input.value='';source.textContent=message;calc();}
 function calc(){
  if(connected&&Date.now()>=connected.expires){clear('갱신 지연 · 연결된 시각을 비웠습니다. 다시 조회하거나 직접 입력하세요.');return;}
  if(blocked){result.textContent=blocked;return;}
  const at=connected?.at??Date.parse(date.value+'T'+input.value+':00+09:00'),buffer=Number(byId('buffer').value);
  if(!Number.isFinite(at)||![30,45,60,90].includes(buffer)){result.textContent='도착 날짜와 예상시각을 입력해 주세요.';return;}
  const target=at+buffer*60000;result.replaceChildren();const strong=document.createElement('strong');strong.textContent='마중 목표 '+model.format(target);result.append(strong);const p=document.createElement('p');p.textContent='예상 도착 '+model.format(at)+' + 직접 선택한 여유 '+buffer+'분'+(model.format(at).slice(0,10)!==model.format(target).slice(0,10)?' · 다음 날로 넘어갑니다.':'');result.append(p);const note=document.createElement('p');note.className='notice';note.textContent='실제 입국장 도착 예측이 아닌 개인 계획값입니다. 터미널과 항공편 상태를 다시 확인하세요.';result.append(note);
 }
 async function get(path){if(!api)throw Error();const r=await fetch(api+path,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();return r.json();}
 async function select(id){const ticket=++seq;selectedId=id;byId('pickup-refresh').disabled=false;clear('최신 도착편 확인 중…');try{const d=await get('/api/pickup-flight?id='+encodeURIComponent(id)+'&date='+encodeURIComponent(date.value));if(ticket!==seq)return;const state=model.assess(d);if(state.at===undefined){clear(state.message);return;}connected=state;blocked='';input.value=model.format(state.at).slice(11,16);source.textContent=state.message;calc();}catch{if(ticket===seq)clear('연결 실패 · 최신 도착편을 다시 조회하거나 직접 입력하세요.');}}
 byId('pickup-search').addEventListener('click',async()=>{const ticket=++seq;selectedId=null;byId('pickup-refresh').disabled=true;choices.replaceChildren();clear('도착편 검색 중…');try{const d=await get('/api/search/flights?q='+encodeURIComponent(byId('pickup-query').value.trim())+'&date='+encodeURIComponent(date.value));if(ticket!==seq)return;const rows=(d.results||[]).filter(f=>f.direction==='ARRIVAL'&&f.destination==='ICN');for(const f of rows){const b=document.createElement('button');b.type='button';b.textContent=f.flight_number+' · '+f.origin+' → 인천';b.onclick=()=>select(f.flight_instance_id);choices.append(b);}clear(rows.length?'도착편을 선택하면 최신 상태를 확인합니다.':'해당 날짜의 인천 도착편을 찾지 못했습니다.');}catch{if(ticket===seq)clear('검색 연결 실패 · 다시 조회하거나 직접 입력하세요.');}});
 byId('pickup-refresh').addEventListener('click',()=>{if(selectedId)select(selectedId);});
 input.addEventListener('input',()=>{seq++;connected=null;blocked='';selectedId=null;byId('pickup-refresh').disabled=true;source.textContent='직접 입력 모드 · 선택한 날짜와 시간으로 계산합니다.';calc();});
 date.addEventListener('change',()=>{seq++;selectedId=null;byId('pickup-refresh').disabled=true;choices.replaceChildren();clear('날짜가 바뀌었습니다. 도착편을 조회하거나 시간을 직접 입력하세요.');});
 byId('calc').addEventListener('click',calc);byId('buffer').addEventListener('change',calc);
 function expire(){if(connected&&Date.now()>=connected.expires)calc();}setInterval(expire,1000);document.addEventListener('visibilitychange',expire);
 if(params.get('id'))clear('연결된 도착편 확인 중…');else calc();
 fetch('../../runtime-config.json',{cache:'no-store'}).then(r=>r.json()).then(c=>{if(!c.liveReadApiEnabled||!c.apiBase)throw Error();api=c.apiBase.replace(/\/$/,'');if(params.get('id')&&seq===0)select(params.get('id'));}).catch(()=>{if(params.get('id'))clear('도착편 연결 실패 · 다시 조회하거나 직접 입력하세요.');else source.textContent='실시간 연결 실패 · 직접 입력 모드로 이용하세요.';});
})();
