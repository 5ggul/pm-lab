const proxyUrl=(process.env.FRANCHISE_DATA_PROXY_URL||'').trim();
const proxyAuth=(process.env.FRANCHISE_DATA_PROXY_AUTH||'').trim();
const serviceKey=(process.env.DATA_GO_KR_SERVICE_KEY||'').trim();
if(!proxyUrl||!proxyAuth) throw new Error('FRANCHISE_DATA_PROXY_URL/AUTH required');
if(!serviceKey) throw new Error('DATA_GO_KR_SERVICE_KEY required');

const target=new URL('https://apis.data.go.kr/1130000/FftcBrandFrcsStatsService/getBrandFrcsStats');
target.searchParams.set('pageNo','1');
target.searchParams.set('numOfRows','1');
target.searchParams.set('resultType','json');
target.searchParams.set('yr','2025');

const r=await fetch(proxyUrl,{
  method:'POST',
  headers:{'content-type':'application/json','authorization':`Bearer ${proxyAuth}`,'apikey':proxyAuth},
  body:JSON.stringify({targetUrl:target.toString(),serviceKey,timeoutMs:20000})
});
const text=await r.text();
const proxied=r.headers.get('x-franchise-proxy')==='supabase-edge';
let proxyError=null;
try{const j=JSON.parse(text);if(j?.error)proxyError=j.error;}catch{}
if(!proxied||proxyError==='UPSTREAM_CONNECT_ERROR'){
  throw new Error(`Proxy transport failed: http=${r.status} proxied=${proxied} error=${proxyError||'none'}`);
}
console.log(JSON.stringify({proxy:'supabase-edge',connected:true,upstreamStatus:r.status,responseFormat:text.trim().startsWith('{')?'json':text.trim().startsWith('<')?'xml':'text',bodyBytes:Buffer.byteLength(text)},null,2));
