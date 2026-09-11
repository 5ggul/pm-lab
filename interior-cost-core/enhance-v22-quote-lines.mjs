import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='22.0.0';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const exists=r=>fs.existsSync(path.join(ROOT,r));
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const norm=s=>String(s??'').toLowerCase().replace(/\s+/g,'').replace(/[()\[\]{}.,·/_-]/g,'');

const compare=json('data/g2b-quote-compare-v20.json',{});
const v21=json('data/reference-compare-config-v21.json',{});
const release21=json('data/release-url-set-v21.json',{});
const reviewed=json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
if(compare.version!=='20.2.0'||!Array.isArray(compare.references)||compare.references.length<300)throw new Error('v22 requires v20 official comparison references');
if(v21.version!=='21.0.0'||!Array.isArray(v21.trades)||v21.trades.length<5)throw new Error('v22 requires v21 trade config');
if(release21.total_count!==85)throw new Error('v22 requires unchanged v21 release set');

const KEYWORDS={
  bathroom:['타일','방수','도기','수전','세면','욕조','미장'],
  wallpaper:['벽지','도배','초배','퍼티','바탕만들기'],
  floor:['장판','바닥','마루','후로아','비닐타일','데코타일','카페트'],
  carpentry:['석고보드','합판','각재','목재','목공','가벽','천장틀','문틀','몰딩'],
  insulation:['단열','보온','우레탄폼','스티로폼','압출법','비드법']
};
const PYEONGS=[24,30,32,34,40];
const refs=compare.references.filter(r=>r&&r.id&&['material','market','standard'].includes(r.source)&&r.unit_key&&Number(r.median_krw)>0);
const refById=Object.fromEntries(refs.map(r=>[r.id,r]));
const tradeConfigs=[];
for(const t of v21.trades){
  if(!KEYWORDS[t.id])continue;
  const kws=KEYWORDS[t.id];
  const ids={material:[],market:[],standard:[]};
  for(const r of refs){
    const text=norm(`${r.label} ${r.detail||''}`);
    if(!kws.some(k=>text.includes(norm(k))))continue;
    ids[r.source].push(r.id);
  }
  for(const s of Object.keys(ids))ids[s].sort((a,b)=>{
    const A=refById[a],B=refById[b];
    return String(A.unit_key).localeCompare(String(B.unit_key),'ko')||String(A.label).localeCompare(String(B.label),'ko')||Number(B.record_count||0)-Number(A.record_count||0);
  });
  const units=[...new Set(Object.values(ids).flat().map(id=>refById[id]?.unit_key).filter(Boolean))].sort((a,b)=>a==='㎡'?-1:b==='㎡'?1:a.localeCompare(b,'ko'));
  tradeConfigs.push({id:t.id,label:t.label,keywords:kws,candidate_ids:ids,units,candidate_count:Object.values(ids).reduce((n,x)=>n+x.length,0)});
}
const routes={};
for(const p of PYEONGS)for(const t of tradeConfigs)routes[`${p}:${t.id}`]=`${BASE}/interior-cost/matrix/${p}-pyeong/${t.id}/`;
const payload={
  version:VERSION,reviewed_on:reviewed,pyeongs:PYEONGS,trades:tradeConfigs,references:refById,routes,
  rules:{pyeong_context_only:true,pyeong_to_work_quantity:false,same_unit_candidates_only:true,trade_keyword_filter:true,scope_equivalence_assumed:false,automatic_price_judgment:false,user_input_persisted:false,cross_source_auto_sum:false,max_lines:12,difference_requires_scope_confirmation:true},
  source_labels:{material:'시설공통자재',market:'건축 시장시공가격',standard:'건축공사 표준시장단가'},
  delta_definition:'공식 참고 중앙값×수량 − 내 견적 단가×수량'
};
write('data/v22-quote-lines-config.json',JSON.stringify(payload,null,2));

const css21=read('assets/site-v21-bundle.css'),js21=read('assets/app-v21-bundle.js');
const css22=fs.readFileSync(path.join(CORE,'site-v22.css'),'utf8'),js22=fs.readFileSync(path.join(CORE,'app-v22.js'),'utf8');
const hash=crypto.createHash('sha1').update(css21+'\n'+css22+'\n'+js21+'\n'+js22).digest('hex').slice(0,12);
write('assets/site-v22-bundle.css',css21+'\n/* v22 quote lines */\n'+css22);
write('assets/app-v22-bundle.js',js21+'\n/* v22 quote lines */\n'+js22);
const cssRef=`<link rel="stylesheet" href="${BASE}/assets/site-v22-bundle.css?v=${hash}">`;
const jsRef=`<script src="${BASE}/assets/app-v22-bundle.js?v=${hash}" defer></script>`;
const shellSource=read('data/index.html');
const header=shellSource.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=shellSource.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
if(!header||!footer)throw new Error('v22 shell missing');

const pyeongOptions=PYEONGS.map(p=>`<option value="${p}">${p}평</option>`).join('');
const configText=JSON.stringify(payload).replace(/</g,'\\u003c');
const canonical=SITE+'/compare/quote-lines/';
const schema={'@context':'https://schema.org','@graph':[
  {'@type':'WebApplication',name:'견적서 여러 항목 공식단가 비교',url:canonical,applicationCategory:'UtilitiesApplication',operatingSystem:'Web',description:'여러 견적 항목을 공종과 동일 단위의 조달청 공식 참고 데이터 후보로 좁혀 사용자가 직접 선택 비교하는 산술 도구.'},
  {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'홈',item:SITE+'/'},{'@type':'ListItem',position:2,name:'견적 비교',item:SITE+'/quote-compare/'},{'@type':'ListItem',position:3,name:'여러 항목 공식단가 비교',item:canonical}]}
]};
const boundary=`<div class="v20-official-note v22-boundary"><p><strong>비교 원칙</strong></p><p>평수는 경로와 설명을 좁히는 컨텍스트일 뿐 작업수량으로 자동 변환하지 않습니다. 각 행의 공종과 단위를 기준으로 관련 키워드가 있는 공식 후보만 보여주며, 규격·VAT·재료 포함범위·시공조건이 같다고 가정하지 않습니다.</p><p>공식 참고값은 서로 다른 데이터축이므로 세 축을 한 숫자로 합치지 않습니다. 차액은 사용자가 범위·규격을 확인한 행에서만 표시하며 적정·과다·저가 판정은 하지 않습니다.</p></div>`;
const body=`<section class="v62-data-hero"><div class="site-shell"><p class="kicker">MULTI-LINE QUOTE CHECK</p><h1>견적서 여러 항목 · 공식단가 비교</h1><p>평수는 컨텍스트로만 사용하고, 각 견적 행의 공종·단위·수량·단가를 공식 참고 후보와 따로 맞춥니다.</p></div></section><section class="v6-section"><div class="site-shell">${boundary}<div class="v22-tool" data-v22-tool><div class="v22-toolbar"><div><label for="v22-pyeong">평수 컨텍스트</label><select id="v22-pyeong" data-v22-pyeong><option value="">미선택</option>${pyeongOptions}</select><small>작업면적 자동 추정 없음</small></div><div class="v22-toolbar__actions"><button type="button" data-v22-add-line>항목 추가</button><span data-v22-line-count>0 / 12</span></div></div><div class="v22-lines" data-v22-lines></div><div class="v22-summary" data-v22-summary><h2>견적서 합계</h2><div class="v22-summary-grid"><div><span>내 견적 입력합계</span><strong data-v22-user-sum>0원</strong><small data-v22-user-coverage>0개 행</small></div><div><span>시설공통자재 선택합</span><strong data-v22-material-sum>-</strong><small data-v22-material-coverage>0개 행</small></div><div><span>시장시공가격 선택합</span><strong data-v22-market-sum>-</strong><small data-v22-market-coverage>0개 행</small></div><div><span>표준시장단가 선택합</span><strong data-v22-standard-sum>-</strong><small data-v22-standard-coverage>0개 행</small></div></div><p>공식 3축의 합계는 각각 독립된 산술합입니다. 서로 더하거나 민간 견적 총액의 적정값으로 사용하지 않습니다.</p><div class="v22-context-links" data-v22-context-links></div></div><script type="application/json" data-v22-config>${configText}</script></div><p class="v6-index-note"><a href="${BASE}/data/g2b-quote-compare/">1개 항목 공식 비교</a> · <a href="${BASE}/compare/reference-layers/">공종별 데이터 레이어</a> · <a href="${BASE}/interior-cost/matrix/">평수×공종</a> · <a href="${BASE}/data/v22-quote-lines-config.json">비교 후보 JSON</a></p></div></section>`;
const page=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>견적서 여러 항목 공식단가 비교 | 견적검수실</title><meta name="description" content="여러 인테리어 견적 항목의 공종·단위·수량·단가를 입력하고 같은 단위의 조달청 공식 참고 후보를 직접 선택해 산술 비교합니다."><link rel="canonical" href="${canonical}">${cssRef}<script type="application/ld+json">${JSON.stringify(schema)}</script></head><body class="v22-page v21-page v20-page" data-v19-role="tool" data-v19-path="compare/quote-lines/index.html"><a class="v18-skip" href="#main-content">본문 바로가기</a>${header}<main id="main-content">${body}</main>${footer}${jsRef}</body></html>`;
const pagePath='compare/quote-lines/index.html';
write(pagePath,page);

const entryPages=['quote-compare/index.html','calculator/index.html','compare/reference-layers/index.html','interior-cost/matrix/index.html','data/g2b-quote-compare/index.html','data/index.html'];
const entryAudit=[];
for(const p of entryPages){
  if(!exists(p)){entryAudit.push({path:p,present:false});continue;}
  let h=read(p);
  if(!h.includes('data-v22-quote-lines-entry')){
    const block=`<section class="v20-integration v22-entry" data-v22-quote-lines-entry><div class="site-shell"><div class="v20-integration__head"><div><p class="kicker">MULTI-LINE</p><h2>견적서 여러 항목 공식 비교</h2></div><p>평수 컨텍스트 · 공종/단위 후보 자동 축소</p></div><p>여러 견적 행을 한 화면에서 입력하고 시설공통자재·건축 시장시공가격·건축공사 표준시장단가 후보를 같은 단위 안에서 직접 선택합니다.</p><div class="v20-integration__links"><a href="${BASE}/compare/quote-lines/">여러 항목 비교</a></div></div></section>`;
    h=h.replace('</main>',block+'</main>');write(p,h);
  }
  entryAudit.push({path:p,present:true,linked:read(p).includes('/compare/quote-lines/')});
}

try{
  let ll=read('llms.txt');
  if(!ll.includes('## v22 multi-line quote comparison'))ll+=`\n## v22 multi-line quote comparison\n- ${SITE}/compare/quote-lines/ — multiple user-entered quote lines filtered to trade-keyword + same-unit official reference candidates; no automatic price judgment\n- ${SITE}/data/v22-quote-lines-config.json — candidate map and comparison rules\n`;
  write('llms.txt',ll);
}catch{}

const counts=tradeConfigs.map(t=>({trade:t.id,label:t.label,units:t.units.length,material:t.candidate_ids.material.length,market:t.candidate_ids.market.length,standard:t.candidate_ids.standard.length,total:t.candidate_count}));
const checks={
  five_trades:tradeConfigs.length===5,
  references_300:refs.length>=300,
  all_trades_have_candidates:counts.every(x=>x.total>0),
  all_trades_have_area_unit:tradeConfigs.every(x=>x.units.includes('㎡')),
  same_unit_only:payload.rules.same_unit_candidates_only===true,
  pyeong_context_only:payload.rules.pyeong_context_only===true&&payload.rules.pyeong_to_work_quantity===false,
  scope_not_assumed:payload.rules.scope_equivalence_assumed===false,
  no_auto_judgment:payload.rules.automatic_price_judgment===false,
  no_input_persistence:payload.rules.user_input_persisted===false,
  no_cross_source_sum:payload.rules.cross_source_auto_sum===false,
  release_set_unchanged:release21.total_count===85,
  entry_links:entryAudit.filter(x=>x.present).every(x=>x.linked)
};
const audit={version:VERSION,reviewed_on:reviewed,reference_count:refs.length,trade_counts:counts,entry_pages:entryAudit,checks,preview_noindex:true,production_switch:false,search_console_submission:false,ads_injected:false,bundle_hash:hash};
write('data/v22-quote-lines-audit.json',JSON.stringify(audit,null,2));
write('data/v22-report.json',JSON.stringify({version:VERSION,page:path.posix.join('/',pagePath),references:refs.length,trades:tradeConfigs.length,max_lines:payload.rules.max_lines,release_v21_count:release21.total_count,checks},null,2));
write('data/v22-browser-contract.json',JSON.stringify({version:VERSION,routes:[pagePath],required_ready:'v22Ready',interaction:{pyeong:'32',line1_trade:'wallpaper',line2_trade:'carpentry'},max_lines:12},null,2));
if(Object.values(checks).some(v=>v!==true))throw new Error(`v22 quote lines gate failed ${JSON.stringify({failed:Object.entries(checks).filter(([,v])=>!v).map(([k])=>k),counts})}`);
console.log(JSON.stringify({version:VERSION,references:refs.length,trades:tradeConfigs.length,counts,checks},null,2));
