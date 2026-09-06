export const AIRPORTS = Object.freeze([
  ['ICN','RKSI'], ['GMP','RKSS'], ['CJU','RKPC'], ['PUS','RKPK'],
  ['TAE','RKTN'], ['CJJ','RKTU'], ['KWJ','RKJJ'], ['USN','RKPU'],
  ['RSU','RKJY'], ['MWX','RKJB'], ['KPO','RKTH'], ['HIN','RKPS'],
  ['KUV','RKJK'], ['WJU','RKNW'], ['YNY','RKNY']
].map(([iata,icao]) => Object.freeze({iata,icao,provider:iata==='ICN'?'IIAC':'KAC'})));
export const KAC_AIRPORTS = Object.freeze(AIRPORTS.filter(a=>a.provider==='KAC'));
export function serviceDateKst(at=new Date().toISOString()) {
  if(!Number.isFinite(Date.parse(at))) throw new Error('INVALID_OBSERVED_AT');
  return new Date(Date.parse(at)+9*3600000).toISOString().slice(0,10);
}
