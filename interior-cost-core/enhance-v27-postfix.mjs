import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.resolve('docs/interior-cost-preview');
const p=path.join(ROOT,'quote-compare/index.html');
if(fs.existsSync(p)){
  let h=fs.readFileSync(p,'utf8');
  h=h.replace(/<style data-v26-quote-critical>[\s\S]*?<\/style>/g,'');
  h=h.replace(/<div class="vendor-grid" style="[^"]*">/g,'<div class="vendor-grid">');
  h=h.replace(/<div class="vendor-cell" style="[^"]*">/g,'<div class="vendor-cell">');
  fs.writeFileSync(p,h);
}
console.log(JSON.stringify({version:'27.0.1',removed_v26_quote_inline_overrides:true},null,2));
