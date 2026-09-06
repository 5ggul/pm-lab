import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const site=fs.readFileSync(new URL('../../docs/airport-now-preview/site.js',import.meta.url),'utf8');
const code=site.slice(site.indexOf('async function loadFreshBoard('),site.indexOf('function markLiveApiConnected'));
async function hydrate(pages){
  let rendered=0,requests=[];const counts=Array.from({length:4},()=>({textContent:''}));
  const board={querySelectorAll:()=>[],insertAdjacentHTML:(_,html)=>{rendered=Number(html)},querySelector:()=>null};
  const section={dataset:{},querySelector:s=>s==='.flight-board'?board:null,querySelectorAll:s=>s==='.snapshot .snap'?counts.map(c=>({querySelector:()=>c})):[]};
  const context=vm.createContext({API_BASE:'https://fixture.test',document:{querySelector:s=>s.startsWith('#arrivals')?section:null,querySelectorAll:()=>[]},Date,Set,
    fetchLiveJson:async p=>{requests.push(p);return pages.shift()??null;},renderLiveArrivalRows:items=>String(items.length),formatKstDateTime:x=>x});
  vm.runInContext(code,context);const result=await context.hydrateLiveArrivals();return{result,rendered,requests,counts};
}
const page=(start,count,extra={})=>({date:'2026-09-06',collection:{current:true,lastSuccessAt:'2026-09-06T07:00:00Z'},results:Array.from({length:count},(_,i)=>({flight_instance_id:'id'+(start+i),observed_at:'2026-09-06T06:00:00Z',status:i===0?'DELAYED':'ARRIVED'})),...extra});
test('preview totals include every page and keep a fixed service date',async()=>{
  const r=await hydrate([page(0,200),page(200,53)]);assert.equal(r.result,true);assert.equal(r.rendered,253);assert.equal(r.counts[0].textContent,'253');assert.equal(r.counts[1].textContent,'2');assert.match(r.requests[1],/offset=200&date=2026-09-06/);
});
test('preview preserves snapshot on failed pages, stale collection, duplicate IDs or changing capture',async()=>{
  for(const pages of [[page(0,200),null],[page(0,1,{collection:{current:false}})],[page(0,200),page(0,1)],[page(0,200),page(200,1,{collection:{current:true,lastSuccessAt:'2026-09-06T07:01:00Z'}})]]){
    const r=await hydrate(pages);assert.equal(r.result,false);assert.equal(r.rendered,0);
  }
});


test('preview search never labels an expired or failed collection as live',()=>{
  const context=vm.createContext({Date,STATUS_LABELS:{ARRIVED:'도착'}});
  vm.runInContext(site.slice(site.indexOf('function liveFlightToIndex('),site.indexOf('function formatKstTime(')),context);
  const row={flight_number:'CX426',origin:'HKG',destination:'ICN',status:'ARRIVED',last_collected_at:new Date().toISOString(),collection_readiness:'LIVE_CAPTURED'};
  assert.equal(context.liveFlightToIndex(row).label,'CX426');
  assert.equal(context.liveFlightToIndex({...row,last_collected_at:new Date(Date.now()-31*60000).toISOString()}),null);
  assert.equal(context.liveFlightToIndex({...row,collection_readiness:'ERROR'}),null);
});

test('nationwide loader keeps airport/direction scope and distinguishes empty from unavailable',async()=>{
  const requests=[];const context=vm.createContext({Date,Set,fetchLiveJson:async path=>{requests.push(path);return page(0,0);}});
  vm.runInContext(site.slice(site.indexOf('async function loadFreshBoard('),site.indexOf('async function hydrateLiveArrivals(')),context);
  const data=await context.loadFreshBoard('CJU','DEPARTURE');assert.equal(data.items.length,0);assert.match(requests[0],/airports\/CJU\/flights\?direction=DEPARTURE/);
  context.fetchLiveJson=async()=>page(0,0,{collection:{current:false}});assert.equal(await context.loadFreshBoard('CJU','ARRIVAL'),false);
});
test('airport cards preserve gate and timing details with escaped provider text',()=>{
  const context=vm.createContext({STATUS_LABELS:{DELAYED:'지연',UNKNOWN:'확인 중'},escapeHtml:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),formatKstTime:x=>x||'—'});
  vm.runInContext(site.slice(site.indexOf('function renderAirportCards('),site.indexOf('async function hydrateAirportBoards(')),context);
  const html=context.renderAirportCards([{flight_number:'<script>',origin:'GMP',destination:'CJU',status:'DELAYED',scheduled_departure:'15:00',actual_departure:'15:28',gate:'23',delay_minutes:28}], 'DEPARTURE');
  assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script>/);assert.match(html,/15:28/);assert.match(html,/28분/);assert.match(html,/실제/);assert.match(html,/23/);
});
