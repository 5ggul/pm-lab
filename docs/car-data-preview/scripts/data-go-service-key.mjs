function unwrap(value){
  let key=String(value??'').replace(/^\uFEFF/,'').trim();
  if((key.startsWith('"')&&key.endsWith('"'))||(key.startsWith("'")&&key.endsWith("'")))key=key.slice(1,-1).trim();
  key=key.replace(/^(?:serviceKey|ServiceKey)\s*=\s*/,'').trim();
  try{
    const decoded=decodeURIComponent(key);
    if(decoded)key=decoded;
  }catch{}
  return key;
}

export function dataGoServiceKeys(env=process.env){
  return [...new Set([
    unwrap(env.DATA_GO_KR_SERVICE_KEY),
    unwrap(env.DATAKEY)
  ].filter(Boolean))];
}

export function addDataGoServiceKey(url,key){
  url.searchParams.set('serviceKey',key);
  return url;
}
