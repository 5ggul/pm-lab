import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const write=(p,c)=>fs.writeFileSync(path.join(ROOT,p),c);
const exists=p=>fs.existsSync(path.join(ROOT,p));
const removeSection=(html,cls)=>html.replace(new RegExp(`<section class="[^"]*${cls}[^"]*"[\\s\\S]*?<\\/section>`,'g'),'');

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

console.log(JSON.stringify({version:'26.0.2',home_empty_sample_removed:true,pyeong_macro_boards_removed:5,region_shortcuts_removed:5,insulation_audit_hook:true,quote_mobile_three_vendor_grid:true},null,2));
