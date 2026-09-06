import {probeCatalog} from './core.mjs';

export const FTC_PUBLIC_DATASETS=Object.freeze([
  {id:'ftcBrandCost',name:'브랜드별 창업 금액 현황',provider:'공정거래위원회',catalogUrl:'https://www.data.go.kr/catalog/15110265/openapi.json',guideUrl:'https://www.data.go.kr/data/15110265/openapi.do',licenseExpected:'이용허락범위 제한 없음',role:'BRAND_STARTUP_COST'},
  {id:'ftcBrandStores',name:'브랜드별 가맹점 현황',provider:'공정거래위원회',catalogUrl:'https://www.data.go.kr/catalog/15110241/openapi.json',guideUrl:'https://www.data.go.kr/data/15110241/openapi.do',licenseExpected:'이용허락범위 제한 없음',role:'BRAND_STORE_AND_SALES'},
  {id:'ftcIndustryStores',name:'주요 업종별 가맹점수 현황',provider:'공정거래위원회',catalogUrl:'https://www.data.go.kr/catalog/15110399/openapi.json',guideUrl:'https://www.data.go.kr/data/15110399/openapi.do',licenseExpected:'이용허락범위 제한 없음',role:'CATEGORY_STORE_COUNTS'},
  {id:'ftcOpenClose',name:'주요 업종별 가맹점 개·폐점률 현황',provider:'공정거래위원회',catalogUrl:'https://www.data.go.kr/catalog/15110402/openapi.json',guideUrl:'https://www.data.go.kr/data/15110402/openapi.do',licenseExpected:'이용허락범위 제한 없음',role:'CATEGORY_OPEN_CLOSE'}
]);

export async function probeFtcRegistry({fetchImpl=fetch}={}){
  const rows=await Promise.all(FTC_PUBLIC_DATASETS.map(async source=>{
    const metadata=await probeCatalog(source,{fetchImpl,timeoutMs:15000});
    return {...metadata,id:source.id,name:metadata.name||source.name,provider:'공정거래위원회',role:source.role,live:'SPEC_MAPPING_REQUIRED',guideUrl:source.guideUrl};
  }));
  return rows;
}
