import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const cssFor=route=>route==='index.html'?'home.css':route.startsWith('cars/')?(route==='cars/index.html'||/^cars\/(?:hyundai|kia|genesis)\/index\.html$/.test(route)?'cars.css':'detail.css'):route.startsWith('compare/')?'compare.css':route.startsWith('rankings/')?'rankings.css':route.startsWith('recalls/')?'recalls.css':route.startsWith('tools/')?'tools.css':null;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
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
 catalog=catalog.replace(/<p class="home-photo-source">[\s\S]*?<\/p>/g,'');
 catalog=catalog.replace(/<div class="home-recalls">[\s\S]*?<\/div>/g,'');
 catalog=catalog.replace(/<details class="image-credit">[\s\S]*?<\/details>/g,'');
 const notices=JSON.parse(fs.readFileSync(path.join(root,'data/recalls.json'),'utf8')).notices.slice(0,3);
 const recalls=`<div class="home-recalls"><h2>수록 리콜 공지</h2><ol>${notices.map(n=>`<li><time datetime="${escapeHtml(n.date)}">${escapeHtml(n.date)}</time><a href="./recalls/${encodeURIComponent(n.slug)}/">${escapeHtml(n.title)}</a></li>`).join('')}</ol></div>`;
 catalog=catalog.replace(/<\/div><\/section>$/,`${recalls}<p class="home-photo-source"><a href="./media-policy/#vehicle-photo-credits">차량 사진 출처·이용 조건</a></p></div></section>`);
 return `<main class="editorial-home"><section class="editorial-hero"><div class="hero-intro"><h1>차량별 연비·자동차세 비교</h1><p class="hero-scope">공식 신고 사양 · 연 20,000 km 에너지비</p><form class="db-search" action="./cars/" method="get"><input name="q" type="search" placeholder="그랜저, 아이오닉 6, 스포티지…" aria-label="차량 검색"><button type="submit">검색</button></form></div>${photo}<p class="hero-photo-note">아이오닉 6 스튜디오 사진 · 표시 사양과 별개</p></section>${catalog}</main>`;
}
function shell(prefix,route){
 const active=route==='index.html'?'':route.split('/')[0];
 const nav=[['cars','찾기'],['compare','비교'],['rankings','순위'],['recalls','리콜']].map(([slug,label])=>`<a href="${prefix}${slug}/"${active===slug?' aria-current="page"':''}>${label}</a>`).join('');
 return `<header class="db-header"><div class="db-shell"><a class="db-logo" href="${prefix}">내차데이터</a><nav class="db-nav" aria-label="주 메뉴">${nav}</nav><a class="site-header-search" href="${prefix}cars/">검색</a></div></header>`;
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
  if(route==='index.html')html=html.replace(/<main\b[\s\S]*?<\/main>/,homeMain(html));
  if(route==='compare/index.html'){
   if(!html.includes('car:comparison')){
    html=html.replace("$('#compareAnswer').textContent=msg}","$('#compareAnswer').textContent=msg;window.dispatchEvent(new CustomEvent('car:comparison',{detail:null}))}");
    html=html.replace('updateRawUrl(a,b,km)}',"updateRawUrl(a,b,km);window.dispatchEvent(new CustomEvent('car:comparison',{detail:{km,names:[ar.family_name,br.family_name],specs:[ar.raw_model,br.raw_model],energy:[a.energy,b.energy],tax:[a.tax,b.tax],totals:[a.total,b.total],at:[d=>rawEnergyAt(a,d),d=>rawEnergyAt(b,d)],fuel:[ptLabel[ar.powertrain]||ar.powertrain,ptLabel[br.powertrain]||br.powertrain],prices:[rawPrice(ar),rawPrice(br)],units:[ar.powertrain==='electric'?'원/kWh':'원/L',br.powertrain==='electric'?'원/kWh':'원/L']}}))}");
    html=html.replace('updateReviewedUrl(a,b,km)}',"updateReviewedUrl(a,b,km);window.dispatchEvent(new CustomEvent('car:comparison',{detail:{km,names:[a.c.model,b.c.model],specs:[a.v.label,b.v.label],energy:[a.energy,b.energy],tax:[a.tax,b.tax],totals:[a.total,b.total],at:[d=>reviewedEnergyAt(a,d),d=>reviewedEnergyAt(b,d)],fuel:[U.getFuelDisplay(a.v),U.getFuelDisplay(b.v)],prices:[reviewedPrice(a.v),reviewedPrice(b.v)],units:[U.fuelKey(a.v)==='electric'?'원/kWh':'원/L',U.fuelKey(b.v)==='electric'?'원/kWh':'원/L']}}))}");
   }
   if(!html.includes('id="compareDashboard"'))html=html.replace('<div id="compareTable"></div>','<div id="compareDashboard" class="compare-dashboard" aria-live="polite"></div><div id="compareTable"></div>');
   if(!html.includes('compare-dashboard.js'))html=html.replace('</head>','<script defer src="../assets/compare-dashboard.js"></script></head>');
  }
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
  if(route.startsWith('qa/'))html=html.replace(/^[ \t]+$/gm,'');
  fs.writeFileSync(file,html);
  count++;
 }
}
walk(root);
console.log(`Editorial UI: ${count} pages use one base and one page stylesheet; no motion asset links.`);
