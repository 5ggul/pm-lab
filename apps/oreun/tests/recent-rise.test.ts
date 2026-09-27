import assert from "node:assert/strict";
import test from "node:test";
import { recentRiseBadge, recentRiseSignal } from "../lib/recent-rise";
import type { HistoryPoint } from "../lib/types";

const point=(hour:number,playing:number):HistoryPoint=>({
  at:new Date(Date.UTC(2026,8,25,hour,0,0)).toISOString(),
  playing,
  coverageRatio:1,
});

test("recent rise prioritizes a trustworthy positive 1H signal",()=>{
  const rows=[point(7,10000),point(8,10200),point(9,11000),point(10,12100)];
  const signal=recentRiseSignal(rows,60);
  assert.ok(signal);
  assert.equal(signal.windowHours,1);
  assert.ok(signal.relativeGrowth>0.09);
  assert.match(recentRiseBadge(signal),/^1H \+\d+\.\d%$/);
});

test("recent rise widens to 6H when the latest hour is not positive",()=>{
  const rows=[
    point(4,8000),point(5,8200),point(6,8400),point(7,9000),
    point(8,9500),point(9,11000),point(10,10500),
  ];
  const signal=recentRiseSignal(rows,60);
  assert.ok(signal);
  assert.equal(signal.windowHours,6);
  assert.ok(signal.absoluteGrowth>0);
});

test("recent rise does not label declining history as rising",()=>{
  const rows=[
    point(4,12000),point(5,11800),point(6,11500),point(7,11200),
    point(8,10800),point(9,10400),point(10,10000),
  ];
  assert.equal(recentRiseSignal(rows,60),null);
});
