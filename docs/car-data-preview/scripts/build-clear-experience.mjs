import {siteConfig} from './site-config.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {reviewedImage} from './reviewed-static-media.mjs';
import '../assets/cost-math.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const catalog=read('data/generated/catalog.json'),cars=catalog.cars.filter(c=>c.indexable);
const h=read('data/generated/service-hierarchy.json'),calc=read('data/generated/all-car-calc-index.json');
const bodyStyleRecords=read('data/body-style-reviewed.json').records;
const bodyStyles=new Map(bodyStyleRecords.map(record=>[record.family_id,record.body_style]));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=String(h.source_fetched_at).slice(0,10);
const rankTypes=[
 {slug:'fuel-economy',fuel:'gasoline',metric:'efficiency',direction:'higher',title:'휘발유 연비 순위',unit:'km/L'},
 {slug:'hybrid-fuel-economy',fuel:'hybrid',metric:'efficiency',direction:'higher',title:'하이브리드 연비 순위',unit:'km/L'},
 {slug:'ev-efficiency',fuel:'electric',metric:'efficiency',direction:'higher',title:'전기차 전비 순위',unit:'km/kWh'},
 {slug:'annual-energy-cost',metric:'energy-cost',direction:'lower',title:'연 2만km 에너지비 순위',unit:'원'},
 {slug:'car-tax',metric:'car-tax',direction:'lower',title:'자동차세 낮은 차 순위',unit:'원'},
 {slug:'suv-fuel-economy',bodyStyle:'suv',fuels:['gasoline','diesel','lpg','hybrid'],metric:'efficiency',direction:'higher',title:'SUV 연비 순위',unit:'km/L'},
 {slug:'sedan-fuel-economy',bodyStyle:'sedan',fuels:['gasoline','diesel','lpg','hybrid'],metric:'efficiency',direction:'higher',title:'세단 연비 순위',unit:'km/L'},
 {slug:'electric-suv-efficiency',bodyStyle:'suv',fuel:'electric',metric:'efficiency',direction:'higher',title:'전기 SUV 전비 순위',unit:'km/kWh'}
];
const staticPathByFamily=new Map(read('data/static-model-pages.json').records.map(r=>[r.family_id,r.path]));
const photoRecords=read('data/vehicle-image-sources.json').records;
const photoFamilies=new Set(photoRecords.map(r=>r.family_id));
const photoByFamily=new Map(photoRecords.map(r=>[r.family_id,r]));
const annualTax=r=>r.tax_ready?globalThis.CAR_COST_MATH.annualTax(r.displacement_cc,r.powertrain==='electric','2026-01',2026).total:null;
const fuelPrice=r=>calc.fuel_price.prices[r.powertrain==='hybrid'?'gasoline':r.powertrain]??null;
const rankingValue=(r,type)=>type.metric==='efficiency'?r.combined_efficiency:type.metric==='energy-cost'?(fuelPrice(r)?20000/r.combined_efficiency*fuelPrice(r):null):annualTax(r);
const comparisons=[['grandeur-vs-k8','그랜저 vs K8','2.5 가솔린 · 2WD'],['ioniq5-vs-ev6','아이오닉 5 vs EV6','롱레인지 · 2WD · 19인치'],['sorento-gasoline-vs-hybrid','쏘렌토 가솔린 vs 하이브리드','2.5 터보와 1.6 하이브리드'],['grandeur-gasoline-vs-hybrid','그랜저 가솔린 vs 하이브리드','2WD · 18인치'],['k8-gasoline-vs-hybrid','K8 가솔린 vs 하이브리드','2WD · 17인치']];
const nav=prefix=>`<header class="db-header"><div class="db-shell"><a class="db-logo" href="${prefix}">내차데이터</a><nav class="db-nav" aria-label="주 메뉴"><a href="${prefix}cars/">차량</a><a href="${prefix}compare/">비교</a><a href="${prefix}rankings/">순위</a><a href="${prefix}tools/annual-cost/">비용 계산</a><a href="${prefix}recalls/">리콜</a></nav></div></header>`;
const footer=prefix=>`<footer class="db-footer"><div class="db-shell"><div>내차데이터</div><div class="db-footer-links">${[['about','소개'],['methodology','계산 기준'],['data-sources','출처'],['contact','문의'],['privacy','개인정보처리방침'],['terms','이용약관']].map(([p,l])=>`<a href="${prefix}${p}/">${l}</a>`).join('')}</div></div></footer>`;
const head=(title,description,rel,prefix)=>`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${esc(title)} | 내차데이터</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${siteConfig.baseUrl}${rel}"><link rel="stylesheet" href="${prefix}assets/site.css"><link rel="stylesheet" href="${prefix}assets/home.css"><link rel="stylesheet" href="${prefix}assets/pilot.css"><script src="${prefix}assets/static-photo-fallback.js"></script></head>`;
function image(id){const r=reviewedImage(id);return `<img class="pilot-photo" src="${esc(r.url)}" alt="${esc(catalog.cars.find(c=>c.id===id).model)} ${esc(r.generation)} 차량 사진" width="${r.width}" height="${r.height}" loading="lazy"><details class="image-credit"><summary>사진 출처</summary><p>${esc(r.generation)} · <a href="${esc(r.source_page)}">${esc(r.author)}</a> · <a href="${esc(r.license_url)}">${esc(r.license)}</a></p></details>`;}
const comparisonList=prefix=>`<div class="comparison-list">${comparisons.map(([p,t,n])=>`<a href="${prefix}compare/${p}/"><strong>${t}</strong><small>${n}</small><b aria-hidden="true">→</b></a>`).join('')}</div>`;
const rankLinks=prefix=>`<div class="explore-links">${rankTypes.map(t=>`<a href="${prefix}rankings/${t.slug}/">${t.title}<span aria-hidden="true">→</span></a>`).join('')}</div>`;
const notices=read('data/recalls.json').notices.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3);
const home=head('자동차 연비·자동차세·유지비','차종별 연비와 자동차세를 찾고, 내 주행거리로 연료비를 비교하세요.','','./')+`<body class="clear-home">${nav('./')}<main><section class="home-search" id="search"><div class="db-shell home-search-layout"><div><h1 class="studio-sr-only">내차데이터</h1><form class="db-search" action="./cars/" method="get"><input name="q" type="search" placeholder="차종 또는 제조사" aria-label="차종 또는 제조사"><button type="submit">검색</button></form><div class="home-quick"><a href="./cars/?maker=현대">현대</a><a href="./cars/?maker=기아">기아</a><a href="./cars/?maker=제네시스">제네시스</a><a href="./cars/">전체 차량 →</a></div></div><figure>${image('grandeur-gn7')}</figure></div></section><section class="db-section"><div class="db-shell"><div class="db-heading"><h2>연비로 찾기</h2></div>${rankLinks('./')}</div></section><section class="db-section" id="catalog"><div class="db-shell"><div class="db-heading"><h2>주요 차량</h2><a class="section-link" href="./cars/">전체 차량 →</a></div><div class="home-cars" id="homeCatalog"><!-- GENERATED:HOME-CATALOG:START -->${cars.map(c=>`<article class="home-car"><figure>${image(c.id)}</figure><a class="car-card" href="${esc(c.path)}"><small>${esc(c.maker)} · ${esc(c.yearLabel)}</small><h3>${esc(c.model)}</h3><dl><dt>복합 ${c.energy==='ev'?'전비':'연비'}</dt><dd>${c.rep.combined} <small>${c.energy==='ev'?'km/kWh':'km/L'}</small></dd><dt>연간 자동차세</dt><dd>${c.rep.tax.toLocaleString('ko-KR')}<small>원</small></dd></dl><p class="variant-label">${esc(c.rep.label)}</p></a></article>`).join('')}<!-- GENERATED:HOME-CATALOG:END --></div><p class="rank-scope">표시된 사양 기준 · 자동차세는 비영업용 승용 신차 기준</p></div></section><section class="db-section soft"><div class="db-shell"><div class="db-heading"><h2>차량 비교</h2><a class="section-link" href="./compare/">직접 선택 →</a></div>${comparisonList('./')}</div></section><section class="db-section"><div class="db-shell"><div class="db-heading"><h2>최근 리콜</h2><a class="section-link" href="./recalls/">전체 공지 →</a></div><div class="recall-list" id="homeRecalls">${notices.map(n=>`<article class="recall-item"><div class="recall-date">${n.date}</div><div><a class="recall-title" href="./recalls/?id=${esc(n.id)}">${esc(n.title)}</a><div class="recall-model">${esc(n.maker)}</div></div><a href="./recalls/?id=${esc(n.id)}">보기 →</a></article>`).join('')}</div></div></section></main>${footer('./')}</body></html>`;
fs.writeFileSync(path.join(root,'index.html'),home);

// Limit rankings to reviewed model identities and explicit, usable efficiency data.
// Snapshot-era generations remain visible; these are not current-new-car market rankings.
const rankingSummaries=[];
for(const type of rankTypes){
  const candidates=calc.rows.filter(r=>{
    if(r.normalization_status!=='reviewed_override'||r.vehicle_class!=='승용차'||!photoFamilies.has(r.family_id))return false;
    if(type.fuel&&r.powertrain!==type.fuel)return false;
    if(type.fuels&&!type.fuels.includes(r.powertrain))return false;
    if(type.bodyStyle&&bodyStyles.get(r.family_id)!==type.bodyStyle)return false;
    if(type.metric==='energy-cost'&&!['gasoline','diesel','lpg','hybrid'].includes(r.powertrain))return false;
    if(type.metric==='car-tax'&&!['gasoline','diesel','lpg','hybrid'].includes(r.powertrain))return false;
    const value=rankingValue(r,type);return Number.isFinite(value)&&value>0;
  });
  candidates.sort((a,b)=>{
    const av=rankingValue(a,type),bv=rankingValue(b,type),metric=type.direction==='higher'?bv-av:av-bv;
    return metric||a.family_name.localeCompare(b.family_name,'ko')||a.calc_id.localeCompare(b.calc_id);
  });
  const seen=new Set(),selected=candidates.filter(r=>{if(seen.has(r.family_id))return false;seen.add(r.family_id);return true;});
  let lastValue,rank=0;
  const rows=selected.map((r,i)=>{const value=rankingValue(r,type);if(value!==lastValue)rank=i+1;lastValue=value;const shown=type.unit==='원'?Math.round(value).toLocaleString('ko-KR'):value;const detail=staticPathByFamily.get(r.family_id)?'../../'+staticPathByFamily.get(r.family_id):`../../cars/record/?id=${encodeURIComponent(r.catalog_id)}`;return `<article class="rank-row" data-rank="${rank}" data-calc-id="${esc(r.calc_id)}" data-family-id="${esc(r.family_id)}" data-metric-value="${value}" data-metric-direction="${type.direction}"><span class="rank-position">${rank}</span><div><h2>${esc(r.maker)} ${esc(r.family_name)}</h2><p>${esc(r.raw_model)}</p><a href="${esc(detail)}">이 사양 보기 →</a></div><div class="rank-value">${shown} <small>${type.unit}</small></div></article>`;}).join('');
  rankingSummaries.push({type,selected:selected.slice(0,3).map(row=>({row,value:rankingValue(row,type)})),count:selected.length});
  const description=type.metric==='efficiency'
    ?`등록 자료 중 ${selected.length}개 ${type.bodyStyle==='suv'?'SUV':type.bodyStyle==='sedan'?'세단':'차종'} 비교. 차종별 복합 ${type.fuel==='electric'?'전비':'연비'}가 가장 높은 사양을 표시합니다.`
    :type.metric==='energy-cost'
      ?`휘발유·경유·LPG·하이브리드 ${selected.length}개 차종을 연 20,000km와 같은 유가로 계산했습니다.`
      :`배기량이 확인된 내연기관·하이브리드 ${selected.length}개 차종의 신차 정상세액을 비교했습니다.`;
  const basis=type.metric==='efficiency'
    ?`연료가 확인되고 복합 ${type.fuel==='electric'?'전비':'연비'}가 있는 ${candidates.length.toLocaleString('ko-KR')}개 사양 중 차종별 최고값 한 개를 골랐습니다.${type.bodyStyle?` 제조사 공식 분류에서 ${type.bodyStyle==='suv'?'SUV':'세단'}으로 확인된 차종만 포함했습니다.`:''}`
    :type.metric==='energy-cost'
      ?`연 20,000km ÷ 복합연비 × ${calc.fuel_price.source} ${calc.fuel_price.price_as_of} 단가로 계산했습니다. 전기차는 충전 요금이 없어 제외했습니다.`
      :`배기량별 본세와 지방교육세 30%를 합산한 신차 정상세액입니다. 전기차·연납·차령 경감·개별 감면은 제외했습니다.`;
  const orderNote=type.direction==='higher'?'차종별 가장 높은 값을 한 개 골랐습니다.':'차종별 가장 낮은 값을 한 개 골랐습니다.';
  const bodySourceList=type.bodyStyle?`<details class="rank-method rank-body-sources"><summary>${type.bodyStyle==='suv'?'SUV':'세단'} 분류 출처</summary><ul>${selected.map(row=>{const source=bodyStyleRecords.find(record=>record.family_id===row.family_id);if(!source)throw Error(`Missing body style source: ${row.family_id}`);return `<li><a href="${esc(source.source_url)}">${esc(row.maker+' '+row.family_name)}</a> · ${esc(source.evidence)}</li>`;}).join('')}</ul></details>`:'';
  let html=head(type.title,description,`rankings/${type.slug}/`,'../../')+`<body class="${type.metric==='efficiency'?'':'cost-ranking'}">${nav('../../')}<main data-ranking-metric="${type.metric}" data-ranking-direction="${type.direction}"><section class="page-hero"><div class="db-shell"><div class="db-kicker">${type.metric==='efficiency'?'연비로 찾기':'비용으로 찾기'}</div><h1>${type.title}</h1><p>${description}</p><p class="rank-scope">자료 기준 ${date} · 과거 연식 포함 · 국내 판매 신차 전체 순위가 아닙니다.</p><nav class="rank-tabs" aria-label="순위 선택">${rankTypes.map(t=>`<a href="../${t.slug}/"${t.slug===type.slug?' aria-current="page"':''}>${t.title}</a>`).join('')}</nav></div></section><section class="db-section"><div class="db-shell"><div class="rank-list">${rows}</div><details class="rank-method"><summary>순위 기준과 출처</summary><ul><li>한국에너지공단 자료 중 차종과 계산 조건이 확인된 승용차를 비교했습니다. 이 사이트의 ${h.active_family_count}개 차량 전체를 대상으로 한 순위는 아닙니다.</li><li>${basis}</li><li>${orderNote} 같은 수치는 공동 순위입니다.</li><li>연식·휠·구동 방식이 서로 다릅니다. 표시된 사양명과 실제 차량의 조건을 확인하세요.</li><li>실제 비용은 주행 환경, 단가, 등록 시점에 따라 달라집니다.</li></ul><a href="../../data-sources/">한국에너지공단 자료와 갱신 기준</a></details>${bodySourceList}<div class="internal-cta"><a href="../../compare/">차량 비교</a><a class="light" href="../../tools/annual-cost/">내 주행거리로 계산</a></div></div></section></main>${footer('../../')}</body></html>`;
  const dir=path.join(root,'rankings',type.slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),html);
}

const rankingGroups=[
  {title:'연료별 효율',description:'휘발유·하이브리드·전기차를 같은 에너지 유형 안에서 비교합니다.',slugs:['fuel-economy','hybrid-fuel-economy','ev-efficiency']},
  {title:'차체 형태별',description:'제조사 공식 분류가 확인된 SUV와 세단만 모았습니다.',slugs:['suv-fuel-economy','sedan-fuel-economy','electric-suv-efficiency']},
  {title:'연간 비용',description:'연 2만km 에너지비와 신차 정상 자동차세를 낮은 순서로 봅니다.',slugs:['annual-energy-cost','car-tax']}
];
const hubRows=rankingGroups.map((group,groupIndex)=>`<section class="rank-hub-group"><header><span>0${groupIndex+1}</span><div><h2>${group.title}</h2><p>${group.description}</p></div></header><div class="rank-hub-list">${group.slugs.map(slug=>{const summary=rankingSummaries.find(item=>item.type.slug===slug),leader=summary.selected[0],photo=photoByFamily.get(leader.row.family_id),shown=summary.type.unit==='원'?Math.round(leader.value).toLocaleString('ko-KR'):leader.value;if(!photo)throw Error(`Missing ranking hub photo: ${leader.row.family_id}`);return `<a class="rank-hub-row" href="./${slug}/"><figure><img src="${esc(photo.image_url)}" alt="${esc(leader.row.maker)} ${esc(leader.row.family_name)} 차량 사진" width="${photo.width}" height="${photo.height}" loading="lazy"></figure><div><small>${summary.count}개 차종</small><h3>${summary.type.title}</h3><p>현재 1위 · ${esc(leader.row.maker)} ${esc(leader.row.family_name)}</p></div><strong>${shown}<small>${summary.type.unit}</small></strong><span aria-hidden="true">↗</span></a>`;}).join('')}</div></section>`).join('');
const rankingHubDescription='연료 유형과 차체 형태를 고른 뒤 연비·전비·연간 에너지비·자동차세 순위를 확인하세요.';
const rankingHub=head('자동차 연비·전비·비용 순위',rankingHubDescription,'rankings/','../')+`<body class="rank-hub">${nav('../')}<main><section class="rank-hub-hero"><div class="db-shell"><p class="db-kicker">자동차 데이터 순위</p><h1>어떤 기준으로<br>차를 찾고 있나요?</h1><p>${rankingHubDescription}</p><a href="#rank-categories">8개 순위 보기 <span aria-hidden="true">↓</span></a></div></section><div id="rank-categories" class="db-shell rank-hub-groups">${hubRows}</div><section class="rank-hub-note"><div class="db-shell"><h2>순위에 표시되는 값</h2><p>공개된 사양 중 차종별 최고 효율 또는 최저 비용 사양 한 개를 사용합니다. 연식·구동·휠 조건은 각 순위에서 확인할 수 있습니다.</p><a href="../data-sources/">자료 출처와 갱신 기준 →</a></div></section></main>${footer('../')}</body></html>`;
fs.mkdirSync(path.join(root,'rankings'),{recursive:true});fs.writeFileSync(path.join(root,'rankings/index.html'),rankingHub);

function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory()){if(!['data','scripts','assets'].includes(e.name))walk(file);}else if(e.name.endsWith('.html')){
  let html=fs.readFileSync(file,'utf8');const rel=path.relative(root,file).replaceAll('\\','/'),prefix=(path.relative(path.dirname(file),root).replaceAll('\\','/')||'.')+'/';
  if(!html.includes('assets/clear-ui.css'))html=html.replace('</head>',`<link rel="stylesheet" href="${prefix}assets/clear-ui.css"></head>`);
  html=html.replace(/<body([^>]*)>/,(all,attrs)=>attrs.includes('clear-site')?all:attrs.includes('class="')?'<body'+attrs.replace('class="','class="clear-site ')+'>':'<body class="clear-site"'+attrs+'>');
  html=html.replace(/<aside class="recall-aside">[\s\S]*?<\/aside>/g,'');
  html=html.replaceAll('같은 조건으로 비교','차량 비교').replaceAll('전체 공식 데이터','전체 차량').replaceAll('검수 상세 차량','주요 차량').replaceAll('검수 완료 계산 상세','주요 차량');
  html=html.replaceAll('전체 공식 신고 사양에서 두 차량을 고르고 같은 주행거리와 에너지 가격으로 비교합니다. 계산 조건이 부족한 항목은 임의의 0원 대신 제외 사유를 표시합니다.','차량과 사양을 선택해 자동차세와 연료비를 비교하세요.');
  if(rel==='recalls/index.html'){
    html=html.replace(/<footer[\s\S]*?<\/footer>/,footer('../'));
    html=html.replace('모델에 발표된 공개 공지를 확인합니다. 모델 공지가 있다고 해서 내 차량이 반드시 대상인 것은 아닙니다.','차종별 리콜 공지를 검색하세요.');
    html=html.replace('<p>생산기간·세부모델 범위를 확인해야 하며, “관련 모델” 표시는 해당 모델군 전체가 대상이라는 뜻이 아닙니다.</p>','');
    html=html.replace('현재 연결된 공지가 없습니다. 이는 리콜이 없다는 뜻이 아닙니다.','검색 결과가 없습니다. 다른 차종명으로 검색해 보세요.');
    html=html.replaceAll('최근 연결 공지','최근 리콜').replace("raw?'“'+raw+'” 연결 공지'","raw?raw+' 리콜'");
    html=html.replace(/<section class="db-section soft">[\s\S]*?<\/section>/,'');
    html=html.replaceAll('연결 모델 ${names} · ${n.match===\'model_family\'?\'모델군 연결\':\'관련 세부 사양\'}','${names}');
  }
  if(rel==='cars/hyundai/grandeur-gn7/index.html')html=html.replace(/<section class="data-section soft" id="recall">[\s\S]*?<\/section>/,'<section class="data-section soft" id="recall"><div class="shell"><h2 class="section-title">그랜저 리콜</h2><a class="button" href="../../../recalls/?q=그랜저">공지 보기 →</a></div></section>');
  if(rel==='compare/index.html'){
    html=html.replace(/<section class="db-section soft">[\s\S]*?<\/section>/,'');
    html=html.replace(/<!-- PILOT:COMPARE:START -->[\s\S]*?<!-- PILOT:COMPARE:END -->/,`<!-- PILOT:COMPARE:START --><section class="db-section"><div class="db-shell"><h2>비교할 차량 고르기</h2>${comparisonList('../')}</div></section><!-- PILOT:COMPARE:END -->`);
  }
  html=html.replaceAll('비교 전에 확인하세요','계산 기준').replaceAll('이 차량의 자료와 계산 범위','출처·계산 기준').replaceAll('사진의 연식·트림은 선택한 사양과 다를 수 있습니다.','연식·트림에 따라 외관 차이');
  fs.writeFileSync(file,html);
}}}walk(root);
console.log(`Clear UI: concise home and recalls, separated content, five comparisons and ${rankTypes.length} rankings.`);
await import('./build-launch-readiness.mjs');
