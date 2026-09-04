const IIAC_DETAILED_BASE='https://apis.data.go.kr/B551177/StatusOfPassengerFlightsDeOdp';
const KAC_STATUS_BASE='https://apis.data.go.kr/B551178/flight-status';

function url(base,path,params){
  const u=new URL(`${base}${path}`);
  for(const [k,v] of Object.entries(params)) if(v!=null&&v!=='') u.searchParams.set(k,String(v));
  return u.toString();
}

export function buildIiacDepartureDetailedUrl({serviceKey,searchday,pageNo=1,numOfRows=100,type='json'}){
  if(!serviceKey) throw new Error('serviceKey required');
  return url(IIAC_DETAILED_BASE,'/getPassengerDeparturesDeOdp',{serviceKey,pageNo,numOfRows,type,searchday});
}

export function buildKacDepartUrl({serviceKey,searchday,airportCode,pageNo=1,numOfRows=100,type='json'}){
  if(!serviceKey) throw new Error('serviceKey required');
  return url(KAC_STATUS_BASE,'/depart',{serviceKey,pageNo,numOfRows,searchday,airport_code:airportCode,type});
}

export function buildKacArrivalUrl({serviceKey,searchday,airportCode,pageNo=1,numOfRows=100,type='json'}){
  if(!serviceKey) throw new Error('serviceKey required');
  return url(KAC_STATUS_BASE,'/arrival',{serviceKey,pageNo,numOfRows,searchday,airport_code:airportCode,type});
}

export const VERIFIED_FLIGHT_STATUS_SPEC=Object.freeze({
  IIAC_DEPARTURE:{datasetId:'15112968',host:IIAC_DETAILED_BASE,path:'/getPassengerDeparturesDeOdp'},
  KAC_DEPARTURE:{datasetId:'15158625',host:KAC_STATUS_BASE,path:'/depart'},
  KAC_ARRIVAL:{datasetId:'15158625',host:KAC_STATUS_BASE,path:'/arrival'}
});
