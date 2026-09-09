import {siteConfig} from './site-config.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {reviewedImage} from './reviewed-static-media.mjs';
import {normalizeFuelSnapshot} from './fuel-price-state.mjs';
import {tools,guides,annualFaq,sources} from './utility-content.mjs';
import {updateStaticCosts} from './static-cost-values.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const catalog=read('data/generated/catalog.json'),cars=catalog.cars.filter(c=>c.indexable);
const statusPath=path.join(root,'data/generated/opinet-status.json');
const fuel=normalizeFuelSnapshot(read('data/fuel-price.json'),fs.existsSync(statusPath)?JSON.parse(fs.readFileSync(statusPath,'utf8')):{});
const base=siteConfig.baseUrl;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const write=(rel,html)=>{const f=path.join(root,rel,'index.html');fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,html)};
const links=prefix=>`<div class="utility-links"><a href="${prefix}tools/">계산 도구</a><a href="${prefix}guide/">이용 가이드</a><a href="${prefix}terms/">이용안내</a></div>`;
function page(title,description,rel,content){
  const prefix='../'.repeat(rel.split('/').filter(Boolean).length);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${esc(title)} | 내차데이터</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${base}${rel}/">${['site','home','pilot','clear-ui','utility'].map(s=>`<link rel="stylesheet" href="${prefix}assets/${s}.css">`).join('')}</head><body class="clear-site"><header class="db-header"><div class="db-shell"><a class="db-logo" href="${prefix}">내차데이터</a><nav class="db-nav" aria-label="주 메뉴"><a href="${prefix}cars/">차량</a><a href="${prefix}compare/">비교</a><a href="${prefix}tools/">계산 도구</a><a href="${prefix}guide/">가이드</a></nav></div></header><main><section class="page-hero"><div class="db-shell"><h1>${esc(title)}</h1><p>${esc(description)}</p></div></section>${content}</main><footer class="db-footer"><div class="db-shell">${links(prefix)}<div class="db-footer-links"><a href="${prefix}about/">소개</a><a href="${prefix}privacy/">개인정보처리방침</a><a href="${prefix}contact/">문의</a></div></div></footer></body></html>`;
}
const section=body=>`<section class="db-section"><div class="db-shell">${body}</div></section>`;
const faq=items=>`<section class="db-section utility-faq"><div class="db-shell"><h2>자주 묻는 질문</h2>${items.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>`;
const input=(id,label,value,attrs='')=>`<label for="${id}">${label}<input id="${id}" name="${id}" type="number" value="${value}" ${attrs}></label>`;
for(const tool of tools){
  const tax=tool.slug==='car-tax',ev=tool.slug==='ev-charge-cost';
  const fields=tax?`<label for="taxFuel">차량 유형<select id="taxFuel"><option value="engine">배기량 있는 승용차</option><option value="electric">전기 승용차</option></select></label>${input('cc','배기량 (cc)','1598','min="1" step="1" required')}<label for="registration">차령기산 참고월<input type="month" id="registration" value="${catalog.taxYear}-01" min="1900-01" max="${catalog.taxYear}-12" required></label><p class="notice">${catalog.taxYear}년 비영업용 승용차 기준입니다. 첫 등록월과 법정 차령기산월이 다른 차량은 관할 지자체에서 확인하세요.</p>`:`${!ev?'<label for="fuel">연료<select id="fuel"><option value="gasoline">휘발유</option><option value="diesel">경유</option><option value="lpg">LPG</option></select></label>':''}${input('distance','주행거리 (km)','20000','min="0" step="any" required')}${input('efficiency',ev?'전비 (km/kWh)':'연비 (km/L)',ev?'5':'12','min="0.01" step="any" required')}${input('unitPrice',ev?'충전단가 (원/kWh)':'연료가격 (원/L)','','min="0.01" step="any" required')}${!ev?'<p id="priceOrigin" class="notice">전국 평균 가격을 확인하고 있습니다. 직접 입력할 수도 있습니다.</p><p id="liveFuelStatus" class="fuel-status" role="status">유가 확인 중</p>':'<p class="notice">이용할 충전기의 단가를 입력하세요. 전비 5는 계산 예시이며 차량 사양에 맞춰 바꾸세요.</p>'}`;
  const sourceLinks=tax?`<a href="${sources.tax}">지방세법 제127조</a><a href="${sources.education}">지방교육세 제151조</a><a href="${sources.age}">차령 계산 기준</a>`:`<a href="${sources.efficiency}">한국에너지공단 표시연비</a>${!ev?`<a href="${sources.fuel}">오피넷 유가 정보</a>`:''}`;
  const content=section(`<div class="utility-grid"><form id="simpleCostForm" class="tool-panel" data-kind="${tool.slug}" data-tax-year="${catalog.taxYear}"><h2>계산 조건</h2><div class="utility-fields">${fields}</div><button class="utility-button" type="submit">계산하기</button></form><div class="tool-panel utility-result"><h2>${tool.unit}</h2><output id="costResult" aria-live="polite">${tax?'290,836원':'거리·효율·단가를 입력하세요'}</output><p id="costBreakdown">${tax?'1,598cc 신차 · 지방교육세 포함':'입력한 거리 전체에 대한 예상 비용입니다.'}</p><p class="notice">${tax?'연납 할인·개별 감면·일할계산은 제외합니다. 실제 고지액은 위택스·지자체 안내가 우선합니다.':ev?'전력 요금만 계산합니다. 주차료·점유 요금·구독료는 별도입니다.':'연료비만 계산합니다. 통행료·보험·정비비는 포함하지 않습니다.'}</p><a href="../annual-cost/">자동차세와 에너지비 함께 계산 →</a></div></div>`)+faq(tool.faqs)+section(`<div class="utility-reading"><h2>계산 기준과 예시</h2><a href="../../guide/${tool.guide}/">${guides.find(g=>g.slug===tool.guide).title} →</a><div class="utility-links">${sourceLinks}</div><p class="notice">기준 확인 2026.09.07</p></div>`);
  write(`tools/${tool.slug}`,page(tool.title,tool.description,`tools/${tool.slug}`,content).replace('</body>','<script src="../../assets/cost-math.js"></script><script src="../../assets/simple-cost-tools.js"></script></body>'));
}
write('tools',page('자동차 계산 도구','자동차세, 유류비, 충전비를 필요한 항목별로 계산하세요.','tools',section(`<div class="utility-directory">${[...tools,{slug:'annual-cost',title:'자동차세·에너지비 계산기',description:'차량 사양을 선택해 자동차세와 연료·충전비를 함께 계산합니다.'}].map(t=>`<a href="./${t.slug}/"><h2>${t.title}</h2><p>${t.description}</p><span>계산하기 →</span></a>`).join('')}</div>`)));
for(const guide of guides){
  const sourceLinks=guide.source==='tax'?`<a href="${sources.tax}">지방세법 제127조</a> · <a href="${sources.education}">제151조</a> · <a href="${sources.age}">시행령 제122조</a>`:`<a href="${sources[guide.source]}">${guide.source==='fuel'?'오피넷 유가 정보':'한국에너지공단 자동차 표시연비'}</a>`;
  write(`guide/${guide.slug}`,page(guide.title,guide.summary,`guide/${guide.slug}`,section(`<article class="utility-article">${guide.body}<div class="utility-reading"><h2>직접 계산하기</h2><a href="../../tools/${guide.tool}/">${guide.tool==='annual-cost'?'자동차세·에너지비 계산기':tools.find(t=>t.slug===guide.tool).title} →</a><p>관련 공식 자료: ${sourceLinks}</p><p class="notice">기준 확인 2026.09.07 · 내차데이터</p><a href="../">다른 가이드 보기 →</a></div></article>`)));
}
write('guide',page('자동차 비용·연비 가이드','계산 예시와 차량 비교 기준을 확인하세요.','guide',section(`<div class="utility-directory">${guides.map(g=>`<a href="./${g.slug}/"><h2>${g.title}</h2><p>${g.summary}</p><span>읽기 →</span></a>`).join('')}</div>`)));

const marker=(name,body)=>`<!-- READY:${name}:START -->${body}<!-- READY:${name}:END -->`;
function clean(html){return html.replace(/<!-- READY:([A-Z]+):START -->[\s\S]*?<!-- READY:\1:END -->/g,'');}
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,e.name);
  if(e.isDirectory()){if(!['assets','data','scripts'].includes(e.name))walk(file);continue;}
  if(e.name!=='index.html')continue;
  let html=clean(fs.readFileSync(file,'utf8'));
  const rel=path.relative(root,file).replaceAll('\\','/'),url=base+rel.replace(/index.html$/,''),prefix=(path.relative(path.dirname(file),root).replaceAll('\\','/')||'.')+'/';
  if(!html.includes('assets/utility.css'))html=html.replace('</head>',`<link rel="stylesheet" href="${prefix}assets/utility.css"></head>`);
  if(rel==='cars/index.html'){
    const fallback=`<section id="catalogStatic" class="db-section"><div class="db-shell"><h2>주요 차량</h2><p class="notice">차종을 선택해 사양별 연비와 자동차세를 확인하세요.</p><div class="home-cars">${cars.map(c=>{const photo=reviewedImage(c.id);return `<article class="home-car"><figure><img class="pilot-photo" src="${esc(photo.url)}" alt="${esc(c.model)} ${esc(photo.generation)}" width="${photo.width}" height="${photo.height}" loading="lazy"><details class="image-credit"><summary>사진 출처</summary><p><a href="${esc(photo.source_page)}">${esc(photo.author)}</a> · <a href="${esc(photo.license_url)}">${esc(photo.license)}</a></p></details></figure><a class="car-card" href="../${esc(c.path.replace(/^\.\//,''))}"><small>${esc(c.maker)} · ${esc(c.yearLabel)}</small><h3>${esc(c.model)}</h3><p>${esc(c.rep.label)}</p><strong>${c.rep.combined} ${c.energy==='ev'?'km/kWh':'km/L'}</strong></a></article>`;}).join('')}</div></div></section>`;
    html=html.replace('</main>',marker('CATALOG',fallback)+'</main>');
    // Keep fallback visible if JS is disabled, its module fails, or the fetch fails.
    html=html.replace('한국에너지공단 공식 신고 데이터를 제조사 → 차종 → 세대 → 파워트레인 순으로 한눈에 확인할 수 있습니다.','차종을 선택하면 제원과 사양별 연비를 볼 수 있습니다.');
  }
  if(rel==='tools/annual-cost/index.html')html=html.replace('</main>',marker('FAQ',faq(annualFaq))+'</main>');
  const car=catalog.cars.find(c=>rel===c.path.replace(/^\.\//,'')+'index.html');
  if(car)html=updateStaticCosts(html,car,catalog);
  if(rel==='cars/hyundai/grandeur-gn7/index.html'&&!html.includes('assets/catalog-data.js'))html=html.replace(/<script src="([^"<>]*assets\/detail.js)"><\/script>/,`<script src="${prefix}assets/catalog-data.js"></script><script src="$1"></script>`);
  const priced=catalog.cars.some(c=>rel===c.path.replace(/^\.\//,'')+'index.html')||rel.startsWith('compare/')||rel==='tools/annual-cost/index.html';
  if(priced){
    const label=fuel.stale?`유가 갱신 지연 · ${fuel.price_as_of} 마지막 수집 가격`:`오피넷 전국 평균 · ${fuel.price_as_of} 기준`;
    html=html.replace(/<main([^>]*)>/,`<main$1>${marker('PRICE',`<div class="fuel-status-wrap"><p class="fuel-status${fuel.stale?' is-delayed':''}" data-fuel-status data-price-date="${esc(fuel.price_as_of)}" data-price-stale="${fuel.stale}">${esc(label)}</p></div>`)}`);
    html=html.replace('</body>',marker('RUNTIME',`<script src="${prefix}assets/fuel-status.js"></script>`)+'</body>');
  }
  if(['index.html','cars/index.html','compare/index.html','tools/annual-cost/index.html'].includes(rel))html=html.replace(/(<footer\b[^>]*>\s*<div class="db-shell">)/,'$1'+marker('LINKS',`<nav aria-label="이용 메뉴">${links(prefix)}</nav>`));
  const title=decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g,'')||html.match(/<title>(.*?)<\/title>/)?.[1]||'내차데이터');
  const graph=[];
  if(rel==='index.html')graph.push({'@type':'WebSite','@id':base+'#website',name:'내차데이터',url:base,inLanguage:'ko-KR',publisher:{'@id':base+'#organization'}},{'@type':'Organization','@id':base+'#organization',name:'내차데이터',url:base});
  const comparison=/^compare\/[^/]+\/index.html$/.test(rel),rank=rel.startsWith('rankings/'),utility=rel.startsWith('tools/'),guide=rel.startsWith('guide/');
  if(comparison||rank||utility||guide){
    if(!html.includes('"@type":"WebApplication"'))graph.push({'@type':utility&&rel!=='tools/index.html'?'WebApplication':'WebPage','@id':url+'#page',url,name:title,inLanguage:'ko-KR',...(utility&&rel!=='tools/index.html'?{applicationCategory:'UtilitiesApplication',operatingSystem:'Any',isAccessibleForFree:true}:{})});
    const group=comparison?'compare':rank?'rankings/fuel-economy':utility?'tools':'guide';
    const names=comparison?'차량 비교':rank?'연비 순위':utility?'계산 도구':'가이드';
    const crumbs=[{name:'홈',item:base},...(url===base+group+'/'?[]:[{name:names,item:base+group+'/'}]),{name:title,item:url}];
    graph.push({'@type':'BreadcrumbList',itemListElement:crumbs.map((c,i)=>({'@type':'ListItem',position:i+1,...c}))});
  }
  if(rank){
    const rows=[...html.matchAll(/<article class="rank-row"[\s\S]*?<\/article>/g)].map(m=>m[0]);
    graph.push({'@type':'ItemList',name:title,numberOfItems:rows.length,itemListElement:rows.map(row=>({'@type':'ListItem',position:Number(row.match(/data-rank="(\d+)"/)[1]),name:decode(row.match(/<h2>(.*?)<\/h2>/)[1]+' · '+row.match(/<p>(.*?)<\/p>/)[1]),url:new URL(decode(row.match(/href="([^"]+)"/)[1]),url).href}))});
  }
  if(graph.length)html=html.replace('</head>',marker('SCHEMA',`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')}</script>`)+'</head>');
  fs.writeFileSync(file,html);
}}walk(root);
console.log('Launch readiness: static six-car fallback, fuel status, structured data, four tools and six guides.');

await import('./build-popular-models.mjs');
