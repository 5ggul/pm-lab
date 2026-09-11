import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='23.0.0';
const REVIEWED='2026-09-12';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmt=n=>Number(n).toLocaleString('ko-KR');

const plan22=json('data/matrix-route-plan-v22.json',{routes:[]});
const release22=json('data/release-url-set-v22.json',{urls:[]});
const answers22=json('data/answer-index-v22.json',{answers:[]});
const units=json('data/public-unit-cost-v8.json',{items:[]});
if(plan22.version!=='22.0.0'||plan22.routes?.length!==25||plan22.release_count!==20||plan22.hold_count!==5)throw new Error('v23 requires v22 20/5 matrix plan');
if(release22.version!=='22.0.0'||release22.urls?.length!==95)throw new Error('v23 requires v22 release set');
if(answers22.version!=='22.0.0'||answers22.answers?.length!==250)throw new Error('v23 requires v22 answer index');
if(units.version!=='8.0.0'||!Array.isArray(units.items))throw new Error('v23 requires public unit catalog');

const expected=new Map([
 ['OD020.20050',16147],['OD020.20100',17893],['OD020.20200',18922],['OD020.20300',20024],
 ['OD020.30050',8289],['OD020.30100',9138],['OD020.50050',14925],['OD020.50200',17333]
]);
const refs=units.items.filter(x=>expected.has(x.code)&&x.group==='단열'&&x.unit==='㎡').map(x=>({code:x.code,name:x.name,spec:x.spec||'',unit:x.unit,price:Number(x.price),scope:x.scope||'',exclude:x.exclude||'',official_source:x.official_source||units.official_source,reference_source:x.reference_source||x.detail||units.reference_index}));
if(refs.length!==8)throw new Error(`expected 8 insulation references, got ${refs.length}`);
for(const r of refs){if(expected.get(r.code)!==r.price)throw new Error(`insulation price drift ${r.code}: ${r.price}`)}
refs.sort((a,b)=>a.code.localeCompare(b.code));

const editorial={
  24:{
    title:'24평 단열은 공급면적보다 실제 단열 구역을 먼저 자릅니다',
    intro:'24평이라는 주택 면적 전체를 단열 면적으로 넣지 않습니다. 외기에 접한 벽, 천장, 확장부처럼 실제 보강하는 구역만 따로 재고, 같은 면적이라도 접착·격자·타정 공법과 두께가 다르면 서로 다른 참고항목으로 봅니다.',
    checks:['단열하는 벽·천장 구역을 방 이름이나 위치별로 나눠 실제 ㎡를 확인','접착제 붙이기·격자넣기·타정 부착 중 견적서 공법을 확인','t=50·100·200·300mm 등 두께를 같은 조건끼리 비교','시공 참고단가에서 주재료 단열재가 제외되는 항목은 자재가격과 자동 합산하지 않기'],
    qa:[
      ['24평이면 단열 작업면적도 24평보다 작다고 보면 되나요?','그렇게 추정하지 않습니다. 공급면적과 단열 대상 벽·천장 면적은 다른 값이므로 실제 공사 구역을 재야 합니다.'],
      ['24평 단열 견적에서 공법 차이가 왜 중요한가요?','접착, 격자, 타정은 작업 방식과 포함재료가 달라 같은 두께라도 같은 단가로 비교할 수 없습니다.'],
      ['공공 단열 시공단가에 조달청 단열재 가격을 더하면 총액이 되나요?','아닙니다. 규격·수량·납품조건과 재료 포함범위가 정확히 대응하지 않으면 자동 합산하지 않습니다.']
    ]
  },
  30:{
    title:'30평 단열은 벽과 천장을 한 수량으로 묶지 않습니다',
    intro:'단열 표준시장단가는 부위와 공법이 나뉘어 있습니다. 30평이라는 면적 하나로 계산하지 않고, 벽과 천장의 실제 시공면적을 분리한 뒤 견적서의 공법·두께와 일치하는 공공 참고행만 확인합니다.',
    checks:['벽과 천장 작업면적을 별도 수량으로 기록','천장 접착·격자·타정 공법이 혼재하면 공법별 면적을 분리','단열재 두께와 재료 종류를 시공단가의 규격과 혼동하지 않기','철거·바탕보수·마감 복구가 단열 항목에 포함되는지 별도 확인'],
    qa:[
      ['30평 단열은 벽과 천장 면적을 합쳐 한 번에 계산해도 되나요?','공법과 규격이 같다는 확인 없이 합치지 않습니다. 부위별 시공방법이 다르면 각각의 수량으로 봐야 합니다.'],
      ['단열재 두께가 두꺼우면 공공 참고단가도 항상 같은 비율로 오르나요?','아닙니다. 공법별 표준시장단가가 별도 공종으로 고시되므로 해당 규격 행을 직접 확인합니다.'],
      ['단열 공공단가에는 단열재 값이 포함되나요?','현재 연결한 OD0 계열 다수는 주재료 단열재를 제외합니다. 각 행의 단가정의를 먼저 확인해야 합니다.']
    ]
  },
  32:{
    title:'32평 단열은 같은 두께라도 시공법을 맞춰야 비교됩니다',
    intro:'32평 단열 견적을 비교할 때는 면적보다 먼저 공법을 맞춥니다. 예를 들어 천장 t=50mm라도 격자넣기와 접착제 붙이기, 타정 부착은 서로 다른 표준시장단가 공종이며 단가정의의 재료 포함범위도 다릅니다.',
    checks:['같은 두께라도 접착·격자·타정 행을 서로 다른 공종으로 유지','시공 면적은 공급 32평 환산값이 아닌 실제 단열 구역 ㎡ 사용','우레탄폼·핀·접착제 등 부자재 포함·제외를 단가정의에서 확인','업체 견적의 마감복구·석고보드·목공이 단열 시공과 묶였는지 확인'],
    qa:[
      ['32평 천장 단열 t=50mm면 어떤 단가 하나를 쓰면 되나요?','하나로 정할 수 없습니다. 접착제 붙이기, 격자넣기, 타정 부착 중 실제 공법과 맞는 행을 선택해야 합니다.'],
      ['32평을 105.79㎡로 바꾼 값을 단열 수량으로 써도 되나요?','아닙니다. 105.79㎡는 공급면적 단순 환산값이며 실제 벽·천장 단열 면적과 다릅니다.'],
      ['공공단가와 업체 단가 차이가 크면 업체가 비싼 건가요?','바로 판단할 수 없습니다. 공공 예정가격 참고와 민간 견적은 포함 공정·재료·현장조건이 다를 수 있습니다.']
    ]
  },
  34:{
    title:'34평 단열은 시공비와 단열재 가격을 두 레이어로 유지합니다',
    intro:'단열은 공공 시공 참고와 조달청 단열재 가격을 같은 숫자로 보지 않는 것이 중요합니다. 34평 페이지에서도 실제 작업면적을 입력하면 REFERENCE 시공행과 OFFICIAL 자재 분포를 나란히 보여주되 자동 합계는 만들지 않습니다.',
    checks:['REFERENCE는 공법·두께·부위가 맞는 시공행만 선택','OFFICIAL 단열재 분포는 같은 ㎡ 단위여도 제품 규격과 납품조건 확인','시공단가의 주재료 제외 문구와 자재 데이터의 품목 범위를 각각 확인','업체 견적의 철거·목공·마감복구 비용을 별도 공정으로 확인'],
    qa:[
      ['34평 단열 페이지의 두 가격 레이어는 왜 합계가 없나요?','표준시장단가의 재료 제외범위와 조달청 자재의 실제 규격·납품조건이 일대일로 대응한다고 보장할 수 없기 때문입니다.'],
      ['조달청 단열재 중앙값을 민간 자재 시세로 봐도 되나요?','아닙니다. 조달청 시설공사 원가계산 참고용 공개가격의 동일 단위 분포이며 일반 소비자 시장가격을 뜻하지 않습니다.'],
      ['34평이라는 정보는 단열 계산에서 어디에 쓰나요?','주택 크기를 구분하는 검색·문맥 정보로만 쓰고 실제 단열 수량은 사용자가 입력한 작업면적을 사용합니다.']
    ]
  },
  40:{
    title:'40평 단열은 여러 공사 구역을 공법·두께별로 나눠 합칩니다',
    intro:'공사 구역이 여러 곳이라도 40평 전체를 하나의 단열 수량으로 두지 않습니다. 실제 단열 구역을 나누고 각 구역의 부위·공법·두께가 같을 때만 같은 참고행을 적용해 산술 결과를 확인합니다.',
    checks:['여러 벽·천장 구역을 공법과 두께가 같은 묶음끼리 합산','서로 다른 공법을 평균 단가 하나로 섞지 않기','단열재 주재료와 시공 참고를 자동 합산하지 않기','공사 구역별 철거·바탕·마감 복구 범위를 견적서에서 분리'],
    qa:[
      ['40평이면 단열 공사 구역도 많다고 가정해도 되나요?','가정하지 않습니다. 실제 단열 보강 구역은 현장 조건과 공사 범위에 따라 달라지므로 위치별로 확인합니다.'],
      ['서로 다른 두께의 단열 구역을 평균 단가로 계산해도 되나요?','권장하지 않습니다. 두께와 공법별 표준시장단가 행에 실제 수량을 각각 적용하는 편이 범위를 명확히 유지합니다.'],
      ['40평 단열 견적끼리 총액만 비교해도 되나요?','먼저 실제 단열 면적, 공법, 두께, 주재료와 마감복구 포함조건을 맞춘 뒤 총액을 비교해야 합니다.']
    ]
  }
};

const official=units.official_source||'https://www.codil.or.kr/helpdesk/read.do?bbsId=BBSMSTR_900000000204&nttId=13281';
write('data/insulation-reference-v23.json',JSON.stringify({version:VERSION,reviewed_on:REVIEWED,period:units.period,official_notice:units.official_notice,official_source:official,scope:'OD0** 단열 시공 공종 중 기존 curated catalog에 이미 검수된 ㎡ 항목 8개를 matrix reference layer에 연결',private_market_average:false,automatic_material_sum:false,rows:refs},null,2));

const addedAnswers=[];
const routeRows=[];
for(const p of [24,30,32,34,40]){
  const rel=`interior-cost/matrix/${p}-pyeong/insulation/index.html`;
  let h=read(rel);
  const e=editorial[p];
  const materialMatch=h.match(/<script type="application\/json" data-v21-route-config>([\s\S]*?)<\/script>/);
  if(!materialMatch)throw new Error(`route config missing ${rel}`);
  const oldConfig=JSON.parse(materialMatch[1]);
  if(!Array.isArray(oldConfig.materials)||oldConfig.materials.length<1)throw new Error(`material layer missing ${rel}`);
  const routeConfig={...oldConfig,public_refs:refs};
  h=h.replace(/<script type="application\/json" data-v21-route-config>[\s\S]*?<\/script>/,`<script type="application/json" data-v21-route-config>${JSON.stringify(routeConfig).replace(/</g,'\\u003c')}</script>`);
  const rowHtml=refs.map(x=>`<tr><th scope="row"><code>${esc(x.code)}</code><br>${esc(x.name)}</th><td>${esc(x.spec)}</td><td>${fmt(x.price)}원/${esc(x.unit)}</td><td>${esc(x.exclude||'단가정의 확인')}</td></tr>`).join('');
  h=h.replace(/(<h2>REFERENCE · 단열 표준시장단가<\/h2>[\s\S]*?<tbody>)[\s\S]*?(<\/tbody>)/,`$1${rowHtml}$2`);
  h=h.replace(/<section class="v6-section" data-v23-insulation>[\s\S]*?<\/section>/,'');
  h=h.replace(/<script type="application\/ld\+json" data-v23-faq>[\s\S]*?<\/script>/,'');
  const marker=`<section class="v6-section"><div class="site-shell"><h2>${p}평 단열 견적에서 확인할 조건</h2>`;
  if(!h.includes(marker))throw new Error(`editorial marker missing ${rel}`);
  const checks=e.checks.map((x,i)=>`<div class="v21-checkitem"><strong>${i+1}. ${esc(x)}</strong><span>실제 견적과 공공 참고의 공법·부위·규격을 같은 기준으로 맞춥니다.</span></div>`).join('');
  const qa=e.qa.map(([q,a])=>`<article><h3>${esc(q)}</h3><p>${esc(a)}</p></article>`).join('');
  const section=`<section class="v6-section" data-v23-insulation><div class="site-shell"><p class="kicker">REFERENCE FIX · V23</p><h2>${esc(e.title)}</h2><p>${esc(e.intro)}</p><div class="v21-checklist">${checks}</div><div class="faq-list" data-v23-faq-list><h2>${p}평 단열 견적 질문</h2>${qa}</div><p><strong>근거 경로</strong> · <a href="${BASE}/data/public-unit-cost/insulation/">단열 시공 공공단가 8개</a> · <a href="${BASE}/data/g2b-materials/insulation/">조달청 단열재 가격</a> · <a href="${BASE}/compare/reference-layers/">데이터 레이어 비교</a></p><p>평수는 검색 문맥일 뿐 작업면적 대체값이 아닙니다. 공공 시공 참고와 조달청 자재 참고는 서로 다른 레이어로 유지합니다.</p></div></section>`;
  h=h.replace(marker,section+marker);
  const faq={'@context':'https://schema.org','@type':'FAQPage',mainEntity:e.qa.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))};
  h=h.replace('</head>',`<script type="application/ld+json" data-v23-faq>${JSON.stringify(faq).replace(/</g,'\\u003c')}</script></head>`);
  write(rel,h);
  const pageUrl=`${BASE}/${rel.replace(/index\.html$/,'')}`;
  e.qa.forEach(([question,answer],i)=>addedAnswers.push({id:`v23-${p}-insulation-${i+1}`,category:'평수×공종',question,answer,source:pageUrl,status:'published',url:pageUrl,evidence_fallback:false}));
  routeRows.push({pyeong:p,path:rel,public_ref_count:refs.length,material_group_count:oldConfig.materials.length,title:e.title,check_count:e.checks.length,faq_count:e.qa.length});
}
if(addedAnswers.length!==15||routeRows.length!==5)throw new Error('v23 insulation editorial batch incomplete');
write('data/insulation-editorial-v23.json',JSON.stringify({version:VERSION,reviewed_on:REVIEWED,route_count:5,faq_count:15,records:routeRows},null,2));

const routes23=plan22.routes.map(r=>r.trade==='insulation'?{...r,status:'RELEASE',public_ref_count:refs.length,release_source:'v23_insulation',hold_reason:undefined}:r);
if(routes23.filter(x=>x.status==='RELEASE').length!==25)throw new Error('v23 matrix must be 25 release');
write('data/matrix-route-plan-v23.json',JSON.stringify({version:VERSION,reviewed_on:REVIEWED,policy:'all 25 matrix routes have public reference or prior validated layers plus route-specific editorial review; preview remains noindex',route_count:25,release_count:25,hold_count:0,routes:routes23},null,2));

const releaseUrls=[...(release22.urls||[])];
for(const r of routes23.filter(x=>x.release_source==='v23_insulation')){
  if(!releaseUrls.some(x=>x.path===r.path))releaseUrls.push({path:r.path,url:`${SITE}/${r.path.replace(/index\.html$/,'')}`,role:'longtail',phase:'WAVE4',primary_intent:r.owner_intent});
}
releaseUrls.sort((a,b)=>a.path.localeCompare(b.path,'en'));
write('data/release-url-set-v23.json',JSON.stringify({version:VERSION,reviewed_on:REVIEWED,simulation_only:true,actual_preview_noindex_unchanged:true,base_v22_count:release22.total_count,matrix_routes:25,matrix_release:25,matrix_hold:0,new_candidates:5,total_count:releaseUrls.length,urls:releaseUrls},null,2));
write('data/matrix-release-gate-v23.json',JSON.stringify({version:VERSION,reviewed_on:REVIEWED,preview_indexing:false,production_switch:false,route_count:25,release_count:25,hold_count:0,rules:{public_reference_required:true,official_material_group_required:true,route_editorial_required:true,pyeong_used_as_work_area:false,automatic_cross_layer_sum:false,private_market_average_from_public_data:false},release_routes:routes23.map(x=>x.path),hold_routes:[]},null,2));
write('data/matrix-cutover-simulation-v23.json',JSON.stringify({version:VERSION,reviewed_on:REVIEWED,simulation_only:true,applied:false,owner_approval_required:true,current_preview_robots:'noindex,nofollow',release_count:25,hold_count:0,rules:{release_if_approved:'index,follow',bulk_noindex_removal_forbidden:true,search_console_submission:false,ads_activation:false},routes:routes23.map(r=>({path:r.path,status:'RELEASE',future_robots_if_approved:'index,follow'}))},null,2));

const combined=[...(answers22.answers||[]),...addedAnswers];
write('data/answer-index-v23.json',JSON.stringify({version:VERSION,reviewed_on:REVIEWED,count:combined.length,base_v22_count:answers22.count,added_v23:addedAnswers.length,answers:combined},null,2));

let matrix=read('interior-cost/matrix/index.html');
matrix=matrix.replace(/<div class="v21-boundary" data-v23-release-note>[\s\S]*?<\/div>/,'');
matrix=matrix.replace(/<div class="v21-boundary" data-v22-release-note>[\s\S]*?<\/div>/,'');
matrix=matrix.replace('출시 후보</span><strong>20개</strong>','출시 후보</span><strong>25개</strong>');
matrix=matrix.replace('v22 편집 검수까지 통과한 조합 20개를 출시 후보로 두고, 공공 시공 참고 레이어가 비어 있는 단열 5개 조합만 HOLD로 유지합니다.','v23에서 누락됐던 단열 OD0** 표준시장단가 8개 연결을 복구해 25개 조합 모두 데이터·편집 검수 후보가 되었습니다. 실제 프리뷰는 계속 noindex입니다.');
for(const p of [24,30,32,34,40]){
  const href=`${BASE}/interior-cost/matrix/${p}-pyeong/insulation/`;
  matrix=matrix.replace(`<a class="v21-route-link v21-hold" href="${href}">견적 확인<small>추가 검토</small></a>`,`<a class="v21-route-link" href="${href}">견적 확인<small>단열 참조 복구</small></a>`);
}
const note='<div class="v21-boundary" data-v23-release-note><p><strong>v23 단열 참조 복구</strong></p><p>단열 5개 HOLD의 원인은 공식 데이터 부재가 아니라 matrix 매핑 누락이었습니다. 기존 공공단가 카탈로그에 있던 OD0** 단열 8개 ㎡ 항목을 연결하고, 5개 평수별 페이지에 공법·두께·부위별 편집 검수를 추가했습니다. 25개 모두 출시 후보이지만 실제 프리뷰 색인은 계속 차단합니다.</p></div>';
matrix=matrix.replace('<div data-v21-matrix-filter>',note+'<div data-v21-matrix-filter>');
write('interior-cost/matrix/index.html',matrix);

let llms=read('llms.txt');
llms=llms.replace(/\n# v23 insulation reference[\s\S]*?# end v23 insulation reference\n?/,'\n');
llms+=`\n# v23 insulation reference\n- insulation matrix mapping restored from existing 2026-H2 OD0** public reference catalog\n- verified insulation public references: ${refs.length}\n- matrix release candidates: 25 / 25; preview remains noindex\n- new insulation FAQ answers: 15; answer index: ${combined.length}\n- public construction reference and G2B material layers remain separate; no automatic sum\n# end v23 insulation reference\n`;
write('llms.txt',llms);
write('data/site-quality-v23.json',JSON.stringify({version:VERSION,reviewed_on:REVIEWED,matrix_routes:25,matrix_release:25,matrix_hold:0,insulation_reference_rows:8,insulation_editorial_routes:5,insulation_faqs:15,release_candidates:releaseUrls.length,answer_count:combined.length,preview_noindex:true,actual_production_switch:false,actual_search_console_submission:false,actual_ads_injected:false},null,2));
console.log(JSON.stringify({version:VERSION,insulation_reference_rows:refs.length,matrix_release:25,matrix_hold:0,release_candidates:releaseUrls.length,answer_count:combined.length},null,2));
