import fs from 'node:fs';
import path from 'node:path';

const API_BASE='https://api.odcloud.kr/api/15151298/v1/uddi:389ed887-3851-49c9-9fbe-be94856a00f6';
const API_KEY=process.env.DATA_GO_KR_SERVICE_KEY||'';
const OUT=path.resolve(process.env.OUT_FILE||'interior-cost-core/v6-review/data/public-unit-prices.json');
const PER_PAGE=1000;
const MAX_PAGES=50;

function n(v){
  if(v===null||v===undefined||v==='')return null;
  const x=Number(String(v).replaceAll(',','').trim());
  return Number.isFinite(x)?x:null;
}
function s(v){return String(v??'').trim()}
function normalize(row){
  return {
    published_date:s(row['최신발표일자']),
    work_code:s(row['세부공종코드']),
    name:s(row['품명']),
    spec:s(row['규격']),
    unit:s(row['단위']),
    material_cost_won:n(row['재료비']),
    labor_cost_won:n(row['노무비']),
    expense_cost_won:n(row['경비']),
    total_cost_won:n(row['합계']),
    application_condition:s(row['적용조건'])
  };
}
function validateRow(r){
  if(!r.name)return false;
  if(!Number.isFinite(r.total_cost_won)||r.total_cost_won<=0)return false;
  for(const k of ['material_cost_won','labor_cost_won','expense_cost_won'])if(r[k]!==null&&r[k]<0)return false;
  return true;
}
function semantic(x){if(!x||typeof x!=='object')return x;const c=structuredClone(x);delete c.generated_at;return c}
function readExisting(){try{return JSON.parse(fs.readFileSync(OUT,'utf8'))}catch{return null}}
async function page(pageNo){
  const u=new URL(API_BASE);
  u.searchParams.set('page',String(pageNo));
  u.searchParams.set('perPage',String(PER_PAGE));
  u.searchParams.set('returnType','JSON');
  u.searchParams.set('serviceKey',API_KEY);
  const res=await fetch(u,{headers:{accept:'application/json'}});
  if(!res.ok)throw new Error(`PPS API HTTP ${res.status}`);
  const json=await res.json();
  if(!Array.isArray(json?.data))throw new Error('PPS API response missing data[]');
  return json;
}

if(!API_KEY)throw new Error('DATA_GO_KR_SERVICE_KEY is required');
const raw=[];
let totalCount=null;
for(let p=1;p<=MAX_PAGES;p++){
  const body=await page(p);
  totalCount=Number(body.totalCount??body.matchCount??totalCount);
  raw.push(...body.data);
  if(!body.data.length||raw.length>=totalCount)break;
}
if(!Number.isFinite(totalCount)||totalCount<1)throw new Error('invalid PPS totalCount');
if(raw.length<totalCount)throw new Error(`incomplete PPS collection ${raw.length}/${totalCount}`);
const rows=raw.map(normalize).filter(validateRow).sort((a,b)=>a.work_code.localeCompare(b.work_code,'ko')||a.name.localeCompare(b.name,'ko')||a.spec.localeCompare(b.spec,'ko'));
if(!rows.length)throw new Error('no valid PPS unit price rows');
const publishedDates=rows.map(r=>r.published_date).filter(Boolean).sort();
let out={
  dataset:'공공 공사비 참고단가',
  data_type:'REFERENCE',
  schema_version:'1.0',
  generated_at:new Date().toISOString(),
  status:'ready',
  source:{
    provider:'조달청',
    name:'공사원가 표준시장단가',
    public_data_id:'15151298',
    api_dataset:'uddi:389ed887-3851-49c9-9fbe-be94856a00f6',
    source_row_count:totalCount,
    collected_row_count:rows.length,
    latest_published_date:publishedDates.at(-1)||null,
    license:'이용허락범위 제한 없음',
    source_url:'https://www.data.go.kr/data/15151298/fileData.do'
  },
  fields:['published_date','work_code','name','spec','unit','material_cost_won','labor_cost_won','expense_cost_won','total_cost_won','application_condition'],
  rows
};
const existing=readExisting();
if(existing&&JSON.stringify(semantic(existing))===JSON.stringify(semantic(out)))out={...out,generated_at:existing.generated_at||out.generated_at};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({ok:true,source_total:totalCount,collected_rows:rows.length,latest_published_date:out.source.latest_published_date,output:OUT,semantic_unchanged:Boolean(existing&&out.generated_at===existing.generated_at)}));
