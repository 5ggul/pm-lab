import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import '../assets/metric-charts.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const photos=read('data/vehicle-image-sources.json').records,calc=read('data/generated/all-car-calc-index.json').rows;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=s=>s.replace(/<[^>]*>/g,'').trim();
const wrap=s=>`<!-- METRICS:START -->${s}<!-- METRICS:END -->`;
const version=name=>createHash('sha256').update(fs.readFileSync(path.join(root,'assets',name))).digest('hex').slice(0,10);
const assets=['metric-charts.js','metric-live.js','metric-visuals.css'];
let pictures=0,charts=0;
for(const folder of ['rankings','compare'])for(const entry of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){
 if(!entry.isDirectory())continue;
 const file=path.join(root,folder,entry.name,'index.html');if(!fs.existsSync(file))continue;
 let s=fs.readFileSync(file,'utf8').replace(/<!-- METRICS:START -->[\s\S]*?<!-- METRICS:END -->/g,'');
 if(folder==='rankings'){
  const ids=[...s.matchAll(/data-calc-id="([^"]+)"/g)].map(m=>m[1]);
  const rows=ids.map(id=>calc.find(r=>r.calc_id===id));if(rows.some(r=>!r))throw Error('Missing ranking source');
  const values=[...s.matchAll(/data-metric-value="([^"]+)"/g)].map(m=>Number(m[1]));
  if(values.length!==rows.length||values.some(v=>!Number.isFinite(v)||v<=0))throw Error('Missing ranking metric');
  const max=Math.max(...values),direction=s.match(/data-ranking-direction="([^"]+)"/)?.[1]||'higher';
  s=s.replace(/<article class="rank-row"[\s\S]*?<\/article>/g,article=>{
   const id=article.match(/data-calc-id="([^"]+)"/)[1],r=rows.find(r=>r.calc_id===id),p=photos.find(p=>p.family_id===r.family_id);
   if(!p)throw Error('Missing licensed ranking photo: '+r.family_id);
   const value=Number(article.match(/data-metric-value="([^"]+)"/)?.[1]);
   const photo=`<figure class="rank-photo"><img class="pilot-photo" src="${esc(p.image_url)}" width="${p.width}" height="${p.height}" loading="lazy" alt="${esc(r.maker+' '+r.family_name+' '+p.generation)} 대표 사진"><details><summary>사진 출처</summary><p>${esc(p.generation)} 대표 사진 · 순위 사양과 외관이 다를 수 있습니다.<br><a href="${esc(p.source_page)}">${esc(p.author)}</a> · <a href="${esc(p.license_url)}">${esc(p.license)}</a></p></details></figure>`;
   pictures++;
   return article.replace(/(<span class="rank-position">\d+<\/span>)/,'$1'+wrap(photo)).replace('</article>',wrap(`<div class="rank-meter" data-metric-value="${value}" data-scale-max="${max}" aria-hidden="true"><span style="width:${value/max*100}%"></span></div>`)+'</article>');
  });
  const note=direction==='lower'?'막대가 짧을수록 표시 비용이 낮습니다. 모든 막대는 0에서 시작합니다.':'막대가 길수록 같은 양의 에너지로 더 멀리 갑니다. 모든 막대는 0에서 시작합니다.';
  s=s.replace('<div class="rank-list">',wrap(`<p class="rank-chart-note">${note}<br>사진은 차종별 대표 이미지로, 표시된 연식·사양과 외관이 다를 수 있습니다.</p>` )+'<div class="rank-list">');
 }
 if(folder==='compare'){
  const cells=[...s.matchAll(/<tr data-equal="[^"]+"><th scope="row">([^<]+)<\/th><td>([^<]+)<\/td><td>([^<]+)<\/td><\/tr>/g)];
  const efficiency=cells.find(m=>/복합.*(?:연비|전비)/.test(m[1]));
  const names=[...s.matchAll(/<span class="reference-car-letter">[AB]<\/span>([^<]+)/g)].map(m=>clean(m[1]));
  if(efficiency&&names.length===2){const values=efficiency.slice(2).map(v=>v.match(/^([\d.,]+)\s+(km\/(?:kWh|L))$/));
   if(values.every(Boolean)&&values[0][2]===values[1][2]){const chart=CAR_METRIC_CHARTS.bars({title:efficiency[1],unit:values[0][2],note:'막대가 길수록 효율이 높습니다. 위에 표시된 사양 기준입니다.',rows:values.map((v,i)=>({label:(i?'B ':'A ')+names[i],values:[Number(v[1].replaceAll(',',''))]}))});s=s.replace('<!-- REF:MATRIX:END -->',wrap(chart)+'<!-- REF:MATRIX:END -->');charts++;}
  }
 }
 fs.writeFileSync(file,s);
}
// Load the same renderer for live results and static examples.
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['assets','scripts','data'].includes(e.name))continue;const f=path.join(dir,e.name);if(e.isDirectory()){walk(f);continue;}if(!f.endsWith('.html'))continue;let s=fs.readFileSync(f,'utf8');const rel=path.relative(root,f).replaceAll('\\','/');if(!/^(compare|rankings)\//.test(rel))continue;const pre='../'.repeat(rel.split('/').length-1);s=s.replace(/<(?:script|link)\b[^>]*(?:src|href)="[^"]*assets\/metric-(?:charts\.js|live\.js|visuals\.css)[^"]*"[^>]*>(?:<\/script>)?/g,'');s=s.replace('</head>',assets.map(name=>name.endsWith('.css')?`<link rel="stylesheet" href="${pre}assets/${name}?v=${version(name)}">`:`<script defer src="${pre}assets/${name}?v=${version(name)}"></script>`).join('')+'</head>');fs.writeFileSync(f,s);}}
walk(root);
console.log(`Metric visuals: ${pictures} ranking photos, ${charts} efficiency charts.`);
