import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const write=(p,c)=>{const f=path.join(ROOT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const exists=p=>fs.existsSync(path.join(ROOT,p));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{const full=path.join(dir,ent.name);return ent.isDirectory()?walk(full):[full]});

const css=fs.readFileSync(path.resolve('interior-cost-core/site-v27-senior.css'),'utf8');
const js=fs.readFileSync(path.resolve('interior-cost-core/site-v27-senior.js'),'utf8');
write('assets/site-v27-senior.css',css);
write('assets/site-v27-senior.js',js);
const cssLink=`<link rel="stylesheet" href="${BASE}/assets/site-v27-senior.css?v=27">`;
const jsLink=`<script src="${BASE}/assets/site-v27-senior.js?v=27" defer></script>`;

const desktopNav=`<nav class="desktop-nav v27-desktop-nav" aria-label="주요 메뉴"><a href="${BASE}/quote-check/">견적 확인</a><a href="${BASE}/quote-compare/">견적 비교</a><a href="${BASE}/interior-cost/">평수별 비용</a><details class="v27-more"><summary>더보기</summary><div><a href="${BASE}/calculator/">비용 계산기</a><a href="${BASE}/cost/">공사별 비용</a><a href="${BASE}/guides/">견적 보는 법</a><a href="${BASE}/data/">공식 자료</a><a href="${BASE}/search/">검색</a></div></details></nav>`;
const mobileNav=`<div id="mobile-drawer" class="mobile-drawer" data-mobile-drawer hidden><a href="${BASE}/quote-check/">견적 확인</a><a href="${BASE}/quote-compare/">견적 비교</a><a href="${BASE}/interior-cost/">평수별 비용</a><a href="${BASE}/calculator/">비용 계산기</a><a href="${BASE}/cost/">공사별 비용</a><a href="${BASE}/guides/">견적 보는 법</a><a href="${BASE}/data/">공식 자료</a><a href="${BASE}/search/">검색</a></div>`;

for(const f of walk(ROOT).filter(f=>f.endsWith('.html'))){
  const p=path.relative(ROOT,f).split(path.sep).join('/');
  let h=read(p);
  if(!h.includes('site-v27-senior.css'))h=h.replace('</head>',`${cssLink}${jsLink}</head>`);
  h=h.replace(/<body class="([^"]*)"/,(_,c)=>`<body class="${c.includes('v27-senior')?c:`${c} v27-senior`.trim()}"`);
  h=h.replace(/<nav class="desktop-nav" aria-label="주요 메뉴">[\s\S]*?<\/nav><form class="header-search"[\s\S]*?<\/form>/,desktopNav);
  h=h.replace(/<div id="mobile-drawer" class="mobile-drawer" data-mobile-drawer hidden>[\s\S]*?<\/div><\/header>/,`${mobileNav}</header>`);
  write(p,h);
}

if(exists('index.html')){
  let h=read('index.html');
  const hero=`<section class="v27-home-hero"><div class="site-shell"><h1>받은 인테리어 견적서, 빠진 비용부터 확인하세요</h1><p>VAT·폐기물·창호·공사 범위를 확인하고 여러 업체 견적을 같은 기준으로 비교할 수 있습니다.</p><div class="v27-home-actions"><a class="v27-main-action" href="${BASE}/quote-check/">내 견적서 확인하기</a><a href="${BASE}/quote-compare/">견적 비교하기</a><a href="${BASE}/interior-cost/">우리 집 비용 알아보기</a></div></div></section>`;
  h=h.replace(/<section class="v26-home-hero">[\s\S]*?<\/section>/,hero);
  const browse=`<section class="v27-quick-browse"><div class="site-shell"><h2>어떤 정보가 필요하세요?</h2><div class="v27-browse-row"><strong>평수별</strong><nav><a href="${BASE}/interior-cost/24-pyeong/">24평</a><a href="${BASE}/interior-cost/30-pyeong/">30평</a><a href="${BASE}/interior-cost/32-pyeong/">32평</a><a href="${BASE}/interior-cost/34-pyeong/">34평</a><a href="${BASE}/interior-cost/40-pyeong/">40평</a></nav></div><div class="v27-browse-row"><strong>공사별</strong><nav><a href="${BASE}/cost/bathroom/">욕실</a><a href="${BASE}/cost/wallpaper/">도배</a><a href="${BASE}/cost/floor/">바닥</a><a href="${BASE}/cost/carpentry/">목공</a><a href="${BASE}/cost/insulation/">단열</a></nav></div><a class="v27-official-link" href="${BASE}/data/">공식·공공 자료 확인하기 →</a></div></section>`;
  h=h.replace(/(<\/section>)(<section class="v6-section">)/,`$1${browse}$2`);
  h=h.replace(/<title>[\s\S]*?<\/title>/i,'<title>인테리어 견적서 확인·비교 | 견적검수실</title>');
  h=h.replace(/<meta name="description" content="[^"]*">/i,'<meta name="description" content="받은 인테리어 견적서에서 VAT·폐기물·창호·공사범위 누락을 확인하고 여러 업체 견적을 같은 기준으로 비교합니다.">');
  h=h.replace(/<meta property="og:title" content="[^"]*">/i,'<meta property="og:title" content="인테리어 견적서 확인·비교 | 견적검수실">');
  h=h.replace(/<meta property="og:description" content="[^"]*">/i,'<meta property="og:description" content="받은 인테리어 견적서에서 VAT·폐기물·창호·공사범위 누락을 확인하고 여러 업체 견적을 같은 기준으로 비교합니다.">');
  write('index.html',h);
}

if(exists('quote-check/index.html')){
  let h=read('quote-check/index.html');
  h=h.replace('<h1>인테리어 견적서 검사</h1><p class="lead">12개 공종 · 포함 / 별도 / 미기재 · 수량 / 사양</p><div class="page-meta"><span>서버 전송 없음</span><span>브라우저 저장</span><span>최종 검수 2026-09-12</span></div>','<h1>견적서 확인</h1><p class="lead">견적서를 보면서 빠진 항목과 별도 비용만 먼저 확인해 주세요.</p><p class="v27-privacy-note">입력 내용은 이 브라우저에서만 처리됩니다.</p>');
  h=h.replace(/<div class="v26-tool-shortcut">[\s\S]*?<\/div>/,'');
  h=h.replace(/<fieldset class="context-grid">([\s\S]*?)<\/fieldset>/,'<details class="v27-context-details"><summary>평수·지역 등 기본 정보 입력(선택)</summary><fieldset class="context-grid">$1</fieldset></details>');
  h=h.replace(/<div class="q-fields">([\s\S]*?)<\/div>/g,'<details class="v27-q-details"><summary>세부 금액 입력</summary><div class="q-fields">$1</div></details>');
  h=h.replace(/>기재<\/label>/g,'>포함되어 있음</label>').replace(/>별도<\/label>/g,'>별도 비용</label>').replace(/>미기재<\/label>/g,'>적혀 있지 않음</label>');
  h=h.replace(/<\/main>/,`<section class="v27-after-tool site-shell"><a href="${BASE}/compare/quote-lines/">CSV·TXT 견적 불러오기</a></section></main>`);
  write('quote-check/index.html',h);
}

if(exists('quote-compare/index.html')){
  let h=read('quote-compare/index.html');
  h=h.replace('<h1>인테리어 견적 A/B/C 비교</h1><p class="lead">A/B/C · 공종별 포함조건 · 금액 구성</p><div class="page-meta"><span>서버 전송 없음</span><span>브라우저 저장</span><span>최종 검수 2026-09-12</span></div>','<h1>견적 비교</h1><p class="lead">업체별 총액보다 포함 조건이 다른 항목부터 확인합니다.</p><p class="v27-privacy-note">입력 내용은 이 브라우저에서만 처리됩니다.</p>');
  h=h.replace(/<div class="v26-tool-shortcut">[\s\S]*?<\/div>/,'');
  const start=`<section class="v27-compare-start"><h2>몇 개의 견적을 비교하시나요?</h2><div class="v27-count-switch"><button type="button" data-v27-count="2" aria-pressed="true">2개</button><button type="button" data-v27-count="3" aria-pressed="false">3개</button></div><p class="v27-diff-summary" data-v27-diff-summary>조건이 다른 항목을 입력하면 여기에서 먼저 알려드립니다.</p></section>`;
  h=h.replace('<div data-compare-table>',`${start}<div data-compare-table data-v27-quote-count="2">`);
  h=h.replace(/<\/main>/,`<section class="v27-after-tool site-shell"><a href="${BASE}/compare/quote-lines/">CSV·TXT 견적 불러오기</a></section></main>`);
  write('quote-compare/index.html',h);
}

if(exists('calculator/index.html')){
  let h=read('calculator/index.html');
  h=h.replace('<h1>인테리어 예산 설계</h1><p class="lead">수량 × 입력 단가 · 공사비지수 · 공공단가 · 내 견적 단가 역산</p><div class="page-meta"><span>서버 전송 없음</span><span>브라우저 저장</span><span>최종 검수 2026-09-12</span></div>','<h1>인테리어 비용 계산기</h1><p class="lead">계산할 공사를 고르면 필요한 입력 항목만 보여드립니다.</p><p class="v27-privacy-note">시장 평균을 임의로 채우지 않고 직접 입력한 값만 계산합니다.</p>');
  const chooser=`<section class="v27-calc-start"><h2>어떤 공사를 계산하시나요?</h2><div class="v27-calc-modes"><button type="button" data-v27-calc-mode="all">전체 인테리어</button><button type="button" data-v27-calc-mode="bathroom">욕실</button><button type="button" data-v27-calc-mode="wallpaper">도배</button><button type="button" data-v27-calc-mode="flooring">바닥</button><button type="button" data-v27-calc-mode="kitchen">주방</button><button type="button" data-v27-calc-mode="custom">전체 항목 한 번에 보기</button></div><p data-v27-calc-help>공사를 선택하면 필요한 항목만 아래에 표시됩니다.</p></section>`;
  h=h.replace('<div class="budget-builder" data-budget-builder>',`${chooser}<div class="budget-builder v27-calc-waiting" data-budget-builder>`);
  write('calculator/index.html',h);
}

write('data/v27-senior-task-first.json',JSON.stringify({version:'27.0.0',reviewed_on:'2026-09-12',home_primary_actions:3,desktop_top_level_choices:4,quote_check_all_rows_visible:true,quote_check_details_progressive:true,quote_compare_default_vendors:2,quote_compare_difference_first:true,calculator_progressive_modes:true,preview_noindex_preserved:true,production_switch:false,search_console_submission:false,ads_injected:false,merge_to_main:false},null,2));
console.log(JSON.stringify({version:'27.0.0',home_task_first:true,header_reduced:true,quote_check_progressive:true,quote_compare_difference_first:true,calculator_progressive:true},null,2));