import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const write=(p,c)=>fs.writeFileSync(path.join(ROOT,p),c);
const exists=p=>fs.existsSync(path.join(ROOT,p));
const removeSection=(html,cls)=>html.replace(new RegExp(`<section class="[^"]*${cls}[^"]*"[\\s\\S]*?<\\/section>`,'g'),'');
const setTitle=(html,title)=>html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${title}</title>`).replace(/<meta property="og:title" content="[^"]*">/i,`<meta property="og:title" content="${title}">`);
const setDescription=(html,description)=>html.replace(/<meta name="description" content="[^"]*">/i,`<meta name="description" content="${description}">`).replace(/<meta property="og:description" content="[^"]*">/i,`<meta property="og:description" content="${description}">`);

// Home: remove the remaining empty private-sample status and old internal navigation/version archaeology.
if(exists('index.html')){
  let h=read('index.html');
  h=h.replace(/<tr><td><span class="v6-status-code">실제견적<\/span><\/td><td>표준화 실제 견적<\/td><td class="v6-status-empty">N=0<\/td><td>[^<]*<\/td><\/tr>/g,'');
  h=h.replace(/<div class="v10-home-strip">[\s\S]*?<section class="v20-integration"[\s\S]*?<\/section>/g,'');
  h=h.replace(/<[^>]+>\s*(?:실제 견적|실제견적)[^<]{0,40}N=0[^<]*<\/[^>]+>/g,'');
  write('index.html',h);
}

// Pyeong pages: remove the macro data board whose only private-quote signal is N=0 and remove region-N=0 shortcuts.
for(const n of [24,30,32,34,40]){
  const p=`interior-cost/${n}-pyeong/index.html`;
  if(!exists(p))continue;
  let h=read(p);
  h=removeSection(h,'v9-pyeong-board');
  h=removeSection(h,'v10-related');
  h=h.replace(/(?:실제 견적 표본|실제견적)[^<]{0,40}N=0/gi,'가격 통계 비공개');
  write(p,h);
}

// The first v26 insulation condition table gets a stable audit hook; cloned legacy tables remain separate.
if(exists('cost/insulation/index.html')){
  let h=read('cost/insulation/index.html');
  h=h.replace('<table class="data-table"><thead><tr><th>항목</th><th>확인할 내용</th></tr></thead>', '<table class="data-table v26-insulation-conditions"><thead><tr><th>항목</th><th>확인할 내용</th></tr></thead>');
  write('cost/insulation/index.html',h);
}

// Quote comparison is a real 3-vendor task. Force A/B/C into one row even when older mobile bundle rules collapse it.
if(exists('quote-compare/index.html')){
  let h=read('quote-compare/index.html');
  h=h.replaceAll('<div class="vendor-grid">','<div class="vendor-grid" style="display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important">');
  h=h.replaceAll('<div class="vendor-cell">','<div class="vendor-cell" style="min-width:0!important;padding:9px!important">');
  const critical=`<style data-v26-quote-critical>@media(max-width:760px){body.v26-public[data-v19-path="quote-compare/index.html"] [data-compare-table] .vendor-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important}body.v26-public[data-v19-path="quote-compare/index.html"] [data-compare-table] .vendor-cell{min-width:0!important;padding:9px!important}body.v26-public[data-v19-path="quote-compare/index.html"] [data-compare-table] .vendor-cell label{font-size:11px!important;gap:4px!important}body.v26-public[data-v19-path="quote-compare/index.html"] [data-compare-table] .vendor-cell input,body.v26-public[data-v19-path="quote-compare/index.html"] [data-compare-table] .vendor-cell select{width:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box!important;min-height:40px!important;font-size:12px!important;padding-left:5px!important;padding-right:3px!important}body.v26-public[data-v19-path="quote-compare/index.html"] [data-compare-table] .compare-row{padding:10px 0!important}body.v26-public[data-v19-path="quote-compare/index.html"] [data-compare-table] .compare-row h3{margin:0 0 7px!important;font-size:16px!important}}</style>`;
  h=h.replace('</head>',`${critical}</head>`);
  write('quote-compare/index.html',h);
}

// Public data hubs should own their actual dataset intent, not a single bathroom keyword or a vague trend phrase.
if(exists('data/public-unit-cost/index.html')){
  const p='data/public-unit-cost/index.html';
  let h=read(p);
  h=setTitle(h,'2026 하반기 공공 공종 단가 | 표준시장단가 | 견적검수실');
  h=setDescription(h,'2026년 하반기 표준시장단가 중 타일·방수·도배·도장·목공·창호 등 인테리어 인접 공종의 단가와 규격·재료비 제외조건·노무비율을 확인합니다.');
  write(p,h);
}
if(exists('data/cost-index/index.html')){
  const p='data/cost-index/index.html';
  let h=read(p);
  h=setTitle(h,'건설공사비지수 | 2026 월별 지수·변화율 | 견적검수실');
  h=setDescription(h,'한국건설기술연구원 건설공사비지수의 최근 월별 값과 전년 동월 대비 변화율을 확인합니다. 민간 인테리어 시장평균이나 업체 견적 적정가로 사용하지 않습니다.');
  write(p,h);
}

console.log(JSON.stringify({version:'26.0.3',home_empty_sample_removed:true,pyeong_macro_boards_removed:5,region_shortcuts_removed:5,insulation_audit_hook:true,quote_mobile_three_vendor_grid:true,public_data_meta_aligned:['data/public-unit-cost/index.html','data/cost-index/index.html']},null,2));
