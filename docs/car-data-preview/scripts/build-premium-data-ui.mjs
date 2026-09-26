import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
let pages=0;

function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){
   if(!['assets','data','scripts','qa'].includes(entry.name))walk(file);
   continue;
  }
  if(!file.endsWith('.html'))continue;
  const rel=path.relative(root,file).replaceAll('\\','/');
  const prefix='../'.repeat(rel.split('/').length-1)||'./';
  let html=fs.readFileSync(file,'utf8');
  if(/data-reference-page="(?:calculator|ranking)"/.test(html)){
   html=html.replace(/(<section class="page-hero[^>]*"><div class="db-shell">)<div class="db-kicker">[\s\S]*?<\/div>/,'$1');
  }
  if(rel==='rankings/index.html'){
   html=html.replace(/<section class="rank-hub-hero">[\s\S]*?<\/section>/,`<section class="rank-hub-hero"><div class="db-shell"><h1>연비·전비·자동차세 순위</h1><p class="ranking-scope">제조사 제원이 확인된 차종 기준입니다. 국내 판매 신차 전체 순위는 아닙니다.</p><a href="#rank-categories">8개 순위 보기 <span aria-hidden="true">↓</span></a></div></section>`);
  }
  if(rel==='tools/annual-cost/index.html'){
   html=html.replace('보험·정비·감가·취득세를 섞지 않고 연간 정상 자동차세와 유류비·충전비만 같은 기준으로 계산합니다.','자동차세와 연료·충전비만 계산합니다.');
   html=html.replace('한국에너지공단 전체 신고 데이터에서 계산 조건이 확인되는 항목만 계산합니다.','계산 가능한 신고 사양만 표시합니다.');
  }
  html=html.replace(/<link[^>]*href="[^"]*assets\/premium-data-ui\.css[^\"]*"[^>]*>/g,'');
  fs.writeFileSync(file,html);
  pages++;
 }
}

walk(root);
await import('./build-editorial-ui.mjs');
// The editorial pass rebuilds the home cards, so responsive local image
// sources must be applied after that final markup is in place.
await import('./build-delivery-optimization.mjs');
console.log(`Editorial copy completed across ${pages} pages.`);

// Run after every editorial generator, including pages rebuilt after finish-public-ui.
const {versionRuntimeAssets}=await import('./version-runtime-assets.mjs');
versionRuntimeAssets();
