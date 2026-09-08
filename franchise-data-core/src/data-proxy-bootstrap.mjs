import {createHash} from 'node:crypto';

const proxyUrl=(process.env.FRANCHISE_DATA_PROXY_URL||'').trim();
const timeoutMs=Math.min(Math.max(Number(process.env.FRANCHISE_DATA_PROXY_TIMEOUT_MS)||25000,3000),30000);
const proofFor=serviceKey=>createHash('sha256').update(`franchise-data-proxy:v1:${serviceKey}`).digest('hex');

if(proxyUrl){
  const originalFetch=globalThis.fetch.bind(globalThis);
  globalThis.fetch=async (input,init={})=>{
    let requestUrl;
    try{
      requestUrl=input instanceof Request?new URL(input.url):new URL(String(input));
    }catch{
      return originalFetch(input,init);
    }
    if(requestUrl.hostname!=='apis.data.go.kr') return originalFetch(input,init);
    const serviceKey=requestUrl.searchParams.get('serviceKey')||'';
    if(!serviceKey) return originalFetch(input,init);
    requestUrl.searchParams.delete('serviceKey');
    return originalFetch(proxyUrl,{
      method:'POST',
      signal:init?.signal,
      headers:{
        'content-type':'application/json',
        'x-franchise-proxy-proof':proofFor(serviceKey),
        'user-agent':'pm-lab-franchise-data-core-proxy-bootstrap/2.0'
      },
      body:JSON.stringify({targetUrl:requestUrl.toString(),serviceKey,timeoutMs})
    });
  };
  globalThis.__FRANCHISE_DATA_PROXY_ACTIVE__=true;
}
