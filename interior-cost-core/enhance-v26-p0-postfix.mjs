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
  // Defensive cleanup: no empty-sample figure belongs on the public home even if an upstream template changes.
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
  // Keep the honest text explanation that statistics are unavailable, but never present zero as a market-price KPI.
  h=h.replace(/(?:실제 견적 표본|실제견적)[^<]{0,40}N=0/gi,'가격 통계 비공개');
  write(p,h);
}

console.log(JSON.stringify({version:'26.0.1',home_empty_sample_removed:true,pyeong_macro_boards_removed:5,region_shortcuts_removed:5},null,2));
