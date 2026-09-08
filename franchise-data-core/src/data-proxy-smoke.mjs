import {createHash} from 'node:crypto';
import {classifyDataGoError} from './data-go-error.mjs';

const proxyUrl=(process.env.FRANCHISE_DATA_PROXY_URL||'').trim();
const rawServiceKey=process.env.DATA_GO_KR_SERVICE_KEY||'';
const serviceKey=rawServiceKey.trim();
if(!proxyUrl) throw new Error('FRANCHISE_DATA_PROXY_URL required');
if(!serviceKey) throw new Error('DATA_GO_KR_SERVICE_KEY required');
const proof=createHash('sha256').update(`franchise-data-proxy:v1:${serviceKey}`).digest('hex');
const keyShape={
  length:serviceKey.length,
  trimmedBytes:Buffer.byteLength(serviceKey),
  hadOuterWhitespace:rawServiceKey!==serviceKey,
  containsWhitespace:/\s/.test(serviceKey),
  wrappedInQuotes:/^(?:".*"|'.*')$/.test(serviceKey),
  percentEncoded:serviceKey.includes('%'),
  containsBase64Symbols:/[+/=]/.test(serviceKey)
};

const target=new URL('https://apis.data.go.kr/1130000/FftcBrandFrcsStatsService/getBrandFrcsStats');
target.searchParams.set('pageNo','1');
target.searchParams.set('numOfRows','1');
target.searchParams.set('resultType','json');
target.searchParams.set('yr','2025');

const r=await fetch(proxyUrl,{
  method:'POST',
  headers:{'content-type':'application/json','x-franchise-proxy-proof':proof},
  body:JSON.stringify({targetUrl:target.toString(),serviceKey,timeoutMs:20000})
});
const text=await r.text();
const proxied=r.headers.get('x-franchise-proxy')==='supabase-edge';
let proxyError=null;
try{const j=JSON.parse(text);if(j?.error)proxyError=j.error;}catch{}
if(!proxied||proxyError==='UPSTREAM_CONNECT_ERROR'||proxyError==='PROXY_AUTH_FAILED'){
  throw new Error(`Proxy transport failed: http=${r.status} proxied=${proxied} error=${proxyError||'none'}`);
}
const gateway=r.ok?null:classifyDataGoError(text,r.status);
console.log(JSON.stringify({
  proxy:'supabase-edge',connected:true,upstreamStatus:r.status,
  responseFormat:text.trim().startsWith('{')?'json':text.trim().startsWith('<')?'xml':'text',
  bodyBytes:Buffer.byteLength(text),keyShape,gateway
},null,2));
