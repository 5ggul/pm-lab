import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const VERSION='20.3.0';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const jsonFile=(file,fallback={})=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}};
const generatedJson=(r,fallback={})=>{try{return JSON.parse(read(r))}catch{return fallback}};
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const median=values=>{const a=values.map(num).filter(v=>v!==null).sort((a,b)=>a-b);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:Math.round((a[m-1]+a[m])/2)};
const unitNorm=u=>{
  const raw=String(u??'').trim();
  return ['㎡','m2','M2','m²','M²','m^2','M^2'].includes(raw)?'㎡':raw;
};
const isoDate=v=>{
  const s=String(v||'').replace(/[^0-9]/g,'').slice(0,8);
  return /^\d{8}$/.test(s)?`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`:String(v||'').slice(0,10);
};

const ROWS={
  demolition:{label:'철거',keywords:['철거','해체','철거공']},
  waste:{label:'폐기물',keywords:['폐기물','폐기','반출']},
  waterproof:{label:'방수',keywords:['방수','도막방수','시트방수']},
  bathroom:{label:'욕실',keywords:['욕실','화장실','위생','타일']},
  kitchen:{label:'주방',keywords:['주방','싱크','싱크대','주방가구']},
  wallpaper:{label:'도배',keywords:['도배','벽지']},
  flooring:{label:'바닥',keywords:['바닥','마루','장판','타일','바닥재']},
  carpentry:{label:'목공',keywords:['목공','합판','각재','석고보드','목재']},
  electrical:{label:'전기',keywords:['전기','배선','전선','조명','배관배선']},
  window:{label:'샷시',keywords:['샷시','창호','창문','창틀']},
  management:{label:'현장관리비',keywords:['현장관리','관리비','현장관리비']}
};
const keywordScore=(text,keywords)=>{
  const hay=String(text||'').toLowerCase();
  return keywords.reduce((score,k)=>score+(hay.includes(String(k).toLowerCase())?1:0),0);
};

const materials=generatedJson('data/g2b-material-stats-v20.json',{});
const market=jsonFile(path.join(CORE,'data','g2b-building-market-construction.json'),{});
const standard=jsonFile(path.join(CORE,'data','g2b-standard-market-unit-building.json'),{});
if(materials.source_id!=='PPS-G2B-PRICE-BUILDING-MATERIALS')throw new Error('calculator official reference material source missing');
if(market.source_id!=='PPS-G2B-MARKET-CONSTRUCTION-BUILDING')throw new Error('calculator official reference market source missing');
if(standard.source_id!=='PPS-G2B-STANDARD-MARKET-UNIT-BUILDING')throw new Error('calculator official reference standard source missing');
const forbidden=/serviceKey|invstDeptTelNo|invstOfclNm|cntrctCorpTelNo/i;
if(forbidden.test(JSON.stringify(market))||forbidden.test(JSON.stringify(standard)))throw new Error('calculator official reference contains forbidden fields');

const refs=[];
const pushRef=(rowKey,ref,score)=>{
  const unitKey=unitNorm(ref.unit);
  if(!unitKey||num(ref.median_krw)===null||num(ref.median_krw)<=0)return;
  refs.push({...ref,row_key:rowKey,row_label:ROWS[rowKey].label,unit_key:unitKey,match_score:score,coverage_label:'부분 일치 · 단위+공종 키워드 일치 · 규격/공사범위 미확인'});
};

for(const g of materials.groups||[]){
  const text=[g.label,g.term,g.slug].filter(Boolean).join(' ');
  for(const [rowKey,row] of Object.entries(ROWS)){
    const score=keywordScore(text,row.keywords);if(!score)continue;
    pushRef(rowKey,{
      id:`material:${rowKey}:${g.term}:${g.normalized_unit}`,
      source:'material',source_label:'시설공통자재',scope_label:'공공 자재 공개가격',
      item_label:String(g.label||g.term||'자재'),detail:String(g.term||''),unit:String(g.normalized_unit||''),
      record_count:Number(g.record_count||0),median_krw:num(g.median_price_krw),low_krw:num(g.p25_price_krw),high_krw:num(g.p75_price_krw),range_label:'P25–P75',
      date:isoDate(g.latest_notice_at),material_cost_krw:null,labor_cost_krw:null,expense_krw:null
    },score);
  }
}

const marketRecords=Array.isArray(market.records)?market.records:[];
for(const g of market.groups||[]){
  const text=[g.product_name,g.item_name].filter(Boolean).join(' ');
  for(const [rowKey,row] of Object.entries(ROWS)){
    const score=keywordScore(text,row.keywords);if(!score)continue;
    const rows=marketRecords.filter(r=>String(r.product_name||'')===String(g.product_name||'')&&unitNorm(r.unit)===unitNorm(g.unit));
    pushRef(rowKey,{
      id:`market:${rowKey}:${g.product_name}:${g.unit}`,
      source:'market',source_label:'건축 시장시공가격',scope_label:'공공 조달 시공가격',
      item_label:String(g.product_name||'시장시공가격'),detail:'',unit:String(g.unit||''),
      record_count:Number(g.record_count||0),median_krw:num(g.median_price_krw),low_krw:num(g.min_price_krw),high_krw:num(g.max_price_krw),range_label:'최소–최대',
      date:isoDate(g.latest_notice_at),
      material_cost_krw:median(rows.map(r=>r.material_cost_krw)),labor_cost_krw:median(rows.map(r=>r.labor_cost_krw)),expense_krw:median(rows.map(r=>r.expense_krw))
    },score);
  }
}

const standardRecords=Array.isArray(standard.records)?standard.records:[];
for(const g of standard.groups||[]){
  const text=[g.item_name,g.unit_price_type].filter(Boolean).join(' ');
  for(const [rowKey,row] of Object.entries(ROWS)){
    const score=keywordScore(text,row.keywords);if(!score)continue;
    const rows=standardRecords.filter(r=>String(r.item_name||'')===String(g.item_name||'')&&unitNorm(r.unit)===unitNorm(g.unit)&&String(r.unit_price_type||'')===String(g.unit_price_type||''));
    pushRef(rowKey,{
      id:`standard:${rowKey}:${g.item_name}:${g.unit}:${g.unit_price_type}`,
      source:'standard',source_label:'건축공사 표준시장단가',scope_label:'공공 시설공사 기준',
      item_label:String(g.item_name||'표준시장단가'),detail:String(g.unit_price_type||''),unit:String(g.unit||''),
      record_count:Number(g.record_count||0),median_krw:num(g.median_component_sum_krw),low_krw:num(g.min_component_sum_krw),high_krw:num(g.max_component_sum_krw),range_label:'최소–최대',
      date:isoDate(g.latest_publication_date),
      material_cost_krw:median(rows.map(r=>r.material_cost_krw)),labor_cost_krw:median(rows.map(r=>r.labor_cost_krw)),expense_krw:median(rows.map(r=>r.expense_krw))
    },score);
  }
}

const buckets=new Map();
for(const r of refs){
  const key=`${r.row_key}|${r.source}|${r.unit_key}`;
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push(r);
}
const compact=[];
for(const list of buckets.values()){
  list.sort((a,b)=>(b.match_score-a.match_score)||(b.record_count-a.record_count)||String(a.item_label).localeCompare(String(b.item_label),'ko'));
  compact.push(...list.slice(0,3));
}
compact.sort((a,b)=>String(a.row_key).localeCompare(String(b.row_key))||String(a.unit_key).localeCompare(String(b.unit_key),'ko')||String(a.source).localeCompare(String(b.source))||(b.match_score-a.match_score)||(b.record_count-a.record_count));

const rowCoverage=Object.fromEntries(Object.entries(ROWS).map(([key,row])=>[key,{
  label:row.label,
  reference_count:compact.filter(r=>r.row_key===key).length,
  units:[...new Set(compact.filter(r=>r.row_key===key).map(r=>r.unit_key))].sort((a,b)=>a.localeCompare(b,'ko')),
  sources:[...new Set(compact.filter(r=>r.row_key===key).map(r=>r.source))]
}]));
const reviewed=generatedJson('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
const payload={
  version:VERSION,reviewed_on:reviewed,
  rule:'메인 예산 계산기의 공종 키워드와 사용자가 입력한 단위가 함께 맞는 공공 참고값만 표시',
  unit_aliases:{'㎡':'㎡',m2:'㎡',M2:'㎡','m²':'㎡','M²':'㎡','m^2':'㎡','M^2':'㎡'},
  rows:rowCoverage,references:compact,
  source_counts:{material:compact.filter(r=>r.source==='material').length,market:compact.filter(r=>r.source==='market').length,standard:compact.filter(r=>r.source==='standard').length},
  same_unit_only:true,category_keyword_gate:true,scope_equivalence_assumed:false,automatic_price_judgment:false,private_market_average:false,user_input_persisted:false,production_switch:false
};
write('data/g2b-calculator-reference-v20.json',JSON.stringify(payload,null,2));
write('data/g2b-calculator-reference-audit-v20.json',JSON.stringify({
  version:VERSION,reviewed_on:reviewed,reference_count:compact.length,row_count:Object.keys(ROWS).length,
  same_unit_only:true,category_keyword_gate:true,scope_equivalence_assumed:false,automatic_price_judgment:false,private_market_average:false,user_input_persisted:false,preview_noindex:true,production_switch:false,
  note:'공종 키워드+동일 단위 후보만 연결. 규격·공사범위·VAT·납품/설치 조건의 동등성은 가정하지 않음.'
},null,2));

const calcPath='calculator/index.html';
let page=read(calcPath);
if(!page.includes('data-budget-builder'))throw new Error('calculator official reference integration requires budget builder');
if(!/noindex,nofollow/.test(page))throw new Error('calculator official reference integration requires preview noindex');

const embedded=JSON.stringify(payload).replace(/</g,'\\u003c');
const panel=`<section class="v20-calc-public" data-v20-calc-public-compare data-v20-calc-public-judgment="none"><div class="v20-calc-public-head"><div><span class="kicker">PUBLIC REFERENCE</span><h2>내 견적 · 공공 참고값 비교</h2></div><a href="/pm-lab/interior-cost-preview/data/g2b-quote-compare/">공식 항목 직접 선택</a></div><p class="v20-calc-public-note">입력 공종의 키워드와 단위가 함께 맞는 공개자료만 표시합니다. 공공 참고값은 민간 아파트 인테리어 시장평균이 아니며 규격·공사범위·VAT·납품·설치 조건의 동일성을 가정하지 않습니다.</p><div class="v20-calc-public-state" data-v20-calc-public-state>단가를 입력하면 같은 단위의 공공 참고값을 확인합니다.</div><div class="v20-calc-public-results" data-v20-calc-public-results></div><div class="v20-calc-public-foot"><span>시설공통자재 / 건축 시장시공가격 / 건축공사 표준시장단가</span><span>산술 비교만 제공 · 가격 적정성 자동 판정 없음 · 입력값 서버 전송 없음</span></div><script type="application/json" data-v20-calc-public-data>${embedded}</script></section>`;
const style=`<style data-v20-calc-public-style>
.v20-calc-public{margin:28px 0 8px;border-top:2px solid #15233b;border-bottom:1px solid #cbd3dc;padding:22px 0;background:#fff}.v20-calc-public-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:10px}.v20-calc-public-head h2{margin:3px 0 0;font-size:clamp(22px,3vw,30px);letter-spacing:-.04em}.v20-calc-public-head>a{font-weight:800;text-decoration:underline;text-underline-offset:4px}.v20-calc-public-note{max-width:900px;margin:0 0 14px;color:#445064;font-size:14px;line-height:1.65}.v20-calc-public-state{padding:10px 0;border-top:1px solid #e0e5ea;border-bottom:1px solid #e0e5ea;font-size:13px;color:#5f6875}.v20-calc-public-row{padding:18px 0;border-bottom:1px solid #e5e9ed}.v20-calc-public-row:last-child{border-bottom:0}.v20-calc-public-rowhead{display:flex;gap:12px;align-items:baseline;justify-content:space-between;margin-bottom:10px}.v20-calc-public-rowhead strong{font-size:18px}.v20-calc-public-rowhead span{font-size:13px;color:#67717e}.v20-calc-public-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#d8dee5;border:1px solid #d8dee5}.v20-calc-public-card{min-width:0;background:#fff;padding:14px}.v20-calc-public-card>span{display:block;font-size:12px;font-weight:800;color:#5d6673;margin-bottom:5px}.v20-calc-public-card>b{display:block;font-size:20px;line-height:1.25;color:#142238}.v20-calc-public-card small{display:block;margin-top:8px;color:#65707f;line-height:1.5}.v20-calc-public-empty{display:block;margin-top:7px;color:#7b8490;font-size:13px}.v20-calc-public-bars{display:grid;gap:7px;margin-top:12px}.v20-calc-public-bar{display:grid;grid-template-columns:minmax(100px,150px) minmax(90px,1fr) 110px;gap:10px;align-items:center;font-size:12px}.v20-calc-public-track{height:7px;background:#e7ebef;overflow:hidden}.v20-calc-public-track i{display:block;height:100%;background:#1b3a6b}.v20-calc-public-components{margin-top:7px;font-size:11px;color:#596474}.v20-calc-public-foot{display:flex;justify-content:space-between;gap:18px;padding-top:13px;border-top:1px solid #d8dee5;font-size:12px;color:#636e7b}.v20-calc-public[data-v20-calc-public-has-input="false"] .v20-calc-public-results{display:none}
@media(max-width:760px){.v20-calc-public{margin-top:22px}.v20-calc-public-head{align-items:start;flex-direction:column;gap:8px}.v20-calc-public-grid{grid-template-columns:1fr}.v20-calc-public-bar{grid-template-columns:84px 1fr 88px;gap:7px}.v20-calc-public-bar strong{text-align:right}.v20-calc-public-foot{flex-direction:column;gap:5px}.v20-calc-public-card b{font-size:18px}}
</style>`;
const script=`<script data-v20-calc-public-script>(()=>{'use strict';const root=document.querySelector('[data-v20-calc-public-compare]'),builder=document.querySelector('[data-budget-builder]');if(!root||!builder)return;let data={references:[],rows:{}};try{data=JSON.parse(root.querySelector('[data-v20-calc-public-data]')?.textContent||'{}')}catch{}const refs=Array.isArray(data.references)?data.references:[];const results=root.querySelector('[data-v20-calc-public-results]'),state=root.querySelector('[data-v20-calc-public-state]');const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));const money=v=>finite(v)?Number(v).toLocaleString('ko-KR',{maximumFractionDigits:0})+'원':'-';const html=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');const unitNorm=u=>{const raw=String(u??'').trim();return ['㎡','m2','M2','m²','M²','m^2','M^2'].includes(raw)?'㎡':raw};const pick=(rowKey,source,unit)=>refs.filter(r=>r.row_key===rowKey&&r.source===source&&r.unit_key===unit).sort((a,b)=>(b.match_score-a.match_score)||(b.record_count-a.record_count))[0]||null;const componentText=r=>{if(!r)return'';const bits=[['재료',r.material_cost_krw],['노무',r.labor_cost_krw],['경비',r.expense_krw]].filter(([,v])=>finite(v));return bits.length?'공개 구성 중앙값 · '+bits.map(([k,v])=>k+' '+money(v)).join(' · '):''};const refCard=(title,r,qty)=>{if(!r)return '<div class="v20-calc-public-card"><span>'+html(title)+'</span><b>-</b><small class="v20-calc-public-empty">비교 가능한 공공 참고값 없음</small></div>';const total=finite(qty)&&Number(qty)>0?Number(r.median_krw)*Number(qty):null;const comp=componentText(r);return '<div class="v20-calc-public-card" data-v20-calc-public-card data-v20-calc-public-source="'+html(r.source)+'"><span>'+html(title)+'</span><b>'+money(r.median_krw)+' / '+html(r.unit_key)+'</b><small>'+html(r.source_label)+' · '+html(r.item_label)+'<br>'+html(r.date||'게시일 미기재')+' · N='+Number(r.record_count||0).toLocaleString('ko-KR')+' · '+html(r.coverage_label)+(finite(total)?'<br>수량 합계 '+money(total):'')+(comp?'<div class="v20-calc-public-components">'+html(comp)+'</div>':'')+'</small></div>'};const render=()=>{const entered=[];for(const row of builder.querySelectorAll('[data-budget-row]')){const key=row.getAttribute('data-budget-row')||'',included=row.querySelector('[data-included]')?.value!=='no',priceMan=Number(row.querySelector('[data-unit-price]')?.value||0),qtyRaw=row.querySelector('[data-qty]')?.value??'',qty=finite(qtyRaw)?Number(qtyRaw):null,unit=unitNorm(row.querySelector('[data-unit]')?.value||'');if(!included||!Number.isFinite(priceMan)||priceMan<=0)continue;const userPrice=priceMan*10000,market=unit?pick(key,'market',unit):null,material=unit?pick(key,'material',unit):null,procurement=market||material,standard=unit?pick(key,'standard',unit):null;entered.push({key,label:data.rows?.[key]?.label||key,unit,qty,userPrice,procurement,standard})}root.dataset.v20CalcPublicHasInput=entered.length?'true':'false';if(!entered.length){state.textContent='단가를 입력하면 같은 단위의 공공 참고값을 확인합니다.';results.innerHTML='';return}const matched=entered.reduce((n,x)=>n+(x.procurement?1:0)+(x.standard?1:0),0);state.textContent='입력 공종 '+entered.length+'개 · 동일 단위 공공 참고값 '+matched+'개 · 단위가 다르면 비교하지 않습니다.';results.innerHTML=entered.map(x=>{const userTotal=finite(x.qty)&&x.qty>0?x.userPrice*x.qty:null;const barItems=[{name:'내 견적',v:x.userPrice},x.procurement&&{name:'공공 조달',v:x.procurement.median_krw},x.standard&&{name:'공공 공사',v:x.standard.median_krw}].filter(Boolean),max=Math.max(1,...barItems.map(b=>Number(b.v)||0));const bars=barItems.map(b=>'<div class="v20-calc-public-bar"><span>'+html(b.name)+'</span><div class="v20-calc-public-track"><i style="width:'+Math.max(2,Math.round(Number(b.v)/max*100))+'%"></i></div><strong>'+money(b.v)+'</strong></div>').join('');return '<article class="v20-calc-public-row" data-v20-calc-public-row="'+html(x.key)+'"><div class="v20-calc-public-rowhead"><strong>'+html(x.label)+'</strong><span>'+html(x.unit||'단위 미입력')+(finite(x.qty)&&x.qty>0?' · 수량 '+html(x.qty):'')+'</span></div><div class="v20-calc-public-grid"><div class="v20-calc-public-card" data-v20-calc-public-user><span>내 견적 단가</span><b>'+money(x.userPrice)+(x.unit?' / '+html(x.unit):'')+'</b><small>'+(finite(userTotal)?'수량 합계 '+money(userTotal):'수량을 입력하면 합계를 표시합니다.')+'</small></div>'+refCard('공공 조달 참고',x.procurement,x.qty)+refCard('공공 공사 참고',x.standard,x.qty)+'</div><div class="v20-calc-public-bars">'+bars+'</div></article>'}).join('')};builder.addEventListener('input',render);builder.addEventListener('change',render);render()})();</script>`;

if(!page.includes('data-v20-calc-public-compare')){
  const target='<div class="tool-actions">';
  if(!page.includes(target))throw new Error('calculator official reference tool-actions anchor missing');
  page=page.replace(target,panel+target);
}
if(!page.includes('data-v20-calc-public-style'))page=page.replace('</head>',style+'</head>');
if(!page.includes('data-v20-calc-public-script'))page=page.replace('</body>',script+'</body>');
write(calcPath,page);
console.log(`v20 calculator official reference integration: ${compact.length} refs / ${Object.keys(ROWS).length} rows`);
