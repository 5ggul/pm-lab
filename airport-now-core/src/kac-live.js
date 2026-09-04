const ENDPOINT='https://apis.data.go.kr/B551178/flight-search/info';

function normalizePublicDataServiceKey(value){
  const raw=String(value||'').trim();
  if(!raw) throw new Error('serviceKey required');
  if(!/%[0-9A-Fa-f]{2}/.test(raw)) return raw;
  try{return decodeURIComponent(raw)}catch{return raw}
}

export function buildKacFlightSearchUrl({serviceKey,flightNumber,lineType=null,ioType=null,airportCode=null,startTime=null,endTime=null,type='json'}){
  if(!serviceKey) throw new Error('serviceKey required');
  const schFln=String(flightNumber||'').toUpperCase().replace(/\s+/g,'');
  if(!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(schFln)) throw new Error('valid flightNumber required');
  if(lineType!=null&&!['D','I'].includes(String(lineType).toUpperCase())) throw new Error('lineType must be D or I');
  if(ioType!=null&&!['I','O'].includes(String(ioType).toUpperCase())) throw new Error('ioType must be I or O');
  if(airportCode!=null&&!/^[A-Z0-9]{3}$/.test(String(airportCode).toUpperCase())) throw new Error('airportCode must be IATA');
  for(const [name,value] of [['startTime',startTime],['endTime',endTime]]) if(value!=null&&!/^\d{4}$/.test(String(value))) throw new Error(`${name} must be HHMM`);
  const u=new URL(ENDPOINT);
  const params={serviceKey:normalizePublicDataServiceKey(serviceKey),schLineType:lineType?.toUpperCase(),schIOType:ioType?.toUpperCase(),schAirCode:airportCode?.toUpperCase(),schStTime:startTime,schEdTime:endTime,schFln,type};
  for(const[k,v] of Object.entries(params)) if(v!=null&&v!=='') u.searchParams.set(k,String(v));
  return u.toString();
}

export function parseKacFlightSearchEnvelope(payload){
  const root=typeof payload==='string'?JSON.parse(payload):payload;
  const response=root?.response;
  const code=String(response?.header?.resultCode??'');
  if(code!=='00') throw new Error(`KAC_RESPONSE_ERROR:${code||'MISSING_CODE'}:${response?.header?.resultMsg||''}`);
  const items=response?.body?.items;
  const item=Array.isArray(items)?items:Array.isArray(items?.item)?items.item:items?.item?[items.item]:[];
  return {rows:item,totalCount:Number(response?.body?.totalCount??item.length)||item.length,pageNo:response?.body?.pageNo??null,numOfRows:response?.body?.numOfRows??null};
}

export const KAC_FLIGHT_SEARCH_FIELDS=Object.freeze(['airlineKorean','airport','arrivedEng','arrivedKor','boardingEng','boardingKor','city','etd','gate','io','line','rmkEng','rmkKor','std','airFln','airlineEnglish']);
export const KAC_FLIGHT_SEARCH_ENDPOINT=ENDPOINT;
