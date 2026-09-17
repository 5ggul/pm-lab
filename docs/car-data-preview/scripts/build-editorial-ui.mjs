import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const cssFor=route=>route==='index.html'?'home.css':route.startsWith('cars/')?(route==='cars/index.html'||/^cars\/(?:hyundai|kia|genesis)\/index\.html$/.test(route)?'cars.css':'detail.css'):route.startsWith('compare/')?'compare.css':route.startsWith('rankings/')?'rankings.css':route.startsWith('recalls/')?'recalls.css':route.startsWith('tools/')?'tools.css':null;
function elementFrom(html,marker,tag){
 const start=html.indexOf(marker);
 if(start<0)throw new Error(`Missing ${marker}`);
 const matcher=new RegExp(`<\\/?${tag}\\b[^>]*>`,'g');matcher.lastIndex=start;
 let depth=0,match;
 while((match=matcher.exec(html))){
  depth+=match[0].startsWith('</')?-1:1;
  if(depth===0)return html.slice(start,matcher.lastIndex);
 }
 throw new Error(`Unbalanced ${tag}: ${marker}`);
}
function homeMain(html){
 const photo=elementFrom(html,'<figure class="hero-photograph"','figure');
 let catalog=elementFrom(html,'<section class="db-section" id="catalog"','section');
 if((catalog.match(/class="home-car"/g)||[]).length!==6)throw new Error('Home must keep six reviewed vehicle cards');
 catalog=catalog.replace('주요 차량','지금 많이 보는 차').replace(/<a class="section-link"[^>]*>[\s\S]*?<\/a>/,'');
 catalog=catalog.replace('</section>','<p class="home-photo-source"><a href="./media-policy/">차량 사진 출처·이용 조건</a></p></section>');
 return `<main class="editorial-home"><section class="editorial-hero"><div class="hero-intro"><h1>차 사기 전에 연비와 세금을 비교하세요</h1><form class="db-search" action="./cars/" method="get"><input name="q" type="search" placeholder="그랜저, 아이오닉 6, 스포티지…" aria-label="차량 검색"><button type="submit">검색</button></form></div>${photo}<p class="hero-photo-note">사진은 표시 사양과 다를 수 있습니다. <a href="./media-policy/#home-hero-photo">사진 출처</a></p></section>${catalog}</main>`;
}
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
  if(entry.isDirectory()){if(!['assets','data','scripts','qa'].includes(entry.name))walk(file);continue;}
  if(!file.endsWith('.html'))continue;
  const route=path.relative(root,file).replaceAll('\\','/');
  const prefix='../'.repeat(route.split('/').length-1)||'./';
  const pageCss=cssFor(route);
  let html=fs.readFileSync(file,'utf8');
  if(route==='index.html'&&!html.includes('<main class="editorial-home">'))html=html.replace(/<main\b[\s\S]*?<\/main>/,homeMain(html));
  html=html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g,'');
  html=html.replace(/<link\b(?=[^>]*rel="stylesheet")(?=[^>]*assets\/[^">]+\.css(?:\?[^">]*)?)[^>]*>/g,'');
  html=html.replace(/<link\b[^>]*href="https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard[^"]*"[^>]*>/g,'');
  html=html.replace(/<script\b[^>]*src="[^"]*assets\/motion-ui\.js(?:\?[^\"]*)?"[^>]*><\/script>/g,'');
  html=html.replace(/<!-- MOTION:HERO:START -->[\s\S]*?<!-- MOTION:HERO:END -->/g,'');
  html=html.replace(/class="([^"]*)"/g,(_,classes)=>`class="${classes.split(/\s+/).filter(token=>!['motion-reveal','is-visible','motion-ready','studio-ui','clear-site','clear-home','showroom-home'].includes(token)).join(' ')}"`);
  const styles=[`<link rel="stylesheet" href="${prefix}assets/tokens.css">`,`<link rel="stylesheet" href="${prefix}assets/base.css">`,...(pageCss?[`<link rel="stylesheet" href="${prefix}assets/${pageCss}">`]:[])].join('');
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
