import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const fontHref='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
const cssFor=route=>route==='index.html'?'home.css':route.startsWith('cars/')?(route==='cars/index.html'||/^cars\/(?:hyundai|kia|genesis)\/index\.html$/.test(route)?'cars.css':'detail.css'):route.startsWith('compare/')?'compare.css':route.startsWith('rankings/')?'rankings.css':route.startsWith('recalls/')?'recalls.css':route.startsWith('tools/')?'tools.css':null;
function shell(prefix,route){
 const active=route==='index.html'?'':route.split('/')[0];
 const nav=[['cars','찾기'],['compare','비교'],['rankings','순위'],['recalls','리콜']].map(([slug,label])=>`<a href="${prefix}${slug}/"${active===slug?' aria-current="page"':''}>${label}</a>`).join('');
 return `<header class="db-header"><div class="db-shell"><a class="db-logo" href="${prefix}">내차데이터</a><nav class="db-nav" aria-label="주 메뉴">${nav}</nav>${route==='index.html'?'':`<a class="site-header-search" href="${prefix}cars/">검색</a>`}</div></header>`;
}
function footer(prefix){
 const links=[['methodology/','자료 기준'],['data-sources/','출처'],['about/','소개'],['privacy/','개인정보'],['terms/','이용안내'],['contact/','연락처']].map(([url,label])=>`<a href="${prefix}${url}">${label}</a>`).join('');
 return `<footer class="db-footer"><div class="db-shell"><div><strong>내차데이터</strong><p>차 사기 전에, 연비와 세금을 같은 조건으로 본다</p></div><nav aria-label="사이트 안내">${links}</nav></div></footer>`;
}
let count=0;
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){if(!['assets','data','scripts'].includes(entry.name))walk(file);continue;}
  if(!file.endsWith('.html'))continue;
  const route=path.relative(root,file).replaceAll('\\','/');
  const prefix='../'.repeat(route.split('/').length-1)||'./';
  const pageCss=cssFor(route);
  let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<link\b(?=[^>]*rel="stylesheet")(?=[^>]*assets\/[^">]+\.css(?:\?[^">]*)?)[^>]*>/g,'');
  html=html.replace(/<link\b[^>]*href="https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard[^"]*"[^>]*>/g,'');
  html=html.replace(/<script\b[^>]*src="[^"]*assets\/motion-ui\.js(?:\?[^\"]*)?"[^>]*><\/script>/g,'');
  html=html.replace(/<!-- MOTION:HERO:START -->[\s\S]*?<!-- MOTION:HERO:END -->/g,'');
  html=html.replace(/class="([^"]*)"/g,(_,classes)=>`class="${classes.split(/\s+/).filter(token=>!['motion-reveal','is-visible','motion-ready'].includes(token)).join(' ')}"`);
  const styles=[`<link rel="stylesheet" href="${fontHref}">`,`<link rel="stylesheet" href="${prefix}assets/tokens.css">`,`<link rel="stylesheet" href="${prefix}assets/base.css">`,...(pageCss?[`<link rel="stylesheet" href="${prefix}assets/${pageCss}">`]:[])].join('');
  html=html.replace('</head>',styles+'</head>');
  const header=shell(prefix,route);
  html=/<header\b[\s\S]*?<\/header>/.test(html)?html.replace(/<header\b[\s\S]*?<\/header>/,header):html.replace(/(<body\b[^>]*>)/,'$1'+header);
  const foot=footer(prefix);
  html=/<footer\b[\s\S]*?<\/footer>/.test(html)?html.replace(/<footer\b[\s\S]*?<\/footer>/,foot):html.replace('</body>',foot+'</body>');
  fs.writeFileSync(file,html);
  count++;
 }
}
walk(root);
console.log(`Editorial UI: ${count} pages use one base and one page stylesheet; no motion asset links.`);
