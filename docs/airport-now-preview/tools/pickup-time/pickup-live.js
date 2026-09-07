(()=>{
 const base='/pm-lab/airport-now-preview/',date=document.getElementById('pickup-date'),input=document.getElementById('arrival'),source=document.getElementById('pickup-source'),choices=document.getElementById('pickup-choices');
 const params=new URLSearchParams(location.search);date.value=params.get('date')||new Date(Date.now()+9*3600000).toISOString().slice(0,10);let api='',seq=0,expires=0,linked=false;
 const text=(s)=>{source.textContent=s;};
 async function get(path){const r=await fetch(api+path,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('조회 실패');return r.json();}
 function expired(){if(linked&&Date.now()>=expires){linked=false;window.airportPickupExpired=true;input.value='';text('갱신 지연 · 연결된 예상시간을 비웠습니다. 다시 조회하거나 직접 입력하세요.');document.getElementById('calc').click();}}
 input.addEventListener('input',()=>{linked=false;window.airportPickupExpired=false;text('직접 입력값 · 항공편 예상시각과 자동으로 연동되지 않습니다.');});
 async function select(id){const ticket=++seq;linked=false;window.airportPickupExpired=true;input.value='';document.getElementById('calc').click();text('최신 도착편 확인 중…');try{const data=await get('/api/pickup-flight?id='+encodeURIComponent(id)+'&date='+encodeURIComponent(date.value));if(ticket!==seq)return;
 const f=data.flight,t=Date.parse(f?.estimated_arrival||'');if(!data.collection?.current||!Number.isFinite(t)||['CANCELLED','DIVERTED'].includes(f.status))throw Error('현재 사용할 예상 도착시각이 없습니다');
 expires=Date.parse(data.collection.lastSuccessAt)+30*60000;if(!Number.isFinite(expires)||expires<=Date.now())throw Error('갱신 지연');
 input.value=new Date(t+9*3600000).toISOString().slice(11,16);linked=true;window.airportPickupExpired=false;
 text(f.flight_number+' · '+f.service_date+' · '+(f.terminal||'터미널 미확인')+' · 예상 '+new Date(t+9*3600000).toISOString().slice(0,16).replace('T',' ')+' KST · 최근 수집 '+new Date(data.collection.lastSuccessAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' KST'+' · 실제 입국장 도착 예측이 아닙니다.');document.getElementById('calc').click();
 }catch{if(ticket===seq){text('최신 예상시간을 가져오지 못했습니다. 공식 운항정보를 확인하거나 직접 입력하세요.');document.getElementById('calc').click();}}}
 document.getElementById('pickup-search').addEventListener('click',async()=>{const ticket=++seq;choices.replaceChildren();text('도착편 검색 중…');try{const data=await get('/api/search/flights?q='+encodeURIComponent(document.getElementById('pickup-query').value.trim())+'&date='+encodeURIComponent(date.value));if(ticket!==seq)return;
 const rows=(data.results||[]).filter(f=>f.direction==='ARRIVAL'&&f.destination==='ICN');for(const f of rows){const b=document.createElement('button');b.type='button';b.textContent=f.flight_number+' · '+f.origin+' → ICN';b.onclick=()=>select(f.flight_instance_id);choices.append(b);}text(rows.length?'해당 날짜의 실제 운항편을 선택하세요.':'해당 날짜의 인천 도착편을 찾지 못했습니다.');}catch{if(ticket===seq)text('검색 연결 실패 · 직접 입력하거나 공식 조회를 이용하세요.');}});
 date.addEventListener('change',()=>{seq++;linked=false;window.airportPickupExpired=true;input.value='';choices.replaceChildren();text('날짜가 바뀌었습니다. 도착편을 다시 조회하세요.');document.getElementById('calc').click();});
 setInterval(expired,1000);document.addEventListener('visibilitychange',expired);
 fetch(base+'runtime-config.json',{cache:'no-store'}).then(r=>r.json()).then(c=>{if(!c.liveReadApiEnabled||!c.apiBase)throw Error();api=c.apiBase.replace(/\/$/,'');if(params.get('id'))select(params.get('id'));}).catch(()=>text('실시간 연결을 확인하지 못했습니다. 직접 입력 모드로 이용하세요.'));
})();
