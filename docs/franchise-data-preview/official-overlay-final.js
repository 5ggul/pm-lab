'use strict';
(function(){
 const doc=globalThis.OFFICIAL_BRAND_DATA;
 const norm=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/주식회사|\(주\)|㈜|\(유\)|유한회사|농업회사법인|재단법인|사단법인/g,'').replace(/[^0-9a-z가-힣]/g,'');
 const meta={applied:false,status:doc?.status||'MISSING',credentialMode:doc?.credentialMode||null,productionReady:!!doc?.productionReady,matched:0,totalPreview:typeof brands!=='undefined'?brands.length:0,quality:doc?.quality||null};
 if(!doc||doc.status!=='READY'||!doc.promotion?.allowPreviewOverlay||typeof brands==='undefined'){globalThis.OFFICIAL_OVERLAY_META=meta;return;}
 const groups=new Map();for(const r of doc.records||[]){const k=norm(r.name);if(!k)continue;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
 for(const b of brands){const rows=groups.get(norm(b.name));if(!rows||rows.length!==1)continue;const r=rows[0];
  if(r.startupCost10k!=null)b.cost=r.startupCost10k;if(r.stores!=null)b.stores=r.stores;if(r.previousStores!=null)b.lastStores=r.previousStores;if(r.averageSales10k!=null)b.sales=r.averageSales10k;if(r.startupFee10k!=null)b.fee=r.startupFee10k;if(r.startupEducation10k!=null)b.education=r.startupEducation10k;if(r.startupDeposit10k!=null)b.deposit=r.startupDeposit10k;
  if(r.startupEtc10k!=null){b.other=Math.max(0,r.startupEtc10k);b.interior=Math.max(0,(b.cost||0)-(b.fee||0)-(b.education||0)-(b.deposit||0)-b.other)}
  b.corp=r.corp||b.corp;b.officialIndustryMajor=r.industryMajor;b.officialIndustryMid=r.industryMid;b.referenceYear=r.referenceYear;b.dataMode=doc.credentialMode==='FTC_PUBLIC_PREVIEW_DEMO'?'FTC_OFFICIAL_PREVIEW':'FTC_OFFICIAL';b.officialSource=r.source;meta.matched++;
 }
 meta.applied=meta.matched>0;globalThis.OFFICIAL_OVERLAY_META=meta;
 if(meta.applied){
  previewNotice=function(){
   if(doc.credentialMode==='FTC_PUBLIC_PREVIEW_DEMO')return `<div class="notice official"><strong>공정위 공식 미리보기 실데이터 적용</strong><span>${meta.matched}개 프리뷰 브랜드의 비용·가맹점·매출 관련 수치를 공정위 공개 미리보기 인증 경로로 수집한 2025 Snapshot으로 교체했습니다. 이 URL은 noindex 검수용이며, 정식 운영은 사용자 data.go.kr 승인키 전환 후 productionReady가 되어야 합니다.</span></div>`;
   return `<div class="notice official"><strong>공정위 공식 데이터 적용</strong><span>${meta.matched}개 프리뷰 브랜드의 비용·가맹점·매출 관련 수치를 사용자 승인키로 수집한 2025 공식 API Snapshot으로 교체했습니다.</span></div>`;
  };
  sourceLine=function(label='공정거래위원회 공개 API + 자체 파생지표'){return `<div class="source-line"><span>공식 기준연도: 2025 · Snapshot ${esc(doc.generatedAt?.slice(0,10)||'')}</span><span><a href="#/sources">출처·품질 보기</a> · ${label}${doc.productionReady?'':' · PREVIEW ONLY'}</span></div>`};
 }
})();
