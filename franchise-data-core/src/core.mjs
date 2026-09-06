'use strict';

export const SOURCES=Object.freeze({
 sbiz:{id:'sbiz',name:'소상공인시장진흥공단 상가(상권)정보',provider:'소상공인시장진흥공단',catalogUrl:'https://www.data.go.kr/catalog/15012005/openapi.json',guideUrl:'https://www.data.go.kr/data/15012005/openapi.do',serviceBase:'https://apis.data.go.kr/B553077/api/open/sdsc2',fallbackBase:'http://apis.data.go.kr/B553077/api/open/sdsc2',licenseExpected:'이용허락범위 제한 없음'},
 ftcIndustry:{id:'ftcIndustry',name:'공정위 주요 업종별 가맹점수·개폐점률',provider:'공정거래위원회',catalogUrl:'https://www.data.go.kr/catalog/15157660/openapi.json',guideUrl:'https://www.data.go.kr/data/15157660/openapi.do',licenseExpected:'이용허락범위 제한 없음'},
 fairdata:{id:'fairdata',name:'공정위 FairData 가맹 브랜드 데이터',provider:'공정거래위원회',catalogUrl:'https://fairdata.go.kr/ext/index.do',guideUrl:'https://fairdata.go.kr/ext/index.do',access:'DATASET_DEPENDENT_APPROVAL'}
});
const isoNow=()=>new Date().toISOString();
const errorText=e=>`${e?.message||'unknown error'}${e?.cause?.code?` (${e.cause.code})`:''}`;
const serviceKeyPart=key=>String(key||'').includes('%')?String(key):encodeURIComponent(String(key||''));

export async function fetchText(url,{fetchImpl=fetch,timeoutMs=30000,headers={}}={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{const response=await fetchImpl(url,{signal:controller.signal,headers:{'user-agent':'pm-lab-franchise-data-core/1.2',accept:'application/json, application/xml;q=0.8, text/xml;q=0.7',...headers}});return {ok:response.ok,status:response.status,text:await response.text(),headers:response.headers,url:String(url)}}finally{clearTimeout(timer)}
}
export function parseApiPayload(text=''){
 const trimmed=String(text).trim();
 if(!trimmed)return {format:'empty',body:null,header:null};
 try{const j=JSON.parse(trimmed);return {format:'json',raw:j,body:j?.body||j?.response?.body||null,header:j?.header||j?.response?.header||null}}catch{}
 const total=trimmed.match(/<totalCount>\s*([^<]+)\s*<\/totalCount>/i)?.[1];
 const code=trimmed.match(/<(?:resultCode|returnReasonCode)>\s*([^<]+)\s*<\/(?:resultCode|returnReasonCode)>/i)?.[1];
 const msg=trimmed.match(/<(?:resultMsg|returnAuthMsg)>\s*([^<]+)\s*<\/(?:resultMsg|returnAuthMsg)>/i)?.[1];
 if(total!=null||code||msg)return {format:'xml',raw:trimmed,body:total!=null?{totalCount:Number(total)}:null,header:{resultCode:code||null,resultMsg:msg||null}};
 return {format:'text',raw:trimmed.slice(0,500),body:null,header:null};
}
export async function requestSbiz(operation,params,serviceKey,{fetchImpl=fetch,timeoutMs=30000}={}){
 if(!serviceKey)throw new Error('DATA_GO_KR_SERVICE_KEY is required');
 const query=new URLSearchParams({...params,type:params?.type||'json'});query.delete('serviceKey');
 const key=serviceKeyPart(serviceKey);const bases=[SOURCES.sbiz.serviceBase,SOURCES.sbiz.fallbackBase];let lastError;
 for(const base of bases){
  const url=`${base}/${operation}?${query.toString()}&serviceKey=${key}`;
  try{const r=await fetchText(url,{fetchImpl,timeoutMs});const parsed=parseApiPayload(r.text);if(!r.ok)throw new Error(`HTTP ${r.status}`);const code=parsed.header?.resultCode;if(code&&!['00','0','0000'].includes(String(code)))throw new Error(`${code}: ${parsed.header?.resultMsg||'API error'}`);if(parsed.format==='text'||parsed.format==='empty')throw new Error(`Unexpected ${parsed.format} response`);return {...parsed,status:r.status,url:base.replace(/https?:\/\//,'')+'/'+operation}}
  catch(e){lastError=e}
 }
 throw lastError||new Error('Sbiz request failed');
}
export async function fetchJson(url,opts={}){const r=await fetchText(url,opts);if(!r.ok)throw new Error(`HTTP ${r.status}: ${url}`);try{return JSON.parse(r.text)}catch(e){throw new Error(`Invalid JSON from ${url}: ${e.message}`)}}
export function normalizeCatalog(meta={},source){return {id:source.id,name:meta.name||source.name,provider:meta.creator?.name||source.provider,availability:'METADATA_VERIFIED',license:meta.license||null,modifiedAt:meta.dateModified||null,format:meta.encodingFormat||null,spatialCoverage:meta.spatialCoverage||null,guideUrl:meta.url||source.guideUrl,checkedAt:isoNow()}}
export async function probeCatalog(source,opts={}){try{const meta=await fetchJson(source.catalogUrl,opts);const n=normalizeCatalog(meta,source);if(source.licenseExpected&&n.license!==source.licenseExpected)n.availability='METADATA_VERIFIED_LICENSE_REVIEW';return n}catch(e){return {id:source.id,name:source.name,provider:source.provider,availability:'METADATA_UNAVAILABLE',error:errorText(e),guideUrl:source.guideUrl,checkedAt:isoNow()}}}

export async function probeSbiz(serviceKey,opts={}){
 const s=SOURCES.sbiz;if(!serviceKey)return {id:s.id,live:'KEY_REQUIRED',checkedAt:isoNow(),operation:'largeUpjongList → storeListInDong'};
 let authProbe;
 try{authProbe=await requestSbiz('largeUpjongList',{numOfRows:'1',pageNo:'1'},serviceKey,opts)}catch(e){return {id:s.id,live:'AUTH_PROBE_ERROR',operation:'largeUpjongList',error:errorText(e),checkedAt:isoNow()}}
 try{
  const scoped=await requestSbiz('storeListInDong',{divId:'signguCd',key:'11680',indsSclsCd:'I21201',numOfRows:'1',pageNo:'1'},serviceKey,opts);
  const count=Number(scoped.body?.totalCount);if(!Number.isFinite(count))throw new Error('Scoped response missing totalCount');
  return {id:s.id,live:'LIVE_VERIFIED',operation:'storeListInDong',pilot:'서울 강남구 · 카페 I21201',sampleTotalCount:count,authProbe:authProbe.format,checkedAt:isoNow()};
 }catch(e){return {id:s.id,live:'LIVE_PARTIAL',operation:'storeListInDong',pilot:'서울 강남구 · 카페 I21201',authProbe:'LIVE_VERIFIED',error:errorText(e),checkedAt:isoNow()}}
}
export async function probeFtcIndustry(serviceKey,endpoint,opts={}){
 const s=SOURCES.ftcIndustry;if(!serviceKey)return {id:s.id,live:'KEY_REQUIRED',checkedAt:isoNow()};if(!endpoint)return {id:s.id,live:'ENDPOINT_MAPPING_REQUIRED',checkedAt:isoNow()};const sep=endpoint.includes('?')?'&':'?';const url=`${endpoint}${sep}pageNo=1&numOfRows=1&serviceKey=${serviceKeyPart(serviceKey)}`;
 try{const r=await fetchText(url,opts);const p=parseApiPayload(r.text);if(!r.ok)throw new Error(`HTTP ${r.status}`);return {id:s.id,live:p.body?'LIVE_VERIFIED':'LIVE_RESPONSE_REVIEW',checkedAt:isoNow()}}catch(e){return {id:s.id,live:'LIVE_ERROR',error:errorText(e),checkedAt:isoNow()}}
}
export async function probeFairdata(opts={}){const s=SOURCES.fairdata;try{const r=await fetchText(s.catalogUrl,opts);if(!r.ok)throw new Error(`HTTP ${r.status}`);const latest=[...r.text.matchAll(/2026-\d{2}-\d{2}/g)].map(x=>x[0]).sort().at(-1)||null;return {id:s.id,name:s.name,provider:s.provider,availability:'PORTAL_VERIFIED',live:'APPROVAL_OR_KEY_REQUIRED_BY_DATASET',latestPortalDate:latest,guideUrl:s.guideUrl,checkedAt:isoNow()}}catch(e){return {id:s.id,name:s.name,provider:s.provider,availability:'PORTAL_UNAVAILABLE',live:'PORTAL_UNAVAILABLE',error:errorText(e),guideUrl:s.guideUrl,checkedAt:isoNow()}}}
export async function buildSourceStatus({env=process.env,fetchImpl=fetch}={}){const opts={fetchImpl,timeoutMs:30000};const [sbizMeta,ftcMeta,fairdata]=await Promise.all([probeCatalog(SOURCES.sbiz,opts),probeCatalog(SOURCES.ftcIndustry,opts),probeFairdata(opts)]);const [sbizLive,ftcLive]=await Promise.all([probeSbiz(env.DATA_GO_KR_SERVICE_KEY,opts),probeFtcIndustry(env.DATA_GO_KR_SERVICE_KEY,env.FTC_FRANCHISE_INDUSTRY_ENDPOINT,opts)]);return {schemaVersion:2,generatedAt:isoNow(),dataMode:env.DATA_GO_KR_SERVICE_KEY?'PUBLIC_API_READINESS':'METADATA_ONLY_READINESS',sources:[{...sbizMeta,...sbizLive,id:'sbiz'},{...ftcMeta,...ftcLive,id:'ftcIndustry'},fairdata,{id:'derived',name:'창업데이터랩 파생지표 엔진',provider:'자체 계산',availability:'READY',live:'READY',checkedAt:isoNow()}]}}
export function statusToJavascript(status){return `'use strict';\n// Generated by franchise-data-core. Do not hand-edit.\nglobalThis.SOURCE_STATUS=${JSON.stringify(status,null,2)};\n`}
