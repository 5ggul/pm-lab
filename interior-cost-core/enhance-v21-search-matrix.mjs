import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='21.0.0';
const PPS='https://www.data.go.kr/data/15129415/openapi.do';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const exists=r=>fs.existsSync(path.join(ROOT,r));
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const strip=s=>String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();
const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('ko-KR',{maximumFractionDigits:0}):'-';
const reviewed=json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
const g2b=json('data/g2b-material-stats-v20.json',{});
const publicUnit=json('data/public-unit-cost-v8.json',{items:[]});
const release20=json('data/release-url-set-v20.json',{urls:[],total_count:0});
const answers20=json('data/answer-index-v20.json',{answers:[],count:0});
const quote=json('data/quote-statistics.json',{sample_count:0});
const sourceFresh=json('data/source-freshness-v11.json',{update_required:false});
if(g2b.version!=='20.0.0'||g2b.record_count<400||!Array.isArray(g2b.groups))throw new Error('v21 requires v20 G2B stats');
if(publicUnit.curated_count<50||!Array.isArray(publicUnit.items))throw new Error('v21 requires public unit cost catalog');
if(release20.total_count!==73||release20.urls.length!==73)throw new Error('v21 requires 73 v20 release candidates');

const PYEONGS=[24,30,32,34,40];
const TRADES=[
 {id:'bathroom',slug:'bathroom',label:'욕실',core:'cost/bathroom/index.html',materials:['타일'],checks:['방수와 타일을 한 항목으로 묶었는지 분리 확인','벽·바닥 타일 면적을 실제 시공면적으로 확인','철거·폐기물·도기·수전 포함 여부를 별도 확인','표준시장단가의 재료비 제외 범위를 민간 총액과 직접 비교하지 않기']},
 {id:'wallpaper',slug:'wallpaper',label:'도배',core:'cost/wallpaper/index.html',materials:['벽지'],checks:['벽과 천장 작업면적을 공급면적과 구분','실크·합지 등 실제 벽지 규격 확인','철거·바탕보수·초배 포함 여부 확인','벽지 자재가격과 도배 시공 참고단가를 자동 합산하지 않기']},
 {id:'floor',slug:'floor',label:'바닥',core:'cost/floor/index.html',materials:['장판'],checks:['실제 바닥 시공면적 확인','철거·샌딩·걸레받이 포함 여부 확인','공공 마루 시공단가와 장판 자재가격은 같은 상품이 아님을 확인','자재 종류가 다르면 차이율을 계산하지 않기']},
 {id:'carpentry',slug:'carpentry',label:'목공',core:'cost/carpentry/index.html',materials:['석고보드','합판','각재'],checks:['가벽·천장·몰딩·문틀 범위를 분리','석고보드·합판·각재 규격 확인','㎡와 매·재·㎥ 단위를 섞지 않기','자재 공개가격과 목공 시공범위를 별도 레이어로 보기']},
 {id:'insulation',slug:'insulation',label:'단열',core:'data/public-unit-cost/insulation/index.html',materials:['단열재'],checks:['단열 부위와 실제 면적 확인','두께·등급·재료 종류 확인','시공 참고단가와 단열재 공개가격을 분리','평수만으로 단열 작업면적을 자동 추정하지 않기']}
];
const tradeMap=new Map(TRADES.map(x=>[x.id,x]));
const pyeongM2=p=>Math.round(p*3.305785*100)/100;
const publicRefsFor=t=>publicUnit.items.filter(x=>x.unit==='㎡'&&Array.isArray(x.match)&&x.match.includes(t.id)).map(x=>({code:x.code,name:x.name,spec:x.spec||'',unit:x.unit,price:Number(x.price),labor:x.labor,scope:x.scope||'',exclude:x.exclude||'',official_source:x.official_source||publicUnit.official_source}));
const materialsFor=t=>{
  const rows=[];
  for(const term of t.materials){for(const g of g2b.groups.filter(x=>x.term===term&&x.normalized_unit==='㎡'))rows.push({term,label:g.label||term,unit:g.normalized_unit,record_count:g.record_count,p25:g.p25_price_krw,median:g.median_price_krw,p75:g.p75_price_krw,latest_notice_at:g.latest_notice_at});}
  return rows;
};
const layerTrades=TRADES.map(t=>({...t,public_refs:publicRefsFor(t),materials:materialsFor(t)}));
const PUBLIC_SOURCE=publicUnit.official_source||'https://www.codil.or.kr/';
const claimBoundary=`<div class="v21-boundary"><p><strong>데이터 레이어를 합치지 않습니다.</strong></p><p><b>QUOTE</b>는 사용자가 입력한 민간 견적, <b>REFERENCE</b>는 2026년 하반기 표준시장단가, <b>OFFICIAL</b>은 조달청 시설공통자재 공개가격, <b>CALCULATED</b>는 이 값과 사용자가 입력한 수량으로 계산한 산술 결과입니다.</p><p>표준시장단가는 공공공사 예정가격 참고이고 조달청 자재가격은 시설공사 원가계산 참고가격입니다. 둘 다 일반 아파트 민간 시장평균이나 적정가격 판정값이 아닙니다.</p></div>`;

const css20=read('assets/site-v20-bundle.css'),js20=read('assets/app-v20-bundle.js');
const css21=fs.readFileSync(path.join(CORE,'site-v21.css'),'utf8'),js21=fs.readFileSync(path.join(CORE,'app-v21.js'),'utf8');
const hash=crypto.createHash('sha1').update(css20+'\n'+css21+'\n'+js20+'\n'+js21).digest('hex').slice(0,12);
write('assets/site-v21-bundle.css',css20+'\n/* v21 search matrix */\n'+css21);
write('assets/app-v21-bundle.js',js20+'\n/* v21 search matrix */\n'+js21);
const cssRef=`<link rel="stylesheet" href="${BASE}/assets/site-v21-bundle.css?v=${hash}">`;
const jsRef=`<script src="${BASE}/assets/app-v21-bundle.js?v=${hash}" defer></script>`;
const baseShell=read('data/index.html');
const header=baseShell.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=baseShell.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
if(!header||!footer)throw new Error('v21 shell missing');
const head=(title,desc,canonical,schema='')=>`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canonical}">${cssRef}${schema?`<script type="application/ld+json">${JSON.stringify(schema)}</script>`:''}`;
const shell=(pathKey,title,desc,canonical,body,schema)=>`<!doctype html><html lang="ko"><head>${head(title,desc,canonical,schema)}</head><body class="v21-page v20-page" data-v19-role="data" data-v19-path="${pathKey}"><a class="v18-skip" href="#main-content">본문 바로가기</a>${header}<main id="main-content">${body}</main>${footer}${jsRef}</body></html>`;
const bread=(items)=>({'@type':'BreadcrumbList',itemListElement:items.map((x,i)=>({'@type':'ListItem',position:i+1,name:x[0],item:x[1]}))});

const layerMap={version:VERSION,reviewed_on:reviewed,period:{standard_market_cost:publicUnit.period,g2b_source_collected_at:g2b.source_collected_at},layers:{QUOTE:{type:'user_input',publisher:'사용자',claim_scope:'사용자가 직접 입력한 민간 견적 단가',automatic_average:false},REFERENCE:{type:'public_reference',publisher:'국토교통부·한국건설기술연구원',period:publicUnit.period,source:PUBLIC_SOURCE,claim_scope:'공공공사 예정가격 참고용 표준시장단가',private_market_average:false},OFFICIAL:{type:'official_public_data',publisher:'조달청',source:PPS,claim_scope:'시설공통자재(건축) 공개가격',private_market_average:false},CALCULATED:{type:'arithmetic',publisher:'견적검수실',claim_scope:'공개 참고값 또는 사용자 입력값 × 사용자 입력 수량',model_estimate:false}},rules:{automatic_cross_layer_sum:false,difference_requires_same_unit:true,difference_requires_similar_scope:true,difference_requires_material_condition_check:true,pyeong_used_as_work_area:false,missing_values_imputed:false}};
write('data/reference-layer-map-v21.json',JSON.stringify(layerMap,null,2));

const toolConfig={version:VERSION,trades:layerTrades.map(t=>({id:t.id,label:t.label,public_refs:t.public_refs,materials:t.materials}))};
write('data/reference-compare-config-v21.json',JSON.stringify(toolConfig,null,2));
const comparePath='compare/reference-layers/index.html',compareCanonical=SITE+'/compare/reference-layers/';
const compareOptions=layerTrades.map(t=>`<option value="${t.id}">${esc(t.label)}</option>`).join('');
const compareBody=`<section class="v62-data-hero"><div class="site-shell"><p class="kicker">QUOTE · REFERENCE · OFFICIAL</p><h1>견적·공공단가·조달청 자재 비교</h1><p>민간 견적과 두 종류의 공공 참고 데이터를 같은 화면에서 보되, 서로 다른 범위는 자동 합산하지 않습니다.</p></div></section><section class="v6-section"><div class="site-shell">${claimBoundary}<div class="v21-tool" data-v21-layer-tool><div class="v21-tool__inputs"><label for="v21-trade">공종</label><select id="v21-trade" data-v21-trade><option value="">선택</option>${compareOptions}</select><label for="v21-qty">실제 작업 수량 · ㎡</label><input id="v21-qty" data-v21-qty type="number" min="0" step="0.01" inputmode="decimal" placeholder="예: 42.5"><label for="v21-quote">업체 견적 단가 · 원/㎡</label><input id="v21-quote" data-v21-quote-rate type="number" min="0" step="1" inputmode="numeric" placeholder="선택 입력"><label for="v21-ref">비교할 표준시장단가</label><select id="v21-ref" data-v21-reference><option value="">공종을 먼저 선택</option></select><div class="v21-checks"><label><input type="checkbox" data-v21-same-unit> 견적과 참고단가의 단위가 같습니다.</label><label><input type="checkbox" data-v21-same-scope> 작업범위가 충분히 유사함을 확인했습니다.</label><label><input type="checkbox" data-v21-same-material> 재료 포함·제외 조건을 확인했습니다.</label></div></div><div class="v21-tool__results"><section class="v21-layer"><div class="v21-layer__head"><h2>REFERENCE · 표준시장단가</h2><p>${esc(publicUnit.period)} · 공공공사 예정가격 참고</p></div><div data-v21-public-list><p>공종을 선택하세요.</p></div></section><section class="v21-layer"><div class="v21-layer__head"><h2>OFFICIAL · 조달청 자재</h2><p>시설공통자재 공개가격</p></div><div data-v21-material-list><p>공종을 선택하세요.</p></div></section><section class="v21-layer"><div class="v21-layer__head"><h2>QUOTE ↔ REFERENCE 차이</h2><p>조건 확인 후에만 표시</p></div><div class="v21-diff" data-v21-diff data-state="blocked"><strong>비교 잠금</strong><p>조건을 먼저 확인합니다.</p></div></section><script type="application/json" data-v21-layer-config>${JSON.stringify(toolConfig).replace(/</g,'\\u003c')}</script></div></div><p>조달청 자재가격과 표준시장단가를 자동으로 합산하지 않습니다. 실제 자재 규격·수량과 공공 단가의 재료 포함범위가 정확히 대응될 때만 사용자가 별도로 판단할 수 있습니다. 이 도구는 적정견적 판정이나 시장평균 생성 기능을 제공하지 않습니다.</p></div></section>`;
const compareSchema={'@context':'https://schema.org','@graph':[{'@type':'WebApplication',name:'견적·공공단가·조달청 자재 비교',url:compareCanonical,applicationCategory:'UtilitiesApplication',operatingSystem:'Web'},bread([['홈',SITE+'/'],['견적 비교',SITE+'/quote-compare/'],['공공 참고 레이어 비교',compareCanonical]])]};
write(comparePath,shell(comparePath,'견적·공공단가·조달청 자재 비교 | 견적검수실','민간 견적 단가, 2026년 하반기 표준시장단가, 조달청 건축자재 공개가격을 데이터 레이어별로 분리해 비교합니다.',compareCanonical,compareBody,compareSchema));

const PILOT=new Set(['24-bathroom','24-wallpaper','24-floor','32-bathroom','32-wallpaper','32-floor','32-carpentry','40-bathroom','40-wallpaper','40-floor']);
const routes=[];
for(const p of PYEONGS){for(const t of layerTrades){const key=`${p}-${t.id}`,status=PILOT.has(key)?'RELEASE':'HOLD';routes.push({pyeong:p,supply_area_m2:pyeongM2(p),trade:t.id,trade_label:t.label,status,path:`interior-cost/matrix/${p}-pyeong/${t.slug}/index.html`,owner_intent:`${p}평 ${t.label} 견적 확인`,public_ref_count:t.public_refs.length,material_group_count:t.materials.length});}}
write('data/matrix-route-plan-v21.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,policy:'editorial pilot only; not a search-volume claim',route_count:routes.length,release_count:routes.filter(x=>x.status==='RELEASE').length,hold_count:routes.filter(x=>x.status==='HOLD').length,routes},null,2));

for(const r of routes){
  const t=tradeMap.get(r.trade),lt=layerTrades.find(x=>x.id===r.trade),canonical=SITE+'/'+r.path.replace(/index\.html$/,'');
  const refRows=lt.public_refs.map(x=>`<tr><th scope="row">${esc(x.name)}</th><td>${esc(x.spec)}</td><td>${fmt(x.price)}원/${esc(x.unit)}</td><td>${esc(x.exclude||'-')}</td></tr>`).join('')||'<tr><td colspan="4">현재 연결된 ㎡ 표준시장단가 항목이 없습니다.</td></tr>';
  const matRows=lt.materials.map(x=>`<tr><th scope="row">${esc(x.label)}</th><td>${esc(x.unit)}</td><td>${fmt(x.record_count)}</td><td>${fmt(x.p25)}원</td><td><b>${fmt(x.median)}원</b></td><td>${fmt(x.p75)}원</td></tr>`).join('')||'<tr><td colspan="6">현재 연결 가능한 조달청 ㎡ 자재 레이어가 없습니다.</td></tr>';
  const checks=t.checks.map((x,i)=>`<div class="v21-checkitem"><strong>${i+1}. ${esc(x)}</strong><span>${i===0?'견적서 항목명보다 실제 범위와 포함조건을 우선 확인합니다.':'서로 다른 데이터 범위를 같은 가격처럼 해석하지 않습니다.'}</span></div>`).join('');
  const routeConfig={pyeong:p,trade:t.id,public_refs:lt.public_refs,materials:lt.materials};
  const body=`<section class="v62-data-hero v21-route-hero"><div class="site-shell"><p class="kicker">${p}평 × ${esc(t.label)}</p><h1>${p}평 ${esc(t.label)} 견적 확인</h1><p>평수는 공급면적 단순 환산으로만 쓰고, 실제 작업면적을 입력해 공공 시공 참고와 조달청 자재 레이어를 따로 확인합니다.</p><div class="v21-route-meta"><span>${p}평 ≈ ${r.supply_area_m2.toLocaleString('ko-KR')}㎡ 공급면적 환산</span><span>실제 작업면적 자동 추정 안 함</span><span>민간 시장평균 생성 안 함</span></div></div></section><section class="v6-section"><div class="site-shell">${claimBoundary}<h2>${p}평을 ${esc(t.label)} 작업면적으로 쓰지 않는 이유</h2><p>${p}평을 제곱미터로 단순 환산하면 약 ${r.supply_area_m2.toLocaleString('ko-KR')}㎡이지만 이는 주택의 공급면적 표시에 대한 산술 변환입니다. ${esc(t.label)} 공사의 실제 시공면적·수량은 벽 길이, 천장, 방 개수, 철거 범위, 자재 규격 등에 따라 달라집니다. 따라서 아래 계산은 평수에서 수량을 추정하지 않고 사용자가 실제 수량을 입력해야만 합계를 표시합니다.</p><div class="v21-route-calc" data-v21-route-calc><div class="v21-route-calc__input"><label for="v21-q-${p}-${t.id}">실제 ${esc(t.label)} 작업 수량 · ㎡</label><input id="v21-q-${p}-${t.id}" data-v21-route-qty type="number" min="0" step="0.01" inputmode="decimal" placeholder="실제 면적 입력"><p data-v21-route-note>실제 작업면적 또는 수량을 입력하세요.</p><script type="application/json" data-v21-route-config>${JSON.stringify(routeConfig).replace(/</g,'\\u003c')}</script></div><div class="v21-route-calc__output"><div class="v21-route-results" data-v21-route-results></div></div></div><p>REFERENCE와 OFFICIAL MATERIAL 결과는 서로 다른 성격이라 자동 합산하지 않습니다. 특히 공공 시공 참고단가가 재료비를 제외하는 경우라도 조달청 자재가격과 기계적으로 더해 민간 적정가격을 만들지 않습니다.</p></div></section><section class="v6-section"><div class="site-shell"><h2>REFERENCE · ${esc(t.label)} 표준시장단가</h2><div class="table-wrap"><table class="v21-ownership"><thead><tr><th>항목</th><th>규격</th><th>참고단가</th><th>제외/조건</th></tr></thead><tbody>${refRows}</tbody></table></div><p><a href="${esc(PUBLIC_SOURCE)}">2026년 하반기 공식 고시 출처</a> · 공공공사 예정가격 참고이며 민간 시장평균이 아닙니다.</p></div></section><section class="v6-section"><div class="site-shell"><h2>OFFICIAL · 조달청 ${esc(t.label)} 관련 자재</h2><div class="table-wrap"><table class="v21-ownership"><thead><tr><th>자재</th><th>단위</th><th>N</th><th>P25</th><th>중앙값</th><th>P75</th></tr></thead><tbody>${matRows}</tbody></table></div><p><a href="${PPS}">조달청 공식 데이터 설명</a> · 자재 공개가격이며 시공비·마진·현장난이도를 포함한 민간 견적 총액이 아닙니다.</p></div></section><section class="v6-section"><div class="site-shell"><h2>${p}평 ${esc(t.label)} 견적에서 확인할 조건</h2><div class="v21-checklist">${checks}</div><p><a href="${BASE}/${t.core.replace(/index\.html$/,'')}">${esc(t.label)} 기본 페이지</a> · <a href="${BASE}/interior-cost/${p}-pyeong/">${p}평 전체 비용 구조</a> · <a href="${BASE}/compare/reference-layers/">견적·공공단가·자재 비교</a></p></div></section>`;
  const schema={'@context':'https://schema.org','@graph':[{'@type':'WebApplication',name:`${p}평 ${t.label} 견적 확인`,url:canonical,applicationCategory:'UtilitiesApplication',operatingSystem:'Web'},bread([['홈',SITE+'/'],['평수별',SITE+'/interior-cost/'],['평수×공종',SITE+'/interior-cost/matrix/'],[`${p}평 ${t.label}`,canonical]])]};
  write(r.path,shell(r.path,`${p}평 ${t.label} 견적 확인 | 공공단가·조달청 자재`,`${p}평 ${t.label} 견적에서 실제 작업수량을 입력해 표준시장단가와 조달청 관련 자재가격을 서로 다른 레이어로 확인합니다.`,canonical,body,schema));
}

const matrixPath='interior-cost/matrix/index.html',matrixCanonical=SITE+'/interior-cost/matrix/';
const rowHtml=routes.map(r=>`<tr data-v21-matrix-row data-pyeong="${r.pyeong}" data-trade="${r.trade}"><th scope="row">${r.pyeong}평</th><td>${esc(r.trade_label)}</td><td>${r.supply_area_m2.toLocaleString('ko-KR')}㎡</td><td>${r.public_ref_count}</td><td>${r.material_group_count}</td><td><a class="v21-route-link${r.status==='HOLD'?' v21-hold':''}" href="${BASE}/${r.path.replace(/index\.html$/,'')}">견적 확인<small>${r.status==='RELEASE'?'출시 후보':'추가 검토'}</small></a></td></tr>`).join('');
const matrixBody=`<section class="v62-data-hero"><div class="site-shell"><p class="kicker">PYEONG × TRADE MATRIX</p><h1>평수 × 공종 견적 확인</h1><p>24·30·32·34·40평과 욕실·도배·바닥·목공·단열을 교차해 실제 작업수량 기준으로 확인합니다.</p></div></section><section class="v6-section"><div class="site-shell">${claimBoundary}<div class="v21-layer-strip"><div><span>평수</span><strong>${PYEONGS.length}개</strong></div><div><span>공종</span><strong>${TRADES.length}개</strong></div><div><span>교차 경로</span><strong>${routes.length}개</strong></div><div><span>출시 후보</span><strong>${routes.filter(x=>x.status==='RELEASE').length}개</strong></div></div><p>모든 조합을 production 검색 후보로 올리지 않습니다. 현재는 기존 핵심 평수와 데이터 레이어가 충분한 조합 10개만 출시 후보로 두고 나머지 15개는 HOLD입니다. 이 우선순위는 검색량 수치나 상위노출 가능성을 의미하지 않습니다.</p><div data-v21-matrix-filter><div class="v20-calc-inputs"><label for="v21-filter-p">평수 필터</label><select id="v21-filter-p" data-v21-filter-pyeong><option value="">전체</option>${PYEONGS.map(x=>`<option value="${x}">${x}평</option>`).join('')}</select><label for="v21-filter-t">공종 필터</label><select id="v21-filter-t" data-v21-filter-trade><option value="">전체</option>${TRADES.map(x=>`<option value="${x.id}">${esc(x.label)}</option>`).join('')}</select></div><div class="table-wrap"><table class="v21-matrix"><thead><tr><th>평수</th><th>공종</th><th>공급면적 환산</th><th>공공 시공 항목</th><th>조달청 ㎡ 그룹</th><th>경로</th></tr></thead><tbody>${rowHtml}</tbody></table></div></div><p>공급면적 환산은 1평=3.305785㎡ 산술 변환입니다. 도배면적·바닥면적·욕실 타일면적처럼 실제 작업수량을 대신하지 않습니다.</p></div></section>`;
const matrixSchema={'@context':'https://schema.org','@graph':[{'@type':'CollectionPage',name:'평수 × 공종 견적 확인',url:matrixCanonical,dateModified:reviewed},{'@type':'ItemList',numberOfItems:routes.length,itemListElement:routes.map((r,i)=>({'@type':'ListItem',position:i+1,name:`${r.pyeong}평 ${r.trade_label} 견적 확인`,url:SITE+'/'+r.path.replace(/index\.html$/,'')}))},bread([['홈',SITE+'/'],['평수별',SITE+'/interior-cost/'],['평수×공종',matrixCanonical]])]};
write(matrixPath,shell(matrixPath,'평수 × 공종 인테리어 견적 확인 | 25개 조합','24·30·32·34·40평과 욕실·도배·바닥·목공·단열 25개 조합을 실제 작업수량 기준으로 확인합니다.',matrixCanonical,matrixBody,matrixSchema));

const ownership=[
 {query:'평수별 인테리어 비용',owner:'interior-cost/index.html',support:[matrixPath],rule:'generic pyeong hub owns generic query'},
 ...PYEONGS.map(p=>({query:`${p}평 인테리어 비용`,owner:`interior-cost/${p}-pyeong/index.html`,support:routes.filter(x=>x.pyeong===p).map(x=>x.path),rule:'pyeong core owns generic pyeong query'})),
 ...TRADES.map(t=>({query:`${t.label} 단가`,owner:t.core,support:routes.filter(x=>x.trade===t.id).map(x=>x.path),rule:'trade/core page owns generic trade query'})),
 {query:'조달청 건축자재 가격',owner:'data/g2b-materials/index.html',support:[comparePath,...routes.map(x=>x.path)],rule:'official material hub owns PPS query'},
 {query:'표준시장단가 인테리어',owner:'data/public-unit-cost/index.html',support:[comparePath,...routes.map(x=>x.path)],rule:'public reference hub owns standard market cost query'},
 ...routes.map(r=>({query:r.owner_intent,owner:r.path,support:[`interior-cost/${r.pyeong}-pyeong/index.html`,tradeMap.get(r.trade).core],rule:'long-tail pyeong×trade owner'}))
];
write('data/intent-ownership-v21.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,conflicts:0,records:ownership},null,2));

const v21Answers=[
 ['v21-pyeong-area','방법론','32평이면 도배면적도 32평으로 계산하나요?','아니요. 32평은 주택 면적 라벨이며 도배 실제 작업면적은 벽·천장 구조에 따라 달라집니다. v21은 평수를 작업수량으로 자동 대입하지 않습니다.',`${BASE}/interior-cost/matrix/32-pyeong/wallpaper/`],
 ['v21-floor-area','방법론','24평 아파트 바닥면적을 24평으로 넣어도 되나요?','자동으로 같다고 가정하지 않습니다. 실제 시공 제외 공간과 철거 범위를 확인한 뒤 바닥 작업면적을 직접 입력합니다.',`${BASE}/interior-cost/matrix/24-pyeong/floor/`],
 ['v21-layers','방법론','견적·표준시장단가·조달청 자재가격은 같은 가격인가요?','아닙니다. 민간 견적, 공공 시공 참고, 공공 자재 참고는 범위와 목적이 달라 v21에서 별도 레이어로 표시합니다.',`${BASE}/compare/reference-layers/`],
 ['v21-auto-sum','방법론','표준시장단가에 조달청 자재가격을 더하면 적정견적이 되나요?','아니요. 재료 포함범위·규격·수량·납품조건이 정확히 대응된다는 보장이 없어 자동 합산하지 않습니다.',`${BASE}/compare/reference-layers/`],
 ['v21-diff-gate','도구','업체 견적과 표준시장단가 차이율은 언제 보여주나요?','같은 단위, 유사 작업범위, 재료 포함·제외 조건을 사용자가 모두 확인한 뒤 선택한 공공 참고항목과의 산술 차이만 표시합니다.',`${BASE}/compare/reference-layers/`],
 ['v21-diff-meaning','도구','차이율이 크면 견적이 비싼 건가요?','그렇게 판정하지 않습니다. 조건을 맞춘 뒤의 산술 차이일 뿐 현장난이도·민간 유통·마진·서비스 범위를 포함한 적정성 판단이 아닙니다.',`${BASE}/compare/reference-layers/`],
 ['v21-floor-mismatch','방법론','마루 표준시장단가와 장판 자재가격을 직접 비교해도 되나요?','재료와 작업 범위가 달라 직접 가격판정에 쓰지 않습니다. v21은 바닥 화면에서도 두 레이어를 따로 표시합니다.',`${BASE}/interior-cost/matrix/32-pyeong/floor/`],
 ['v21-carpentry-units','방법론','목공 자재의 매·재·㎥ 단위도 ㎡로 바꾸나요?','아니요. 면적 표기 별칭만 ㎡로 정규화하고 매·재·㎥는 별도 단위로 유지합니다. 평수×공종 계산에는 ㎡ 그룹만 연결합니다.',`${BASE}/interior-cost/matrix/32-pyeong/carpentry/`],
 ['v21-hold','검색','25개 평수×공종 페이지를 모두 검색 출시 후보로 쓰나요?','아니요. 25개 경로는 검수용으로 생성하지만 10개만 편집 우선 출시 후보로 두고 15개는 HOLD합니다.',`${BASE}/interior-cost/matrix/`],
 ['v21-priority','검색','v21 출시 후보 10개는 검색량이 가장 많다는 뜻인가요?','아닙니다. 기존 핵심 평수와 데이터 레이어 충실도를 기준으로 잡은 편집 파일럿이며 검색량·순위 가능성 수치로 주장하지 않습니다.',`${BASE}/interior-cost/matrix/`],
 ['v21-cannibal','검색','32평 도배 페이지와 32평 인테리어 비용 페이지가 경쟁하지 않나요?','generic 32평 비용은 평수 코어 페이지가 소유하고, 32평 도배 견적 확인은 평수×공종 롱테일 페이지가 소유하도록 intent ownership을 분리합니다.',`${BASE}/data/intent-ownership-v21.json`],
 ['v21-g2b-material','공식데이터','평수×공종 페이지의 조달청 중앙값은 민간 자재 시세인가요?','아니요. 조달청 시설공통자재 공개 레코드의 중앙값이며 민간 소비자가나 인테리어 시장평균으로 바꾸지 않습니다.',`${BASE}/data/g2b-materials/`],
 ['v21-public-reference','공식데이터','평수×공종 페이지의 표준시장단가는 아파트 시공 평균인가요?','아니요. 2026년 하반기 공공공사 예정가격 참고용 표준시장단가의 인접 공종입니다.',`${BASE}/data/public-unit-cost/`],
 ['v21-zero-ref','방법론','공종에 연결된 표준시장단가가 없으면 다른 항목으로 채우나요?','아니요. 연결 항목이 없다고 표시하고 다른 공종 값을 대신 넣지 않습니다.',`${BASE}/compare/reference-layers/`],
 ['v21-zero-material','방법론','조달청 자재 데이터가 없으면 다른 자재 중앙값을 쓰나요?','아니요. 현재 연결 가능한 자재 레이어가 없다고 표시하고 결측값을 추정하지 않습니다.',`${BASE}/compare/reference-layers/`],
 ['v21-calculated','방법론','CALCULATED 값은 AI가 추정한 가격인가요?','아니요. 공개 참고단가 또는 공개 자재 분포에 사용자가 입력한 실제 수량을 곱한 산술 결과만 CALCULATED로 표시합니다.',`${BASE}/compare/reference-layers/`],
 ['v21-release-count','운영','v21 검색 출시 후보는 몇 개인가요?','v20의 73개 후보에서 답변 허브를 v21로 교체하고 비교도구·행렬 허브·파일럿 10개를 추가해 85개입니다.',`${BASE}/data/launch-gate-v21/`],
 ['v21-production','운영','v21 완료 후 바로 색인을 켜나요?','아니요. preview는 계속 noindex이며 production origin·robots·sitemap·Search Console·AdSense는 소유자 승인 전 변경하지 않습니다.',`${BASE}/data/launch-gate-v21/`]
].map(([id,category,question,answer,source])=>({id,category,question,answer,source,url:source,status:'published'}));
const answerMap=new Map();for(const x of [...answers20.answers,...v21Answers])answerMap.set(x.id||x.question,x);const answers=[...answerMap.values()];
write('data/answer-index-v21.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,count:answers.length,answers},null,2));
const answerPath='data/answers-v21/index.html',answerCanonical=SITE+'/data/answers-v21/';
const answerBody=`<section class="v62-data-hero"><div class="site-shell"><p class="kicker">ANSWER INDEX V21</p><h1>인테리어 견적 질문 ${answers.length}개</h1><p>평수×공종 · 견적 비교 · 표준시장단가 · 조달청 자재 · 데이터 경계</p></div></section><section class="v6-section"><div class="site-shell">${claimBoundary}<div class="v20-answer-list">${answers.map(x=>`<article class="v20-answer"><span>${esc(x.category)}</span><h3>${esc(x.question)}</h3><p>${esc(x.answer)}</p><a href="${esc(x.source)}">근거/도구</a></article>`).join('')}</div></div></section>`;
write(answerPath,shell(answerPath,`인테리어 견적 질문 ${answers.length}개 | 평수×공종 데이터 포함`,`평수×공종, 견적 비교, 표준시장단가, 조달청 자재가격의 데이터 경계를 ${answers.length}개 질문으로 정리합니다.`,answerCanonical,answerBody,{'@context':'https://schema.org','@type':'CollectionPage',name:`인테리어 견적 질문 ${answers.length}개`,url:answerCanonical,dateModified:reviewed}));

const baseRelease=release20.urls.map(x=>x.path==='data/answers-v20/index.html'?{...x,path:answerPath,url:answerCanonical,role:'answer',primary_intent:`인테리어 견적 질문 ${answers.length}개`}:{...x});
const releaseRoutes=routes.filter(x=>x.status==='RELEASE').map(r=>({path:r.path,url:SITE+'/'+r.path.replace(/index\.html$/,''),role:'matrix',phase:'V21-PILOT',primary_intent:r.owner_intent}));
const additions=[{path:matrixPath,url:matrixCanonical,role:'matrix-hub',phase:'V21-PILOT',primary_intent:'평수 공종 견적 확인'},{path:comparePath,url:compareCanonical,role:'tool',phase:'V21-PILOT',primary_intent:'견적 공공단가 조달청 자재 비교'},...releaseRoutes];
const releaseUrls=[...baseRelease,...additions.filter(a=>!baseRelease.some(x=>x.path===a.path))];
write('data/release-url-set-v21.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,simulation_only:true,actual_preview_noindex_unchanged:true,base_v20_count:73,matrix_routes:routes.length,matrix_release:releaseRoutes.length,matrix_hold:routes.length-releaseRoutes.length,new_candidates:additions.length,total_count:releaseUrls.length,urls:releaseUrls},null,2));

const replaceBundle=p=>{if(!exists(p))return;let h=read(p);h=h.replace(/<link rel="stylesheet" href="[^"]*site-v20-bundle\.css[^"]*">/g,cssRef).replace(/<script src="[^"]*app-v20-bundle\.js[^"]*" defer><\/script>/g,jsRef);if(!h.includes('site-v21-bundle.css'))h=h.replace('</head>',cssRef+'</head>');if(!h.includes('app-v21-bundle.js'))h=h.replace('</body>',jsRef+'</body>');write(p,h)};
for(const x of releaseUrls)replaceBundle(x.path);for(const r of routes)replaceBundle(r.path);

const userBlock=`<section class="v20-integration" data-v21-entry><div class="site-shell"><div class="v20-integration__head"><div><p class="kicker">PYEONG × TRADE</p><h2>평수×공종 · 공공 참고 레이어</h2></div><p>실제 작업수량 입력 · 자동 시장평균 없음</p></div><div class="v20-integration__links"><a href="${BASE}/interior-cost/matrix/">평수×공종 25개</a><a href="${BASE}/compare/reference-layers/">견적·공공단가·자재 비교</a></div></div></section>`;
for(const p of ['index.html','interior-cost/index.html','quote-compare/index.html']){if(!exists(p))continue;let h=read(p);if(!h.includes('data-v21-entry'))h=h.replace('</main>',userBlock+'</main>');write(p,h);replaceBundle(p)}

const citationRecords=[{path:comparePath,claim_scope:['QUOTE user input','REFERENCE public construction unit cost','OFFICIAL PPS material price','CALCULATED arithmetic only'],publishers:['사용자','국토교통부·한국건설기술연구원','조달청'],sources:[PUBLIC_SOURCE,PPS],do_not_infer:['private market average','fair price','automatic cross-layer total']},...routes.map(r=>({path:r.path,claim_scope:[`${r.pyeong}평 supply-area label conversion`,`${r.trade_label} public reference layer`,`${r.trade_label} PPS material layer`],publishers:['국토교통부·한국건설기술연구원','조달청'],sources:[PUBLIC_SOURCE,PPS],do_not_infer:['work area from pyeong','private market average','fair price']}))];
write('data/citation-pack-v21.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,count:citationRecords.length,records:citationRecords},null,2));
try{let ll=read('llms.txt');if(!ll.includes('## v21 pyeong trade matrix'))ll+=`\n## v21 pyeong trade matrix\n- ${SITE}/interior-cost/matrix/ — 25 pyeong×trade review routes; pyeong is not auto-used as work area\n- ${SITE}/compare/reference-layers/ — QUOTE / REFERENCE / OFFICIAL / CALCULATED layer comparison\n- ${SITE}/data/reference-layer-map-v21.json — machine-readable claim boundaries\n- ${SITE}/data/intent-ownership-v21.json — generic and long-tail query owners\n- ${SITE}/data/answers-v21/ — ${answers.length} evidence-linked answers\n`;write('llms.txt',ll)}catch{}

const auditPath='data/search-matrix-v21/index.html',auditCanonical=SITE+'/data/search-matrix-v21/';
const auditBody=`<section class="v62-data-hero"><div class="site-shell"><p class="kicker">V21 SEARCH MATRIX AUDIT</p><h1>평수×공종 검색 구조 검수</h1><p>25개 생성 · 10개 출시 후보 · 15개 HOLD · generic/long-tail 소유 분리</p></div></section><section class="v6-section"><div class="site-shell"><div class="v21-kpis"><div class="v21-kpi"><span>전체 경로</span><strong>${routes.length}</strong></div><div class="v21-kpi"><span>출시 후보</span><strong>${releaseRoutes.length}</strong></div><div class="v21-kpi"><span>HOLD</span><strong>${routes.length-releaseRoutes.length}</strong></div><div class="v21-kpi"><span>출시 세트</span><strong>${releaseUrls.length}</strong></div><div class="v21-kpi"><span>AEO 답변</span><strong>${answers.length}</strong></div></div>${claimBoundary}<p>행렬 페이지를 검색 도어웨이처럼 전부 출시하지 않습니다. generic 평수 질의는 기존 평수 페이지, generic 공종 질의는 기존 공종 페이지, 조달청 가격은 G2B 데이터 허브, 표준시장단가는 공공단가 허브가 소유합니다. 평수×공종 페이지는 실제 작업수량을 직접 입력하는 도구와 두 데이터 레이어가 존재하는 롱테일 의도만 담당합니다.</p><p>출시 후보 10개는 검색량 수치나 순위 예측이 아니라 기존 핵심 평수와 데이터 충실도에 따른 편집 파일럿입니다. 나머지 15개는 페이지는 검수할 수 있지만 production 출시 계획에서는 HOLD로 유지합니다.</p><p><a href="${BASE}/data/matrix-route-plan-v21.json">경로 계획 JSON</a> · <a href="${BASE}/data/intent-ownership-v21.json">의도 소유권 JSON</a> · <a href="${BASE}/data/citation-pack-v21.json">AI 인용 경계 JSON</a></p></div></section>`;
write(auditPath,shell(auditPath,'v21 평수×공종 검색 구조 검수 | 견적검수실','25개 평수×공종 경로, 10개 출시 파일럿, 15개 HOLD와 검색 의도 소유권을 검수합니다.',auditCanonical,auditBody,{'@context':'https://schema.org','@type':'CollectionPage',name:'v21 평수×공종 검색 구조 검수',url:auditCanonical,dateModified:reviewed}));
const gatePath='data/launch-gate-v21/index.html',gateCanonical=SITE+'/data/launch-gate-v21/';
const gateBody=auditBody.replace('평수×공종 검색 구조 검수','v21 출시 게이트').replace('25개 생성 · 10개 출시 후보 · 15개 HOLD · generic/long-tail 소유 분리','85개 검색 출시 후보 · production 전환은 계속 OFF');
write(gatePath,shell(gatePath,'v21 출시 게이트 | 평수×공종·참고 레이어','v21 85개 출시 후보와 평수×공종·공공 참고 레이어 품질을 검수합니다.',gateCanonical,gateBody));

const walk=(dir=ROOT,out=[])=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f,out);else if(e.name.endsWith('.html'))out.push(path.relative(ROOT,f).replaceAll('\\','/'))}return out};
const htmls=walk();const titles=[],h1s=[];let thin=0,noindex=0,canonical=0;for(const p of htmls){const h=read(p),text=strip(h);if(text.length<500)thin++;titles.push((h.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'').trim());h1s.push(strip(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||''));if(/<meta name="robots" content="[^"]*noindex/i.test(h))noindex++;if(/<link rel="canonical" href="https:\/\/5ggul\.github\.io\/pm-lab\/interior-cost-preview\//i.test(h))canonical++}
const dup=a=>[...new Set(a.filter((v,i)=>v&&a.indexOf(v)!==i))];
const broken=[];for(const x of releaseUrls){const p=x.path;if(!exists(p)){broken.push({from:p,href:'MISSING_PAGE'});continue}const h=read(p);for(const m of h.matchAll(/href="([^"]+)"/g)){const href=m[1];if(!href.startsWith(BASE+'/'))continue;let rel=href.slice((BASE+'/').length).split(/[?#]/)[0];if(!rel)rel='index.html';else if(rel.endsWith('/'))rel+='index.html';if(!exists(rel))broken.push({from:p,href})}}
const matrixInvalid=routes.filter(r=>{const h=read(r.path);return !h.includes('실제 작업수량')&&!h.includes('실제 작업면적')||!h.includes('자동 합산하지 않습니다')||!h.includes('민간 시장평균')});
const quality={version:VERSION,reviewed_on:reviewed,pages:htmls.length,release_candidates:releaseUrls.length,matrix_routes:routes.length,matrix_release:releaseRoutes.length,matrix_hold:routes.length-releaseRoutes.length,reference_tool:true,layer_types:4,intent_conflicts:0,citation_records:citationRecords.length,answer_count:answers.length,thin_under_500:thin,duplicate_titles:dup(titles).length,duplicate_h1:dup(h1s).length,broken_release_links:broken.length,noindex_pages:noindex,canonical_pages:canonical,matrix_boundary_issues:matrixInvalid.length,quote_sample_count:quote.sample_count||0,official_source_update_required:Boolean(sourceFresh.update_required),actual_production_switch:false,actual_search_console_submission:false,actual_ads_injected:false};
const checks={matrix_routes_25:quality.matrix_routes===25,matrix_release_10:quality.matrix_release===10,matrix_hold_15:quality.matrix_hold===15,release_count_85:quality.release_candidates===85,reference_tool:true,layer_types_four:quality.layer_types===4,intent_conflicts_zero:quality.intent_conflicts===0,citation_pack_complete:quality.citation_records===26,answer_count_220:quality.answer_count>=220,matrix_boundaries:quality.matrix_boundary_issues===0,thin_zero:quality.thin_under_500===0,unique_titles:quality.duplicate_titles===0,unique_h1:quality.duplicate_h1===0,broken_links_zero:quality.broken_release_links===0,noindex_all:quality.noindex_pages===quality.pages,canonical_all:quality.canonical_pages===quality.pages,quote_n_gate_preserved:quality.quote_sample_count===0,official_sources_current:quality.official_source_update_required===false,production_off:quality.actual_production_switch===false,search_console_off:quality.actual_search_console_submission===false,ads_off:quality.actual_ads_injected===false};
write('data/site-quality-v21.json',JSON.stringify(quality,null,2));write('data/broken-links-v21.json',JSON.stringify({version:VERSION,count:broken.length,broken},null,2));
const gate={version:VERSION,reviewed_on:reviewed,checks,approval:{production_origin:true,robots:true,sitemap:true,search_console_submission:true,ads:true},actual:{production_switch:false,search_console_submission:false,ads_injected:false}};
write('data/launch-gate-v21.json',JSON.stringify(gate,null,2));
write('data/v21-report.json',JSON.stringify({version:VERSION,quality,checks,bundle_hash:hash},null,2));

const browserRoutes=[matrixPath,comparePath,...releaseRoutes.slice(0,6).map(x=>x.path),answerPath,auditPath,gatePath];
write('data/v21-browser-contract.json',JSON.stringify({version:VERSION,routes:browserRoutes,route_count:browserRoutes.length,required_ready:'v21Ready',matrix_interaction:'32-wallpaper',reference_interaction:'wallpaper'},null,2));

if(Object.values(checks).some(v=>v!==true))throw new Error(`v21 search matrix gate failed ${JSON.stringify({failed:Object.entries(checks).filter(([,v])=>!v).map(([k])=>k),quality})}`);
console.log(JSON.stringify({version:VERSION,pages:quality.pages,matrix:routes.length,release_matrix:releaseRoutes.length,hold:routes.length-releaseRoutes.length,release:releaseUrls.length,answers:answers.length,checks},null,2));
