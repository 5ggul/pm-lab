import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='20.2.0';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const exists=r=>fs.existsSync(path.join(ROOT,r));
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const fmt=v=>num(v)!==null?num(v).toLocaleString('ko-KR',{maximumFractionDigits:0}):'-';
const unitNorm=u=>{
  const raw=String(u??'').trim();
  return ['㎡','m2','M2','m²','M²','m^2','M^2'].includes(raw)?'㎡':raw||'단위 미기재';
};

const materials=json('data/g2b-material-stats-v20.json',{});
const market=json('data/g2b-building-market-construction.json',{});
const standard=json('data/g2b-standard-market-unit-building.json',{});
if(materials.source_id!=='PPS-G2B-PRICE-BUILDING-MATERIALS')throw new Error('v20 quote compare material source missing');
if(market.source_id!=='PPS-G2B-MARKET-CONSTRUCTION-BUILDING')throw new Error('v20 quote compare market source missing');
if(standard.source_id!=='PPS-G2B-STANDARD-MARKET-UNIT-BUILDING')throw new Error('v20 quote compare standard source missing');

const refs=[];
for(const [i,g] of (materials.groups||[]).entries()){
  const median=num(g.median_price_krw),low=num(g.p25_price_krw),high=num(g.p75_price_krw);
  if(median===null||median<=0)continue;
  refs.push({
    id:`material-${i}`,
    source:'material',source_label:'시설공통자재',
    label:String(g.label||g.term||'자재'),detail:String(g.term||''),
    unit:String(g.normalized_unit||''),unit_key:unitNorm(g.normalized_unit),
    record_count:Number(g.record_count||0),low_krw:low,median_krw:median,high_krw:high,
    range_label:'P25–P75',date:String(g.latest_notice_at||''),
    scope:'자재 공개가격'
  });
}
for(const [i,g] of (market.groups||[]).entries()){
  const median=num(g.median_price_krw),low=num(g.min_price_krw),high=num(g.max_price_krw);
  if(median===null||median<=0)continue;
  refs.push({
    id:`market-${i}`,
    source:'market',source_label:'건축 시장시공가격',
    label:String(g.product_name||'시장시공가격'),detail:'',
    unit:String(g.unit||''),unit_key:unitNorm(g.unit),
    record_count:Number(g.record_count||0),low_krw:low,median_krw:median,high_krw:high,
    range_label:'최소–최대',date:String(g.latest_notice_at||''),
    scope:'공공 조달 시공가격'
  });
}
for(const [i,g] of (standard.groups||[]).entries()){
  const median=num(g.median_component_sum_krw),low=num(g.min_component_sum_krw),high=num(g.max_component_sum_krw);
  if(median===null||median<=0)continue;
  refs.push({
    id:`standard-${i}`,
    source:'standard',source_label:'건축공사 표준시장단가',
    label:String(g.item_name||'표준시장단가'),detail:String(g.unit_price_type||''),
    unit:String(g.unit||''),unit_key:unitNorm(g.unit),
    record_count:Number(g.record_count||0),low_krw:low,median_krw:median,high_krw:high,
    range_label:'최소–최대',date:String(g.latest_publication_date||''),
    scope:'공공 시설공사 기준'
  });
}

const sourceOrder=['material','market','standard'];
const sourceLabel={material:'시설공통자재',market:'건축 시장시공가격',standard:'건축공사 표준시장단가'};
const unitsMap=new Map();
for(const r of refs){
  if(!unitsMap.has(r.unit_key))unitsMap.set(r.unit_key,{unit_key:r.unit_key,counts:{material:0,market:0,standard:0}});
  unitsMap.get(r.unit_key).counts[r.source]=(unitsMap.get(r.unit_key).counts[r.source]||0)+1;
}
const units=[...unitsMap.values()].map(x=>({...x,source_count:sourceOrder.filter(s=>x.counts[s]>0).length,total_count:sourceOrder.reduce((n,s)=>n+x.counts[s],0)})).sort((a,b)=>(b.source_count-a.source_count)||(a.unit_key==='㎡'?-1:b.unit_key==='㎡'?1:0)||(b.total_count-a.total_count)||a.unit_key.localeCompare(b.unit_key,'ko'));
const reviewed=json('data/v5-report.json',{}).reviewed_on||String(materials.reviewed_on||'');
const payload={
  version:VERSION,reviewed_on:reviewed,
  rule:'동일 unit_key 안에서만 사용자가 직접 참고 항목을 선택하며 자동 적정성 판정을 하지 않음',
  unit_aliases:{'㎡':'㎡',m2:'㎡',M2:'㎡','m²':'㎡','M²':'㎡','m^2':'㎡','M^2':'㎡'},
  source_boundaries:{
    material:'시설공통자재 공개가격. 민간 소매가격 또는 시공비가 아님.',
    market:'조달청 건축 시장시공가격. 민간 아파트 인테리어 평균견적이 아님.',
    standard:'건축공사 표준시장단가의 재료비·노무비·경비 합계 분포. 개별 주택 현장 적정가격이 아님.'
  },
  units,references:refs,
  source_counts:Object.fromEntries(sourceOrder.map(s=>[s,refs.filter(r=>r.source===s).length])),
  same_unit_filter_only:true,scope_equivalence_assumed:false,automatic_price_judgment:false,user_input_persisted:false
};
write('data/g2b-quote-compare-v20.json',JSON.stringify(payload,null,2));

let hub=read('data/index.html');
const header=hub.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=hub.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
const cssRef=hub.match(/<link rel="stylesheet" href="[^"]*site-v20-bundle\.css[^"]*">/)?.[0]||'';
const jsRef=hub.match(/<script src="[^"]*app-v20-bundle\.js[^"]*" defer><\/script>/)?.[0]||'';
if(!header||!footer||!cssRef||!jsRef)throw new Error('v20 quote compare requires v20 generated shell');

const defaultUnit=units.some(x=>x.unit_key==='㎡')?'㎡':(units[0]?.unit_key||'');
const unitOptions=units.map(u=>`<option value="${esc(u.unit_key)}"${u.unit_key===defaultUnit?' selected':''}>${esc(u.unit_key)} · 자재 ${u.counts.material} · 시공 ${u.counts.market} · 표준 ${u.counts.standard}</option>`).join('');
const compareCanonical=SITE+'/data/g2b-quote-compare/';
const compareData=JSON.stringify(payload).replace(/</g,'\\u003c');
const schema={'@context':'https://schema.org','@graph':[
  {'@type':'WebApplication',name:'내 견적·공식 참고단가 비교',url:compareCanonical,applicationCategory:'UtilitiesApplication',operatingSystem:'Web',description:'사용자 견적과 조달청 시설공통자재·건축 시장시공가격·건축공사 표준시장단가를 동일 단위 안에서 선택 비교하는 산술 도구.'},
  {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'홈',item:SITE+'/'},{'@type':'ListItem',position:2,name:'데이터',item:SITE+'/data/'},{'@type':'ListItem',position:3,name:'공식 참고단가 비교',item:compareCanonical}]}
]};
const sourceBoundary=`<div class="v20-official-note"><p><strong>비교 경계</strong></p><p>시설공통자재, 건축 시장시공가격, 표준시장단가는 서로 다른 가격 개념입니다. 이 도구는 같은 단위의 후보만 보여주지만 규격·공사범위·VAT·납품/설치 조건이 같다고 가정하지 않습니다.</p><p>사용자가 선택한 항목의 공개 통계와 입력 견적의 산술 차이만 계산하며 비싸다·싸다·적정하다는 판정을 만들지 않습니다.</p></div>`;
const body=`<section class="v62-data-hero"><div class="site-shell"><p class="kicker">UNIT-MATCHED REFERENCE</p><h1>내 견적 · 공식 참고단가 비교</h1><p>같은 단위 후보만 선택해 단가와 수량 합계를 나란히 봅니다.</p></div></section><section class="v6-section"><div class="site-shell"><div class="v20-quote-compare" data-v20-quote-compare data-v20-compare-judgment="none"><div class="v20-compare-inputs"><div class="v20-compare-field"><label for="v20-compare-unit">비교 단위</label><select id="v20-compare-unit" data-v20-compare-unit>${unitOptions}</select></div><div class="v20-compare-field"><label for="v20-user-price">내 견적 단가</label><div class="v20-input-suffix"><input id="v20-user-price" data-v20-user-price type="number" min="0" step="1" inputmode="numeric" placeholder="예: 50000"><span>원 / <b data-v20-selected-unit>${esc(defaultUnit||'-')}</b></span></div></div><div class="v20-compare-field"><label for="v20-compare-qty">수량</label><input id="v20-compare-qty" data-v20-compare-qty type="number" min="0" step="0.01" inputmode="decimal" value="1"></div><div class="v20-compare-divider"></div><div class="v20-compare-field"><label for="v20-ref-material">시설공통자재</label><select id="v20-ref-material" data-v20-ref-material><option value="">선택 안 함</option></select></div><div class="v20-compare-field"><label for="v20-ref-market">건축 시장시공가격</label><select id="v20-ref-market" data-v20-ref-market><option value="">선택 안 함</option></select></div><div class="v20-compare-field"><label for="v20-ref-standard">건축공사 표준시장단가</label><select id="v20-ref-standard" data-v20-ref-standard><option value="">선택 안 함</option></select></div><script type="application/json" data-v20-compare-data>${compareData}</script></div><div class="v20-compare-results"><div class="v20-compare-status" data-v20-compare-note>단위를 선택하고 내 견적 단가를 입력한 뒤 비교할 공식 항목을 직접 고릅니다.</div><div class="v20-compare-bars" data-v20-compare-bars></div><div class="table-wrap"><table class="v20-record-table v20-compare-table"><thead><tr><th>기준</th><th>선택 항목</th><th>단위</th><th>단가 / 중앙</th><th>공개 범위</th><th>수량 합계</th><th>내 견적과 산술 차이</th></tr></thead><tbody data-v20-compare-output><tr><td colspan="7">비교 항목을 선택하세요.</td></tr></tbody></table></div></div></div>${sourceBoundary}<div class="v20-compare-rules"><div><strong>시설공통자재</strong><span>P25 · 중앙값 · P75</span></div><div><strong>시장시공가격</strong><span>최소 · 중앙값 · 최대</span></div><div><strong>표준시장단가</strong><span>재료비+노무비+경비 공개합계의 최소 · 중앙값 · 최대</span></div></div><p class="v6-index-note"><a href="${BASE}/data/g2b-materials/">자재 데이터</a> · <a href="${BASE}/data/g2b-market-construction/">시장시공가격</a> · <a href="${BASE}/data/g2b-standard-market-unit/">표준시장단가</a> · <a href="${BASE}/data/g2b-quote-compare-v20.json">비교 데이터 JSON</a></p></div></section>`;
const page=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>내 견적·공식 참고단가 비교 | 견적검수실</title><meta name="description" content="내 견적과 조달청 시설공통자재·건축 시장시공가격·표준시장단가를 동일 단위 안에서 사용자가 직접 선택해 산술 비교합니다."><link rel="canonical" href="${compareCanonical}">${cssRef}<script type="application/ld+json">${JSON.stringify(schema)}</script></head><body class="v20-page v20-compare-page" data-v19-role="tool" data-v19-path="data/g2b-quote-compare/index.html"><a class="v18-skip" href="#main-content">본문 바로가기</a>${header}<main id="main-content">${body}</main>${footer}${jsRef}</body></html>`;
const comparePath='data/g2b-quote-compare/index.html';
write(comparePath,page);

const linkBlock=`<section class="v20-integration v20-compare-entry" data-v20-official-compare-link><div class="site-shell"><div class="v20-integration__head"><div><p class="kicker">UNIT-MATCHED</p><h2>내 견적 · 공식 참고단가</h2></div><p>동일 단위 후보만 선택 · 자동 적정성 판정 없음</p></div><div class="v20-integration__links"><a href="${BASE}/data/g2b-quote-compare/">공식 참고단가 비교</a></div></div></section>`;
const integrated=[];
for(const p of ['calculator/index.html','data/g2b-materials/calculator/index.html','data/g2b-market-construction/index.html','data/g2b-standard-market-unit/index.html','data/index.html']){
  if(!exists(p))continue;
  let h=read(p);
  if(!h.includes('data-v20-official-compare-link'))h=h.replace('</main>',linkBlock+'</main>');
  write(p,h);integrated.push(p);
}

const readiness=json('data/g2b-readiness-v20.json',{});
readiness.browser_routes=Array.isArray(readiness.browser_routes)?readiness.browser_routes:[];
if(!readiness.browser_routes.includes(comparePath))readiness.browser_routes.push(comparePath);
readiness.quote_compare_same_unit_only=true;
readiness.quote_compare_scope_equivalence_assumed=false;
readiness.quote_compare_automatic_price_judgment=false;
readiness.quote_compare_user_input_persisted=false;
write('data/g2b-readiness-v20.json',JSON.stringify(readiness,null,2));

const audit={version:VERSION,reviewed_on:reviewed,page:comparePath,reference_count:refs.length,unit_count:units.length,source_counts:payload.source_counts,default_unit:defaultUnit,integrated_pages:integrated,same_unit_filter_only:true,scope_equivalence_assumed:false,automatic_price_judgment:false,user_input_persisted:false,preview_noindex:true,production_switch:false};
write('data/g2b-quote-compare-audit-v20.json',JSON.stringify(audit,null,2));

console.log(`Interior v20 quote compare: ${refs.length} refs / ${units.length} units / ${integrated.length} entries`);
