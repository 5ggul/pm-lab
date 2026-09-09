import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const cssVersion=createHash('sha256').update(fs.readFileSync(path.join(root,'assets/showroom-ui.css'))).digest('hex').slice(0,10);
const image=JSON.parse(fs.readFileSync(path.join(root,'data/hero-image.json'),'utf8'));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function endDiv(html,start){let depth=0;const re=/<\/?div\b[^>]*>/g;re.lastIndex=start;let m;while(m=re.exec(html)){depth+=m[0].startsWith('</')?-1:1;if(!depth)return re.lastIndex}throw Error('Unbalanced workspace')}
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=html.indexOf('<div class="home-studio"');
if(start<0)throw Error('Generate studio before editorial home');
const end=endDiv(html,start),catalog=html.slice(start,end).match(/<section class="db-section" id="catalog">[\s\S]*?<\/section>/)?.[0];
if(!catalog)throw Error('Static catalogue missing');
const hero=`<section class="editorial-hero" aria-label="차량 검색과 비교"><div class="hero-intro"><div><h1>차량별 연비·자동차세 비교</h1><p>공식 사양을 고르고 자동차세와 연료·충전비를 같은 조건으로 계산하세요.</p></div><form class="db-search" action="./cars/" method="get"><input name="q" type="search" placeholder="어떤 차가 궁금하세요?" aria-label="차종 또는 제조사"><button type="submit">검색 <span aria-hidden="true">↗</span></button></form></div><figure class="hero-photograph"><picture><source type="image/webp" srcset="${image.files.map(f=>'./'+f.path+' '+f.width+'w').join(', ')}" sizes="100vw"><img class="pilot-photo" src="./${image.files.at(-1).path}" width="${image.original_width}" height="${image.original_height}" alt="사람 없이 스튜디오에 주차된 검은색 아이오닉 6의 측면" fetchpriority="high" decoding="async"></picture></figure><nav class="hero-utility-links" aria-label="주요 기능">${[['차량 찾기','cars/'],['세금·에너지비 계산','tools/annual-cost/'],['차량 비교','compare/'],['연비 순위','rankings/fuel-economy/']].map(([label,url])=>`<a href="./${url}">${label}</a>`).join('')}</nav></section>`;
html=html.slice(0,start)+hero+catalog+html.slice(end);
html=html.replace(/<script id="studio-data"[\s\S]*?<\/script><script type="module" src="[^\"]*assets\/studio.js"><\/script>/,'');
html=html.replace(/<body class="/,'<body class="showroom-home ').replace('</head>','<link rel="stylesheet" href="./assets/showroom-ui.css"></head>');
fs.writeFileSync(path.join(root,'index.html'),html);
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const f=path.join(dir,entry.name);
  if(entry.isDirectory()){if(!['assets','data','scripts'].includes(entry.name))walk(f);continue}
  if(!f.endsWith('.html'))continue;
  let html=fs.readFileSync(f,'utf8');
  if(!html.includes('assets/showroom-ui.css')){
   const pre=path.relative(path.dirname(f),root).replaceAll('\\','/')||'.';
   html=html.replace('</head>',`<link rel="stylesheet" href="${pre}/assets/showroom-ui.css"></head>`);
  }
  html=html.replace(/href="([^"?]*assets\/showroom-ui\.css)(?:\?[^"]*)?"/g,(_,url)=>`href="${url}?v=${cssVersion}"`);
  fs.writeFileSync(f,html);
 }
}
walk(root);
console.log('Editorial home: one licensed photograph, direct search and compact utility links.');
