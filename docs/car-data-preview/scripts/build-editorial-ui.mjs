import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const catalogData=JSON.parse(fs.readFileSync(path.join(root,'data/generated/catalog.json'),'utf8'));
const heroImage=JSON.parse(fs.readFileSync(path.join(root,'data/hero-image.json'),'utf8'));
const fuelPrice=JSON.parse(fs.readFileSync(path.join(root,'data/fuel-price.json'),'utf8'));
const money=value=>Number(value).toLocaleString('ko-KR')+'원';
const stripHtml=value=>String(value??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
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
 let catalog=elementFrom(html,'<section class="db-section" id="catalog"','section');
 catalog=catalog.replace('주요 차량','지금 많이 보는 차').replace(/<a class="section-link"[^>]*>[\s\S]*?<\/a>/,'');
 catalog=catalog.replace(/<p class="home-photo-source">[\s\S]*?<\/p>/g,'');
 catalog=catalog.replace(/<div class="home-recalls">[\s\S]*?<\/div>/g,'');
 catalog=catalog.replace(/<details class="image-credit">[\s\S]*?<\/details>/g,'');
 const featured=['grandeur-gn7','sorento-mq4','k8-gl3','ioniq5-ne','ev6-cv','g80-rg3'].map(id=>catalogData.cars.find(car=>car.id===id)).filter(Boolean);
 if(featured.length!==6)throw new Error('Home must keep six reviewed vehicle cards');
 const cards=featured.map(car=>{
  const rep=car.rep,fuel=rep.fuelType==='ev'?'electric':rep.fuelType==='hybrid'?'hybrid':rep.fuelType==='lpg'?'lpg':'gasoline';
  const fuelLabel=fuel==='electric'?'전기':fuel==='hybrid'?'하이브리드':fuel==='lpg'?'LPG':rep.fuelType==='diesel'?'경유':'가솔린';
  const efficiencyLabel=fuel==='electric'?'전비':'연비',unit=fuel==='electric'?'km/kWh':'km/L';
  const annual=rep.total==null?'충전단가 입력':money(rep.total),energy=rep.annualEnergy==null?'직접 입력':Math.round(rep.annualEnergy/10000).toLocaleString('ko-KR')+'만';
  const metrics=`<dl class="home-annual"><dt>세금+${fuel==='electric'?'충전비':'연료비'} · 20,000km</dt><dd>${annual}${rep.total==null?'':'<small>/년</small>'}</dd></dl><dl class="home-metrics"><div><dt>복합 ${efficiencyLabel}</dt><dd>${rep.combined} <small>${unit}</small></dd></div><div><dt>자동차세</dt><dd>${Math.round(rep.tax/10000).toLocaleString('ko-KR')}만</dd></div><div><dt>${fuel==='electric'?'충전':'연료'}</dt><dd>${energy}</dd></div></dl>`;
  return `<article class="home-car"><a class="car-card" href="${car.path}"><figure><img class="pilot-photo" src="${escapeHtml(car.image)}" alt="${escapeHtml(car.model)} 대표 차량 사진" loading="lazy" width="900" height="600"></figure><small>${escapeHtml(car.maker)} · ${escapeHtml(car.yearLabel)}</small><h3>${escapeHtml(car.model)}</h3><span class="fuel-chip fuel-${fuel}">${fuelLabel}</span>${metrics}<p class="variant-label">${escapeHtml(rep.label)}</p></a><div class="home-car-actions"><a href="${car.path}">상세 보기</a><button type="button" data-compare-pick data-compare-mode="reviewed" data-compare-id="${car.id}" data-compare-variant="${rep.id}" data-compare-label="${escapeHtml(car.model)}">비교에 담기</button></div></article>`;
 }).join('');
 const grid=elementFrom(catalog,'<div class="home-cars"','div');
 catalog=catalog.replace(grid,`<div class="home-cars" id="homeCatalog"><!-- GENERATED:HOME-CATALOG:START -->${cards}<!-- GENERATED:HOME-CATALOG:END --></div>`);
 const notices=JSON.parse(fs.readFileSync(path.join(root,'data/recalls.json'),'utf8')).notices.slice(0,3);
 const notice=notices[0];
 const recalls=`<div class="home-recalls"><strong>최근 리콜</strong><a href="./recalls/${encodeURIComponent(notice.slug)}/">${escapeHtml(notice.title)}</a><time datetime="${escapeHtml(notice.date)}">${escapeHtml(notice.date)}</time></div>`;
 catalog=catalog.replace(/<\/div><\/section>$/,`${recalls}<p class="home-photo-source"><a href="./media-policy/#vehicle-photo-credits">차량 사진 출처·이용 조건</a></p></div></section>`);
 const compareGroups=[['gasoline','가솔린',['grandeur-vs-k8','sorento-vs-santafe']],['hybrid','하이브리드',['grandeur-gasoline-vs-hybrid','sorento-gasoline-vs-hybrid']],['electric','전기',['ioniq5-vs-ev6','ev3-vs-ev6']]];
 const panels=compareGroups.map(([key,label,slugs],groupIndex)=>`<div class="home-compare-panel" id="home-compare-${key}" role="tabpanel"${groupIndex?' hidden':''}>${slugs.map(slug=>{const file=path.join(root,'compare',slug,'index.html');if(!fs.existsSync(file))return '';const source=fs.readFileSync(file,'utf8'),title=stripHtml(source.match(/<h1>([\s\S]*?)<\/h1>/)?.[1]),lead=stripHtml(source.match(/<p class="comparison-lead"[^>]*>([\s\S]*?)<\/p>/)?.[1]);return `<a class="home-compare-row" href="./compare/${slug}/"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(lead)}</span><b>비교하기</b></a>`}).join('')}</div>`).join('');
 const comparison=`<section class="home-compare"><div class="home-compare-head"><h2>인기 비교</h2><a href="./compare/">직접 비교하기</a></div><div class="home-compare-tabs" role="tablist" aria-label="비교 유형">${compareGroups.map(([key,label],i)=>`<button type="button" role="tab" aria-selected="${i===0}" aria-controls="home-compare-${key}" data-home-tab="${key}">${label}</button>`).join('')}</div>${panels}</section>`;
 const heroSources=heroImage.files.map(file=>`./${file.path} ${file.width}w`).join(', '),heroFallback=heroImage.files.at(-1);
 const hero=`<section class="editorial-hero"><div class="hero-intro"><h1>차량 찾기부터 비교·계산·순위·리콜까지</h1><form class="db-search" action="./cars/" method="get"><input name="q" type="search" placeholder="그랜저, 아이오닉 5, 쏘렌토…" aria-label="차량 검색"><button type="submit">검색</button></form><nav class="home-quick" aria-label="빠른 비교"><a href="./compare/grandeur-vs-k8/">그랜저 vs K8</a><a href="./compare/sorento-vs-santafe/">쏘렌토 vs 싼타페</a><a href="./compare/grandeur-gasoline-vs-hybrid/">가솔린 vs 하이브리드</a><a href="./tools/car-tax/">전기차 세금 13만 원</a></nav></div><figure class="home-hero-visual" aria-label="아이오닉 6 스튜디오 사진"><picture><source type="image/webp" srcset="${heroSources}" sizes="100vw"><img src="./${heroFallback.path}" width="${heroFallback.width}" height="${heroFallback.height}" alt="스튜디오에 주차된 검은색 아이오닉 6 측면" fetchpriority="high" decoding="async"></picture></figure></section>`;
 return `<main class="editorial-home">${hero}${comparison}${catalog}</main>`;
}
function shell(prefix,route){
 const active=route==='index.html'?'':route.split('/')[0];
 const nav=[['cars','찾기'],['compare','비교'],['rankings','순위'],['recalls','리콜']].map(([slug,label])=>`<a href="${prefix}${slug}/"${active===slug?' aria-current="page"':''}>${label}</a>`).join('');
 return `<header class="db-header"><div class="db-shell"><a class="db-logo" href="${prefix}">내차데이터</a><nav class="db-nav" id="sitePrimaryNav" aria-label="주 메뉴">${nav}</nav><form class="site-header-search" action="${prefix}cars/" method="get"><input name="q" type="search" placeholder="차량 검색" aria-label="상단 검색"><button type="submit" aria-label="상단 검색 실행">검색</button></form><button class="site-nav-toggle" type="button" aria-controls="sitePrimaryNav" aria-expanded="false" aria-label="메뉴 열기"><span aria-hidden="true">☰</span></button></div></header>`;
}
function footer(prefix){
 const links=[['tools/','계산 도구'],['guide/','가이드'],['methodology/','계산 기준'],['data-sources/','출처'],['about/','소개'],['terms/','이용안내'],['privacy/','개인정보'],['contact/','오류 신고'],['media-policy/','사진 출처']].map(([url,label])=>`<a href="${prefix}${url}">${label}</a>`).join('');
 return `<footer class="db-footer"><div class="db-shell"><div><strong>내차데이터</strong><p>차 사기 전에, 연비와 세금을 같은 조건으로 본다</p></div><nav aria-label="사이트 안내">${links}</nav></div></footer>`;
}
function innerHtml(block){return block.slice(block.indexOf('>')+1,block.lastIndexOf('</'))}
function elevateVehicleDetail(html){
 if(html.includes('vehicle-decision-hero')){
  html=html.replace('<span id="answerFuel" hidden>','<span hidden id="answerFuel">');
  if(!html.includes('id="answerFuel"'))html=html.replace(/(<b id="mFuel">)([\d,]+)(원<\/b>)/,`$1$2$3<span hidden id="answerFuel">$2</span>`);
  return html;
 }
 if(!html.includes('<section class="vehicle-hero">'))return html;
 const oldHero=elementFrom(html,'<section class="vehicle-hero"','section');
 const config=elementFrom(html,'<section class="config"','section');
 const summary=elementFrom(html,'<section class="summary"','section');
 const metrics=elementFrom(summary,'<div class="metrics-strip"','div');
 const fuelHook=summary.match(/id="answerFuel">([\d,]+)/)?.[1]||'';
 let hero=oldHero.replace('class="vehicle-hero"','class="vehicle-hero vehicle-decision-hero"');
 hero=hero.replace('</div></div><div class="photo-credit">',`${innerHtml(elementFrom(config,'<div class="shell"','div'))}${metrics}${fuelHook?`<span hidden id="answerFuel">${fuelHook}</span>`:''}<div class="vehicle-hero-actions"><a class="primary" href="#compare">다른 차와 비교</a><a href="#cost">내 조건으로 계산</a></div></div></div><details class="photo-credit"><summary>사진 출처</summary>`).replace('</span></div></section>','</span></details></section>');
 html=html.replace(oldHero,hero).replace(config,'').replace(summary,'');
 if(html.includes('<section class="compare-dark"')){
  const comparison=elementFrom(html,'<section class="compare-dark"','section').replace('class="compare-dark"','class="compare-dark vehicle-inline-compare"');
  html=html.replace(elementFrom(html,'<section class="compare-dark"','section'),'').replace(hero,hero+comparison);
 }
 return html.replace(/<h2>같은 [^<]+도<br>사양에 따라 다릅니다\.<\/h2>/,'<h2>표시연비와 제원</h2>');
}
function moveComparePresets(html){
 const presetMarker='<section class="db-section comparison-directory compare-presets"';
 const marker='<section class="db-section comparison-directory"';
 let source='';
 while(html.includes(presetMarker)||html.includes(marker)){
  const current=html.includes(presetMarker)?elementFrom(html,presetMarker,'section'):elementFrom(html,marker,'section');
  if(!source||current.includes('compare-presets'))source=current;
  html=html.replace(current,'');
 }
 if(!source)return html.replace(/<div class="compare-fuel-status"><\/div>/g,'');
 const directory=source.includes('compare-presets')?source:source.replace('class="db-section comparison-directory"','class="db-section comparison-directory compare-presets"').replace('차종별 비용 비교','비교 프리셋');
 return html.replace(/<div class="compare-fuel-status"><\/div>/g,'').replace('</main>',directory+'</main>');
}
function moveFuelStatusToBottom(html){
 const footMarker='<div class="page-fuel-status-foot"';
 const marker='<div class="fuel-status-wrap"';
 let status='';
 while(html.includes(footMarker)){
  const foot=elementFrom(html,footMarker,'div');
  if(!status&&foot.includes(marker))status=elementFrom(foot,marker,'div');
  html=html.replace(foot,'');
 }
 while(html.includes(marker)){
  const found=elementFrom(html,marker,'div');
  if(!status)status=found;
  html=html.replace(found,'');
 }
 if(!status)return html;
 const date=escapeHtml(fuelPrice.price_as_of),stale=Boolean(fuelPrice.stale);
 const label=stale?`유가 갱신 지연 · ${date} 마지막 수집 가격`:`오피넷 전국 평균 · ${date} 기준`;
 status=`<div class="fuel-status-wrap"><p class="fuel-status${stale?' is-delayed':''}" data-fuel-status data-price-date="${date}" data-price-stale="${stale}">${label}</p></div>`;
 return html.replace('</main>',`<div class="page-fuel-status-foot">${status}</div></main>`);
}
function moveToolFuelStatusToBottom(html){
 const footMarker='<div class="tool-fuel-status-foot"';
 const marker='<p id="liveFuelStatus"';
 let status='';
 while(html.includes(footMarker)){
  const foot=elementFrom(html,footMarker,'div');
  if(!status&&foot.includes(marker))status=elementFrom(foot,marker,'p');
  html=html.replace(foot,'');
 }
 while(html.includes(marker)){
  const found=elementFrom(html,marker,'p');
  if(!status)status=found;
  html=html.replace(found,'');
 }
 return status?html.replace('</main>',`<div class="tool-fuel-status-foot">${status}</div></main>`):html;
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
   html=moveComparePresets(html);
   if(!html.includes('car:comparison')){
    html=html.replace("$('#compareAnswer').textContent=msg}","$('#compareAnswer').textContent=msg;window.dispatchEvent(new CustomEvent('car:comparison',{detail:null}))}");
    html=html.replace('updateRawUrl(a,b,km)}',"updateRawUrl(a,b,km);window.dispatchEvent(new CustomEvent('car:comparison',{detail:{km,names:[ar.family_name,br.family_name],specs:[ar.raw_model,br.raw_model],energy:[a.energy,b.energy],tax:[a.tax,b.tax],totals:[a.total,b.total],at:[d=>rawEnergyAt(a,d),d=>rawEnergyAt(b,d)],fuel:[ptLabel[ar.powertrain]||ar.powertrain,ptLabel[br.powertrain]||br.powertrain],prices:[rawPrice(ar),rawPrice(br)],units:[ar.powertrain==='electric'?'원/kWh':'원/L',br.powertrain==='electric'?'원/kWh':'원/L']}}))}");
    html=html.replace('updateReviewedUrl(a,b,km)}',"updateReviewedUrl(a,b,km);window.dispatchEvent(new CustomEvent('car:comparison',{detail:{km,names:[a.c.model,b.c.model],specs:[a.v.label,b.v.label],energy:[a.energy,b.energy],tax:[a.tax,b.tax],totals:[a.total,b.total],at:[d=>reviewedEnergyAt(a,d),d=>reviewedEnergyAt(b,d)],fuel:[U.getFuelDisplay(a.v),U.getFuelDisplay(b.v)],prices:[reviewedPrice(a.v),reviewedPrice(b.v)],units:[U.fuelKey(a.v)==='electric'?'원/kWh':'원/L',U.fuelKey(b.v)==='electric'?'원/kWh':'원/L']}}))}");
   }
   if(!html.includes('id="compareDashboard"'))html=html.replace('<div id="compareTable"></div>','<div id="compareDashboard" class="compare-dashboard" aria-live="polite"></div><div id="compareTable"></div>');
   if(!html.includes('compare-dashboard.js'))html=html.replace('</head>','<script defer src="../assets/compare-dashboard.js"></script></head>');
  }
  if(route==='tools/fuel-cost/index.html')html=moveToolFuelStatusToBottom(html);
  html=moveFuelStatusToBottom(html);
  if(/^cars\/[^/]+\/[^/]+\/index\.html$/.test(route))html=elevateVehicleDetail(html);
  if(route==='tools/annual-cost/index.html'){
   html=html.replace('>신고 사양 전체</button>','>모든 등록 사양</button>').replace(/>제원 확인된 \d+종<\/button>/,'>대표 사양</button>');
   html=html.replace("query.get('car')?'reviewed':'all'","query.get('fa')?'all':'reviewed'");
  }
  html=html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g,'');
  html=html.replace(/<link\b(?=[^>]*rel="stylesheet")(?=[^>]*assets\/[^">]+\.css(?:\?[^">]*)?)[^>]*>/g,'');
  html=html.replace(/<link\b[^>]*href="https:\/\/cdn\.jsdelivr\.net\/gh\/orioncactus\/pretendard[^"]*"[^>]*>/g,'');
  html=html.replace(/<script\b[^>]*src="[^"]*assets\/motion-ui\.js(?:\?[^\"]*)?"[^>]*><\/script>/g,'');
  html=html.replace(/<!-- MOTION:HERO:START -->[\s\S]*?<!-- MOTION:HERO:END -->/g,'');
  html=html.replace(/class="([^"]*)"/g,(_,classes)=>`class="${classes.split(/\s+/).filter(token=>!['motion-reveal','is-visible','motion-ready','studio-ui','clear-site','clear-home','showroom-home'].includes(token)).join(' ')}"`);
  const styles=[`<link rel="stylesheet" href="${prefix}assets/tokens.css">`,`<link rel="stylesheet" href="${prefix}assets/base.css">`,...(pageCss?[`<link rel="stylesheet" href="${prefix}assets/${pageCss}">`]:[])].join('');
  html=html.replace('</head>',styles+'</head>');
  if(route==='index.html'&&!html.includes('assets/home.js'))html=html.replace('</body>',`<script src="${prefix}assets/home.js"></script><script src="${prefix}assets/compare-tray.js"></script></body>`);
  if(route==='cars/index.html'){
   if(!html.includes('assets/cost-math.js'))html=html.replace('</head>',`<script src="${prefix}assets/cost-math.js"></script></head>`);
   if(!html.includes('assets/compare-tray.js'))html=html.replace('</body>',`<script src="${prefix}assets/compare-tray.js"></script></body>`);
  }
  if(!html.includes('assets/header-nav.js'))html=html.replace('</body>',`<script src="${prefix}assets/header-nav.js"></script></body>`);
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
