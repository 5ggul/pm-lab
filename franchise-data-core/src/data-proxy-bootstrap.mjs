const proxyUrl=(process.env.FRANCHISE_DATA_PROXY_URL||'').trim();
const proxyAuth=(process.env.FRANCHISE_DATA_PROXY_AUTH||'').trim();
const timeoutMs=Math.min(Math.max(Number(process.env.FRANCHISE_DATA_PROXY_TIMEOUT_MS)||25000,3000),30000);

if(proxyUrl&&proxyAuth){
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
        'authorization':`Bearer ${proxyAuth}`,
        'apikey':proxyAuth,
        'user-agent':'pm-lab-franchise-data-core-proxy-bootstrap/1.0'
      },
      body:JSON.stringify({targetUrl:requestUrl.toString(),serviceKey,timeoutMs})
    });
  };
  globalThis.__FRANCHISE_DATA_PROXY_ACTIVE__=true;
}
