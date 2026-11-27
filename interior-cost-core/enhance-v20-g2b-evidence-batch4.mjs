import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve('docs/interior-cost-preview');
const VERSION='20.8.0';
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const DATASET_URL='https://www.data.go.kr/data/15129415/openapi.do';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const money=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?`${Number(v).toLocaleString('ko-KR',{maximumFractionDigits:0})}원`:'-';
const sha=s=>crypto.createHash('sha1').update(String(s)).digest('hex').slice(0,12);

const payload=json('data/g2b-calculator-reference-v20.json',{});
const refs=Array.isArray(payload.references)?payload.references:[];
if(refs.length<20||payload.same_unit_only!==true||payload.category_keyword_gate!==true||payload.scope_equivalence_assumed!==false||payload.automatic_price_judgment!==false||payload.private_market_average!==false){
  throw new Error('evidence batch requires guarded official-reference payload');
}
const sourceMeta={
  material:{operation:'getPriceInfoListFcltyCmmnMtrilBildng',source_page:`${BASE}/data/g2b-materials/`,source_type:'공공 자재 공개가격'},
  market:{operation:'getPriceInfoListMrktCnstrctPcBildng',source_page:`${BASE}/data/g2b-market-construction/`,source_type:'공공 조달 시공가격'},
  standard:{operation:'getStdMarkUprcinfoList',source_page:`${BASE}/data/g2b-standard-market-unit/`,source_type:'공공 시설공사 기준'}
};
const caveat='민간 아파트 인테리어 시장평균·적정가격이 아니며 규격·공사범위·VAT·납품/설치 조건의 동일성을 가정하지 않음';
const evidence=refs.map(r=>{
  const meta=sourceMeta[r.source];
  if(!meta)throw new Error(`unknown evidence source ${r.source}`);
  return {
    evidence_id:`g2b-${r.source}-${sha(r.id)}`,
    ref_id:r.id,
    row_key:r.row_key,row_label:r.row_label||payload.rows?.[r.row_key]?.label||r.row_key,
    source:r.source,source_label:r.source_label,source_type:meta.source_type,
    dataset_id:'15129415',provider:'조달청',operation:meta.operation,
    official_dataset_url:DATASET_URL,source_page:meta.source_page,
    item_label:r.item_label,detail:r.detail||'',unit_key:r.unit_key,
    median_krw:r.median_krw??null,low_krw:r.low_krw??null,high_krw:r.high_krw??null,range_label:r.range_label||'',
    record_count:Number(r.record_count||0),date:r.date||null,
    material_cost_krw:r.material_cost_krw??null,labor_cost_krw:r.labor_cost_krw??null,expense_krw:r.expense_krw??null,
    match_score:Number(r.match_score||0),matched_keywords:Array.isArray(r.matched_keywords)?r.matched_keywords:[],
    coverage_label:r.coverage_label||'',caveat
  };
});
const ids=new Set(evidence.map(x=>x.evidence_id));
if(ids.size!==evidence.length)throw new Error('duplicate evidence ids');
const forbidden=/serviceKey|invstDeptTelNo|invstOfclNm|cntrctCorpTelNo/i;
if(forbidden.test(JSON.stringify(evidence)))throw new Error('forbidden field leaked into evidence index');
const reviewed=payload.reviewed_on||json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
const sourceCounts=Object.fromEntries(Object.keys(sourceMeta).map(k=>[k,evidence.filter(x=>x.source===k).length]));
const rows=[...new Set(evidence.map(x=>x.row_key))].sort();
const units=[...new Set(evidence.map(x=>x.unit_key))].sort((a,b)=>String(a).localeCompare(String(b),'ko'));
const index={
  version:VERSION,reviewed_on:reviewed,dataset_id:'15129415',provider:'조달청',official_dataset_url:DATASET_URL,
  evidence_count:evidence.length,source_counts:sourceCounts,row_count:rows.length,unit_count:units.length,
  same_unit_only:true,category_keyword_gate:true,scope_equivalence_assumed:false,automatic_price_judgment:false,private_market_average:false,
  user_input_persisted:false,server_transmission:false,production_switch:false,search_console_submission:false,ads_injected:false,
  caveat,evidence
};
write('data/g2b-evidence-index-v20.json',JSON.stringify(index,null,2));

const template=read('data/g2b-quote-compare/index.html');
const header=template.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=template.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
const styles=[...template.matchAll(/<link rel="stylesheet" href="[^"]+">/g)].map(x=>x[0]).join('');
const scripts=[...template.matchAll(/<script src="[^"]+" defer><\/script>/g)].map(x=>x[0]).join('');
const options=(list,label,key=v=>v)=>`<option value="">${label}</option>`+list.map(v=>`<option value="${esc(key(v))}">${esc(typeof v==='string'?v:v.label)}</option>`).join('');
const rowOptions=rows.map(k=>({key:k,label:payload.rows?.[k]?.label||evidence.find(x=>x.row_key===k)?.row_label||k}));
const cards=evidence.map(e=>{
  const components=[['재료',e.material_cost_krw],['노무',e.labor_cost_krw],['경비',e.expense_krw]].filter(([,v])=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))).map(([k,v])=>`${k} ${money(v)}`).join(' · ');
  const search=[e.evidence_id,e.row_label,e.source_label,e.item_label,e.detail,e.unit_key,e.operation,...e.matched_keywords].join(' ').toLowerCase();
  return `<article class="v20-ev-card" id="evidence-${esc(e.evidence_id)}" data-v20-evidence-card data-source="${esc(e.source)}" data-row="${esc(e.row_key)}" data-unit="${esc(e.unit_key)}" data-search="${esc(search)}"><div class="v20-ev-card-head"><span>${esc(e.row_label)} · ${esc(e.source_label)}</span><code>${esc(e.evidence_id)}</code></div><h2>${esc(e.item_label)}</h2><div class="v20-ev-kpis"><div><span>중앙 참고값</span><strong>${money(e.median_krw)} / ${esc(e.unit_key)}</strong></div><div><span>${esc(e.range_label||'범위')}</span><strong>${money(e.low_krw)} – ${money(e.high_krw)}</strong></div><div><span>표본</span><strong>N=${Number(e.record_count).toLocaleString('ko-KR')}</strong></div><div><span>기준일</span><strong>${esc(e.date||'-')}</strong></div></div>${components?`<p class="v20-ev-components">${esc(components)}</p>`:''}<p class="v20-ev-meta">operation <code>${esc(e.operation)}</code>${e.detail?` · ${esc(e.detail)}`:''}</p><p class="v20-ev-caveat">${esc(caveat)}</p><nav><a href="${esc(e.source_page)}">내부 원천 페이지</a><a href="${esc(DATASET_URL)}" target="_blank" rel="noopener noreferrer">공공데이터포털 원천</a></nav></article>`;
}).join('');
const pageStyle=`<style data-v20-evidence-style>
.v20-ev-hero{padding:34px 0 20px;border-bottom:1px solid #d7dde3}.v20-ev-hero h1{margin:4px 0 8px;font-size:clamp(28px,5vw,44px);letter-spacing:-.05em}.v20-ev-hero p{max-width:900px;color:#526070;line-height:1.65}.v20-ev-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#d9dfe5;border:1px solid #d9dfe5;margin:22px 0}.v20-ev-summary div{background:#fff;padding:13px}.v20-ev-summary span{display:block;font-size:11px;color:#66717e;font-weight:800}.v20-ev-summary strong{display:block;font-size:20px;margin-top:4px}.v20-ev-tools{display:grid;grid-template-columns:1.4fr repeat(3,minmax(120px,.7fr)) auto;gap:8px;margin:18px 0;align-items:end}.v20-ev-tools label{display:grid;gap:4px;font-size:11px;font-weight:800;color:#596674}.v20-ev-tools input,.v20-ev-tools select,.v20-ev-tools button{min-width:0;width:100%;border:1px solid #bfc8d1;background:#fff;padding:9px;font:inherit}.v20-ev-tools button{width:auto;white-space:nowrap;font-weight:800;cursor:pointer}.v20-ev-state{font-size:12px;color:#5c6876;padding:10px 0;border-top:1px solid #e1e6ea;border-bottom:1px solid #e1e6ea}.v20-ev-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0 34px}.v20-ev-card{border:1px solid #d4dbe2;background:#fff;padding:16px;min-width:0}.v20-ev-card[hidden]{display:none}.v20-ev-card-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.v20-ev-card-head span{font-size:11px;font-weight:900;color:#506071}.v20-ev-card code{font-size:10px;overflow-wrap:anywhere}.v20-ev-card h2{font-size:17px;margin:9px 0 12px}.v20-ev-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:#e0e5e9;border:1px solid #e0e5e9}.v20-ev-kpis div{background:#fff;padding:9px}.v20-ev-kpis span{display:block;font-size:10px;color:#6a7480}.v20-ev-kpis strong{display:block;margin-top:3px;font-size:13px;overflow-wrap:anywhere}.v20-ev-components,.v20-ev-meta,.v20-ev-caveat{font-size:11px;line-height:1.6;color:#5d6976;margin:9px 0 0}.v20-ev-caveat{color:#354457}.v20-ev-card nav{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px}.v20-ev-card nav a{font-size:11px;font-weight:800;text-decoration:underline;text-underline-offset:3px}
@media(max-width:760px){.v20-ev-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.v20-ev-tools{grid-template-columns:1fr 1fr}.v20-ev-tools label:first-child,.v20-ev-tools button{grid-column:1/-1}.v20-ev-tools input,.v20-ev-tools select{font-size:16px}.v20-ev-grid{grid-template-columns:1fr}.v20-ev-card-head{align-items:flex-start;flex-direction:column}.v20-ev-kpis{grid-template-columns:1fr 1fr}}
</style>`;
const embedded=JSON.stringify(evidence).replace(/</g,'\\u003c');
const pageScript=`<script data-v20-evidence-script>(()=>{'use strict';const root=document.querySelector('[data-v20-evidence-page]');if(!root)return;const q=root.querySelector('[data-v20-evidence-q]'),source=root.querySelector('[data-v20-evidence-source]'),row=root.querySelector('[data-v20-evidence-row]'),unit=root.querySelector('[data-v20-evidence-unit]'),state=root.querySelector('[data-v20-evidence-state]'),cards=[...root.querySelectorAll('[data-v20-evidence-card]')];let data=[];try{data=JSON.parse(root.querySelector('[data-v20-evidence-json]').textContent||'[]')}catch{}const apply=()=>{const needle=String(q.value||'').trim().toLowerCase();let n=0;for(const c of cards){const ok=(!needle||String(c.dataset.search||'').includes(needle))&&(!source.value||c.dataset.source===source.value)&&(!row.value||c.dataset.row===row.value)&&(!unit.value||c.dataset.unit===unit.value);c.hidden=!ok;if(ok)n++}state.textContent='표시 '+n+'개 / 전체 '+cards.length+'개'};for(const el of [q,source,row,unit])el.addEventListener(el===q?'input':'change',apply);root.querySelector('[data-v20-evidence-csv]').addEventListener('click',()=>{const visible=new Set(cards.filter(c=>!c.hidden).map(c=>c.id.replace('evidence-',''))),rows=data.filter(x=>visible.has(x.evidence_id)),head=['evidence_id','row_label','source_label','item_label','unit_key','median_krw','low_krw','high_krw','record_count','date','operation'],quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"',csv='\\ufeff'+[head.join(','),...rows.map(x=>head.map(k=>quote(x[k])).join(','))].join('\\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='g2b-evidence-visible.csv';a.click();URL.revokeObjectURL(a.href)});apply();root.dataset.v20EvidenceReady='1'})();</script>`;
const page=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><meta name="googlebot" content="noindex,nofollow,noarchive,nosnippet"><title>공식 참고값 근거 인덱스 | 견적검수실</title><meta name="description" content="견적 도구에 연결된 조달청 공개가격·시장시공가격·표준시장단가의 품목, 단위, 기준일, N, API operation을 근거 ID별로 확인합니다."><link rel="canonical" href="${SITE}/data/g2b-evidence/">${styles}${pageStyle}<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Dataset',name:'공식 참고값 근거 인덱스',description:'견적검수실의 공공 참고값에 사용되는 조달청 가격정보현황서비스 근거 인덱스',url:`${SITE}/data/g2b-evidence/`,dateModified:reviewed,creator:{'@type':'Organization',name:'조달청'},isBasedOn:DATASET_URL})}</script></head><body class="v20-evidence-ui">${header}<main id="main-content" data-v20-evidence-page><section class="v20-ev-hero"><div class="site-shell"><p class="kicker">EVIDENCE INDEX</p><h1>공식 참고값 근거 인덱스</h1><p>계산기와 견적 도구에 표시되는 공공 참고값을 근거 ID로 추적합니다. 동일 단위와 공종 키워드로 후보를 좁힐 뿐 규격·공사범위가 같다고 자동 확정하지 않습니다.</p><div class="v20-ev-summary"><div><span>근거 레코드</span><strong>${evidence.length}</strong></div><div><span>시설공통자재</span><strong>${sourceCounts.material}</strong></div><div><span>시장시공가격</span><strong>${sourceCounts.market}</strong></div><div><span>표준시장단가</span><strong>${sourceCounts.standard}</strong></div><div><span>단위 종류</span><strong>${units.length}</strong></div></div></div></section><section><div class="site-shell"><div class="v20-ev-tools"><label>검색<input data-v20-evidence-q placeholder="품목 · 근거 ID · operation"></label><label>출처<select data-v20-evidence-source>${options([{key:'material',label:'시설공통자재'},{key:'market',label:'시장시공가격'},{key:'standard',label:'표준시장단가'}],'전체 출처',x=>x.key)}</select></label><label>공종<select data-v20-evidence-row>${options(rowOptions,'전체 공종',x=>x.key)}</select></label><label>단위<select data-v20-evidence-unit>${options(units,'전체 단위')}</select></label><button type="button" data-v20-evidence-csv>현재 결과 CSV</button></div><div class="v20-ev-state" data-v20-evidence-state></div><div class="v20-ev-grid">${cards}</div><script type="application/json" data-v20-evidence-json>${embedded}</script></div></section></main>${footer}${scripts}${pageScript}</body></html>`;
write('data/g2b-evidence/index.html',page);

const stripStyle='<style data-v20-evidence-strip-style>.v20-evidence-strip{margin:20px auto;padding:12px 0;border-top:1px solid #ccd4dc;border-bottom:1px solid #ccd4dc;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap}.v20-evidence-strip strong{font-size:13px}.v20-evidence-strip span{font-size:11px;color:#64707d}.v20-evidence-strip a{font-size:12px;font-weight:800;text-decoration:underline;text-underline-offset:3px}@media(max-width:760px){.v20-evidence-strip{align-items:flex-start;flex-direction:column;gap:5px}}</style>';
const strip=`<div class="site-shell"><section class="v20-evidence-strip" data-v20-evidence-strip><strong>공식 참고값 근거</strong><span>${evidence.length}개 · 조달청 가격정보현황서비스 · 근거 ID/단위/기준일/N 확인</span><a href="${BASE}/data/g2b-evidence/">근거 인덱스 보기</a></section></div>`;
const targetPaths=['calculator/index.html','quote-check/index.html','quote-compare/index.html','quote-paste/index.html','one-set/index.html','checklist/index.html','cost-combination/index.html','data/g2b-quote-compare/index.html','data/g2b-materials/index.html','data/g2b-market-construction/index.html','data/g2b-standard-market-unit/index.html'];
const qbAudit=json('data/g2b-quote-tools-batch-audit-v20.json',{});
for(const slug of qbAudit.cost_slugs||[]){const p=`cost/${slug}/index.html`;try{if(read(p).includes('data-v20-qb-cost'))targetPaths.push(p)}catch{}}
const uniqueTargets=[...new Set(targetPaths)];
let injected=0;
for(const rel of uniqueTargets){
  try{
    let h=read(rel);if(!/noindex,nofollow/.test(h))throw new Error(`${rel} lost preview noindex`);
    if(!h.includes('data-v20-evidence-strip-style'))h=h.replace('</head>',stripStyle+'</head>');
    if(!h.includes('data-v20-evidence-strip'))h=h.replace('</main>',strip+'</main>');
    write(rel,h);injected++;
  }catch(error){throw new Error(`evidence strip failed for ${rel}: ${error.message}`)}
}

try{
  const cat=json('data/dataset-catalog.json',{datasets:[]});cat.datasets=Array.isArray(cat.datasets)?cat.datasets:[];
  if(!cat.datasets.some(x=>x.id==='g2b-evidence-v20'))cat.datasets.push({id:'g2b-evidence-v20',type:'EVIDENCE',name:'공식 참고값 근거 인덱스',status:'preview',scope:`${evidence.length}개 공식 참고값의 근거 ID·원천 operation·단위·N`,period:reviewed,page:`${BASE}/data/g2b-evidence/`,json:`${BASE}/data/g2b-evidence-index-v20.json`,source:'조달청 나라장터 가격정보현황서비스',not_for:'민간 인테리어 시장평균·적정가격 판정'});
  write('data/dataset-catalog.json',JSON.stringify(cat,null,2));
}catch{}
try{
  const search=json('data/search-index.json',[]);if(Array.isArray(search)&&!search.some(x=>x.url===`${BASE}/data/g2b-evidence/`)){search.push({title:'공식 참고값 근거 인덱스',url:`${BASE}/data/g2b-evidence/`,type:'데이터',description:'조달청 공식 참고값의 품목·단위·N·기준일·API operation 추적',keywords:['공식 단가 출처','조달청 인테리어 참고','표준시장단가 근거']});write('data/search-index.json',JSON.stringify(search,null,2))}
}catch{}
try{
  let ll=read('llms.txt');if(!ll.includes('/data/g2b-evidence/'))ll+=`\n## Official reference evidence\n- ${SITE}/data/g2b-evidence/ — ${evidence.length} evidence records with stable IDs, units, dates, N and provider operations. Public references are not private-market averages or automatic price judgments.\n- ${SITE}/data/g2b-evidence-index-v20.json — machine-readable evidence index.\n`;write('llms.txt',ll)
}catch{}

const audit={version:VERSION,reviewed_on:reviewed,evidence_count:evidence.length,unique_evidence_ids:ids.size,source_counts:sourceCounts,row_count:rows.length,unit_count:units.length,strip_target_count:uniqueTargets.length,strip_injected_count:injected,strip_targets:uniqueTargets,dataset_id:'15129415',official_dataset_url:DATASET_URL,operations:Object.fromEntries(Object.entries(sourceMeta).map(([k,v])=>[k,v.operation])),same_unit_only:true,category_keyword_gate:true,scope_equivalence_assumed:false,automatic_price_judgment:false,private_market_average:false,user_input_persisted:false,server_transmission:false,preview_noindex:true,production_switch:false,search_console_submission:false,ads_injected:false};
write('data/g2b-evidence-audit-v20.json',JSON.stringify(audit,null,2));
console.log(`v20 evidence batch4: ${evidence.length} evidence / ${uniqueTargets.length} linked surfaces / ${units.length} units`);
