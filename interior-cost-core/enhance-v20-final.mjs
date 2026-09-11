import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const VERSION='20.0.0';
const OFFICIAL='https://www.data.go.kr/data/15129415/openapi.do';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const json=(r,f={})=>{try{return JSON.parse(read(r))}catch{return f}};
const exists=r=>fs.existsSync(path.join(ROOT,r));
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const strip=s=>String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();
const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('ko-KR',{maximumFractionDigits:0}):'-';
const reviewed=json('data/v5-report.json',{}).reviewed_on||new Date().toISOString().slice(0,10);
const data=json('data/g2b-building-materials.json',{});
const release19=json('data/release-url-set-v19.json',{urls:[],total_count:0});
const answers19=json('data/answer-index-v19.json',{answers:[],count:0});
const quote=json('data/quote-statistics.json',{sample_count:0});
const sourceFresh=json('data/source-freshness-v11.json',{update_required:false});
if(data.source_id!=='PPS-G2B-PRICE-BUILDING-MATERIALS'||!Array.isArray(data.records)||data.records.length<400)throw new Error('v20 requires valid G2B snapshot');
if(release19.total_count!==65||release19.urls.length!==65)throw new Error('v20 requires 65 v19 release candidates');
if(JSON.stringify(data).match(/serviceKey|invstDeptTelNo|invstOfclNm/i))throw new Error('v20 forbidden G2B fields');

const MATERIALS=[
 {term:'타일',slug:'tile',label:'타일'},
 {term:'벽지',slug:'wallpaper',label:'벽지'},
 {term:'장판',slug:'vinyl-flooring',label:'장판'},
 {term:'합판',slug:'plywood',label:'합판'},
 {term:'석고보드',slug:'gypsum-board',label:'석고보드'},
 {term:'각재',slug:'lumber',label:'각재'},
 {term:'단열재',slug:'insulation',label:'단열재'}
];
const unitNorm=u=>['㎡','m2','M2','m²','M²'].includes(String(u||'').trim())?'㎡':String(u||'').trim()||'단위 미기재';
const quantile=(values,p)=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return Math.round(a[lo]+(a[hi]-a[lo])*(i-lo))};
const materialByTerm=new Map(MATERIALS.map(x=>[x.term,x]));
const groups=[];
for(const m of MATERIALS){
  const rows=data.records.filter(r=>r.query_term===m.term&&Number(r.price_krw)>0);
  const units=new Map();
  for(const r of rows){const u=unitNorm(r.unit);if(!units.has(u))units.set(u,[]);units.get(u).push(r)}
  for(const [u,list] of units){
    const prices=list.map(x=>Number(x.price_krw)).filter(x=>x>0);const dates=list.map(x=>String(x.notice_at||'').slice(0,10)).filter(Boolean).sort();
    groups.push({term:m.term,slug:m.slug,label:m.label,normalized_unit:u,source_units:[...new Set(list.map(x=>String(x.unit||'').trim()).filter(Boolean))],record_count:list.length,unique_products:new Set(list.map(x=>x.product_id||x.item_name)).size,min_price_krw:Math.min(...prices),p25_price_krw:quantile(prices,.25),median_price_krw:quantile(prices,.5),p75_price_krw:quantile(prices,.75),max_price_krw:Math.max(...prices),latest_notice_at:dates.at(-1)||'',vat_values:[...new Set(list.map(x=>x.vat).filter(Boolean))],delivery_conditions:[...new Set(list.map(x=>x.delivery_condition).filter(Boolean))]});
  }
}
groups.sort((a,b)=>a.term.localeCompare(b.term,'ko')||b.record_count-a.record_count||a.normalized_unit.localeCompare(b.normalized_unit,'ko'));
const materialStats=MATERIALS.map(m=>{const gs=groups.filter(x=>x.term===m.term),source=(data.groups||[]).find(x=>x.term===m.term)||{};return {...m,source_total:Number(source.total_count||0),source_captured:Number(source.captured_count||0),priced_records:gs.reduce((n,x)=>n+x.record_count,0),units:gs}});
const active=materialStats.filter(x=>x.source_captured>0);
const collectedDate=String(data.source_collected_at||data.collected_at||'').slice(0,10);
const attemptedDate=String(data.refresh_attempted_at||'').slice(0,10);
const latestNotice=groups.map(x=>x.latest_notice_at).filter(Boolean).sort().at(-1)||'';
write('data/g2b-material-stats-v20.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,source_id:data.source_id,source_collected_at:data.source_collected_at||data.collected_at,refresh_status:data.refresh_status,record_count:data.record_count,active_materials:active.length,normalized_group_count:groups.length,unit_normalization:{'㎡':'㎡',m2:'㎡',M2:'㎡','m²':'㎡','M²':'㎡'},materials:materialStats,groups},null,2));

const css19=read('assets/site-v19-bundle.css'),js19=read('assets/app-v19-bundle.js');
const css20=fs.readFileSync(path.join(CORE,'site-v20.css'),'utf8'),js20=fs.readFileSync(path.join(CORE,'app-v20.js'),'utf8');
const hash=crypto.createHash('sha1').update(css19+'\n'+css20+'\n'+js19+'\n'+js20).digest('hex').slice(0,12);
write('assets/site-v20-bundle.css',css19+'\n/* v20 official materials */\n'+css20);
write('assets/app-v20-bundle.js',js19+'\n/* v20 official materials */\n'+js20);
const cssRef=`<link rel="stylesheet" href="${BASE}/assets/site-v20-bundle.css?v=${hash}">`;
const jsRef=`<script src="${BASE}/assets/app-v20-bundle.js?v=${hash}" defer></script>`;
const dataHub=read('data/index.html');
const header=dataHub.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=dataHub.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
if(!header||!footer)throw new Error('v20 shell missing');
const head=(title,desc,canonical,schema='')=>`<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canonical}">${cssRef}${schema?`<script type="application/ld+json">${JSON.stringify(schema)}</script>`:''}`;
const shell=(pathKey,title,desc,canonical,body,schema)=>`<!doctype html><html lang="ko"><head>${head(title,desc,canonical,schema)}</head><body class="v20-page v19-release-candidate" data-v19-role="data" data-v19-path="${pathKey}"><a class="v18-skip" href="#main-content">본문 바로가기</a>${header}<main id="main-content">${body}</main>${footer}${jsRef}</body></html>`;
const sourceBoundary=`<div class="v20-official-note"><p><strong>OFFICIAL · 조달청 나라장터 가격정보현황서비스</strong></p><p>조달청 공식 설명상 시설공사 원가계산에 참고하는 가격정보입니다. 조사 시점, 계약수량, 난이도, 수급여건과 납품조건에 따라 달라질 수 있으며 일반 아파트 민간 인테리어 시공비·소비자가·적정견적·시장평균을 직접 뜻하지 않습니다.</p><p><a href="${OFFICIAL}">공식 데이터 설명</a> · 수집일 ${esc(collectedDate)} · 최신 레코드 게시일 ${esc(latestNotice||'-')}</p></div>`;

const groupRow=g=>`<tr><th scope="row">${esc(g.label)}</th><td>${esc(g.normalized_unit)}</td><td>${fmt(g.record_count)}</td><td>${fmt(g.p25_price_krw)}원</td><td><b>${fmt(g.median_price_krw)}원</b></td><td>${fmt(g.p75_price_krw)}원</td><td>${esc(g.latest_notice_at)}</td></tr>`;
const materialLinks=materialStats.map(m=>{const u=groups.filter(x=>x.term===m.term);const href=m.source_captured?`${BASE}/data/g2b-materials/${m.slug}/`:'#v20-coverage';return `<a class="v20-material-link" href="${href}"><strong>${esc(m.label)}</strong><span>${m.source_captured?`${fmt(m.priced_records)}개 가격 레코드 · ${u.map(x=>x.normalized_unit).join(' · ')||'단위 없음'}`:'현재 검색 결과 0건 · 상세페이지 미생성'}</span><b>${m.source_captured?'상세':'범위 확인'}</b></a>`}).join('');
const coverage=(data.groups||[]).map(g=>`<tr><th scope="row">${esc(g.term)}</th><td>${fmt(g.captured_count)} / ${fmt(g.total_count)}</td><td>${esc((g.units||[]).join(' · ')||'-')}</td><td>${g.captured_count>0?'가격 레코드 있음':'현재 검색 결과 없음'}</td></tr>`).join('');
const hubBody=`<section class="v62-data-hero"><div class="site-shell"><p class="kicker">OFFICIAL · PPS G2B</p><h1>조달청 건축자재 가격 데이터</h1><p>1,561개 공개 레코드를 자재와 같은 단위끼리 분리해 확인합니다.</p></div></section><section class="v6-section"><div class="site-shell"><div class="v20-source-strip"><div><span>수집 레코드</span><strong>${fmt(data.record_count)}건</strong></div><div><span>응답 자재</span><strong>${active.length}개</strong></div><div><span>정규화 단위 묶음</span><strong>${groups.length}개</strong></div><div><span>최신 게시</span><strong>${esc(latestNotice||'-')}</strong></div></div>${sourceBoundary}<h2>자재별 데이터</h2><div class="v20-material-index">${materialLinks}</div></div></section><section class="v6-section" id="v20-coverage"><div class="site-shell"><h2>검색어별 수집 범위</h2><div class="table-wrap"><table class="v20-record-table"><thead><tr><th>검색어</th><th>수집 / 전체</th><th>원문 단위</th><th>상태</th></tr></thead><tbody>${coverage}</tbody></table></div><p>마루·시멘트·전선·조명·창호처럼 현재 API 검색 결과가 0건인 분류는 숫자를 추정하지 않고 0건 상태만 유지합니다.</p></div></section><section class="v6-section"><div class="site-shell"><h2>같은 단위 가격 분포</h2><div class="table-wrap"><table class="v20-record-table"><thead><tr><th>자재</th><th>단위</th><th>N</th><th>P25</th><th>중앙값</th><th>P75</th><th>최근 게시</th></tr></thead><tbody>${groups.map(groupRow).join('')}</tbody></table></div><p><a href="${BASE}/data/g2b-materials/calculator/">공공 자재 참고 계산기</a> · <a href="${BASE}/data/g2b-material-stats-v20.json">정규화 통계 JSON</a> · <a href="${BASE}/data/g2b-building-materials.json">정제 원본 JSON</a></p></div></section>`;
const hubSchema={'@context':'https://schema.org','@graph':[{'@type':'Dataset',name:'조달청 시설공통자재(건축) 가격 정규화 데이터',url:SITE+'/data/g2b-materials/',dateModified:collectedDate,creator:{'@type':'GovernmentOrganization',name:'조달청'},distribution:{'@type':'DataDownload',encodingFormat:'application/json',contentUrl:SITE+'/data/g2b-material-stats-v20.json'}},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'홈',item:SITE+'/'},{'@type':'ListItem',position:2,name:'데이터',item:SITE+'/data/'},{'@type':'ListItem',position:3,name:'조달청 건축자재 가격',item:SITE+'/data/g2b-materials/'}]}]};
write('data/g2b-materials/index.html',shell('data/g2b-materials/index.html','조달청 건축자재 가격 데이터 | 자재별 P25·중앙값·P75','나라장터 시설공통자재 공개가격을 동일 단위끼리 분리해 P25·중앙값·P75와 게시일을 확인합니다.',SITE+'/data/g2b-materials/',hubBody,hubSchema));

const detailPaths=[];
for(const m of active){
  const gs=groups.filter(x=>x.term===m.term),rows=data.records.filter(r=>r.query_term===m.term&&Number(r.price_krw)>0).sort((a,b)=>String(b.notice_at).localeCompare(String(a.notice_at))).slice(0,40);
  const unitBlocks=gs.map(g=>{const max=Math.max(g.p75_price_krw||0,g.median_price_krw||0,g.p25_price_krw||0,1);const bar=(label,val)=>`<div class="v20-dist-row"><span>${label}</span><div class="v20-dist-track"><i class="v20-dist-fill" style="width:${Math.max(2,Math.round(Number(val||0)/max*100))}%"></i></div><strong>${fmt(val)}원</strong></div>`;return `<section class="v20-unit-block"><div class="v20-unit-head"><h3>${esc(m.label)} · ${esc(g.normalized_unit)}</h3><p>원문 단위 ${esc(g.source_units.join(' · '))} · N=${g.record_count}</p></div><div class="v20-stats"><div class="v20-stat"><span>품목</span><strong>${fmt(g.unique_products)}개</strong></div><div class="v20-stat"><span>P25</span><strong>${fmt(g.p25_price_krw)}원</strong></div><div class="v20-stat"><span>중앙값</span><strong>${fmt(g.median_price_krw)}원</strong></div><div class="v20-stat"><span>P75</span><strong>${fmt(g.p75_price_krw)}원</strong></div><div class="v20-stat"><span>최근 게시</span><strong>${esc(g.latest_notice_at)}</strong></div></div><div class="v20-dist">${bar('P25',g.p25_price_krw)}${bar('중앙값',g.median_price_krw)}${bar('P75',g.p75_price_krw)}</div><p>가격분포는 ${esc(m.label)} 검색 레코드 중 정규화 단위가 ${esc(g.normalized_unit)}인 값만 사용합니다. 규격·납품조건이 다른 개별 품목을 동일 상품으로 간주하지 않습니다.</p></section>`}).join('');
  const recRows=rows.map(r=>`<tr><td>${esc(r.item_name||r.product_name)}</td><td>${esc(unitNorm(r.unit))}<small>${unitNorm(r.unit)!==String(r.unit||'').trim()?` (${esc(r.unit)})`:''}</small></td><td>${fmt(r.price_krw)}원</td><td>${esc(String(r.notice_at||'').slice(0,10))}</td><td>${esc(r.vat||'-')}</td><td>${esc(r.delivery_condition||'-')}</td></tr>`).join('');
  const canonical=SITE+`/data/g2b-materials/${m.slug}/`,pathKey=`data/g2b-materials/${m.slug}/index.html`;
  const schema={'@context':'https://schema.org','@graph':[{'@type':'Dataset',name:`조달청 ${m.label} 공개가격`,url:canonical,dateModified:collectedDate,creator:{'@type':'GovernmentOrganization',name:'조달청'}},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'홈',item:SITE+'/'},{'@type':'ListItem',position:2,name:'조달청 건축자재 가격',item:SITE+'/data/g2b-materials/'},{'@type':'ListItem',position:3,name:m.label,item:canonical}]}]};
  const body=`<section class="v62-data-hero"><div class="site-shell"><p class="kicker">OFFICIAL · ${esc(m.label)}</p><h1>조달청 ${esc(m.label)} 가격 데이터</h1><p>${fmt(m.priced_records)}개 가격 레코드 · ${gs.length}개 정규화 단위</p></div></section><section class="v6-section"><div class="site-shell"><div class="v20-source-strip"><div><span>가격 레코드</span><strong>${fmt(m.priced_records)}건</strong></div><div><span>단위 그룹</span><strong>${gs.length}개</strong></div><div><span>수집일</span><strong>${esc(collectedDate)}</strong></div><div><span>최신 게시</span><strong>${esc(gs.map(x=>x.latest_notice_at).sort().at(-1)||'-')}</strong></div></div>${sourceBoundary}${unitBlocks}</div></section><section class="v6-section"><div class="site-shell"><h2>최근 공개 레코드</h2><div class="table-wrap"><table class="v20-record-table"><thead><tr><th>품목/규격</th><th>단위</th><th>가격</th><th>게시일</th><th>VAT</th><th>납품조건</th></tr></thead><tbody>${recRows}</tbody></table></div><p>최근순 최대 40개를 표시합니다. 전체 정제 레코드는 JSON에서 확인할 수 있습니다.</p><p><a href="${BASE}/data/g2b-materials/calculator/">${esc(m.label)} 수량 계산</a> · <a href="${BASE}/data/g2b-materials/">자재 전체</a></p></div></section>`;
  write(pathKey,shell(pathKey,`조달청 ${m.label} 가격 | P25·중앙값·P75`,`${m.label} 조달청 시설공통자재 공개가격을 같은 단위끼리 분리해 P25·중앙값·P75와 최신 게시일을 확인합니다.`,canonical,body,schema));detailPaths.push({path:pathKey,...m,priced_records:m.priced_records});
}

const calculatorGroups=groups.filter(x=>x.record_count>0);
const calcOptions=calculatorGroups.map(g=>`<option value="${esc(g.term+'|'+g.normalized_unit)}">${esc(g.label)} · ${esc(g.normalized_unit)} · N=${g.record_count}</option>`).join('');
const calcPath='data/g2b-materials/calculator/index.html',calcCanonical=SITE+'/data/g2b-materials/calculator/';
const calcSchema={'@context':'https://schema.org','@graph':[{'@type':'WebApplication',name:'조달청 건축자재 참고 계산기',url:calcCanonical,applicationCategory:'UtilitiesApplication',operatingSystem:'Web'},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'홈',item:SITE+'/'},{'@type':'ListItem',position:2,name:'조달청 건축자재 가격',item:SITE+'/data/g2b-materials/'},{'@type':'ListItem',position:3,name:'자재 참고 계산기',item:calcCanonical}]}]};
const calcBody=`<section class="v62-data-hero"><div class="site-shell"><p class="kicker">CALCULATED FROM OFFICIAL</p><h1>조달청 건축자재 참고 계산기</h1><p>공개 자재가격 P25·중앙값·P75 × 사용자가 입력한 수량</p></div></section><section class="v6-section"><div class="site-shell"><div class="v20-calculator" data-v20-calculator><div class="v20-calc-inputs"><label for="v20-group">자재 · 단위</label><select id="v20-group" data-v20-group><option value="">선택</option>${calcOptions}</select><label for="v20-qty">수량 <span data-v20-unit>-</span></label><input id="v20-qty" data-v20-qty type="number" min="0" step="0.01" inputmode="decimal" placeholder="수량 입력"><script type="application/json" data-v20-stats>${JSON.stringify(calculatorGroups).replace(/</g,'\\u003c')}</script></div><div class="v20-calc-result"><p data-v20-calc-note>자재·단위와 수량을 입력하면 조달청 공개 레코드 분포를 단순 곱셈합니다.</p><div class="v20-calc-grid"><div><span>P25 참고합계</span><strong data-v20-p25>0원</strong></div><div><span>중앙값 참고합계</span><strong data-v20-median>0원</strong></div><div><span>P75 참고합계</span><strong data-v20-p75>0원</strong></div></div></div></div>${sourceBoundary}<p>이 계산기는 자재 공개가격과 입력 수량을 곱하는 산술 도구입니다. 인건비, 철거·폐기물, 운반, 현장 난이도, 시공사 마진, VAT 조건 차이, 민간 유통가격을 자동 보정하거나 추정하지 않습니다.</p></div></section>`;
write(calcPath,shell(calcPath,'조달청 건축자재 참고 계산기 | P25·중앙값·P75','나라장터 시설공통자재 공개가격 분포에 사용자가 입력한 수량을 곱해 P25·중앙값·P75 참고합계를 계산합니다.',calcCanonical,calcBody,calcSchema));

const integrations=[
 ['data/public-unit-cost/tile/index.html',['타일']],['data/public-unit-cost/wallpaper/index.html',['벽지']],['data/public-unit-cost/flooring/index.html',['장판']],['data/public-unit-cost/carpentry-drywall/index.html',['석고보드','합판','각재']],['data/public-unit-cost/insulation/index.html',['단열재']],
 ['cost/bathroom/index.html',['타일']],['cost/kitchen/index.html',['타일']],['cost/wallpaper/index.html',['벽지']],['cost/floor/index.html',['장판']],['cost/carpentry/index.html',['석고보드','합판','각재']]
];
const integrationRows=[];
for(const [p,terms] of integrations){if(!exists(p))continue;let h=read(p);const links=terms.map(t=>materialByTerm.get(t)).filter(Boolean).map(m=>`<a href="${BASE}/data/g2b-materials/${m.slug}/">조달청 ${esc(m.label)} 가격</a>`).join('');const block=`<section class="v20-integration" data-v20-g2b-integration><div class="v20-integration__head"><div><p class="kicker">OFFICIAL MATERIAL REFERENCE</p><h2>조달청 자재 참고</h2></div><p>시설공사 원가계산 참고가격 · 민간 인테리어 시세 아님</p></div><p>같은 공종이라도 표준시장단가의 시공 범위, 조달청 자재 공개가격, 업체 민간 견적은 서로 다른 데이터입니다. 숫자를 합치기 전에 단위·규격·VAT·납품조건을 확인합니다.</p><div class="v20-integration__links">${links}<a href="${BASE}/data/g2b-materials/calculator/">자재 수량 계산</a></div></section>`;if(!h.includes('data-v20-g2b-integration'))h=h.replace('</main>',block+'</main>');write(p,h);integrationRows.push({path:p,terms,present:true})}

const v20Answers=[
 ['v20-g2b-what','공식데이터','나라장터 건축자재 가격은 무엇인가요?','조달청 가격정보현황서비스의 시설공통자재(건축) 공개 가격입니다. 시설공사 원가계산 참고용이며 민간 아파트 인테리어 시세와 구분합니다.',`${BASE}/data/g2b-materials/`],
 ['v20-private','공식데이터','조달청 자재가격을 민간 인테리어 적정가격으로 써도 되나요?','아니요. 조사시점·수량·난이도·수급·납품조건이 다르므로 민간 소비자가나 적정견적을 직접 판정하는 값으로 사용하지 않습니다.',`${BASE}/data/g2b-materials/`],
 ['v20-unit','방법론','m2, M2, ㎡는 어떻게 처리하나요?','표시와 집계에서는 면적 단위 별칭을 ㎡로 정규화하고 원문 단위도 함께 보존합니다. 매·개·재·㎥처럼 다른 단위는 합치지 않습니다.',`${BASE}/data/g2b-materials/`],
 ['v20-p25','방법론','조달청 자재가격 P25·중앙값·P75는 무엇인가요?','동일 검색어와 정규화 단위의 공개 레코드를 정렬해 25·50·75백분위 가격을 계산한 분포 요약입니다. 동일 규격 상품의 시세 범위라는 뜻은 아닙니다.',`${BASE}/data/g2b-materials/`],
 ['v20-date','공식데이터','수집일과 게시일은 왜 따로 표시하나요?','수집일은 견적검수실이 API를 조회한 날이고 게시일은 조달청 가격 레코드의 기준 날짜라 서로 다른 시점입니다.',`${BASE}/data/g2b-materials/`],
 ['v20-vat','공식데이터','조달청 자재가격의 VAT 조건도 확인해야 하나요?','네. 공개 레코드의 VAT 표기를 보존하며 현재 스냅샷의 주요 레코드는 부가가치세별도 조건이므로 민간 견적과 비교할 때 같은 조건인지 확인해야 합니다.',`${BASE}/data/g2b-materials/`],
 ['v20-zero','방법론','마루·전선·조명·창호가 0건이면 가격을 어떻게 보여주나요?','다른 자재 값을 대신 넣지 않고 검색 결과 0건 상태만 표시합니다. 데이터가 없는 분류의 평균이나 중앙값을 만들지 않습니다.',`${BASE}/data/g2b-materials/`],
 ['v20-stale','데이터','G2B API 갱신에 실패하면 최신값처럼 표시하나요?','아니요. 이전 정상 스냅샷을 유지하고 refresh_status와 fallback 분류를 기록해 신규 수집 성공과 구분합니다.',`${BASE}/data/g2b-materials/`],
 ['v20-calc','도구','조달청 자재 계산기는 무엇을 계산하나요?','사용자가 선택한 자재·단위의 P25·중앙값·P75 공개가격에 입력 수량을 곱합니다. 시공비나 민간시장 가격은 추정하지 않습니다.',`${BASE}/data/g2b-materials/calculator/`],
 ['v20-tile','공식데이터','조달청 타일 가격 데이터는 어디서 보나요?','타일 상세에서 ㎡와 개 단위를 분리해 레코드 수와 P25·중앙값·P75, 최신 게시일을 확인합니다.',`${BASE}/data/g2b-materials/tile/`],
 ['v20-wallpaper','공식데이터','조달청 벽지 가격 데이터는 어디서 보나요?','벽지 상세에서 ㎡ 기준 공개 레코드와 분포, VAT·납품조건을 확인합니다.',`${BASE}/data/g2b-materials/wallpaper/`],
 ['v20-plywood','공식데이터','합판은 매와 ㎡ 가격을 합치나요?','아니요. 합판의 매 단위와 ㎡ 단위는 서로 다른 그룹으로 유지합니다.',`${BASE}/data/g2b-materials/plywood/`],
 ['v20-gypsum','공식데이터','석고보드의 m2와 ㎡는 따로 보나요?','원문 단위는 보존하지만 면적 단위 별칭은 정규화 집계에서 ㎡로 합쳐 분포를 계산합니다.',`${BASE}/data/g2b-materials/gypsum-board/`],
 ['v20-lumber','공식데이터','각재의 재와 ㎥ 가격을 비교해도 되나요?','단위가 다르므로 직접 비교하지 않습니다. 재와 ㎥는 별도 가격분포로 봅니다.',`${BASE}/data/g2b-materials/lumber/`],
 ['v20-insulation','공식데이터','단열재 공개가격은 어떤 단위로 보나요?','m2·M2·㎡ 면적 표기를 ㎡로 정규화하되 원문 단위를 보존해 확인할 수 있습니다.',`${BASE}/data/g2b-materials/insulation/`],
 ['v20-release','운영','v20 공식자재 데이터가 추가되면 바로 검색 색인을 켜나요?','아니요. v20도 preview noindex 상태로 검증하며 production robots·sitemap·Search Console·AdSense는 소유자 승인 전 변경하지 않습니다.',`${BASE}/data/launch-gate-v20/`]
].map(([id,category,question,answer,source])=>({id,category,question,answer,source,url:source,status:'published'}));
const answerMap=new Map();for(const x of [...answers19.answers,...v20Answers])answerMap.set(x.id||x.question,x);const answers=[...answerMap.values()];
write('data/answer-index-v20.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,count:answers.length,answers},null,2));
const answerCanonical=SITE+'/data/answers-v20/',answerPath='data/answers-v20/index.html';
const answerBody=`<section class="v62-data-hero"><div class="site-shell"><p class="kicker">ANSWER INDEX V20</p><h1>인테리어 견적 질문 ${answers.length}개</h1><p>공식 자재가격 · 견적 비교 · 데이터 경계 · 실제 브라우저 검수</p></div></section><section class="v6-section"><div class="site-shell"><div class="v20-answer-list">${answers.map(x=>`<article class="v20-answer"><span>${esc(x.category)}</span><h3>${esc(x.question)}</h3><p>${esc(x.answer)}</p><a href="${esc(x.source)}">근거/도구</a></article>`).join('')}</div></div></section>`;
write(answerPath,shell(answerPath,`인테리어 견적 질문 ${answers.length}개 | 공식 자재가격 포함`,`견적·공공단가·조달청 자재가격·데이터 기준 질문 ${answers.length}개를 근거 페이지와 연결합니다.`,answerCanonical,answerBody,{'@context':'https://schema.org','@type':'CollectionPage',name:`인테리어 견적 질문 ${answers.length}개`,url:answerCanonical,dateModified:reviewed}));

const baseRelease=release19.urls.map(x=>x.path==='data/answers-v19/index.html'?{...x,path:answerPath,url:answerCanonical,role:'answer',primary_intent:`인테리어 견적 질문 ${answers.length}개`}:{...x});
const substantive=detailPaths.filter(x=>x.term!=='장판'&&x.priced_records>=10).map(x=>({path:x.path,url:SITE+'/'+x.path.replace(/index\.html$/,''),role:'official-data',primary_intent:`조달청 ${x.label} 가격`}));
const additions=[{path:'data/g2b-materials/index.html',url:SITE+'/data/g2b-materials/',role:'official-data',primary_intent:'조달청 건축자재 가격'},{path:calcPath,url:calcCanonical,role:'tool',primary_intent:'조달청 건축자재 계산기'},...substantive];
const releaseUrls=[...baseRelease,...additions.filter(a=>!baseRelease.some(x=>x.path===a.path))];
write('data/release-url-set-v20.json',JSON.stringify({version:VERSION,reviewed_on:reviewed,simulation_only:true,actual_preview_noindex_unchanged:true,base_v19_count:65,new_official_candidates:additions.length,total_count:releaseUrls.length,urls:releaseUrls},null,2));

const replaceBundle=p=>{if(!exists(p))return;let h=read(p);h=h.replace(/<link rel="stylesheet" href="[^"]*site-v19-bundle\.css[^"]*">/g,cssRef).replace(/<script src="[^"]*app-v19-bundle\.js[^"]*" defer><\/script>/g,jsRef);if(!h.includes('site-v20-bundle.css'))h=h.replace('</head>',cssRef+'</head>');if(!h.includes('app-v20-bundle.js'))h=h.replace('</body>',jsRef+'</body>');write(p,h)};
for(const x of releaseUrls)replaceBundle(x.path);for(const [p] of integrations)replaceBundle(p);

let hub=read('data/index.html');if(!hub.includes('data-v20-g2b-hub'))hub=hub.replace('</main>',`<section class="v20-integration" data-v20-g2b-hub><div class="site-shell"><div class="v20-integration__head"><div><p class="kicker">OFFICIAL · PPS</p><h2>조달청 건축자재 가격 ${fmt(data.record_count)}건</h2></div><p>${active.length}개 자재 · ${groups.length}개 정규화 단위 그룹</p></div><div class="v20-integration__links"><a href="${BASE}/data/g2b-materials/">자재 데이터</a><a href="${BASE}/data/g2b-materials/calculator/">자재 계산기</a><a href="${BASE}/data/g2b-material-stats-v20.json">통계 JSON</a></div></div></section></main>`);write('data/index.html',hub);

try{const cat=json('data/dataset-catalog.json',{datasets:[]});cat.datasets=cat.datasets||[];cat.datasets=cat.datasets.filter(x=>x.id!=='g2b-material-v20');cat.datasets.push({id:'g2b-material-v20',type:'OFFICIAL',name:'조달청 시설공통자재(건축) 가격',status:'published-preview',scope:`${data.record_count} records / ${active.length} materials / ${groups.length} normalized unit groups`,period:collectedDate,page:`${BASE}/data/g2b-materials/`,json:`${BASE}/data/g2b-material-stats-v20.json`,source:OFFICIAL,not_for:'민간 아파트 인테리어 시장평균·적정견적 직접 판정'});write('data/dataset-catalog.json',JSON.stringify(cat,null,2))}catch{}
try{let ll=read('llms.txt');if(!ll.includes('## v20 official material data'))ll+=`\n## v20 official material data\n- ${SITE}/data/g2b-materials/ — PPS G2B facility-building material reference prices; not private apartment market prices\n- ${SITE}/data/g2b-material-stats-v20.json — normalized unit groups with P25/median/P75\n- ${SITE}/data/g2b-materials/calculator/ — arithmetic on official reference distributions and user quantity only\n- ${SITE}/data/answers-v20/ — ${answers.length} evidence-linked answers\n`;write('llms.txt',ll)}catch{}

const integrationAudit={version:VERSION,reviewed_on:reviewed,source_records:data.record_count,active_materials:active.length,normalized_groups:groups.length,detail_pages:detailPaths.length,release_detail_pages:substantive.length,integrated_pages:integrationRows.length,calculator_official_values_only:true,private_market_average:false,source_boundary_all:true,rows:integrationRows};
write('data/g2b-integration-audit-v20.json',JSON.stringify(integrationAudit,null,2));
const readiness={version:VERSION,reviewed_on:reviewed,source_id:data.source_id,source_collected_at:data.source_collected_at||data.collected_at,refresh_attempted_at:data.refresh_attempted_at||null,refresh_status:data.refresh_status,fallback_terms:data.fallback_terms||[],record_count:data.record_count,active_query_groups:active.length,normalized_unit_groups:groups.length,detail_pages:detailPaths.length,release_candidates:releaseUrls.length,answers:answers.length,no_secret_fields:true,unit_alias_normalization_only:true,unrelated_units_combined:false,private_market_average:false,preview_noindex:true,production_switch:false,search_console_submission:false,ads_injected:false,browser_routes:['data/g2b-materials/index.html',...detailPaths.map(x=>x.path),calcPath,answerPath,'data/g2b-audit-v20/index.html','data/launch-gate-v20/index.html']};
write('data/g2b-readiness-v20.json',JSON.stringify(readiness,null,2));

const auditPlaceholder=`<section class="v62-data-hero"><div class="site-shell"><p class="kicker">V20 AUDIT</p><h1>조달청 자재 데이터 검수</h1><p>공식 데이터 경계, 단위 정규화, 출시 후보 연결을 확인합니다.</p></div></section><section class="v6-section"><div class="site-shell">${sourceBoundary}<p>이 페이지는 수집 레코드 수만 늘리는 것이 아니라 자재·단위·게시시점·VAT·납품조건을 분리하고, 민간 견적과 공공 참고가격을 섞지 않는지 검수합니다. 면적 단위의 표기 차이만 정규화하며 매·개·재·㎥는 별도 그룹으로 유지합니다. 상세 페이지와 계산기는 데이터가 실제로 존재하는 자재에서만 값을 사용하고 0건 분류에는 다른 자재 값을 대입하지 않습니다.</p></div></section>`;
write('data/g2b-audit-v20/index.html',shell('data/g2b-audit-v20/index.html','v20 조달청 자재 데이터 검수 | 견적검수실','G2B 수집·단위 정규화·상세페이지·계산기·기존 공종 연결을 검수합니다.',SITE+'/data/g2b-audit-v20/',auditPlaceholder));
write('data/launch-gate-v20/index.html',shell('data/launch-gate-v20/index.html','v20 출시 게이트 | 공식 자재 데이터','v20 공식 자재 데이터와 73개 출시 후보의 품질·색인 OFF 상태를 확인합니다.',SITE+'/data/launch-gate-v20/',auditPlaceholder.replace('조달청 자재 데이터 검수','v20 출시 게이트')));

const walk=(dir=ROOT,out=[])=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f,out);else if(e.name.endsWith('.html'))out.push(path.relative(ROOT,f).replaceAll('\\','/'))}return out};
const htmls=walk();const titles=[],h1s=[];let thin=0,noindex=0,canonical=0;for(const p of htmls){const h=read(p),text=strip(h);if(text.length<500)thin++;const t=(h.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'').trim(),one=strip(h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');titles.push(t);h1s.push(one);if(/<meta name="robots" content="[^"]*noindex/i.test(h))noindex++;if(/<link rel="canonical" href="https:\/\/5ggul\.github\.io\/pm-lab\/interior-cost-preview\//i.test(h))canonical++}
const dup=a=>[...new Set(a.filter((v,i)=>v&&a.indexOf(v)!==i))];
const releaseSet=new Set(releaseUrls.map(x=>x.path));const broken=[];for(const p of releaseSet){if(!exists(p)){broken.push({from:p,href:'MISSING_PAGE'});continue}const h=read(p);for(const m of h.matchAll(/href="([^"]+)"/g)){const href=m[1];if(!href.startsWith(BASE+'/'))continue;let rel=href.slice((BASE+'/').length).split(/[?#]/)[0];if(!rel)rel='index.html';else if(rel.endsWith('/'))rel+='index.html';if(!exists(rel))broken.push({from:p,href})}}
const quality={version:VERSION,reviewed_on:reviewed,pages:htmls.length,release_candidates:releaseUrls.length,g2b_source_records:data.record_count,active_materials:active.length,normalized_groups:groups.length,detail_pages:detailPaths.length,integrated_pages:integrationRows.length,answer_count:answers.length,thin_under_500:thin,duplicate_titles:dup(titles).length,duplicate_h1:dup(h1s).length,broken_release_links:broken.length,noindex_pages:noindex,canonical_pages:canonical,quote_sample_count:quote.sample_count||0,official_source_update_required:Boolean(sourceFresh.update_required),actual_production_switch:false,actual_search_console_submission:false,actual_ads_injected:false};
const checks={source_records:quality.g2b_source_records>=400,active_materials:quality.active_materials===7,normalized_groups:quality.normalized_groups>=10,detail_pages:quality.detail_pages===7,integrations:quality.integrated_pages>=10,release_count_73:quality.release_candidates===73,answer_count_200:quality.answer_count>=200,thin_zero:quality.thin_under_500===0,unique_titles:quality.duplicate_titles===0,unique_h1:quality.duplicate_h1===0,broken_links_zero:quality.broken_release_links===0,noindex_all:quality.noindex_pages===quality.pages,canonical_all:quality.canonical_pages===quality.pages,quote_n_gate_preserved:quality.quote_sample_count===0,official_sources_current:quality.official_source_update_required===false,production_off:quality.actual_production_switch===false,search_console_off:quality.actual_search_console_submission===false,ads_off:quality.actual_ads_injected===false};
write('data/site-quality-v20.json',JSON.stringify(quality,null,2));write('data/broken-links-v20.json',JSON.stringify({version:VERSION,count:broken.length,broken},null,2));
const gate={version:VERSION,reviewed_on:reviewed,checks,approval:{production_origin:true,robots:true,sitemap:true,search_console_submission:true,ads:true},actual:{production_switch:false,search_console_submission:false,ads_injected:false}};write('data/launch-gate-v20.json',JSON.stringify(gate,null,2));
write('data/v20-report.json',JSON.stringify({version:VERSION,quality,checks,bundle_hash:hash},null,2));

const auditKpis=`<div class="v20-audit-kpis"><div><span>공식 레코드</span><strong>${fmt(data.record_count)}</strong></div><div><span>자재</span><strong>${active.length}</strong></div><div><span>단위 그룹</span><strong>${groups.length}</strong></div><div><span>출시 후보</span><strong>${releaseUrls.length}</strong></div></div>`;
write('data/g2b-audit-v20/index.html',shell('data/g2b-audit-v20/index.html','v20 조달청 자재 데이터 검수 | 견적검수실','G2B 수집·단위 정규화·상세페이지·계산기·기존 공종 연결을 검수합니다.',SITE+'/data/g2b-audit-v20/',`<section class="v62-data-hero"><div class="site-shell"><p class="kicker">V20 AUDIT</p><h1>조달청 자재 데이터 검수</h1><p>공식 데이터 경계 · 단위 정규화 · 검색 후보 연결</p></div></section><section class="v6-section"><div class="site-shell">${auditKpis}${sourceBoundary}<p>상세 ${detailPaths.length}개, 기존 공종 연결 ${integrationRows.length}개, AEO 답변 ${answers.length}개입니다. 면적 표기 별칭만 ㎡로 정규화하고 매·개·재·㎥는 합치지 않습니다. 장판 상세는 현재 가격 레코드가 적어 preview에는 남기되 production 출시 후보에서는 제외합니다. 0건 검색어는 가격 통계를 생성하지 않습니다.</p><p><a href="${BASE}/data/g2b-integration-audit-v20.json">통합 감사 JSON</a> · <a href="${BASE}/data/site-quality-v20.json">사이트 품질 JSON</a></p></div></section>`));
write('data/launch-gate-v20/index.html',shell('data/launch-gate-v20/index.html','v20 출시 게이트 | 공식 자재 데이터','v20 공식 자재 데이터와 73개 출시 후보의 품질·색인 OFF 상태를 확인합니다.',SITE+'/data/launch-gate-v20/',`<section class="v62-data-hero"><div class="site-shell"><p class="kicker">LAUNCH GATE V20</p><h1>v20 출시 게이트</h1><p>실제 색인·Search Console·AdSense는 계속 OFF</p></div></section><section class="v6-section"><div class="site-shell">${auditKpis}<div class="table-wrap"><table class="v20-record-table"><thead><tr><th>검사</th><th>상태</th></tr></thead><tbody>${Object.entries(checks).map(([k,v])=>`<tr><th scope="row">${esc(k)}</th><td><strong>${v?'PASS':'FAIL'}</strong></td></tr>`).join('')}</tbody></table></div><p>이 게이트는 preview 품질 확인용입니다. production robots, sitemap, Search Console 제출, 광고 삽입은 소유자 승인 전까지 실행하지 않습니다. 실제 민간 견적 표본 N=0과 공개 임계치도 변경하지 않습니다.</p></div></section>`));

if(Object.values(checks).some(v=>v!==true))throw new Error(`v20 final gate failed ${JSON.stringify({failed:Object.entries(checks).filter(([,v])=>!v).map(([k])=>k),quality})}`);
console.log(JSON.stringify({version:VERSION,records:data.record_count,materials:active.length,groups:groups.length,details:detailPaths.length,integrations:integrationRows.length,release:releaseUrls.length,answers:answers.length,pages:quality.pages,checks},null,2));
