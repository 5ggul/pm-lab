import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const write=(p,c)=>{const f=path.join(ROOT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const exists=p=>fs.existsSync(path.join(ROOT,p));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]});

const css=fs.readFileSync(path.resolve('interior-cost-core/site-v28-refine.css'),'utf8');
write('assets/site-v28-refine.css',css);
const cssLink=`<link rel="stylesheet" href="${BASE}/assets/site-v28-refine.css?v=28.1">`;
const simpleFooter=`<footer class="site-footer v28-simple-footer"><div class="site-shell"><strong>견적검수실</strong><nav aria-label="사이트 안내"><a href="${BASE}/about/">소개</a><a href="${BASE}/data/">공식 자료</a><a href="${BASE}/data/sources/">출처</a><a href="${BASE}/privacy/">개인정보</a><a href="${BASE}/corrections/">정정 요청</a></nav></div></footer>`;

for(const f of walk(ROOT).filter(f=>f.endsWith('.html'))){
  const p=path.relative(ROOT,f).split(path.sep).join('/');
  let h=read(p);
  if(!h.includes('site-v28-refine.css'))h=h.replace('</head>',`${cssLink}</head>`);
  h=h.replace(/<footer class="site-footer">[\s\S]*?<\/footer>/,simpleFooter);
  h=h.replace(/<h2>데이터와 한계<\/h2>/g,'<h2>데이터 기준</h2>');
  write(p,h);
}

const hubTitle=(title)=>`<section class="v28-hub-title"><div class="site-shell"><h1>${title}</h1></div></section>`;
const card=(href,title,meta='',kind='')=>`<a class="v28-hub-card"${kind?` data-kind="${kind}"`:''} href="${BASE}${href}"><strong>${title}</strong>${meta?`<span>${meta}</span>`:''}</a>`;
const setMain=(p,body)=>{let h=read(p);h=h.replace(/<main id="main-content">[\s\S]*?<\/main>/,`<main id="main-content">${body}</main>`);write(p,h)};

// Home: keep only the literal service catalog. All legacy charts/status/SEO blocks live on their own pages.
if(exists('index.html')){
  let h=read('index.html');
  const m=h.match(/<section class="v28-home">[\s\S]*?<\/section>/);
  if(m)h=h.replace(/<main id="main-content">[\s\S]*?<\/main>/,`<main id="main-content">${m[0]}</main>`);
  write('index.html',h);
}

// Pyeong hub: direct, card-based navigation instead of explanatory prose/table.
setMain('interior-cost/index.html',`${hubTitle('평수별 인테리어 비용')}<div class="site-shell v28-hub"><section class="v28-hub-section"><div class="v28-hub-grid">${card('/interior-cost/24-pyeong/','24평','욕실 · 주방 · 샷시 · 폐기물','primary')}${card('/interior-cost/30-pyeong/','30평','욕실 · 샷시 · 주방 · 철거')}${card('/interior-cost/32-pyeong/','32평','욕실 2개 · 샷시 · 주방 · 철거')}${card('/interior-cost/34-pyeong/','34평','방·욕실 구성 · 수납 · 창호 · 주방')}${card('/interior-cost/40-pyeong/','40평','목공 · 수납 · 욕실 · 창호 · 마감')}</div></section><section class="v28-hub-section"><h2>견적 도구</h2><div class="v28-hub-grid v28-hub-grid-2">${card('/quote-check/','견적 확인','누락 · 별도 비용')}${card('/quote-compare/','견적 비교','업체 2~3곳')}</div></section></div>`);

// Trade hub: service-category cards, no AI-style explanatory sentences.
setMain('cost/index.html',`${hubTitle('공사별 인테리어 비용')}<div class="site-shell v28-hub"><section class="v28-hub-section"><div class="v28-hub-grid">${card('/cost/bathroom/','욕실','철거 · 폐기물 · 방수 · 타일','primary')}${card('/cost/kitchen/','주방','가구 · 상판 · 배관 · 전기')}${card('/cost/window/','샷시·창호','창 개수 · 유리 · 철거 · 양중')}${card('/cost/wallpaper/','도배','면적 · 벽지 · 철거 · 바탕면')}${card('/cost/floor/','바닥','면적 · 철거 · 자재 · 마감')}${card('/cost/carpentry/','목공','천장 · 가벽 · 몰딩 · 문틀')}${card('/cost/insulation/','단열','단열재 · 두께 · 면적 · 기밀')}${card('/cost/electrical/','전기·조명','회로 · 콘센트 · 분전반')}${card('/cost/demolition/','철거·폐기물','범위 · 반출 · 장비 · 처리')}</div></section><section class="v28-hub-section"><h2>공식 자료</h2><div class="v28-hub-grid v28-hub-grid-2">${card('/data/public-unit-cost/','공공 공종 단가','2026 하반기 표준시장단가')}${card('/data/g2b-materials/','조달청 자재 가격','시설공통자재')}</div></section></div>`);

// Data hub: only public data surfaces, no operational snapshots or N=0/status consoles.
setMain('data/index.html',`${hubTitle('공식 자료')}<div class="site-shell v28-hub"><section class="v28-hub-section"><h2>지표</h2><div class="v28-hub-grid">${card('/data/cost-index/','건설공사비지수','월별 지수 · 한국건설기술연구원','primary')}${card('/data/construction-wage/','건설업 임금','132개 직종 일평균임금')}${card('/data/public-unit-cost/','공공 공종 단가','표준시장단가 · 타일·방수·도배·목공')}</div></section><section class="v28-hub-section"><h2>조달청</h2><div class="v28-hub-grid">${card('/data/g2b-materials/','건축자재 가격','시설공통자재 1,561건')}${card('/data/g2b-market-construction/','시장시공가격','건축 공종 1,928건')}${card('/data/g2b-standard-market-unit/','건축 표준시장단가','건축공사 1,910건')}</div></section><section class="v28-hub-section"><h2>기준</h2><div class="v28-hub-grid">${card('/data/sources/','출처','기관 · 게시일 · 원문')}${card('/data/methodology/','산출 기준','단위 · 포함범위 · 계산 규칙')}${card('/data/changelog/','변경이력','데이터 갱신 기록')}</div></section></div>`);

// Guide hub: literal guide titles only.
setMain('guides/index.html',`${hubTitle('견적 보는 법')}<div class="site-shell v28-hub"><section class="v28-hub-section"><div class="v28-hub-grid">${card('/guides/quote-reading/','견적서 읽기','항목 · 수량 · 단위 · 사양','primary')}${card('/guides/missing-items/','누락 항목','철거 · 폐기물 · VAT · 관리비')}${card('/guides/missing-spec/','사양 미기재','자재 · 규격 · 범위')}${card('/guides/contract-cost-types/','계약 비용 항목','포함 · 별도 · 추가 비용')}${card('/guides/change-order/','추가·변경 공사','변경 범위 · 금액 기록')}${card('/guides/bathroom-one-set/','욕실 1식','철거 · 방수 · 타일 · 도기')}${card('/guides/kitchen-check/','주방 견적','가구 · 상판 · 배관 · 전기')}${card('/guides/partial-vs-full/','부분·전체 공사','공사 범위 비교')}${card('/guides/old-apartment/','구축 아파트','철거 · 배관 · 전기 · 샷시')}${card('/guides/24-vs-32/','24평·32평','평수별 조건 차이')}${card('/guides/quote-32-match/','32평 견적 비교','포함조건 맞추기')}</div></section></div>`);

// Detail headings: literal nouns instead of question/slogan-style headings.
for(const n of [24,30,32,34,40]){
  const p=`interior-cost/${n}-pyeong/index.html`; if(!exists(p))continue;
  let h=read(p);
  h=h.replace(/<h1>[^<]*<\/h1>/,`<h1>${n}평 인테리어 비용</h1>`);
  h=h.replace(new RegExp(`<h2>${n}평 전체 인테리어에서 무엇이 비용을 바꾸나\\?<\\/h2>`),`<h2>${n}평 주요 조건</h2>`);
  h=h.replace(/<h2>총액을 비교하기 전에<\/h2>/,'<h2>공통 확인 항목</h2>');
  h=h.replace(/<h2>실제 표본 통계<\/h2>/,'<h2>실제 견적 통계</h2>');
  write(p,h);
}
for(const name of ['bathroom','kitchen','window','wallpaper','floor','demolition','electrical','carpentry','insulation']){
  const p=`cost/${name}/index.html`; if(!exists(p))continue;
  let h=read(p);
  h=h.replace(/<h2>[^<]*견적서에서 확인할 항목<\/h2>/,'<h2>견적 항목</h2>');
  h=h.replace(/<h2>바로 비교하면 안 되는 경우<\/h2>/,'<h2>비교 조건</h2>');
  h=h.replace(/<h2>데이터와 한계<\/h2>/g,'<h2>데이터 기준</h2>');
  write(p,h);
}

write('data/v28-refine.json',JSON.stringify({version:'28.1.0',home_legacy_sections_removed:true,pyeong_hub_cards:true,trade_hub_cards:true,data_hub_public_only:true,guides_hub_cards:true,simple_footer:true,literal_detail_headings:true,preview_noindex_preserved:true},null,2));
console.log(JSON.stringify({version:'28.1.0',home_compact:true,hubs_rebuilt:true,footer_compact:true},null,2));
