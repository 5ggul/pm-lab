import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const exists=p=>fs.existsSync(path.join(ROOT,p));
const write=(p,c)=>{const f=path.join(ROOT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{const full=path.join(dir,ent.name);return ent.isDirectory()?walk(full):[full]});
const rel=f=>path.relative(ROOT,f).split(path.sep).join('/');
const textOf=html=>html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();

const cssSource=fs.readFileSync(path.resolve('interior-cost-core/site-v26-public.css'),'utf8');
write('assets/site-v26-public.css',cssSource);
const cssLink=`<link rel="stylesheet" href="${BASE}/assets/site-v26-public.css?v=26">`;

const addShell=html=>{
  if(!html.includes('site-v26-public.css'))html=html.replace('</head>',`${cssLink}</head>`);
  html=html.replace(/<body class="([^"]*)"/,(_,cls)=>`<body class="${cls.includes('v26-public')?cls:`${cls} v26-public`.trim()}"`);
  return html;
};
const protectVisible=(html,fn)=>{
  const tokens=html.match(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]+>|[^<]+/gi)||[html];
  return tokens.map(token=>token.startsWith('<')?token:fn(token)).join('');
};
const visitorRewrite=text=>text
  .replace(/PRIMARY ANSWER/gi,'')
  .replace(/EVIDENCE TYPE/gi,'')
  .replace(/RELEASE CANDIDATE/gi,'')
  .replace(/PRIVATE QUOTE SAMPLE/gi,'')
  .replace(/NEXT CHECK/gi,'')
  .replace(/INDEX RELEASE/gi,'')
  .replace(/\bOPEN\b/g,'')
  .replace(/\bGO\b/g,'')
  .replace(/\bOFFICIAL\b/g,'공식자료')
  .replace(/\bREFERENCE\b/g,'공공참고')
  .replace(/\bCALCULATED\b/g,'계산값')
  .replace(/\bQUOTE\b/g,'실제견적')
  .replace(/\bPREVIEW\b/gi,'')
  .replace(/\bNOINDEX\b/gi,'')
  .replace(/프리뷰/g,'')
  .replace(/\s{2,}/g,' ');
const removeSectionByClass=(html,cls)=>html.replace(new RegExp(`<section class="[^"]*${cls}[^"]*"[\\s\\S]*?<\\/section>`,'g'),'');
const removePublicChrome=html=>{
  for(const cls of ['v17-answer-first','v15-rc-strip','v18-next-actions','v15-sample-cta','v9-thin-recovery'])html=removeSectionByClass(html,cls);
  html=html.replace(/<p class="kicker">[\s\S]*?<\/p>/g,'');
  html=html.replace(/<span>자료 유형 편집 가이드<\/span>/g,'');
  return html;
};
const setTitle= (html,title)=>html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${title}</title>`).replace(/<meta property="og:title" content="[^"]*">/i,`<meta property="og:title" content="${title}">`);
const setDescription=(html,desc)=>html.replace(/<meta name="description" content="[^"]*">/i,`<meta name="description" content="${desc}">`).replace(/<meta property="og:description" content="[^"]*">/i,`<meta property="og:description" content="${desc}">`);
const setH1=(html,h1)=>html.replace(/<h1>[\s\S]*?<\/h1>/i,`<h1>${h1}</h1>`);
const replaceArticle=(html,body)=>html.replace(/<article class="article-body">[\s\S]*?<\/article>/i,`<article class="article-body">${body}</article>`);

// 1) Public-wide cleanup. v25 only covered a subset; v26 applies the visitor shell to every generated page.
for(const f of walk(ROOT).filter(f=>f.endsWith('.html'))){
  const p=rel(f);
  let h=read(p);
  h=removePublicChrome(h);
  h=addShell(h);
  h=protectVisible(h,visitorRewrite);
  write(p,h);
}

// 2) Home: one job first, data second. H1 is now the first content heading.
if(exists('index.html')){
  let h=read('index.html');
  const hero=`<main id="main-content"><section class="v26-home-hero"><div class="site-shell"><h1>인테리어 견적 검사·비교</h1><p>견적서의 공사범위·수량·단위·VAT·폐기물을 먼저 맞추고 여러 견적을 같은 기준으로 비교합니다.</p><div class="v26-primary-actions"><a class="v26-primary" href="${BASE}/quote-check/">견적 검사 시작</a><a href="${BASE}/quote-compare/">3견적 비교</a></div><nav class="v26-utility-links" aria-label="추가 기능"><a href="${BASE}/compare/quote-lines/">CSV·TXT 견적 불러오기</a><a href="${BASE}/calculator/">예산 계산</a><a href="${BASE}/cost/">공사별 확인</a><a href="${BASE}/data/">공식 데이터</a></nav><ol class="v26-flow" aria-label="견적 비교 순서"><li>견적 입력</li><li>조건 정리</li><li>업체별 비교</li><li>공식 참고자료 확인</li></ol></div></section>`;
  h=h.replace(/<main id="main-content">[\s\S]*?(?=<section class="v6-section">)/,hero);
  h=h.replace(/<section class="v6-section">[\s\S]*?<\/section>/,m=>m); // keep data content below the task-first hero
  h=setTitle(h,'인테리어 견적 검사·비교 | 견적검수실');
  h=setDescription(h,'인테리어 견적서의 공사범위·수량·단위·VAT·폐기물을 확인하고 A/B/C 견적을 같은 기준으로 비교하는 브라우저 도구입니다.');
  h=h.replace(/<meta name="twitter:card" content="summary">/,'<meta name="twitter:card" content="summary_large_image">');
  h=h.replace(/<body class="([^"]*)"/,(_,cls)=>`<body class="${cls} v26-home"`);
  write('index.html',h);
}

// 3) Core tools: surface the existing CSV/TXT importer instead of claiming the feature only in QA docs.
for(const p of ['quote-check/index.html','quote-compare/index.html']){
  if(!exists(p))continue;
  let h=read(p);
  const action=`<div class="v26-tool-shortcut"><a href="${BASE}/compare/quote-lines/">CSV·TXT 견적 불러오기</a><span>파일 내용은 브라우저에서 처리합니다.</span></div>`;
  h=h.replace(/(<\/section>)(<div class="tool-page site-shell">)/,`$1${action}$2`);
  if(p==='quote-check/index.html'){
    h=setTitle(h,'인테리어 견적서 검사 | 누락·포함조건 체크 | 견적검수실');
    h=setDescription(h,'인테리어 견적서에서 VAT·폐기물·철거·샷시·공사범위의 포함·별도·미기재를 확인하고 비교 전에 조건을 정리합니다.');
  }else{
    h=setTitle(h,'인테리어 견적 비교 | A/B/C 조건·금액 비교 | 견적검수실');
    h=setDescription(h,'인테리어 견적 A/B/C의 공종별 금액과 VAT·폐기물·샷시 등 포함조건을 같은 표에서 비교하고 미기재 조건은 자동 판정하지 않습니다.');
  }
  write(p,h);
}
if(exists('calculator/index.html')){
  let h=read('calculator/index.html');
  h=setTitle(h,'인테리어 예산 계산기 | 견적·공공단가 분리 계산 | 견적검수실');
  h=setDescription(h,'인테리어 예산과 공종별 입력금액을 계산하고 공공 참고단가는 사용자 견적과 합치지 않은 채 별도 결과로 확인합니다.');
  write('calculator/index.html',h);
}

// 4) Pyeong pages: do not present an empty private-quote sample as the main answer.
const pyeongs=[24,30,32,34,40];
for(const n of pyeongs){
  const p=`interior-cost/${n}-pyeong/index.html`;
  if(!exists(p))continue;
  let h=read(p);
  h=removeSectionByClass(h,'v7-pyeong-stat');
  h=removeSectionByClass(h,'v62-snapshot');
  h=h.replace(/<aside class="v6-benchmark">[\s\S]*?<\/aside>/g,'');
  const lead=(h.match(/<p class="lead">([\s\S]*?)<\/p>/i)?.[1]||`${n}평 견적은 총액보다 포함 범위와 수량 조건을 먼저 맞춰야 합니다.`).replace(/<[^>]+>/g,'').trim();
  h=setTitle(h,`${n}평 인테리어 비용 비교 | 견적 조건 체크 | 견적검수실`);
  h=setDescription(h,`${lead} 실제 견적 표본이 공개 기준에 미달하면 가격 통계는 표시하지 않습니다.`.slice(0,165));
  h=setH1(h,`${n}평 인테리어 비용 비교 조건`);
  const boundary=`<section class="v26-data-boundary"><strong>가격 통계 공개 전</strong><p>현재 실제 견적 표본이 공개 기준에 미달해 평균·중앙값·P25/P75를 표시하지 않습니다. 대신 ${n}평에서 총액을 바꾸는 공사범위와 포함조건을 확인할 수 있습니다.</p><a href="${BASE}/quote-compare/">내 견적 3개 비교하기</a></section>`;
  h=h.replace(/(<div class="article-layout">)/,`${boundary}$1`);
  write(p,h);
}

// 5) Cost hub and cost routes: remove internal chrome, align search intent, and add the missing insulation hub.
const costMeta={
  bathroom:['욕실 인테리어 견적 | 방수·타일·철거 조건 비교 | 견적검수실','욕실 견적은 철거·폐기물·방수 범위·타일 규격·도기·수전·배관 이동을 같은 조건으로 맞춰 비교합니다.'],
  kitchen:['주방 인테리어 견적 | 가구·상판·배관 조건 비교 | 견적검수실','주방 견적은 가구 길이·상판 재료·아일랜드·철거·배관·전기 이동 범위를 같은 기준으로 확인합니다.'],
  window:['샷시·창호 견적 | 창 개수·유리·철거 조건 비교 | 견적검수실','샷시·창호 견적은 창 개수와 치수·프레임·유리 사양·철거·양중 포함 여부를 맞춰 비교합니다.'],
  wallpaper:['도배 견적 | 벽지·면적·철거·보수 조건 비교 | 견적검수실','도배 견적은 실제 벽·천장 면적과 기존 벽지 제거·바탕면 보수·합지·실크 등 사양을 같은 기준으로 확인합니다.'],
  floor:['바닥 공사 견적 | 면적·철거·자재·마감 비교 | 견적검수실','바닥 견적은 실제 시공면적·기존 바닥 철거·자재 종류·걸레받이·문턱 마감 포함 여부를 맞춰 비교합니다.'],
  demolition:['철거·폐기물 견적 | 범위·반출·장비 조건 비교 | 견적검수실','철거·폐기물 견적은 철거 범위·반출 거리·장비·엘리베이터 조건과 폐기물 처리 범위를 분리해 확인합니다.'],
  electrical:['전기·조명 견적 | 회로·콘센트·분전반 조건 비교 | 견적검수실','전기·조명 견적은 조명 개수뿐 아니라 회로·콘센트·스위치·분전반·전용회로 범위를 같은 기준으로 확인합니다.'],
  carpentry:['목공 견적 | 천장·가벽·몰딩·문틀 조건 비교 | 견적검수실','목공 견적은 천장·가벽·몰딩·문틀·간접조명 구조 등 작업 범위를 나눠 업체별 견적을 비교합니다.'],
  insulation:['단열 공사 견적 | 단열재·두께·면적·마감 비교 | 견적검수실','단열 견적은 단열재 종류와 두께·시공 위치·실제 작업면적·기밀·방습·마감 복구 범위를 같은 기준으로 확인합니다.']
};
if(!exists('cost/insulation/index.html')&&exists('cost/carpentry/index.html')){
  let h=read('cost/carpentry/index.html');
  h=h.replaceAll('/cost/carpentry/','/cost/insulation/').replaceAll('carpentry','insulation').replaceAll('목공','단열');
  const article=`<section class="direct-answer"><h2>단열 견적에서 먼저 맞출 조건</h2><p>단열 견적은 ㎡당 금액보다 단열재 종류·두께·시공 위치·실제 작업면적·기밀·방습·마감 복구 범위를 같은 조건으로 맞춰야 합니다.</p></section><section class="content-section"><h2>단열 견적 비교 항목</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>항목</th><th>확인할 내용</th></tr></thead><tbody><tr><th>단열재</th><td>종류와 두께, 등급·규격</td></tr><tr><th>시공 위치</th><td>외벽·천장·바닥·결로 취약부</td></tr><tr><th>작업면적</th><td>공급면적이 아니라 실제 시공 ㎡</td></tr><tr><th>기밀·방습</th><td>테이프·방습층·접합부 처리 포함 여부</td></tr><tr><th>철거</th><td>기존 마감 철거와 폐기물 처리 포함 여부</td></tr><tr><th>마감 복구</th><td>석고보드·도배·도장 등 후속 마감 포함 여부</td></tr></tbody></table></div></section><section class="content-section"><h2>공공 참고자료를 볼 때</h2><p>공공 단가와 조달청 자재 가격은 민간 아파트 단열 공사의 시장평균이 아닙니다. 규격·단위·재료 포함 여부가 같은 항목인지 확인하는 참고축으로만 사용합니다.</p><p><a href="${BASE}/data/public-unit-cost/">공공 단가 보기</a> · <a href="${BASE}/data/g2b-materials/">조달청 자재 참고</a></p></section><section class="content-section faq"><h2>자주 묻는 질문</h2><article><h3>32평이면 단열 작업면적도 32평인가요?</h3><p>아닙니다. 공급면적은 주택 크기를 구분하는 값이고 단열 견적에는 실제 벽·천장·바닥 등 시공면적을 사용해야 합니다.</p></article><article><h3>단열재 가격만 비교하면 되나요?</h3><p>아닙니다. 두께·등급·부착 방식·기밀·방습·마감 복구와 철거 범위가 다르면 총액을 직접 비교하기 어렵습니다.</p></article></section>`;
  h=replaceArticle(h,article);
  write('cost/insulation/index.html',h);
}
if(exists('cost/index.html')){
  let h=read('cost/index.html');
  h=setTitle(h,'공사별 인테리어 견적 | 욕실·도배·바닥·목공·단열 | 견적검수실');
  h=setDescription(h,'욕실·주방·샷시·도배·바닥·철거·전기·목공·단열 견적에서 총액보다 먼저 맞춰야 할 공사범위·수량·규격·포함조건을 확인합니다.');
  if(!h.includes('/cost/insulation/')){
    const row=`<tr><th scope="row"><a href="${BASE}/cost/insulation/">단열</a></th><td>단열은 단열재 종류·두께·실제 작업면적·기밀·방습·철거·마감 복구 범위를 같은 기준으로 맞춰야 합니다.</td></tr>`;
    h=h.replace(/(<tr><th scope="row"><a href="[^\"]*\/cost\/carpentry\/">목공<\/a><\/th>[\s\S]*?<\/tr>)/,`$1${row}`);
  }
  write('cost/index.html',h);
}
for(const [slug,[title,desc]] of Object.entries(costMeta)){
  const p=`cost/${slug}/index.html`;
  if(!exists(p))continue;
  let h=read(p);
  h=setTitle(h,title);
  h=setDescription(h,desc);
  write(p,h);
}

// 6) Search should return actionable pages, not empty regional shells or internal QA/version pages.
if(exists('search/index.html')){
  let h=read('search/index.html');
  h=removeSectionByClass(h,'v9-quality-context');
  const script=`<script data-v26-search-filter>(function(){const blocked=['/region/','/data/answers-v','/data/production-','/data/ad-layout/','/data/sample-growth/','/data/coverage/','/data/launch-gate-','/data/mobile-audit-','/data/search-snippets-','/data/citation-pack-'];const root=document.querySelector('[data-search-results]');if(!root)return;const clean=()=>{for(const a of root.querySelectorAll('a[href]')){if(blocked.some(x=>a.getAttribute('href')?.includes(x))){const box=a.closest('article,li,[data-search-item],.search-card,.result-card')||a;box.remove();}}};new MutationObserver(clean).observe(root,{childList:true,subtree:true});clean();})();</script>`;
  h=h.replace('</body>',`${script}</body>`);
  write('search/index.html',h);
}

// 7) Policy copy: remove generic estimator-template footer language. Real public contact email remains a domain-launch manual gate.
const policyBodies={
  'about/index.html':`<section class="direct-answer"><h2>무엇을 하는 사이트인가</h2><p>견적검수실은 인테리어 견적서의 공종·수량·단위·포함조건을 구조화해 여러 견적을 같은 기준에서 비교하도록 돕는 도구입니다.</p></section><section class="content-section"><h2>데이터 원칙</h2><p>사용자 견적, 공공 시공 참고, 공식 공개자료, 계산 결과를 서로 다른 값으로 표시합니다. 서로 다른 출처를 임의로 합쳐 적정가격이나 업체 추천 점수로 만들지 않습니다.</p><h2>검수 범위</h2><p>표시하는 숫자는 출처·기준일·단위·적용범위를 함께 확인하고, 실제 민간 견적 통계는 공개 기준을 충족한 경우에만 표시합니다.</p></section>`,
  'contact/index.html':`<section class="direct-answer"><h2>오류·정정 요청</h2><p>데이터 출처, 견적 항목 분류, 오탈자와 기능 오류는 운영 연락처를 통해 정정 요청할 수 있습니다.</p></section><section class="content-section"><h2>보내면 좋은 정보</h2><p>문제가 있는 URL, 항목명, 현재 표시 내용, 수정 근거가 되는 공식 문서나 견적 표기를 함께 보내주세요.</p><h2>운영 연락처</h2><p>현재는 공개 전 검수용 주소입니다. 실제 수신 이메일은 운영 도메인 확정과 함께 이 위치에 연결합니다.</p></section>`,
  'privacy/index.html':`<section class="direct-answer"><h2>현재 처리하는 정보</h2><p>견적 검사·비교·계산 입력은 현재 브라우저에서 처리하며 서버로 견적 원문을 전송하지 않습니다.</p></section><section class="content-section"><h2>브라우저 저장</h2><p>일부 입력값과 설정은 사용 편의를 위해 브라우저 localStorage에 저장될 수 있습니다. 브라우저 저장공간을 삭제하면 함께 제거됩니다.</p><h2>파일 처리</h2><p>CSV·TXT 견적 불러오기는 브라우저에서 파싱하며 이름·전화번호·이메일·상세주소·업체명·사업자번호·계좌·서명 같은 식별정보를 공개 데이터로 사용하지 않습니다.</p><h2>로그·쿠키·광고</h2><p>현재 프리뷰에는 광고 코드가 없습니다. 운영 도메인에서 분석도구나 Google AdSense 등 쿠키를 사용하는 서비스를 도입할 경우 실제 설정에 맞춰 수집 항목, 목적, 보관기간, 제3자 제공·처리위탁, 거부 방법을 이 방침에 반영합니다.</p><h2>이용자 권리와 문의</h2><p>운영 연락처는 도메인 공개 시 함께 고지하며, 개인정보 관련 요청과 정정·삭제 문의를 받을 수 있는 수신 주소를 제공합니다.</p></section>`,
  'terms/index.html':`<section class="direct-answer"><h2>이용 범위</h2><p>견적검수실의 계산·비교 결과와 공공 참고자료는 견적 검토를 돕는 참고정보이며 계약·법률·감정 결과를 대신하지 않습니다.</p></section><section class="content-section"><h2>사용자 입력</h2><p>사용자가 입력한 견적의 정확성과 이용 권한은 사용자에게 있습니다. 서비스는 입력값을 바탕으로 조건을 정리하지만 시공 품질이나 업체 이행을 보증하지 않습니다.</p><h2>외부 자료</h2><p>공식·공공 출처 자료는 공표기관의 기준과 갱신 시점에 따라 달라질 수 있으며 원출처 확인이 우선합니다.</p></section>`,
  'disclaimer/index.html':`<section class="direct-answer"><h2>가격 판정 서비스가 아닙니다</h2><p>공공 단가와 공식 통계는 민간 아파트 인테리어의 시장평균이나 적정가격을 의미하지 않습니다.</p></section><section class="content-section"><h2>견적 비교의 한계</h2><p>같은 공종명이라도 자재·규격·수량·철거·양중·현장조건·VAT·폐기물 포함 여부가 다르면 총액을 직접 비교할 수 없습니다. 최종 계약 전에는 시공업체와 범위와 사양을 다시 확인해야 합니다.</p></section>`,
  'editorial-policy/index.html':`<section class="direct-answer"><h2>검수 기준</h2><p>숫자는 출처·공표일·단위·적용범위를 확인하고 사용자 견적과 공공·공식 자료를 분리해 표시합니다.</p></section><section class="content-section"><h2>게시 기준</h2><p>민간 견적 통계는 공개 표본 기준을 충족할 때만 표시합니다. 공공 단가를 민간 평균으로 바꾸거나 표본이 없는 값을 추정해 채우지 않습니다.</p><h2>수정</h2><p>출처 갱신이나 오류가 확인되면 변경이력과 정정 정책에 따라 수정합니다.</p></section>`,
  'corrections/index.html':`<section class="direct-answer"><h2>정정 원칙</h2><p>출처 링크 오류, 단위·기준일 오류, 공종 분류 오류, 기능 오류를 확인하면 원자료와 비교해 수정합니다.</p></section><section class="content-section"><h2>정정 요청에 필요한 정보</h2><p>URL, 문제 항목, 현재 표시값, 기대하는 수정 내용, 근거 출처를 함께 전달하면 확인이 빠릅니다.</p><h2>기록</h2><p>공개 데이터의 의미가 달라지는 주요 수정은 변경이력에 남깁니다.</p></section>`
};
for(const [p,body] of Object.entries(policyBodies)){
  if(!exists(p))continue;
  let h=read(p);
  h=removeSectionByClass(h,'v9-quality-context');
  h=replaceArticle(h,body);
  write(p,h);
}

// 8) Explicit launch-index manifest. Keep preview noindex; this only defines the future production allow-list.
const htmlFiles=walk(ROOT).filter(f=>f.endsWith('.html')).map(rel);
const fileToRoute=p=>p==='index.html'?'/':`/${p.replace(/index\.html$/,'')}`;
const indexNow=new Set([
  '/','/quote-check/','/quote-compare/','/calculator/','/compare/quote-lines/','/compare/reference-layers/',
  '/cost/','/cost/bathroom/','/cost/kitchen/','/cost/window/','/cost/wallpaper/','/cost/floor/','/cost/demolition/','/cost/electrical/','/cost/carpentry/','/cost/insulation/',
  '/data/','/data/cost-index/','/data/public-unit-cost/','/data/public-unit-cost/topics/','/data/g2b-materials/','/data/methodology/','/data/sources/','/data/changelog/','/quote-items/',
  '/about/','/contact/','/privacy/','/terms/','/disclaimer/','/editorial-policy/','/corrections/'
]);
const rows=htmlFiles.map(file=>{
  const route=fileToRoute(file);
  let state='review_before_index',reason='개별 콘텐츠 가치와 검색 의도 수동 검수 필요';
  if(indexNow.has(route)){state='index_candidate';reason='도구·공종·공식 데이터·신뢰 페이지 1차 공개 후보';}
  if(/^\/interior-cost\/(?:24|30|32|34|40)-pyeong\/$/.test(route)){state='hold_noindex';reason='실제 민간 견적 통계 공개 기준 미달, 고유성 추가 검수';}
  if(route.startsWith('/interior-cost/matrix/')&&route!=='/interior-cost/matrix/'){state='hold_noindex';reason='평수×공종 25개는 유사 템플릿 위험으로 1차 색인 제외';}
  if(route.startsWith('/region/')){state='hold_noindex';reason='지역 실제 견적 표본이 충분할 때까지 색인 제외';}
  if(/^\/data\/(?:answers(?:-v\d+)?|production-|ad-layout|sample-growth|coverage|launch-gate|mobile-audit|search-snippets|citation-pack|publisher-readiness|production-diff)/.test(route)){state='exclude_production';reason='운영·QA·버전 페이지';}
  if(['/404.html','/search/'].includes(route)){state='hold_noindex';reason='검색/오류 유틸리티 페이지';}
  return {file,route,state,reason};
});
const summary=Object.fromEntries(['index_candidate','hold_noindex','review_before_index','exclude_production'].map(k=>[k,rows.filter(r=>r.state===k).length]));
const manifest={version:'26.0.0',reviewed_on:'2026-09-12',preview_noindex_preserved:true,production_index_not_enabled:true,summary,manual_launch_gates:['production_origin','public_contact_email','final_index_candidate_manual_review'],pages:rows};
write('data/v26-launch-manifest.json',JSON.stringify(manifest,null,2));
write('data/v26-sitemap-paths.txt',rows.filter(r=>r.state==='index_candidate').map(r=>r.route).sort().join('\n')+'\n');

const report={version:'26.0.0',reviewed_on:'2026-09-12',home_task_first:true,global_internal_chrome_removed:true,pyeong_empty_statistics_deemphasized:true,insulation_hub_added:exists('cost/insulation/index.html'),search_internal_results_filtered:true,launch_manifest:summary,preview_noindex_preserved:true,production_switch:false,search_console_submission:false,ads_injected:false,merge_to_main:false};
write('data/v26-public-launch-quality.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
