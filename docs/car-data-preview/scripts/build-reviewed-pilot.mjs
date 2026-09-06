import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {reviewedImage} from './reviewed-static-media.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/generated/catalog.json')));
const cars=catalog.cars;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const photo=(id,loading='eager')=>{const r=reviewedImage(id);return `<img class="pilot-photo" src="${esc(r.image_url)}" alt="${esc(cars.find(c=>c.id===id).model)} ${esc(r.generation)} 차량 사진" width="${r.width}" height="${r.height}" loading="${loading}" decoding="async">`;};
const credit=id=>{const r=reviewedImage(id);return `<span class="pilot-credit">사진: ${esc(r.generation)} · <a href="${esc(r.source_page)}">${esc(r.author)} · ${esc(r.license)}</a> · <a href="${esc(r.license_url)}">이용 조건</a><br>사진의 연식·트림은 선택한 사양과 다를 수 있습니다.</span>`;};
const pairs=[
  {slug:'grandeur-vs-k8',title:'그랜저와 K8 비교',a:'grandeur-gn7',av:'gn7-g25-2wd-18',b:'k8-gl3',bv:'k8-g25-2wd-17',note:'두 차량 모두 2.5 가솔린·2WD 사양입니다. 그랜저는 18인치, K8은 17인치 휠 기준이므로 연비 차이를 차종만의 차이로 해석하지 마세요.'},
  {slug:'ioniq5-vs-ev6',title:'아이오닉 5와 EV6 비교',a:'ioniq5-ne',av:'ne-lr-2wd-19-no-bic',b:'ev6-cv',bv:'cv-lr-2wd-19',note:'롱레인지·2WD·19인치 사양을 비교합니다. 아이오닉 5는 빌트인캠 미적용 기준입니다. 충전 요금은 사업자·회원 조건·급속/완속 여부에 따라 달라 직접 입력해야 합니다.'},
  {slug:'sorento-gasoline-vs-hybrid',title:'쏘렌토 가솔린과 하이브리드 비교',a:'sorento-mq4',av:'mq4-g25-2wd-18-0',b:'sorento-mq4',bv:'mq4-hev16-2wd-17-0',note:'가솔린 2.5 터보 2WD 18인치와 하이브리드 1.6 2WD 5인승 17인치를 비교합니다. 휠·인승 조건도 확인하세요. 구매가격 차이를 포함하지 않으므로 하이브리드 구매비 회수 시점을 뜻하지 않습니다.'}
];
const scope='계산 범위는 자동차세와 연료·충전비입니다. 구매가격·보험·정비·취득세·감가상각은 포함하지 않습니다. 자동차세는 비영업용 승용 신차의 연간 기준이며, 차령 경감·연납 할인·개별 감면은 반영하지 않습니다.';
const formula='연료비 = 연간 주행거리 ÷ 복합연비(km/L) × 원/L. 충전비 = 연간 주행거리 ÷ 복합전비(km/kWh) × 원/kWh. 표시연비·전비는 실제 운전 환경과 다를 수 있습니다.';
function block(html,key,content){const a=`<!-- PILOT:${key}:START -->`,b=`<!-- PILOT:${key}:END -->`;const value=a+content+b;return html.includes(a)?html.replace(new RegExp(a+'[\\s\\S]*?'+b),value):html.replace('</main>',value+'</main>');}
function variantCard(id,vid){const c=cars.find(c=>c.id===id),v=c?.variants.find(v=>v.id===vid);if(!c?.indexable||!v)throw Error(`Unreviewed comparison selection ${id}/${vid}`);return `<article data-pilot-car="${id}" data-pilot-variant="${vid}">${photo(id)}${credit(id)}<h2>${esc(c.model)}</h2><p>${esc(c.yearLabel)} · ${esc(v.label)}</p><dl><dt>복합 ${c.energy==='ev'?'전비':'연비'}</dt><dd>${v.combined} ${c.energy==='ev'?'km/kWh':'km/L'}</dd><dt>${c.energy==='ev'?'1회 충전 주행거리':'배기량'}</dt><dd>${c.energy==='ev'?`${v.range} km`:`${v.cc.toLocaleString('ko-KR')} cc`}</dd><dt>전장 / 전폭</dt><dd>${c.dimensions.length_mm.toLocaleString('ko-KR')} / ${c.dimensions.width_mm.toLocaleString('ko-KR')} mm</dd><dt>축거</dt><dd>${c.dimensions.wheelbase_mm.toLocaleString('ko-KR')} mm</dd></dl><p class="pilot-note">차체 크기는 ${esc(c.code)} 제조사 제원 기준입니다. 확인일 ${esc(c.reviewedOn)}.</p><div class="pilot-links"><a href="${esc(c.sourceUrl)}">공식 연비·전비 자료</a><a href="${esc(c.specSourceUrl)}">제조사 제원</a><a href="../../${c.path.slice(2)}">차량 상세</a></div></article>`;}
for(const p of pairs){
  const params=new URLSearchParams({mode:'reviewed',a:p.a,av:p.av,b:p.b,bv:p.bv,km:'20000'});
  const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${p.title} | 내차데이터</title><meta name="description" content="${esc(p.note)}"><link rel="canonical" href="https://5ggul.github.io/pm-lab/car-data-preview/compare/${p.slug}/"><link rel="stylesheet" href="../../assets/site.css"><link rel="stylesheet" href="../../assets/home.css"></head><body><header class="db-header"><div class="db-shell"><a class="db-logo" href="../../">내차데이터</a><nav class="db-nav" aria-label="주 메뉴"><a href="../../cars/">차량</a><a href="../">비교</a><a href="../../tools/annual-cost/">1년 유지비</a><a href="../../recalls/">리콜</a><a href="../../data-sources/">출처</a></nav></div></header><main><section class="page-hero"><div class="pilot-wrap"><p><a href="../">차량 비교</a> / ${p.title}</p><h1>${p.title}</h1><p>${p.note}</p><a class="pilot-cta" data-pilot-calculate href="../?${esc(params)}">이 사양으로 세금·에너지비 계산</a><p class="pilot-note">연 20,000km로 시작하며 주행거리와 단가를 바꿀 수 있습니다. 전기차는 충전단가를 입력한 뒤 계산합니다.</p></div></section><section class="db-section"><div class="pilot-wrap pilot-grid">${variantCard(p.a,p.av)}${variantCard(p.b,p.bv)}</div></section><section class="pilot-trust"><div class="pilot-wrap"><h2>비교 전에 확인하세요</h2><p>${scope}</p><p>${formula}</p><p>위 수치는 표에 적힌 사양의 값입니다. 차종 전체 평균이나 다른 연식의 수치가 아닙니다. 어느 차가 더 좋다는 순위를 매기지 않습니다.</p><div class="pilot-links"><a href="../../methodology/">계산 기준</a><a href="../../data-sources/">출처와 갱신 기준</a></div></div></section></main><footer class="db-footer"><div class="pilot-wrap">내차데이터 · 공식 자료와 입력 조건을 함께 확인하세요.</div></footer></body></html>`;
  const dir=path.join(root,'compare',p.slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),html);
}
// Existing details keep their working selectors and calculators; add their scope and sources.
for(const c of cars){
  const file=path.join(root,c.path.slice(2),'index.html');let html=fs.readFileSync(file,'utf8');
  html=html.replace(/<img\b[^>]*>/,photo(c.id));
  html=html.replace(/<details class="photo-credit"[^>]*>[\s\S]*?<\/details>|<div class="photo-credit">[\s\S]*?<\/div>/g,`<div class="photo-credit">${credit(c.id)}</div>`);
  if(c.indexable){const related=pairs.filter(p=>p.a===c.id||p.b===c.id);html=block(html,'TRUST',`<section class="pilot-trust"><div class="pilot-wrap"><h2>이 차량의 자료와 계산 범위</h2><p>${esc(c.yearLabel)}년형 ${esc(c.code)} · 자료 확인 ${esc(c.reviewedOn)}. 연비와 비용은 선택한 엔진·구동·휠 사양을 기준으로 확인하세요.</p><p>${scope}</p><p>${formula}</p><div class="pilot-links"><a href="${esc(c.sourceUrl)}">공식 연비·전비 자료</a><a href="${esc(c.specSourceUrl)}">제조사 제원</a><a href="../../../methodology/">계산 기준</a>${related.map(p=>`<a href="../../../compare/${p.slug}/">${p.title}</a>`).join('')}</div></div></section>`);}
  fs.writeFileSync(file,html);
}
let home=fs.readFileSync(path.join(root,'index.html'),'utf8');
home=home.replace('공식 API가 제공하는 전체 차량을 검색합니다.','공식 연비·전비 자료에서 차량을 검색합니다.').replaceAll('전체 차량 DB','전체 차량').replaceAll('전체 DB와 검수 허브','제조사별 차량 찾기');
const heroIds=['sorento-mq4','k8-gl3','ioniq5-ne'];let heroIndex=0;
home=home.replace(/<div class="hero-collage"[^>]*>[\s\S]*?<\/div>/,part=>part.replace(/<img\b[^>]*>/g,()=>photo(heroIds[heroIndex++])));
home=home.replace(/<details class="photo-credit hero-credit">[\s\S]*?<\/details>/,`<details class="photo-credit hero-credit"><summary>사진 출처</summary>${heroIds.map(credit).join('<br>')}</details>`);
const links=`<section class="pilot-trust"><div class="pilot-wrap"><h2>사양을 맞춰 비교하기</h2><p>먼저 엔진·구동·휠 조건을 확인하고, 같은 주행거리로 자동차세와 에너지비를 비교하세요.</p><div class="pilot-links">${pairs.map(p=>`<a href="./compare/${p.slug}/">${p.title}</a>`).join('')}</div></div></section>`;
home=block(home,'COMPARE',links);fs.writeFileSync(path.join(root,'index.html'),home);
const compareFile=path.join(root,'compare/index.html');let compare=fs.readFileSync(compareFile,'utf8');compare=block(compare,'COMPARE',links.replaceAll('./compare/','./'));fs.writeFileSync(compareFile,compare);
const hybridFile=path.join(root,'cars/hyundai/grandeur-gn7/hybrid/index.html');
let hybrid=fs.readFileSync(hybridFile,'utf8');
hybrid=hybrid.replace(/<img\b[^>]*>/,photo('grandeur-gn7').replace('<img ', '<img style="width:100%;height:auto" '));
hybrid=hybrid.replace(/<p class="source-line">[^<]*Photo:[\s\S]*?<\/p>/,`<p class="source-line">${credit('grandeur-gn7')}</p>`);
fs.writeFileSync(hybridFile,hybrid);
// Include navigation and photo handling on every existing HTML page, at its actual depth.
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory()){if(!['data','scripts','assets'].includes(e.name))walk(f);}else if(e.name.endsWith('.html')){
  let html=fs.readFileSync(f,'utf8');const prefix=path.relative(path.dirname(f),root).replaceAll('\\','/')||'.';
  if(!html.includes('/assets/pilot.css'))html=html.replace('</head>',`<link rel="stylesheet" href="${prefix}/assets/pilot.css"><script src="${prefix}/assets/static-photo-fallback.js"></script></head>`);
  html=html.replace(/<img\b[^>]*>/g,img=>img.includes('class=')?img:img.replace('<img','<img class="pilot-photo"'));
  html=html.replaceAll('車種群','車種').replaceAll('차종군','차종').replaceAll('공식 신고 행','공식 사양').replaceAll('신고행','사양');
  fs.writeFileSync(f,html);
}}}walk(root);
console.log('Reviewed pilot: 6 existing public details, 3 comparison pages, shared photos and accessible navigation.');
