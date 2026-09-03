function fail(reasons,reason){reasons.push(reason)}
export function airportIndexGate(v,cfg={}){
  const c={minEligibleFlights:10,minBaselineSample:20,minFlightRows:4,maxFreshnessMinutes:15,...cfg};
  const reasons=[];
  if(!v.liveVerified) fail(reasons,'LIVE_SOURCE_NOT_VERIFIED');
  if(!v.sourceVisible) fail(reasons,'SOURCE_NOT_VISIBLE');
  if(!Number.isFinite(v.freshnessMinutes)||v.freshnessMinutes>c.maxFreshnessMinutes) fail(reasons,'DATA_STALE_OR_UNKNOWN');
  if((v.eligibleFlights??0)<c.minEligibleFlights) fail(reasons,'CURRENT_SAMPLE_TOO_SMALL');
  if((v.baselineSampleSize??0)<c.minBaselineSample) fail(reasons,'BASELINE_SAMPLE_TOO_SMALL');
  if(((v.departureRows??0)+(v.arrivalRows??0))<c.minFlightRows) fail(reasons,'TOO_FEW_FLIGHT_ROWS');
  if(!v.hasUniqueComparison) fail(reasons,'NO_UNIQUE_COMPARISON_VALUE');
  return {indexable:reasons.length===0,reasons};
}
export function flightHubIndexGate(v,cfg={}){
  const c={minHistoryInstances:7,maxFreshnessMinutes:15,...cfg};const reasons=[];
  if(!v.liveVerified) fail(reasons,'LIVE_SOURCE_NOT_VERIFIED');
  if(!v.validRoute) fail(reasons,'INVALID_OR_UNKNOWN_ROUTE');
  if(!v.sourceVisible) fail(reasons,'SOURCE_NOT_VISIBLE');
  if((v.historyInstances??0)<c.minHistoryInstances) fail(reasons,'HISTORY_SAMPLE_TOO_SMALL');
  if(!v.hasCurrentOrScheduleData) fail(reasons,'NO_CURRENT_OR_SCHEDULE_DATA');
  if(v.hasCurrentData&&(!Number.isFinite(v.freshnessMinutes)||v.freshnessMinutes>c.maxFreshnessMinutes)) fail(reasons,'CURRENT_DATA_STALE');
  return {indexable:reasons.length===0,reasons};
}
export function routeIndexGate(v,cfg={}){
  const c={minObservedDays:14,minEligibleFlights:30,...cfg};const reasons=[];
  if(!v.liveVerified) fail(reasons,'LIVE_SOURCE_NOT_VERIFIED');
  if(!v.validRoute) fail(reasons,'INVALID_ROUTE');
  if((v.observedDays??0)<c.minObservedDays) fail(reasons,'TOO_FEW_OBSERVED_DAYS');
  if((v.eligibleFlights??0)<c.minEligibleFlights) fail(reasons,'TOO_FEW_FLIGHTS');
  if(!v.sourceVisible) fail(reasons,'SOURCE_NOT_VISIBLE');
  return {indexable:reasons.length===0,reasons};
}
export function adEligibility({indexable,trustPagesComplete,noPreviewMarkers,emptyModules=0}){
  const reasons=[];if(!indexable)fail(reasons,'NOT_INDEXABLE');if(!trustPagesComplete)fail(reasons,'TRUST_PAGES_INCOMPLETE');if(!noPreviewMarkers)fail(reasons,'PREVIEW_OR_MOCK_MARKERS_PRESENT');if(emptyModules>0)fail(reasons,'EMPTY_MODULES_PRESENT');return{adEligible:reasons.length===0,reasons};
}
