import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const DATA=path.resolve('interior-cost-core/data');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const write=(p,c)=>{const f=path.join(ROOT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const exists=p=>fs.existsSync(path.join(ROOT,p));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]});
const fmt=n=>Number(n||0).toLocaleString('ko-KR');

const summary=JSON.parse(fs.readFileSync(path.join(DATA,'g2b-priceinfo-v29-summary.json'),'utf8'));
const interior=JSON.parse(fs.readFileSync(path.join(DATA,'g2b-priceinfo-v29-interior.json'),'utf8'));
if(summary.operation_count!==11||summary.total_raw_rows!==337984)throw new Error('V30_REQUIRES_V29_FULL_DATA');
const cat=new Map(interior.category_overview.map(x=>[x.category,x]));

const css=fs.readFileSync(path.resolve('interior-cost-core/site-v30-hyper.css'),'utf8');
write('assets/site-v30-hyper.css',css);
const cssLink=`<link rel="stylesheet" href="${BASE}/assets/site-v30-hyper.css?v=30">`;

const eyebrowFor=p=>{
  if(p==='index.html')return 'INTERIOR / QUOTE DATA';
  if(p.startsWith('quote-check/'))return '도구 / 견적 확인';
  if(p.startsWith('quote-compare/'))return '도구 / 견적 비교';
  if(p.startsWith('calculator/'))return '도구 / 비용 계산';
  if(p.startsWith('compare/quote-lines/'))return '도구 / 견적 불러오기';
  if(p.startsWith('interior-cost/'))return '평수별 비용';
  if(p.startsWith('cost/'))return '공사별 비용';
  if(p.startsWith('data/'))return '공식 자료';
  if(p.startsWith('guides/'))return '견적 가이드';
  return '견적검수실';
};

for(const f of walk(ROOT).filter(f=>f.endsWith('.html'))){
  const p=path.relative(ROOT,f).split(path.sep).join('/');
  let h=read(p);
  if(!h.includes('site-v30-hyper.css'))h=h.replace('</head>',`${cssLink}</head>`);
  h=h.replace(/<body class="([^"]*)"/,(_,c)=>`<body class="${c.includes('v30-hyper')?c:`${c} v30-hyper`.trim()}"`);
  if(!h.includes('v30-eyebrow')){
    const eye=`<span class="v30-eyebrow">${eyebrowFor(p)}</span>`;
    h=h.replace(/(<section class="(?:article-hero|tool-hero)"[\s\S]*?<div class="(?:article-shell|site-shell)">)(?![\s\S]*?v30-eyebrow)/,'$1'+eye);
    h=h.replace(/(<section class="v28-hub-title"><div class="site-shell">)(?![\s\S]*?v30-eyebrow)/,'$1'+eye);
  }
  write(p,h);
}

const service=(n,href,title,meta)=>`<a href="${BASE}${href}"><b>${n}</b><strong>${title}</strong><em>${meta}</em></a>`;
const dataCard=(href,label,count,meta='공개 참고자료')=>`<a href="${BASE}${href}"><span>${label}</span><strong>${fmt(count)}건</strong><b>${meta}</b></a>`;

// Home: functional labels only. No marketing slogan paragraph.
{
  let h=read('index.html');
  const home=`<section class="v30-hero"><div class="site-shell"><div class="v30-status"><i></i><span>공공 데이터 연결 · ${fmt(summary.total_raw_rows)} 레코드</span></div><div class="v30-hero-grid"><div><h1>인테리어 견적<br><span>비용 데이터</span></h1><div class="v30-actions"><a href="${BASE}/quote-check/">견적 확인</a><a href="${BASE}/quote-compare/">견적 비교</a><a href="${BASE}/calculator/">비용 계산</a></div></div><div class="v30-hero-stats"><div class="v30-hero-stat"><span>PRICE RECORDS</span><strong>${fmt(summary.total_raw_rows)}</strong></div><div class="v30-hero-stat"><span>API</span><strong>${summary.operation_count}</strong></div><div class="v30-hero-stat"><span>PAGES</span><strong>${fmt(summary.total_api_pages)}</strong></div></div></div><div class="v30-blueprint" aria-hidden="true"></div></div></section>`+
  `<section class="v30-home-section"><div class="site-shell"><div class="v30-section-head"><span>01</span><h2>견적 도구</h2></div><div class="v30-service-list">${service('01','/quote-check/','견적 확인','누락 · 별도 비용')}${service('02','/quote-compare/','견적 비교','업체 2~3곳')}${service('03','/calculator/','비용 계산','공종별 입력')}${service('04','/compare/quote-lines/','견적 불러오기','CSV · TXT')}</div></div></section>`+
  `<section class="v30-home-section"><div class="site-shell"><div class="v30-section-head"><span>02</span><h2>공사별 데이터</h2></div><div class="v30-data-grid">${dataCard('/cost/bathroom/','욕실',cat.get('bathroom')?.record_count)}${dataCard('/cost/wallpaper/','도배',cat.get('wallpaper')?.record_count)}${dataCard('/cost/floor/','바닥',cat.get('floor')?.record_count)}${dataCard('/cost/carpentry/','목공',cat.get('carpentry')?.record_count)}${dataCard('/cost/insulation/','단열',cat.get('insulation')?.record_count)}${dataCard('/cost/window/','창호',cat.get('window')?.record_count)}${dataCard('/cost/electrical/','전기·조명',cat.get('electrical')?.record_count)}${dataCard('/cost/plumbing/','배관·설비',cat.get('plumbing')?.record_count)}</div></div></section>`+
  `<section class="v30-home-section"><div class="site-shell"><div class="v30-section-head"><span>03</span><h2>공식 데이터</h2></div><div class="v30-source-row"><a class="v30-source-main" href="${BASE}/data/g2b-all/"><span>나라장터 가격정보 전체</span><strong>${fmt(summary.total_raw_rows)}</strong><span>${summary.operation_count} API · ${fmt(summary.total_api_pages)} pages</span></a><div class="v30-source-side"><a href="${BASE}/data/g2b-standard-market-unit/"><span>STANDARD UNIT</span><strong>표준시장단가</strong></a><a href="${BASE}/data/g2b-all/"><span>RESOURCE</span><strong>순수자원</strong></a><a href="${BASE}/data/g2b-all/"><span>CLASS</span><strong>공종분류</strong></a><a href="${BASE}/data/cost-index/"><span>INDEX</span><strong>건설공사비지수</strong></a></div></div></div></section>`+
  `<section class="v30-home-section"><div class="site-shell"><div class="v30-section-head"><span>04</span><h2>평수별 비용</h2></div><div class="v30-service-list">${service('24','/interior-cost/24-pyeong/','24평','욕실 · 주방 · 창호')}${service('30','/interior-cost/30-pyeong/','30평','철거 · 주방 · 창호')}${service('32','/interior-cost/32-pyeong/','32평','욕실 2개 · 주방 · 창호')}${service('34','/interior-cost/34-pyeong/','34평','수납 · 창호 · 주방')}${service('40','/interior-cost/40-pyeong/','40평','목공 · 욕실 · 창호')}</div></div></section>`;
  h=h.replace(/<main id="main-content">[\s\S]*?<\/main>/,`<main id="main-content">${home}</main>`);
  h=h.replace(/<body class="([^"]*)"/,(_,c)=>`<body class="${c.includes('v30-home')?c:`${c} v30-home`.trim()}"`);
  write('index.html',h);
}

// Pyeong hub: editorial numbered list.
if(exists('interior-cost/index.html')){
  let h=read('interior-cost/index.html');
  const body=`<section class="v28-hub-title"><div class="site-shell"><span class="v30-eyebrow">평수별 비용</span><h1>평수별 인테리어 비용</h1></div></section><section class="v30-home-section"><div class="site-shell"><div class="v30-service-list">${service('24','/interior-cost/24-pyeong/','24평','욕실 · 주방 · 창호 · 폐기물')}${service('30','/interior-cost/30-pyeong/','30평','욕실 · 창호 · 주방 · 철거')}${service('32','/interior-cost/32-pyeong/','32평','욕실 2개 · 창호 · 주방 · 철거')}${service('34','/interior-cost/34-pyeong/','34평','방 · 욕실 · 수납 · 창호')}${service('40','/interior-cost/40-pyeong/','40평','목공 · 수납 · 욕실 · 마감')}</div></div></section>`;
  h=h.replace(/<main id="main-content">[\s\S]*?<\/main>/,`<main id="main-content">${body}</main>`);
  write('interior-cost/index.html',h);
}

// Cost hub: full category coverage + v29 record counts.
if(exists('cost/index.html')){
  let h=read('cost/index.html');
  const cards=[['bathroom','욕실'],['kitchen','주방'],['window','창호'],['wallpaper','도배'],['floor','바닥'],['carpentry','목공'],['insulation','단열'],['electrical','전기·조명'],['plumbing','배관·설비'],['demolition','철거']].map(([k,l])=>dataCard(`/cost/${k}/`,l,cat.get(k)?.record_count,'공공 참고 레코드')).join('');
  const body=`<section class="v28-hub-title"><div class="site-shell"><span class="v30-eyebrow">공사별 비용</span><h1>공사별 인테리어 비용</h1></div></section><div class="site-shell v28-hub"><section class="v28-hub-section"><h2>공종</h2><div class="v30-data-grid">${cards}</div></section><section class="v28-hub-section"><h2>공식 자료</h2><div class="v30-service-list">${service('01','/data/g2b-all/','나라장터 가격정보',`${fmt(summary.total_raw_rows)}건`)}${service('02','/data/public-unit-cost/','공공 공종 단가','표준시장단가 · 적용조건')}${service('03','/data/construction-wage/','건설업 임금','132개 직종')}</div></section></div>`;
  h=h.replace(/<main id="main-content">[\s\S]*?<\/main>/,`<main id="main-content">${body}</main>`);
  write('cost/index.html',h);
}

// Official data hub: one dominant number + skeletal links.
if(exists('data/index.html')){
  let h=read('data/index.html');
  const body=`<section class="v28-hub-title"><div class="site-shell"><span class="v30-eyebrow">공식 자료</span><h1>데이터</h1></div></section><div class="site-shell v28-hub"><section class="v28-hub-section"><div class="v30-source-row"><a class="v30-source-main" href="${BASE}/data/g2b-all/"><span>나라장터 가격정보</span><strong>${fmt(summary.total_raw_rows)}</strong><span>${summary.operation_count} API · ${fmt(summary.total_api_pages)} pages</span></a><div class="v30-source-side"><a href="${BASE}/data/g2b-materials/"><span>MATERIAL</span><strong>건축자재</strong></a><a href="${BASE}/data/g2b-standard-market-unit/"><span>UNIT COST</span><strong>표준시장단가</strong></a><a href="${BASE}/data/cost-index/"><span>INDEX</span><strong>공사비지수</strong></a><a href="${BASE}/data/construction-wage/"><span>WAGE</span><strong>건설업 임금</strong></a></div></div></section><section class="v28-hub-section"><h2>기준</h2><div class="v30-service-list">${service('01','/data/sources/','출처','기관 · 게시일 · 원문')}${service('02','/data/methodology/','산출 기준','단위 · 포함범위 · 계산 규칙')}${service('03','/data/changelog/','변경이력','데이터 갱신 기록')}</div></section></div>`;
  h=h.replace(/<main id="main-content">[\s\S]*?<\/main>/,`<main id="main-content">${body}</main>`);
  write('data/index.html',h);
}

// Guide hub: editorial list instead of cards.
if(exists('guides/index.html')){
  let h=read('guides/index.html');
  const body=`<section class="v28-hub-title"><div class="site-shell"><span class="v30-eyebrow">견적 가이드</span><h1>견적 보는 법</h1></div></section><section class="v30-home-section"><div class="site-shell"><div class="v30-service-list">${service('01','/guides/quote-reading/','견적서 읽기','항목 · 수량 · 단위 · 사양')}${service('02','/guides/missing-items/','누락 항목','철거 · 폐기물 · VAT')}${service('03','/guides/missing-spec/','사양 미기재','자재 · 규격 · 범위')}${service('04','/guides/contract-cost-types/','계약 비용 항목','포함 · 별도 · 추가')}${service('05','/guides/change-order/','추가·변경 공사','변경 범위 · 금액 기록')}${service('06','/guides/old-apartment/','구축 아파트','철거 · 배관 · 전기 · 창호')}</div></div></section>`;
  h=h.replace(/<main id="main-content">[\s\S]*?<\/main>/,`<main id="main-content">${body}</main>`);
  write('guides/index.html',h);
}

write('data/v30-hyper-editorial.json',JSON.stringify({version:'30.0.0',benchmark:'hyperstudio.org visual principles',copied_assets:false,copied_copy:false,dark_editorial:true,display_type:true,hairline_grid:true,shadows:false,home_marketing_copy:false,full_api_rows:summary.total_raw_rows,preview_noindex_preserved:true,production_switch:false},null,2));
console.log(JSON.stringify({version:'30.0.0',home_rebuilt:true,hubs_rebuilt:true,full_api_rows:summary.total_raw_rows,html:walk(ROOT).filter(f=>f.endsWith('.html')).length},null,2));
