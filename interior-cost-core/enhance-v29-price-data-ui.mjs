import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const DATA=path.resolve('interior-cost-core/data');
const summary=JSON.parse(fs.readFileSync(path.join(DATA,'g2b-priceinfo-v29-summary.json'),'utf8'));
const interior=JSON.parse(fs.readFileSync(path.join(DATA,'g2b-priceinfo-v29-interior.json'),'utf8'));
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const write=(p,c)=>{const f=path.join(ROOT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const exists=p=>fs.existsSync(path.join(ROOT,p));
const fmt=n=>Number(n||0).toLocaleString('ko-KR');
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

if(summary.operation_count!==11||summary.total_raw_rows!==337984||summary.total_api_pages!==351)throw new Error('V29_FULL_API_SCOPE_MISMATCH');

const css=fs.readFileSync(path.resolve('interior-cost-core/site-v29-price-data.css'),'utf8');
write('assets/site-v29-price-data.css',css);
const cssLink=`<link rel="stylesheet" href="${BASE}/assets/site-v29-price-data.css?v=29">`;
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]});
for(const f of walk(ROOT).filter(f=>f.endsWith('.html'))){let h=fs.readFileSync(f,'utf8');if(!h.includes('site-v29-price-data.css'))h=h.replace('</head>',`${cssLink}</head>`);fs.writeFileSync(f,h)}

const overviewMap=new Map(interior.category_overview.map(x=>[x.category,x]));
const statRows=interior.category_stats;
const pageMap={
  bathroom:'bathroom',wallpaper:'wallpaper',floor:'floor',carpentry:'carpentry',insulation:'insulation',kitchen:'kitchen',window:'window',electrical:'electrical',demolition:'demolition',plumbing:'plumbing'
};
const sourcePriority={standard_market_unit:0,market_building:1,market_mechanical:1,materials_building:2,materials_mechanical:2,materials_electrical_it:2,materials_total:3,net_resource:4,materials_civil:5,market_civil:5};
const unitPriority={
  bathroom:['㎡','m2','M2','개소','개','m'],wallpaper:['㎡','m2','M2','롤','매'],floor:['㎡','m2','M2','평','매'],carpentry:['㎡','m2','M2','매','m','재'],insulation:['㎡','m2','M2','10㎡','m','롤'],kitchen:['m','개','㎡','m2','개소'],window:['㎡','m2','M2','m','M','개소'],electrical:['개','개소','m','M','기'],plumbing:['m','M','개','개소','㎡'],demolition:['㎡','m2','M2','m','㎥']
};
function pickStats(category){
  const units=unitPriority[category]||[];
  return statRows.filter(x=>x.category===category&&x.priced_count>=3).sort((a,b)=>{
    const ua=units.indexOf(a.unit),ub=units.indexOf(b.unit),u1=ua<0?99:ua,u2=ub<0?99:ub;
    if(u1!==u2)return u1-u2;
    const s1=sourcePriority[a.source_id]??99,s2=sourcePriority[b.source_id]??99;if(s1!==s2)return s1-s2;
    return b.priced_count-a.priced_count;
  }).slice(0,3);
}
function referenceSection(category){
  const ov=overviewMap.get(category); if(!ov)return '';
  const rows=pickStats(category);
  const cards=rows.length?rows.map(r=>`<article class="v29-ref-card"><span>${esc(r.source_label)} · ${esc(r.unit)}</span><strong>${fmt(r.median_price_krw)}원</strong><em>P25 ${fmt(r.p25_price_krw)}원 ~ P75 ${fmt(r.p75_price_krw)}원</em><small>가격 레코드 ${fmt(r.priced_count)}건 · 관련 ${fmt(r.record_count)}건</small></article>`).join(''):`<div class="v29-ref-empty">동일 단위 가격 레코드가 3건 미만이라 분포 통계를 표시하지 않습니다.</div>`;
  return `<section class="v29-trade-reference" data-v29-price-reference="${category}"><h2>공공 참고단가</h2><div class="v29-ref-grid">${cards}</div><p class="v29-price-source">관련 공개 데이터 ${fmt(ov.record_count)}건 · 가격 필드 ${fmt(ov.priced_count)}건</p><p class="v29-note">같은 공종 키워드와 단위로 묶은 조달청 공개자료의 분포입니다. 민간 아파트 전체 공사비 평균이나 적정 견적을 뜻하지 않습니다.</p><a class="v29-api-link" href="${BASE}/data/g2b-all/">전체 API 데이터 보기 →</a></section>`;
}

function setMeta(h,{title,description,route}){
  const url=`https://5ggul.github.io${BASE}${route}`;
  h=h.replace(/<title>[\s\S]*?<\/title>/,`<title>${esc(title)}</title>`);
  h=h.replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${esc(description)}">`);
  h=h.replace(/<meta property="og:title" content="[^"]*">/,`<meta property="og:title" content="${esc(title)}">`);
  h=h.replace(/<meta property="og:description" content="[^"]*">/,`<meta property="og:description" content="${esc(description)}">`);
  h=h.replace(/<meta property="og:url" content="[^"]*">/,`<meta property="og:url" content="${url}">`);
  h=h.replace(/<link rel="canonical" href="[^"]*">/,`<link rel="canonical" href="${url}">`);
  return h;
}
function setMain(p,body){let h=read(p);h=h.replace(/<main id="main-content">[\s\S]*?<\/main>/,`<main id="main-content">${body}</main>`);write(p,h)}
const hubTitle=title=>`<section class="v28-hub-title"><div class="site-shell"><h1>${title}</h1></div></section>`;
const hubCard=(href,title,meta='',kind='')=>`<a class="v28-hub-card"${kind?` data-kind="${kind}"`:''} href="${BASE}${href}"><strong>${title}</strong>${meta?`<span>${meta}</span>`:''}</a>`;

// Full API overview page.
{
  let h=read('data/index.html');
  h=setMeta(h,{title:'나라장터 인테리어 가격 데이터 | 견적검수실',description:'조달청 나라장터 가격정보현황서비스 11개 API의 337,984개 공개 레코드와 공종별 가격 분포를 확인합니다.',route:'/data/g2b-all/'});
  const operations=summary.operations.map(o=>`<div class="v29-operation"><span>${esc(o.label)}</span><strong>${fmt(o.record_count)}건</strong></div>`).join('');
  const routeFor={bathroom:'/cost/bathroom/',wallpaper:'/cost/wallpaper/',floor:'/cost/floor/',carpentry:'/cost/carpentry/',insulation:'/cost/insulation/',kitchen:'/cost/kitchen/',window:'/cost/window/',electrical:'/cost/electrical/',plumbing:'/cost/plumbing/',demolition:'/cost/demolition/'};
  const cats=interior.category_overview.map(c=>`<a class="v29-category" href="${BASE}${routeFor[c.category]||'/cost/'}"><strong>${esc(c.label)}</strong><b>${fmt(c.priced_count)}건</b><small>가격 레코드 · 관련 ${fmt(c.record_count)}건</small></a>`).join('');
  const std=summary.operations.find(x=>x.id==='standard_market_unit');
  const yrs=(std?.years||[]).filter(x=>x.year>=2024).map(x=>`<div class="v29-history-card"><strong>${x.year} 표준시장단가</strong><b>${fmt(x.record_count)}건</b></div>`).join('');
  const body=`${hubTitle('나라장터 가격정보')}<div class="site-shell v28-hub"><section class="v28-hub-section"><div class="v29-kpi"><div><span>전체 레코드</span><strong>${fmt(summary.total_raw_rows)}건</strong></div><div><span>API</span><strong>${summary.operation_count}개</strong></div><div><span>수집 페이지</span><strong>${fmt(summary.total_api_pages)}</strong></div></div><p class="v29-note">시설공통자재·시장시공가격·공종분류·순수자원·표준시장단가를 전 페이지 수집했습니다. 원본의 담당자명·전화번호·업체 연락처는 공개 화면에서 제외합니다.</p></section><section class="v28-hub-section"><h2>데이터셋</h2><div class="v29-operation-list">${operations}</div></section><section class="v28-hub-section"><h2>인테리어 관련 가격 레코드</h2><div class="v29-category-grid">${cats}</div></section><section class="v28-hub-section"><h2>최근 표준시장단가</h2><div class="v29-history">${yrs}</div></section><section class="v28-hub-section"><h2>사용 기준</h2><p class="v29-note">공공 자료의 자재·공정·단위별 가격은 견적 항목을 확인하는 참고자료입니다. 여러 서로 다른 항목을 합쳐 민간 인테리어 평균 공사비로 표시하지 않습니다.</p></section></div>`;
  h=h.replace(/<main id="main-content">[\s\S]*?<\/main>/,`<main id="main-content">${body}</main>`);
  write('data/g2b-all/index.html',h);
}

// Data hub: replace old partial-count cards with full API coverage.
{
  const op=id=>summary.operations.find(x=>x.id===id);
  const body=`${hubTitle('공식 자료')}<div class="site-shell v28-hub"><section class="v28-hub-section"><h2>나라장터 가격정보</h2><div class="v29-kpi"><div><span>전체 공개 레코드</span><strong>${fmt(summary.total_raw_rows)}건</strong></div><div><span>API</span><strong>${summary.operation_count}개</strong></div><div><span>수집 페이지</span><strong>${fmt(summary.total_api_pages)}</strong></div></div><div class="v28-hub-grid">${hubCard('/data/g2b-all/','전체 가격 데이터',`${fmt(summary.total_raw_rows)}건 · 11개 API`,'primary')}${hubCard('/data/g2b-materials/','건축자재',`${fmt(op('materials_building').record_count)}건`)}${hubCard('/data/g2b-market-construction/','건축 시장시공가격',`${fmt(op('market_building').record_count)}건`)}${hubCard('/data/g2b-standard-market-unit/','표준시장단가',`${fmt(op('standard_market_unit').record_count)}건 · 2010~2026`)}${hubCard('/data/g2b-all/','기계설비 자재',`${fmt(op('materials_mechanical').record_count)}건`)}${hubCard('/data/g2b-all/','전기·정보통신 자재',`${fmt(op('materials_electrical_it').record_count)}건`)}${hubCard('/data/g2b-all/','순수자원',`${fmt(op('net_resource').record_count)}건`)}${hubCard('/data/g2b-all/','공종분류',`${fmt(op('construction_classification').record_count)}건`)}</div></section><section class="v28-hub-section"><h2>공식 지표</h2><div class="v28-hub-grid">${hubCard('/data/cost-index/','건설공사비지수','월별 지수 · 한국건설기술연구원')}${hubCard('/data/construction-wage/','건설업 임금','132개 직종 일평균임금')}${hubCard('/data/public-unit-cost/','공공 공종 단가','표준시장단가 · 적용조건')}</div></section><section class="v28-hub-section"><h2>기준</h2><div class="v28-hub-grid">${hubCard('/data/sources/','출처','기관 · 게시일 · 원문')}${hubCard('/data/methodology/','산출 기준','단위 · 포함범위 · 계산 규칙')}${hubCard('/data/changelog/','변경이력','데이터 갱신 기록')}</div></section></div>`;
  setMain('data/index.html',body);
}

// Cost hub gets coverage counts and a new plumbing route.
{
  const meta=id=>{const x=overviewMap.get(id);return x?`공공 가격 ${fmt(x.priced_count)}건`:''};
  const body=`${hubTitle('공사별 인테리어 비용')}<div class="site-shell v28-hub"><section class="v28-hub-section"><div class="v28-hub-grid">${hubCard('/cost/bathroom/','욕실',meta('bathroom'),'primary')}${hubCard('/cost/kitchen/','주방',meta('kitchen'))}${hubCard('/cost/window/','샷시·창호',meta('window'))}${hubCard('/cost/wallpaper/','도배',meta('wallpaper'))}${hubCard('/cost/floor/','바닥',meta('floor'))}${hubCard('/cost/carpentry/','목공',meta('carpentry'))}${hubCard('/cost/insulation/','단열',meta('insulation'))}${hubCard('/cost/electrical/','전기·조명',meta('electrical'))}${hubCard('/cost/plumbing/','배관·설비',meta('plumbing'))}${hubCard('/cost/demolition/','철거·폐기물',meta('demolition'))}</div></section><section class="v28-hub-section"><h2>공식 자료</h2><div class="v28-hub-grid v28-hub-grid-2">${hubCard('/data/g2b-all/','나라장터 가격정보',`${fmt(summary.total_raw_rows)}건`)}${hubCard('/data/public-unit-cost/','공공 공종 단가','2026 하반기 표준시장단가')}</div></section></div>`;
  setMain('cost/index.html',body);
}

// Add the missing high-value plumbing page using the existing simple service shell.
if(!exists('cost/plumbing/index.html')){
  let h=read('cost/electrical/index.html');
  h=setMeta(h,{title:'배관·설비 비용 | 급수·배수·위생 배관 단가 | 견적검수실',description:'급수·배수·위생 배관과 밸브·수전 연결·배관 이동 견적의 공공 참고단가와 비교 조건을 확인합니다.',route:'/cost/plumbing/'});
  const body=`<section class="article-hero"><div class="article-shell"><nav class="breadcrumbs" aria-label="현재 위치"><a href="${BASE}/">홈</a><span aria-hidden="true">/</span><a href="${BASE}/cost/">공사별 비용</a><span aria-hidden="true">/</span><span aria-current="page">배관·설비</span></nav><h1>배관·설비 비용</h1></div></section><div class="article-layout"><article class="article-body">${referenceSection('plumbing')}<section class="content-section"><h2>견적 항목</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>항목</th><th>확인 내용</th></tr></thead><tbody><tr><th>급수</th><td>관경 · 재질 · 길이 · 매립 여부</td></tr><tr><th>배수</th><td>관경 · 구배 · 연결 위치</td></tr><tr><th>밸브·수전</th><td>수량 · 제품 포함 여부</td></tr><tr><th>배관 이동</th><td>이동 거리 · 벽·바닥 철거 범위</td></tr><tr><th>보온</th><td>단열재 종류 · 두께</td></tr><tr><th>복구</th><td>미장 · 방수 · 타일 · 마감 포함 여부</td></tr></tbody></table></div></section><section class="content-section"><h2>비교 조건</h2><p>같은 길이라도 관경·재질·매립 방식·철거와 마감 복구 범위가 다르면 단가를 바로 비교하지 않습니다.</p></section><section class="content-section source-note"><h2>데이터 기준</h2><p>조달청 시설공통자재·시장시공가격·표준시장단가의 배관·급수·배수·위생 관련 공개 항목을 참고합니다.</p><a href="${BASE}/data/g2b-all/">전체 가격 데이터</a></section></article><aside class="side-rail"><strong>같이 확인</strong><a href="${BASE}/quote-check/">견적 확인</a><a href="${BASE}/quote-compare/">견적 비교</a><a href="${BASE}/cost/bathroom/">욕실</a></aside></div>`;
  h=h.replace(/<main id="main-content">[\s\S]*?<\/main>/,`<main id="main-content">${body}</main>`);
  write('cost/plumbing/index.html',h);
}

// Existing trade pages: add the v29 public reference section at the first useful position.
for(const [slug,category] of Object.entries(pageMap)){
  const p=`cost/${slug}/index.html`; if(!exists(p))continue;
  let h=read(p);
  if(!h.includes(`data-v29-price-reference="${category}"`))h=h.replace('<article class="article-body">',`<article class="article-body">${referenceSection(category)}`);
  write(p,h);
}

// Home stays simple; only expand literal trade navigation and expose the full official dataset.
{
  let h=read('index.html');
  if(h.includes('class="v28-home"')){
    h=h.replace(/<h2>공사별 비용<\/h2><div class="v28-link-row">[\s\S]*?<\/div><h2>공식 자료<\/h2>/,`<h2>공사별 비용</h2><div class="v28-link-row"><a href="${BASE}/cost/bathroom/">욕실</a><a href="${BASE}/cost/wallpaper/">도배</a><a href="${BASE}/cost/floor/">바닥</a><a href="${BASE}/cost/carpentry/">목공</a><a href="${BASE}/cost/insulation/">단열</a><a href="${BASE}/cost/kitchen/">주방</a><a href="${BASE}/cost/window/">샷시</a><a href="${BASE}/cost/electrical/">전기</a><a href="${BASE}/cost/plumbing/">배관</a><a href="${BASE}/cost/demolition/">철거</a></div><h2>공식 자료</h2>`);
    h=h.replace(/<div class="v28-data-links">[\s\S]*?<\/div>/,`<div class="v28-data-links"><a href="${BASE}/data/g2b-all/">나라장터 가격정보<small>${fmt(summary.total_raw_rows)}건</small></a><a href="${BASE}/data/cost-index/">건설공사비지수<small>월별 지수</small></a><a href="${BASE}/data/public-unit-cost/">공공 공종 단가<small>표준시장단가</small></a></div>`);
  }
  write('index.html',h);
}

write('data/v29-price-data-ui.json',JSON.stringify({version:'29.0.0',operation_count:summary.operation_count,total_raw_rows:summary.total_raw_rows,total_api_pages:summary.total_api_pages,trade_pages:Object.keys(pageMap),plumbing_page:true,full_data_page:true,private_market_average_fabricated:false,preview_noindex_preserved:true},null,2));
console.log(JSON.stringify({version:'29.0.0',full_api_rows:summary.total_raw_rows,full_api_pages:summary.total_api_pages,trade_pages:Object.keys(pageMap).length,plumbing:true},null,2));
