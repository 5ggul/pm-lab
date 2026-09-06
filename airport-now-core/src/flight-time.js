// Compact provider timestamps are local Korean time, never the machine timezone.
export function flightTime(value, serviceDate) {
  if(value==null || String(value).trim()==='') return null;
  let s=String(value).trim();
  if(/^\d{4}$/.test(s)) s=serviceDate.replaceAll('-','')+s;
  if(!/^\d{12}(\d{2})?$/.test(s)) throw new Error('INVALID_FLIGHT_TIME');
  const date=`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  const h=Number(s.slice(8,10)),m=Number(s.slice(10,12)),sec=Number(s.slice(12)||0);
  const base=Date.parse(date+'T00:00:00+09:00');
  if(!Number.isFinite(base)||new Date(base+9*3600000).toISOString().slice(0,10)!==date||h>24||m>59||sec>59||(h===24&&(m||sec))) throw new Error('INVALID_FLIGHT_TIME');
  return new Date(base+(h*3600+m*60+sec)*1000+9*3600000).toISOString().slice(0,19)+'+09:00';
}
export function comparisonTime(value,serviceDate,scheduled) {
  const iso=flightTime(value,serviceDate);
  if(iso && /^\d{4}$/.test(String(value)) && Date.parse(iso)<Date.parse(scheduled)-12*3600000)
    return new Date(Date.parse(iso)+86400000+9*3600000).toISOString().slice(0,19)+'+09:00';
  return iso;
}
