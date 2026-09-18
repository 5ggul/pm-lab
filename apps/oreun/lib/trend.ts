import type { Confidence, HistoryPoint, TrendResult } from "./types";
const clamp=(n:number,min=0,max=100)=>Math.min(max,Math.max(min,n));
export const median=(values:number[])=>{if(!values.length)return null;const s=[...values].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
export function computeTrend(universeId:number, points:HistoryPoint[], updatedAt:string|null, now=new Date()):TrendResult{
  const valid=points.filter(p=>p.playing!=null); const expected=Math.max(points.length,1); const coverage=valid.length/expected;
  if(valid.length<8 || coverage<.7){return {universeId,score:null,eligible:false,confidence:"insufficient",calculationVersion:"trend_v1",components:{absolute:0,relative:0,baseline:0,coverage:coverage*100,update:0,interest:null},metrics:{baseline:null,recent:null,coverageRatio:coverage,relativeGrowth:null,absoluteMomentum:null},reason:"데이터 수집 중"};}
  const split=Math.max(1,Math.floor(valid.length*.6)); const baseline=median(valid.slice(0,split).map(p=>p.playing!))!; const recent=median(valid.slice(split).map(p=>p.playing!))!; const absolute=recent-baseline; const rel=absolute/Math.max(baseline,500);
  const absoluteScore=clamp(50+50*Math.tanh(absolute/Math.max(3000,baseline*.18)));
  const clippedRel=Math.max(-.8,Math.min(3,rel)); const relativeScore=clamp((clippedRel+.2)/1.2*100);
  const baselineScore=clamp(Math.log1p(baseline)/Math.log1p(250000)*100);
  const coverageScore=clamp(coverage*100);
  const days=updatedAt?Math.max(0,(now.getTime()-new Date(updatedAt).getTime())/86400000):365; const updateScore=clamp(100*Math.exp(-days/30));
  const weighted=(absoluteScore*.30+relativeScore*.25+baselineScore*.15+coverageScore*.10+updateScore*.10)/.90;
  const confidence:Confidence=coverage>=.9?"high":coverage>=.7?"medium":"low";
  return {universeId,score:Math.round(weighted*10)/10,eligible:true,confidence,calculationVersion:"trend_v1",components:{absolute:absoluteScore,relative:relativeScore,baseline:baselineScore,coverage:coverageScore,update:updateScore,interest:null},metrics:{baseline,recent,coverageRatio:coverage,relativeGrowth:rel,absoluteMomentum:absolute},reason:absolute>0?"최근 플레이 인원 모멘텀이 기준 구간보다 높습니다.":"최근 모멘텀이 기준 구간보다 낮습니다."};
}
