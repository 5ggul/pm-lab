(function(root){
 const format=t=>new Date(t+9*3600000).toISOString().slice(0,16).replace('T',' ')+' KST';
 const terminal=t=>({T1:'제1여객터미널 (T1)',T2:'제2여객터미널 (T2)',CONCOURSE:'탑승동 · 마중 입국장은 공식 안내 확인'})[t]||'터미널 미확인 · 공식 안내 확인';
 function assess(data,now=Date.now()){
  const f=data?.flight,expires=Date.parse(data?.collection?.lastSuccessAt||'')+1800000;
  if(!data?.collection?.current||!f||!Number.isFinite(expires)||expires<=now)return{message:'갱신 지연 · 최신 도착편을 다시 조회하세요.'};
  const name=(f.flight_number||'도착편')+' · '+terminal(f.terminal);
  const stopped={CANCELLED:'결항 · 마중 계산을 중단했습니다. 항공사에 대체편을 확인하세요.',DIVERTED:'회항 · 인천 도착을 가정해 계산할 수 없습니다. 항공사에 실제 도착 공항과 이후 일정을 확인하세요.',ARRIVED:'도착 완료 · 예상시간 계산 대신 동행인의 입국·수하물 진행 상황과 만날 입국장을 확인하세요.'};
  if(stopped[f.status])return{message:name+' · '+stopped[f.status]};
  if(!['SCHEDULED','DELAYED','DEPARTED','BOARDING','LANDED'].includes(f.status))return{message:name+' · 상태 미확인 · 공식 운항정보 확인 후 직접 입력하세요.'};
  const at=Date.parse(f.estimated_arrival||'');
  if(!Number.isFinite(at))return{message:name+' · 예상 도착시각 미확인 · 공식 운항정보를 확인하세요.'};
  if(at<now)return{message:name+' · '+(f.status==='LANDED'?'착륙 확인 · ':'')+'예상시각 '+format(at)+'이 지났습니다. 동행인과 항공사의 최신 안내를 확인하세요.'};
  return {at,expires,message:name+' · '+(f.status==='LANDED'?'착륙 확인 · 입국장 도착과 다릅니다. ':f.status==='DELAYED'?'지연 · ':'')+'예상 '+format(at)+' · 최근 수집 '+format(expires-1800000)};
 }
 root.AirportPickup={format,terminal,assess};
})(globalThis);
