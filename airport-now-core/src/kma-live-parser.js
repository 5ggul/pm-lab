function toObject(payload){
  if(payload==null) throw new Error('KMA_PAYLOAD_REQUIRED');
  if(typeof payload==='string'){
    try{return JSON.parse(payload)}catch{throw new Error('KMA_PAYLOAD_NOT_JSON')}
  }
  return payload;
}
function decodeXmlText(value){
  return String(value??'')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&apos;/g,"'").replace(/&amp;/g,'&').trim();
}
function localText(xml,name){
  const re=new RegExp(`<\\s*(?:[A-Za-z0-9_-]+:)?${name}\\b[^>]*>([^<]*)<\\/\\s*(?:[A-Za-z0-9_-]+:)?${name}\\s*>`,'i');
  const m=String(xml||'').match(re);
  return m?decodeXmlText(m[1]):null;
}
function hrefCodes(xml,name){
  const re=new RegExp(`<\\s*(?:[A-Za-z0-9_-]+:)?${name}\\b[^>]*\\bxlink:href=["']([^"']+)["'][^>]*/?>`,'gi');
  const out=[]; let m;
  while((m=re.exec(String(xml||'')))) out.push(m[1].split('/').filter(Boolean).pop());
  return out;
}
function n(v){if(v==null||v==='')return null;const x=Number(v);return Number.isFinite(x)?x:null}
function knotsToMps(v){const x=n(v);return x==null?null:+(x*0.514444).toFixed(1)}
function rootKind(xml){
  const s=String(xml||'');
  if(/<\\s*iwxxm:SPECI\\b/i.test(s)) return 'SPECI';
  if(/<\\s*iwxxm:METAR\\b/i.test(s)) return 'METAR';
  return 'METAR_OR_SPECI';
}
export function extractKmaMetarItems(payload){
  const p=toObject(payload);
  const response=p?.response;
  const code=String(response?.header?.resultCode??'');
  if(code!=='00') throw new Error(`KMA_API_ERROR_${code||'UNKNOWN'}`);
  const items=response?.body?.items?.item;
  if(!Array.isArray(items)) return items?[items]:[];
  return items;
}
export function parseKmaIwxxmMetar(xml,{observedAt=new Date().toISOString()}={}){
  if(!xml||typeof xml!=='string') throw new Error('KMA_METAR_XML_REQUIRED');
  const icao=localText(xml,'designator');
  if(!icao) throw new Error('KMA_METAR_ICAO_MISSING');
  return {
    icao,
    airportName:localText(xml,'name'),
    kind:rootKind(xml),
    phenomenonTime:localText(xml,'timePosition'),
    airTemperature:n(localText(xml,'airTemperature')),
    dewpointTemperature:n(localText(xml,'dewpointTemperature')),
    qnh:n(localText(xml,'qnh')),
    meanWindDirection:n(localText(xml,'meanWindDirection')),
    meanWindSpeed:knotsToMps(localText(xml,'meanWindSpeed')),
    windGustSpeed:knotsToMps(localText(xml,'windGustSpeed')),
    visibility:n(localText(xml,'prevailingVisibility')),
    presentWeather:hrefCodes(xml,'presentWeather'),
    cloudAmounts:hrefCodes(xml,'amount'),
    observedAt,
    sourceId:'KMA_METAR_SPECI',
    sourceUnits:{temperature:'C',qnh:'hPa',wind:'kt',visibility:'m'},
    canonicalUnits:{temperature:'C',qnh:'hPa',wind:'m/s',visibility:'m'}
  };
}
export function normalizeKmaMetarLiveResponse(payload,{observedAt=new Date().toISOString()}={}){
  return extractKmaMetarItems(payload).map(item=>parseKmaIwxxmMetar(item?.metarMsg,{observedAt}));
}
