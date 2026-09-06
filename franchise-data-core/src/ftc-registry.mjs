import {probeCatalog, fetchText, parseApiPayload} from './core.mjs';

const keyPart=key=>String(key||'').includes('%')?String(key):encodeURIComponent(String(key||''));
const PREVIEW_URL='https://franchise.ftc.go.kr/openApi.do?service=FftcBrandFrcsStatsService';

export const FTC_PUBLIC_DATASETS=Object.freeze([
  {id:'ftcBrandStores',dataId:'15110241',name:'브랜드별 가맹점 현황',catalogUrl:'https://www.data.go.kr/catalog/15110241/openapi.json',guideUrl:'https://www.data.go.kr/data/15110241/openapi.do',licenseExpected:'이용허락범위 제한 없음',role:'BRAND_STORE_AND_SALES',endpoint:'https://apis.data.go.kr/1130000/FftcBrandFrcsStatsService/getBrandFrcsStats',yearParam:'yr'},
  {id:'ftcBrandCost',dataId:'15110265',name:'브랜드별 창업 금액 현황',catalogUrl:'https://www.data.go.kr/catalog/15110265/openapi.json',guideUrl:'https://www.data.go.kr/data/15110265/openapi.do',licenseExpected:'이용허락범위 제한 없음',role:'BRAND_STARTUP_COST',endpoint:'https://apis.data.go.kr/1130000/FftcBrandFntnStatsService/getBrandFntnStats',yearParam:'yr'},
  {id:'ftcBrandMaster',dataId:'15125467',name:'브랜드 등록 정보',catalogUrl:'https://www.data.go.kr/catalog/15125467/openapi.json',guideUrl:'https://www.data.go.kr/data/15125467/openapi.do',licenseExpected:'이용허락범위 제한 없음',role:'BRAND_MASTER',endpoint:'https://apis.data.go.kr/1130000/FftcBrandRlsInfo2_Service/getBrandinfo',yearParam:'jngBizCrtraYr'},
  {id:'ftcBrandRegion',dataId:'15125490',name:'브랜드 가맹점·직영점 지역 정보',catalogUrl:'https://www.data.go.kr/catalog/15125490/openapi.json',guideUrl:'https://www.data.go.kr/data/15125490/openapi.do',licenseExpected:'이용허락범위 제한 없음',role:'BRAND_REGION_DIRECT',endpoint:'https://apis.data.go.kr/1130000/FftcBrandFrcsDropInfo3_Service/getbrandFrcsDmsstus2',yearParam:'jngBizCrtraYr'},
  {id:'ftcBrandOverview',dataId:'15109828',name:'브랜드별 브랜드 개요 통계',catalogUrl:'https://www.data.go.kr/catalog/15109828/openapi.json',guideUrl:'https://www.data.go.kr/data/15109828/openapi.do',licenseExpected:'이용허락범위 제한 없음',role:'BRAND_OVERVIEW',endpoint:'https://apis.data.go.kr/1130000/FftcBrandBrandStatsService/getBrandBrandStats',yearParam:'yr'},
  {id:'ftcIndustryOpenClose',dataId:'15157660',name:'주요 업종별 가맹점수·개폐점률',catalogUrl:'https://www.data.go.kr/catalog/15157660/openapi.json',guideUrl:'https://www.data.go.kr/data/15157660/openapi.do',licenseExpected:'이용허락범위 제한 없음',role:'CATEGORY_OPEN_CLOSE',endpoint:'https://apis.data.go.kr/1130000/FftcIndutyFrcsCntOpclStatsService/getIndutyFrcsCntOpclStats',yearParam:'jngBizCrtrYr'}
]);

export function extractPublicPreviewKey(html=''){
  const text=String(html).replace(/&amp;/g,'&').replace(/&#x2F;|&#47;/gi,'/').replace(/&#x2B;|&#43;/gi,'+').replace(/&#x3D;|&#61;/gi,'=');
  const patterns=[
    /(?:sampleKey|serviceKey)\s*[:=]\s*["']([^"'\s<>]{50,160})["']/i,
    /(?:id|name)=["'](?:sampleKey|serviceKey)["'][^>]*value=["']([^"']{50,160})["']/i,
    /value=["']([^"']{50,160})["'][^>]*(?:id|name)=["'](?:sampleKey|serviceKey)["']/i
  ];
  for(const p of patterns){const m=text.match(p);if(m?.[1])return m[1].trim()}
  const generic=[...text.matchAll(/[A-Za-z0-9+/]{70,150}={0,2}/g)].map(m=>m[0]).filter(v=>v.length>=80&&v.length<=120&&/[+/]/.test(v));
  return generic.length===1?generic[0]:null;
}
export async function discoverPublicPreviewKey({fetchImpl=fetch}={}){
  try{
    const r=await fetchText(PREVIEW_URL,{fetchImpl,timeoutMs:15000,attempts:2,headers:{referer:'https://franchise.ftc.go.kr/'}});
    if(!r.ok)return {ok:false,status:r.status,error:`HTTP ${r.status}`};
    const key=extractPublicPreviewKey(r.text);return key?{ok:true,key,source:PREVIEW_URL,transport:r.transport}:{ok:false,error:'Public preview key not found in official preview page'};
  }catch(e){return {ok:false,error:`${e.message}${e?.cause?.code?` (${e.cause.code})`:''}`};
}

export async function requestFtc(spec,serviceKey,{year=2025,fetchImpl=fetch,timeoutMs=20000,numOfRows=1,pageNo=1}={}){
  if(!serviceKey)return {live:'KEY_REQUIRED'};
  const q=new URLSearchParams({pageNo:String(pageNo),numOfRows:String(numOfRows),resultType:'json',[spec.yearParam]:String(year)});
  const url=`${spec.endpoint}?${q.toString()}&serviceKey=${keyPart(serviceKey)}`;
  try{
    const r=await fetchText(url,{fetchImpl,timeoutMs,attempts:2});const p=parseApiPayload(r.text);
    if(!r.ok)return {live:r.status===401?'UNAUTHORIZED':r.status===403?'ACCESS_DENIED':'HTTP_ERROR',httpStatus:r.status,transport:r.transport};
    const raw=p.raw||{};const header=raw?.response?.header||raw;const body=raw?.response?.body||raw;const code=header?.resultCode??body?.resultCode;
    if(code!=null&&!['00','0','0000'].includes(String(code)))return {live:['20','30'].includes(String(code))?'ACCESS_DENIED':'API_ERROR',resultCode:String(code),resultMsg:header?.resultMsg||body?.resultMsg||null,transport:r.transport};
    const items=body?.items;const list=Array.isArray(items)?items:Array.isArray(items?.item)?items.item:items?[items]:[];
    return {live:'LIVE_VERIFIED',year,totalCount:Number(body?.totalCount)||list.length,sampleCount:list.length,schemaFields:list[0]?Object.keys(list[0]).sort():[],sample:list.slice(0,Math.min(3,list.length)),transport:r.transport};
  }catch(e){return {live:'CONNECT_ERROR',error:`${e.message}${e?.cause?.code?` (${e.cause.code})`:''}`};}
}

export async function probeFtcRegistry({serviceKey='',fetchImpl=fetch}={}){
  return Promise.all(FTC_PUBLIC_DATASETS.map(async source=>{
    const [metadata,live]=await Promise.all([probeCatalog({...source,provider:'공정거래위원회'},{fetchImpl,timeoutMs:12000}),requestFtc(source,serviceKey,{fetchImpl,year:2025,timeoutMs:15000,numOfRows:1})]);
    return {...metadata,id:source.id,dataId:source.dataId,name:metadata.name||source.name,provider:'공정거래위원회',role:source.role,endpointVerifiedByProbe:live.live==='LIVE_VERIFIED',...live,guideUrl:source.guideUrl};
  }));
}
