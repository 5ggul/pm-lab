import test from "node:test";
import assert from "node:assert/strict";
import { computeTrend, historyCoverage } from "../lib/trend";
import type { HistoryPoint } from "../lib/types";

function series(start:number,end:number,n=20,stepHours=1):HistoryPoint[]{
  const now=Date.UTC(2026,8,18);
  return Array.from({length:n},(_,i)=>({
    at:new Date(now-(n-1-i)*stepHours*3600000).toISOString(),
    playing:Math.round(start+(end-start)*(i/(n-1))),
  }));
}

test("low-baseline percentage explosion does not dominate a meaningful larger move",()=>{
  const small=computeTrend(1,series(1,20),"2026-09-18T00:00:00Z",new Date("2026-09-18T12:00:00Z"));
  const large=computeTrend(2,series(1000,1500),"2026-09-18T00:00:00Z",new Date("2026-09-18T12:00:00Z"));
  assert.equal(small.eligible,true);
  assert.equal(large.eligible,true);
  assert.ok((large.score??0)>(small.score??0),`${large.score} should beat ${small.score}`);
});

test("explicit null intervals reduce coverage and are not ranked",()=>{
  const points=series(1000,1200,10).map((p,i)=>i<5?{...p,playing:null}:p);
  const r=computeTrend(3,points,"2026-09-18T00:00:00Z");
  assert.equal(r.eligible,false);
  assert.equal(r.confidence,"insufficient");
  assert.equal(r.score,null);
});

test("missing rows are counted as missing expected time slots",()=>{
  const full=series(1000,1400,20);
  const sparse=full.filter((_,i)=>i%2===0);
  const coverage=historyCoverage(sparse,60);
  assert.ok(coverage.ratio<0.6,`coverage was ${coverage.ratio}`);
  const r=computeTrend(4,sparse,"2026-09-18T00:00:00Z",new Date("2026-09-18T12:00:00Z"),60);
  assert.equal(r.eligible,false);
  assert.equal(r.confidence,"insufficient");
});

test("six-hour preview fixture cadence remains eligible when declared explicitly",()=>{
  const points=series(1000,1500,20,6);
  const r=computeTrend(5,points,"2026-09-18T00:00:00Z",new Date("2026-09-18T12:00:00Z"),360);
  assert.equal(r.eligible,true);
  assert.ok((r.metrics.coverageRatio??0)>.99);
  assert.equal(r.calculationVersion,"trend_v1_1");
});
