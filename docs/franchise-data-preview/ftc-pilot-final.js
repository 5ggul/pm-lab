'use strict';
globalThis.FTC_PILOT={
  "schemaVersion": 3,
  "generatedAt": "2026-09-08T06:11:34.661Z",
  "year": 2025,
  "status": "BLOCKED",
  "credentialMode": "USER_DATA_GO_KR_KEY",
  "productionReady": false,
  "previewRealDataReady": false,
  "required": [
    "ftcBrandCost",
    "ftcBrandStores"
  ],
  "blockers": [
    "ftcBrandCost:ACCESS_DENIED",
    "ftcBrandStores:ACCESS_DENIED"
  ],
  "primaryCredentialBlockers": [
    "ftcBrandCost:ACCESS_DENIED",
    "ftcBrandStores:ACCESS_DENIED"
  ],
  "demoDiscovery": {
    "ok": false,
    "error": "Public preview key not found in official preview page",
    "source": null
  },
  "results": [
    {
      "id": "ftcBrandStores",
      "dataId": "15110241",
      "name": "브랜드별 가맹점 현황",
      "role": "BRAND_STORE_AND_SALES",
      "endpoint": "https://apis.data.go.kr/1130000/FftcBrandFrcsStatsService/getBrandFrcsStats",
      "yearParam": "yr",
      "live": "ACCESS_DENIED",
      "httpStatus": 403,
      "transport": "fetch"
    },
    {
      "id": "ftcBrandCost",
      "dataId": "15110265",
      "name": "브랜드별 창업 금액 현황",
      "role": "BRAND_STARTUP_COST",
      "endpoint": "https://apis.data.go.kr/1130000/FftcBrandFntnStatsService/getBrandFntnStats",
      "yearParam": "yr",
      "live": "ACCESS_DENIED",
      "httpStatus": 403,
      "transport": "fetch"
    },
    {
      "id": "ftcBrandMaster",
      "dataId": "15125467",
      "name": "브랜드 등록 정보",
      "role": "BRAND_MASTER",
      "endpoint": "https://apis.data.go.kr/1130000/FftcBrandRlsInfo2_Service/getBrandinfo",
      "yearParam": "jngBizCrtraYr",
      "live": "ACCESS_DENIED",
      "httpStatus": 403,
      "transport": "fetch"
    },
    {
      "id": "ftcBrandRegion",
      "dataId": "15125490",
      "name": "브랜드 가맹점·직영점 지역 정보",
      "role": "BRAND_REGION_DIRECT",
      "endpoint": "https://apis.data.go.kr/1130000/FftcBrandFrcsDropInfo3_Service/getbrandFrcsDmsstus2",
      "yearParam": "jngBizCrtraYr",
      "live": "ACCESS_DENIED",
      "httpStatus": 403,
      "transport": "fetch"
    },
    {
      "id": "ftcBrandOverview",
      "dataId": "15109828",
      "name": "브랜드별 브랜드 개요 통계",
      "role": "BRAND_OVERVIEW",
      "endpoint": "https://apis.data.go.kr/1130000/FftcBrandBrandStatsService/getBrandBrandStats",
      "yearParam": "yr",
      "live": "ACCESS_DENIED",
      "httpStatus": 403,
      "transport": "fetch"
    },
    {
      "id": "ftcIndustryOpenClose",
      "dataId": "15157660",
      "name": "주요 업종별 가맹점수·개폐점률",
      "role": "CATEGORY_OPEN_CLOSE",
      "endpoint": "https://apis.data.go.kr/1130000/FftcIndutyFrcsCntOpclStatsService/getIndutyFrcsCntOpclStats",
      "yearParam": "jngBizCrtrYr",
      "live": "ACCESS_DENIED",
      "httpStatus": 403,
      "transport": "fetch"
    }
  ]
};
