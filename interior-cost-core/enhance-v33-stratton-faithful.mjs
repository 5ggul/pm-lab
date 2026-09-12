import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const CORE=path.resolve('interior-cost-core');
const BASE='/pm-lab/interior-cost-preview';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]});
const write=(p,c)=>{const f=path.join(ROOT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const copy=(src,dst)=>{const out=path.join(ROOT,dst);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(path.join(CORE,src),out)};

copy('site-v33-stratton-faithful.css','assets/site-v33-stratton-faithful.css');
copy('v33-measure-hand.svg','assets/v33-measure-hand.svg');
copy('v33-plan-hand.svg','assets/v33-plan-hand.svg');
copy('v33-process-strip.svg','assets/v33-process-strip.svg');
copy('v33-footer-collage.svg','assets/v33-footer-collage.svg');

const css=`<link rel="stylesheet" href="${BASE}/assets/site-v33-stratton-faithful.css?v=33">`;
const headerCta=`<a class="v33-header-cta" href="${BASE}/quote-check/">견적 확인</a>`;
const homeHero=`<section class="v33-home-hero" aria-label="견적 도구 개요">
  <div class="v33-home-copy">
    <p class="v33-eyebrow">나라장터 가격정보 337,984건 · 공종 11개</p>
    <h1>견적서 확인.<br>업체 비교.<br><span class="v33-mark">공사비 데이터.</span></h1>
    <p class="v33-lede">견적서 누락·별도비용 확인 · 업체 2~3곳 조건 맞춤 비교 · 조달청 가격정보와 공공단가 참고.</p>
    <div class="v33-home-actions"><a href="${BASE}/quote-check/">견적 확인</a><a href="${BASE}/quote-compare/">견적 비교</a></div>
  </div>
  <aside class="v33-ticket" aria-label="견적 검수 시트">
    <div class="v33-ticket-head"><span class="v33-ticket-logo">V</span><span><strong>견적 검수 시트</strong><small>interior quote review</small></span><a href="${BASE}/quote-check/">확인 시작</a></div>
    <dl><div><dt>표준 확인 항목</dt><dd>12</dd></div><div><dt>업체 비교</dt><dd>2–3곳</dd></div><div><dt>가격 데이터</dt><dd>337,984건</dd></div><div><dt>공공단가 분포</dt><dd class="v33-alert">P25–P75</dd></div></dl>
    <p class="v33-ticket-note">공공 참고단가와 견적 조건을 분리해 보여줍니다. 민간 평균가나 자동 적정가 판정이 아닙니다.</p>
  </aside>
  <img class="v33-hero-art v33-hero-art--left" src="${BASE}/assets/v33-measure-hand.svg" alt="" aria-hidden="true">
  <img class="v33-hero-art v33-hero-art--right" src="${BASE}/assets/v33-plan-hand.svg" alt="" aria-hidden="true">
</section>`;
const process=`<section class="v33-process-stage" aria-label="견적 검수 흐름">
  <div class="v33-process-stamp" aria-hidden="true">12</div>
  <div class="v33-step-grid">
    <article class="v33-step"><b>01</b><strong>견적 받기</strong><p>업체 견적서의 항목·수량·사양을 그대로 확인합니다.</p><em>원본 유지</em></article>
    <article class="v33-step"><b>02</b><strong>누락 확인</strong><p>VAT·폐기물·양중·철거·별도공사를 분리합니다.</p><em>12항목</em></article>
    <article class="v33-step"><b>03</b><strong>조건 맞추기</strong><p>업체마다 다른 공사범위와 단위를 같은 기준으로 맞춥니다.</p><em>동일 조건</em></article>
    <article class="v33-step"><b>04</b><strong>공공단가 보기</strong><p>나라장터·표준시장단가의 중앙값과 P25–P75를 봅니다.</p><em>공공 참고</em></article>
    <article class="v33-step"><b>05</b><strong>업체 비교</strong><p>같은 조건에서 총액과 세부 항목 차이를 비교합니다.</p><em>2–3곳</em></article>
  </div>
  <img class="v33-process-strip" src="${BASE}/assets/v33-process-strip.svg" alt="" aria-hidden="true">
</section>`;

function kindFor(rel){
  if(rel==='index.html') return '홈';
  if(rel.includes('quote-check')||rel.includes('quote-compare')||rel.includes('calculator')||rel.includes('compare/quote-lines')) return '견적 도구';
  if(rel.startsWith('cost/')) return '공사별 비용';
  if(rel.startsWith('interior-cost/')) return '평수별 비용';
  if(rel.startsWith('data/')) return '공식 자료';
  if(rel.startsWith('guides/')) return '견적 보는 법';
  if(rel.startsWith('search/')) return '검색';
  return '견적검수실';
}
function ticketFor(rel){
  if(rel.includes('quote-check')||rel.includes('quote-compare')||rel.includes('calculator')||rel.includes('compare/quote-lines')) return [['확인 항목','12'],['비교 업체','2–3곳'],['저장','브라우저 내'],['자동 판정','없음']];
  if(rel.startsWith('data/')) return [['API','11개'],['페이지','351'],['가격 데이터','337,984건'],['기준','공공 원문']];
  if(rel.startsWith('cost/')) return [['가격 데이터','337,984건'],['공종','11개'],['표시','중앙값·P25–P75'],['판정','민간 평균 아님']];
  if(rel.startsWith('interior-cost/')) return [['평수','24·30·32·34·40'],['공종','11개'],['가격 데이터','337,984건'],['합산 평균','제공 안 함']];
  return [['가격 데이터','337,984건'],['공종','11개'],['평수','5종'],['근거','공공 자료']];
}
function markLastWord(html){
  return html.replace(/<h1([^>]*)>([^<]+)<\/h1>/,(_,attrs,text)=>{
    const t=text.trim();
    const parts=t.split(/\s+/);
    if(parts.length<2) return `<h1${attrs}><span class="v33-mark">${t}</span></h1>`;
    const last=parts.pop();
    return `<h1${attrs}>${parts.join(' ')} <span class="v33-mark">${last}</span></h1>`;
  });
}
function decorateHead(html,rel){
  const kind=kindFor(rel);
  const rows=ticketFor(rel).map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const ticket=`<aside class="v33-page-ticket" aria-label="페이지 데이터"><strong>${kind}</strong><dl>${rows}</dl><p>표시 숫자는 출처와 단위를 유지하며, 조건이 다른 값을 하나의 적정가로 합치지 않습니다.</p></aside>`;
  if(html.includes('class="article-shell"')){
    html=html.replace(/(<nav class="breadcrumbs"[\s\S]*?<\/nav>)/,`$1<p class="v33-page-eyebrow">${kind}</p>`);
    html=markLastWord(html);
    html=html.replace(/(<div class="article-shell">[\s\S]*?<h1[^>]*>[\s\S]*?<\/h1>)/,`$1${ticket}`);
    return html;
  }
  if(html.includes('class="tool-hero"')){
    html=html.replace(/(<div class="site-shell">)/,`$1<p class="v33-page-eyebrow">${kind}</p>`);
    html=markLastWord(html);
    html=html.replace(/(<section class="tool-hero">[\s\S]*?<h1[^>]*>[\s\S]*?<\/h1>)/,`$1${ticket}`);
    return html;
  }
  if(html.includes('class="v28-hub-title"')){
    html=html.replace(/(<section class="v28-hub-title">[\s\S]*?<div class="site-shell">)/,`$1<p class="v33-page-eyebrow">${kind}</p>`);
    html=markLastWord(html);
    html=html.replace(/(<section class="v28-hub-title">[\s\S]*?<h1[^>]*>[\s\S]*?<\/h1>)/,`$1${ticket}`);
    return html;
  }
  return markLastWord(html);
}

for(const file of walk(ROOT).filter(f=>f.endsWith('.html'))){
  const rel=path.relative(ROOT,file).replaceAll('\\','/');
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<link rel="stylesheet" href="[^"]*site-v33-stratton-faithful\.css[^"]*">/g,'');
  if(!html.includes('site-v33-stratton-faithful.css')) html=html.replace('</head>',`${css}</head>`);
  html=html.replace(/<body class="([^"]*)"/,(_,c)=>`<body class="${c.includes('v33-stratton')?c:`${c} v33-stratton`.trim()}"`);
  if(!html.includes('v33-header-cta')) html=html.replace('<button class="menu-btn"',`${headerCta}<button class="menu-btn"`);
  if(!html.includes('v33-footer-collage')) html=html.replace('<footer class="site-footer',`<div class="v33-footer-collage" aria-hidden="true"></div><footer class="site-footer`);
  if(rel!=='index.html') html=decorateHead(html,rel);
  fs.writeFileSync(file,html);
}

let home=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
home=home.replace(/<section class="v33-home-hero"[\s\S]*?<\/section><section class="v33-process-stage"[\s\S]*?<\/section>/g,'');
home=home.replace(/<section class="v28-home">/,`<section class="v28-home">${homeHero}${process}`);
write('index.html',home);

write('data/v33-stratton-faithful.json',JSON.stringify({
  version:'33.0.0',
  reference:'https://stratton.market/',
  reference_capture:'desktop and mobile screenshots inspected',
  translated_structure:['oversized staggered hero','orange paper highlight','asymmetric data ticket','original construction collage art','five-step story rail','hard-rule ledgers','black inverted footer'],
  whole_site:true,
  copied_reference_assets:false,
  data_preserved:{price_records:337984,api_operations:11,pages:351,trades:11},
  preview_noindex:true,
  production_switch:false,
  ads:false
},null,2));
console.log(JSON.stringify({version:'33.0.0',whole_site:true,reference_structure:true},null,2));
