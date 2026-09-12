import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const BASE='/pm-lab/interior-cost-preview';
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const write=(p,c)=>{const f=path.join(ROOT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f]});

write('assets/site-v32-stratton.css',fs.readFileSync(path.resolve('interior-cost-core/site-v32-stratton.css'),'utf8'));
const cssLink=`<link rel="stylesheet" href="${BASE}/assets/site-v32-stratton.css?v=32">`;
const tape=`<div class="v32-data-tape" aria-label="주요 데이터"><div class="v32-data-tape-inner"><a href="${BASE}/data/g2b-all/">가격 데이터 337,984건</a><a href="${BASE}/cost/">공종 11개</a><a href="${BASE}/interior-cost/">24·30·32·34·40평</a><a href="${BASE}/data/">공공 단가 · 공사비지수</a></div></div>`;
const hero=`<div class="v32-home-hero"><h1>견적 검사.<br>견적 비교.<br>비용 데이터.</h1><div class="v32-home-side"><dl><div><dt>가격 레코드</dt><dd>337,984</dd></div><div><dt>공종</dt><dd>11</dd></div><div><dt>평수</dt><dd>5</dd></div></dl><a href="${BASE}/quote-check/"><span>견적 확인 시작</span><span>→</span></a></div></div>`;

for(const file of walk(ROOT).filter(f=>f.endsWith('.html'))){
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<link rel="stylesheet" href="[^"]*site-v31-light-service\.css[^"]*">/g,'');
  html=html.replace(/\s+v31-light\b/g,'');
  html=html.replace(/<link rel="stylesheet" href="[^"]*site-v30-hyper\.css[^"]*">/g,'');
  html=html.replace(/\s+v30-hyper\b/g,'');
  if(!html.includes('site-v32-stratton.css'))html=html.replace('</head>',`${cssLink}</head>`);
  html=html.replace(/<body class="([^"]*)"/,(_,c)=>`<body class="${c.includes('v32-stratton')?c:`${c} v32-stratton`.trim()}"`);
  if(!html.includes('class="v32-data-tape"'))html=html.replace('</header>',`</header>${tape}`);
  fs.writeFileSync(file,html);
}

let home=read('index.html');
home=home.replace(/<div class="v32-home-hero">[\s\S]*?<\/div><\/div>(?=<div class="site-shell">)/g,'');
home=home.replace(/<h1 class="sr-only">[^<]*<\/h1>/g,'');
home=home.replace('<section class="v28-home"><div class="site-shell">',`<section class="v28-home">${hero}<div class="site-shell">`);
write('index.html',home);

write('data/v32-stratton-system.json',JSON.stringify({
  version:'32.0.0',
  reference:'https://stratton.market/',
  reference_audit:'real Playwright computed-style capture',
  system:{paper:'#f7f1e8',ink:'#0d0d0c',header_px:66,radius_px:0,shadows:false,gradients:false,display_font:'Bricolage Grotesque',body_font:'IBM Plex Sans'},
  scope:['home','hubs','pyeong','trade details','public data','quote check','quote compare','calculator','guides','policy/trust pages'],
  copied_brand_assets:false,
  source_data_preserved:true,
  preview_noindex_preserved:true,
  production_switch:false,
  search_console_submission:false,
  ads_injected:false
},null,2));
console.log(JSON.stringify({version:'32.0.0',all_pages:true,stratton_system:true},null,2));
