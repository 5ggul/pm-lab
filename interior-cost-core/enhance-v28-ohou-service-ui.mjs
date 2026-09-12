import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const write=(p,c)=>{const f=path.join(ROOT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(ent=>{const full=path.join(dir,ent.name);return ent.isDirectory()?walk(full):[full]});
const rel=f=>path.relative(ROOT,f).split(path.sep).join('/');
const css=fs.readFileSync(path.resolve('interior-cost-core/site-v28-ohou.css'),'utf8');
write('assets/site-v28-ohou.css',css);
const cssLink=`<link rel="stylesheet" href="${BASE}/assets/site-v28-ohou.css?v=28">`;

const removeSection=(html,cls)=>html.replace(new RegExp(`<section class="[^"]*${cls}[^"]*"[\\s\\S]*?<\\/section>`,'g'),'');
const stripHeroCopy=html=>html
  .replace(/(<section class="(?:article-hero|tool-hero)"[\s\S]*?<h1>[\s\S]*?<\/h1>)<p class="lead">[\s\S]*?<\/p>/, '$1')
  .replace(/<div class="page-meta">[\s\S]*?<\/div>/g,'');

for(const f of walk(ROOT).filter(f=>f.endsWith('.html'))){
  const p=rel(f);
  let h=read(p);
  if(!h.includes('site-v28-ohou.css'))h=h.replace('</head>',`${cssLink}</head>`);
  h=h.replace(/<body class="([^"]*)"/,(_,c)=>`<body class="${c.includes('v28-ohou')?c:`${c} v28-ohou`.trim()}"`);
  h=stripHeroCopy(h);
  h=removeSection(h,'v26-data-boundary');
  h=removeSection(h,'v7-trade-stat');
  h=removeSection(h,'v9-trade-board');
  h=h.replace(/<nav class="v18-next-actions"[\s\S]*?<\/nav>/g,'');
  write(p,h);
}

// Home: no marketing hero. Visible content starts with literal service names, like a service marketplace landing page.
{
  let h=read('index.html');
  h=removeSection(h,'v27-home-hero');
  h=removeSection(h,'v27-quick-browse');
  const home=`<section class="v28-home"><div class="site-shell"><h1 class="sr-only">인테리어 견적 비교</h1><h2>견적 도구</h2><div class="v28-service-grid"><a class="v28-service-card" href="${BASE}/quote-check/"><span class="v28-service-icon">✓</span><span><strong>견적 확인</strong><small>누락 · 별도 비용</small></span></a><a class="v28-service-card" href="${BASE}/quote-compare/"><span class="v28-service-icon">⇄</span><span><strong>견적 비교</strong><small>업체 2~3곳</small></span></a><a class="v28-service-card" href="${BASE}/calculator/"><span class="v28-service-icon">₩</span><span><strong>비용 계산</strong><small>공종별 입력</small></span></a><a class="v28-service-card" href="${BASE}/compare/quote-lines/"><span class="v28-service-icon">CSV</span><span><strong>견적 불러오기</strong><small>CSV · TXT</small></span></a></div><h2>평수별 비용</h2><div class="v28-link-row"><a href="${BASE}/interior-cost/24-pyeong/">24평</a><a href="${BASE}/interior-cost/30-pyeong/">30평</a><a href="${BASE}/interior-cost/32-pyeong/">32평</a><a href="${BASE}/interior-cost/34-pyeong/">34평</a><a href="${BASE}/interior-cost/40-pyeong/">40평</a></div><h2>공사별 비용</h2><div class="v28-link-row"><a href="${BASE}/cost/bathroom/">욕실</a><a href="${BASE}/cost/wallpaper/">도배</a><a href="${BASE}/cost/floor/">바닥</a><a href="${BASE}/cost/carpentry/">목공</a><a href="${BASE}/cost/insulation/">단열</a><a href="${BASE}/cost/kitchen/">주방</a><a href="${BASE}/cost/window/">샷시</a></div><h2>공식 자료</h2><div class="v28-data-links"><a href="${BASE}/data/cost-index/">건설공사비지수<small>월별 지수</small></a><a href="${BASE}/data/public-unit-cost/">공공 공종 단가<small>표준시장단가</small></a><a href="${BASE}/data/construction-wage/">건설업 임금<small>공식 통계</small></a></div></div></section>`;
  h=h.replace('<main id="main-content">',`<main id="main-content">${home}`);
  h=h.replace(/<body class="([^"]*)"/,(_,c)=>`<body class="${c.includes('v28-home-page')?c:`${c} v28-home-page`.trim()}"`);
  // Remove low-value state/status block from the public home if present.
  h=h.replace(/<section class="v6-section"><div class="site-shell"><div class="v6-section-head"><h2>데이터 상태<\/h2>[\s\S]*?<\/section>/g,'');
  write('index.html',h);
}

// Cost and pyeong detail pages: remove duplicated answer-intro blocks, keep the actual tables/data once.
for(const f of walk(path.join(ROOT,'cost')).filter(f=>f.endsWith('index.html'))){
  const p=rel(f); if(p==='cost/index.html')continue;
  let h=read(p);
  h=removeSection(h,'direct-answer');
  write(p,h);
}
for(const f of walk(path.join(ROOT,'interior-cost')).filter(f=>f.endsWith('index.html'))){
  const p=rel(f);
  if(!/^interior-cost\/\d+-pyeong\/index\.html$/.test(p))continue;
  let h=read(p);
  h=removeSection(h,'direct-answer');
  write(p,h);
}

// Literal, compact titles for key tools; no slogan sentence below them.
const titleMap={
  'quote-check/index.html':'견적서 확인',
  'quote-compare/index.html':'견적 비교',
  'calculator/index.html':'비용 계산기',
  'compare/quote-lines/index.html':'견적 불러오기',
  'interior-cost/index.html':'평수별 인테리어 비용',
  'cost/index.html':'공사별 인테리어 비용',
  'data/index.html':'공식 자료',
  'guides/index.html':'견적 보는 법'
};
for(const [p,title] of Object.entries(titleMap)){
  if(!fs.existsSync(path.join(ROOT,p)))continue;
  let h=read(p);
  h=h.replace(/(<section class="(?:article-hero|tool-hero)"[\s\S]*?<h1>)[\s\S]*?(<\/h1>)/,'$1'+title+'$2');
  write(p,h);
}

write('data/v28-ohou-service-ui.json',JSON.stringify({version:'28.0.0',reference:'ohou.se/experts design principles only',copied_brand_assets:false,marketing_hero_removed:true,subpage_lead_copy_removed:true,trade_empty_stats_removed:true,legacy_data_boards_removed:true,preview_noindex_preserved:true,production_switch:false,search_console_submission:false,ads_injected:false},null,2));
console.log(JSON.stringify({version:'28.0.0',home_service_grid:true,subpage_design_unified:true,marketing_copy_removed:true},null,2));
