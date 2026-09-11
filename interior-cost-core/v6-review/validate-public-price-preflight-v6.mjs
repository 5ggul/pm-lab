import fs from 'node:fs';
import path from 'node:path';
import {parseLivePayload,normalizeLiveRow,dedupeLatestRows,buildDataset} from '../collect-pps-g2b-price-info.mjs';
import {buildPreflightReport,probeGateway,classifyCollectionError} from '../preflight-public-prices-v6.mjs';

const errors=[];
const fixture=JSON.parse(fs.readFileSync(path.resolve('interior-cost-core/fixtures/pps-g2b-standard-market.sample.json'),'utf8'));
const parsed=parseLivePayload(fixture);
const normalized=parsed.items.map(normalizeLiveRow);
const rows=dedupeLatestRows(normalized);
const dataset=buildDataset({rows,sourceTotalCount:3,rawRowCount:3,validRowCount:3,minPublishedRows:2,start:'20250101',end:'20260201',generatedAt:'2026-02-02T00:00:00.000Z'});
const range={start:'20250101',end:'20260201',days:396};
const collection={sourceTotalCount:3,rawRowCount:3,validRowCount:3};
const ready=buildPreflightReport(dataset,{minRows:2,maxAgeDays:60,now:new Date('2026-02-02T00:00:00Z'),range,collection});
if(ready.schema_version!=='1.2'||!ready.validator.ok||ready.blocker!==null||ready.summary.readiness!=='ready'||ready.summary.published_rows!==2||ready.summary.latest_published_date!=='2026-01-15')errors.push('ready-report');
if(ready.summary.source_total_count!==3||ready.summary.raw_rows!==3||ready.summary.valid_rows!==3)errors.push('collection-counts');
if(ready.safety.repository_write||ready.safety.git_commit||ready.safety.git_push||ready.safety.production_deploy||ready.safety.api_key_in_output||ready.safety.http_probe_service_key_sent)errors.push('safety-flags');
if(!ready.distribution.publication_dates.length||!ready.distribution.units.length||!ready.distribution.application_prefixes.length)errors.push('distribution');
const blocked=buildPreflightReport(dataset,{minRows:3,maxAgeDays:60,now:new Date('2026-02-02T00:00:00Z'),range,collection});
if(blocked.validator.ok||blocked.summary.readiness!=='blocked'||blocked.blocker?.code!=='publication_readiness_blocked'||!blocked.validator.errors.some(x=>x.startsWith('row-floor:')))errors.push('blocked-floor');
const stale=buildPreflightReport(dataset,{minRows:2,maxAgeDays:1,now:new Date('2026-03-01T00:00:00Z'),range,collection});
if(stale.validator.ok||stale.blocker?.code!=='publication_readiness_blocked'||!stale.validator.errors.some(x=>x.startsWith('stale:')))errors.push('stale-report');
for(const [message,code] of [
  ['PPS G2B API HTTP 403 body="SERVICE_KEY_IS_NOT_REGISTERED_ERROR 등록되지 않은 서비스키"','service_key_not_registered'],
  ['PPS API result 20 SERVICE_ACCESS_DENIED_ERROR','service_access_denied'],
  ['DEADLINE_HAS_EXPIRED_ERROR','service_key_expired'],
  ['BLACKLIST_IP_ACCESS_ERROR','blacklisted_egress_ip'],
  ['LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR','rate_limit']
])if(classifyCollectionError(message).code!==code)errors.push(`blocker-classification:${code}`);
let probeUrl='';const probe=await probeGateway({scheme:'http:',start:'20260101',end:'20260131',fetchImpl:async url=>{probeUrl=String(url);return{ok:false,status:403,headers:{get:n=>n==='content-type'?'text/plain':n==='server'?'probe-gw':''},text:async()=> 'Forbidden without credentials'}}});
if(probe.scheme!=='http:'||probe.status!==403||probe.service_key_sent!==false||probe.server!=='probe-gw'||probeUrl.includes('ServiceKey='))errors.push('credential-free-probe');
const source=fs.readFileSync(path.resolve('interior-cost-core/preflight-public-prices-v6.mjs'),'utf8');
for(const forbidden of ['git commit','git push','interior-cost-core/v6-review/data/public-unit-prices.json'])if(source.includes(forbidden))errors.push(`mutating-source:${forbidden}`);
for(const required of ["mode:'read_only_preflight'",'repository_write:false','production_deploy:false','PREFLIGHT_OUT_DIR','PREFLIGHT_STRICT','minPublishedRows:1','probeGateway','classifyCollectionError','service_key_not_registered','http_probe_service_key_sent:false'])if(!source.includes(required))errors.push(`source-contract:${required}`);
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,synthetic_only:true,source:'15129415',report_schema:'1.2',ready_case:true,blocked_floor_case:true,stale_case:true,classified_external_blockers:true,credential_free_gateway_probe:true,http_probe_service_key_sent:false,repository_write:false,git_commit:false,git_push:false,production_deploy:false,artifact_report:'public-price-preflight.json'},null,2));
