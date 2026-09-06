import { SOURCES as BASE_SOURCES, SOURCE_STATES, READINESS } from '../core.js';

const ACCESS_BLOCKED='ACCESS_BLOCKED';
const { KAC_FLIGHT_SEARCH_GW: _supersededKacSearch, ...CURRENT_BASE_SOURCES }=BASE_SOURCES;

export const SOURCES=Object.freeze({
  ...CURRENT_BASE_SOURCES,
  IIAC_PASSENGER_ARRIVAL:{
    ...BASE_SOURCES.IIAC_PASSENGER_ARRIVAL,
    state:SOURCE_STATES.LIVE_VERIFIED,
    readiness:READINESS.FIXTURE_READY,
    productionEnabled:false,
    notes:'HTTP 200 live fixture verified. Current-main D1 bulk ingest and codeshare dedupe are implemented; production remains disabled until Worker + D1 deployment verification.'
  },
  IIAC_PASSENGER_DEPARTURE:{
    id:'IIAC_PASSENGER_DEPARTURE',
    provider:'인천국제공항공사',
    datasetId:'15112968',
    endpoint:'https://apis.data.go.kr/B551177/StatusOfPassengerFlightsDeOdp/getPassengerDeparturesDeOdp',
    state:SOURCE_STATES.DOC_VERIFIED,
    readiness:ACCESS_BLOCKED,
    productionEnabled:false,
    scope:'ICN 여객 출발 상세',
    notes:'Official operation and response fields verified. Current registered service key returns SERVICE_KEY_IS_NOT_REGISTERED_ERROR.'
  },
  KAC_FLIGHT_STATUS_GW:{
    id:'KAC_FLIGHT_STATUS_GW',
    provider:'한국공항공사',
    datasetId:'15158625',
    endpoints:{
      departure:'https://apis.data.go.kr/B551178/flight-status/depart',
      arrival:'https://apis.data.go.kr/B551178/flight-status/arrival'
    },
    state:SOURCE_STATES.DOC_VERIFIED,
    readiness:ACCESS_BLOCKED,
    productionEnabled:false,
    scope:'인천 제외 공항 실시간 출발·도착',
    notes:'Official depart/arrival operations and fields verified. Current registered service key returns SERVICE_KEY_IS_NOT_REGISTERED_ERROR.'
  },
  KMA_METAR_SPECI:{
    ...BASE_SOURCES.KMA_METAR_SPECI,
    state:SOURCE_STATES.LIVE_VERIFIED,
    readiness:READINESS.FIXTURE_READY,
    productionEnabled:false,
    notes:'IWXXM 2023-1 live responses verified. Current-main D1 ingest uses phenomenon-time freshness, immutable weather events, and request-time freshness gating; production remains disabled until Worker + D1 deployment verification.'
  }
});

export const READINESS_EXT=Object.freeze({...READINESS,ACCESS_BLOCKED});
export function productionReadySources(){
  return Object.values(SOURCES).filter(source=>source.state===SOURCE_STATES.LIVE_VERIFIED&&source.productionEnabled);
}
