import fs from 'node:fs';
import path from 'node:path';

const apiKey=process.env.KOSIS_API_KEY;
const userStatsId=process.env.KOSIS_USER_STATS_ID;
const out=path.resolve('interior-cost-core/v6-review/data/construction-cost-index.kosis.json');
const discoveryOut=path.resolve('interior-cost-core/v6-review/data/kosis-discovery.json');

if(!apiKey){
  console.error('KOSIS_API_KEY is required. Never expose this key in browser JavaScript.');
  process.exit(2);
}

async function getJson(url){
  const res=await fetch(url,{headers:{'user-agent':'interior-cost-data-pipeline/1.0'}});
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

async function discover(){
  const u=new URL('https://kosis.kr/openapi/statisticsSearch.do');
  u.search=new URLSearchParams({
    method:'getList',apiKey,searchNm:'건설공사비지수',sort:'DATE',startCount:'1',resultCount:'100',format:'json'
  });
  const rows=await getJson(u);
  const candidates=rows.filter(x=>String(x.TBL_NM||'').includes('건설공사비지수'));
  const exact=candidates.find(x=>String(x.TBL_NM||'').includes('2020년기준'))||candidates[0]||null;
  const payload={retrieved_at:new Date().toISOString(),query:'건설공사비지수',selected:exact,candidates};
  fs.writeFileSync(discoveryOut,JSON.stringify(payload,null,2));
  return exact;
}

function normalize(rows){
  const numeric=rows
    .filter(x=>x.PRD_DE&&Number.isFinite(Number(String(x.DT||'').replaceAll(',',''))))
    .map(x=>({
      date:String(x.PRD_DE).replace(/^(\d{4})(\d{2})$/,'$1-$2'),
      index:Number(String(x.DT).replaceAll(',','')),
      item:x.ITM_NM||null,
      category:x.C1_NM||null,
      source_id:`KOSIS:${x.ORG_ID||''}:${x.TBL_ID||''}`,
      modified_at:x.LST_CHN_DE||null
    }))
    .sort((a,b)=>a.date.localeCompare(b.date));
  const byDate=new Map();
  for(const row of numeric){
    const preferred=/총지수|건설공사비|종합/i.test(`${row.item||''} ${row.category||''}`);
    if(!byDate.has(row.date)||preferred) byDate.set(row.date,row);
  }
  return [...byDate.values()].slice(-12);
}

async function fetchRegisteredSeries(){
  if(!userStatsId) return null;
  const u=new URL('https://kosis.kr/openapi/statisticsData.do');
  u.search=new URLSearchParams({
    method:'getList',apiKey,format:'json',jsonVD:'Y',userStatsId,prdSe:'M',newEstPrdCnt:'12',smblChk:'Y'
  });
  return getJson(u);
}

const selected=await discover();
const rows=await fetchRegisteredSeries();
if(!rows){
  console.log('KOSIS table discovery completed. Set KOSIS_USER_STATS_ID after registering the exact table selection; no public series file was overwritten.');
  process.exit(0);
}
const series=normalize(rows);
if(series.length<2) throw new Error('KOSIS series normalization returned fewer than 2 monthly points. Keep the existing reviewed snapshot.');
const latest=series.at(-1),prev=series.at(-2),yearAgo=series.length>=13?series.at(-13):null;
const monthChange=prev?((latest.index/prev.index)-1)*100:null;
const yearChange=yearAgo?((latest.index/yearAgo.index)-1)*100:null;
const payload={
  dataset:selected?.TBL_NM||'건설공사비지수',data_type:'OFFICIAL',provider:'KOSIS / 한국건설기술연구원',
  latest:{...latest,month_change:monthChange==null?null:Number(monthChange.toFixed(2)),year_change:yearChange==null?null:Number(yearChange.toFixed(2))},
  series,source:{org_id:selected?.ORG_ID||null,tbl_id:selected?.TBL_ID||null,link:selected?.LINK_URL||null},
  retrieved_at:new Date().toISOString(),display_rule:'민간 아파트 인테리어 평균가로 사용하지 않음'
};
fs.writeFileSync(out,JSON.stringify(payload,null,2));
console.log(`wrote ${out} with ${series.length} monthly rows`);
