import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pageUrl,siteConfig} from './site-config.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const readJson=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const familyIndex=readJson('data/generated/family-detail-index.json');
const photoIndex=readJson('data/vehicle-photo-index.json');
const fuel=readJson('data/fuel-price.json');
const calcRows=readJson('data/generated/all-car-calc-index.json').rows||[];
const photos=new Map((photoIndex.records||[]).map(row=>[row.family_id,row]));
const families=familyIndex.families||[];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>String(value??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const range=value=>value?value.min===value.max?String(value.min):`${value.min}–${value.max}`:'—';
const ptLabel={gasoline:'휘발유',diesel:'경유',lpg:'LPG',hybrid:'하이브리드',phev:'플러그인 하이브리드',electric:'전기',hydrogen:'수소',unknown:''};
const unit=kind=>kind==='electric'?'km/kWh':kind==='hydrogen'?'km/kg':'km/L';
const prefixFor=file=>(path.relative(path.dirname(file),root).replaceAll('\\','/')||'.')+'/';
const annualTax=row=>row.powertrain==='electric'?130000:Number(row.displacement_cc)>0?Math.round(Number(row.displacement_cc)*(row.displacement_cc<=1000?80:row.displacement_cc<=1600?140:200)*1.3):null;
function defaultBenchmark(){
  const selected=calcRows.find(row=>row.family_name==='쏘렌토'&&row.full_cost_ready);if(!selected)return null;
  const price=Number(fuel.prices?.[selected.fuel_price_key]||0),distance=20000,peers=calcRows.filter(row=>row.full_cost_ready&&row.powertrain===selected.powertrain&&row.vehicle_class===selected.vehicle_class&&row.combined_efficiency>0&&annualTax(row)!=null),total=row=>distance/row.combined_efficiency*price+annualTax(row),values=peers.map(total).sort((a,b)=>a-b),current=total(selected),mid=values.length%2?values[Math.floor(values.length/2)]:(values[values.length/2-1]+values[values.length/2])/2,avg=values.reduce((sum,value)=>sum+value,0)/values.length,rank=values.filter(value=>value<current).length+1;
  return {current,mid,avg,rank,count:values.length,percent:Math.round(rank/values.length*100),powertrain:selected.powertrain,vehicleClass:selected.vehicle_class};
}

function commonHead(title,description,rel,prefix){
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | 내차데이터</title><meta name="description" content="${esc(description)}"><meta name="robots" content="${esc(siteConfig.robots)}"><link rel="canonical" href="${pageUrl(rel)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)} | 내차데이터"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${pageUrl(rel)}"><link rel="stylesheet" href="${prefix}assets/site.css"><link rel="stylesheet" href="${prefix}assets/home.css"><link rel="stylesheet" href="${prefix}assets/clear-ui.css"><link rel="stylesheet" href="${prefix}assets/page-design.css"><link rel="stylesheet" href="${prefix}assets/data-service.css"></head>`;
}
function nav(prefix,current=''){
  return `<header class="db-header"><div class="db-shell"><a class="db-logo" href="${prefix}">내차데이터</a><nav class="db-nav" aria-label="주 메뉴">${[['cars/','차량 찾기','cars'],['compare/','비교','compare'],['tools/','계산','tools'],['rankings/','순위','rankings']].map(([href,label,key])=>`<a href="${prefix}${href}"${current===key?' aria-current="page"':''}>${label}</a>`).join('')}</nav></div></header>`;
}
function footer(prefix){return `<footer class="page-footer"><strong>내차데이터</strong><p>자동차세와 연료·충전비를 같은 조건으로 계산합니다.</p><nav aria-label="운영 정보"><a href="${prefix}tools/">계산 도구</a><a href="${prefix}guide/">이용 가이드</a><a href="${prefix}about/">사이트 소개</a><a href="${prefix}data-sources/">데이터 출처</a><a href="${prefix}methodology/">계산 기준</a><a href="${prefix}terms/">이용안내</a><a href="${prefix}privacy/">개인정보 처리방침</a><a href="${prefix}contact/">오류 신고</a><a href="${prefix}media-policy/">사진 이용안내</a></nav></footer>`}

function initialFamilies(){
  const domestic=['현대','기아','제네시스','케이지모빌리티','KG모빌리티','르노코리아','한국지엠'];
  return families.filter(row=>row.static_detail_path&&domestic.includes(row.maker)).sort((a,b)=>domestic.indexOf(a.maker)-domestic.indexOf(b.maker)||a.family_name.localeCompare(b.family_name,'ko',{numeric:true})).slice(0,24);
}
function staticRow(f){
  const main=(f.powertrains||[]).find(row=>row.combined_efficiency&&row.powertrain!=='unknown')||(f.powertrains||[]).find(row=>row.combined_efficiency);
  const efficiency=main?`${range(main.combined_efficiency)} ${unit(main.powertrain)}`:'공개값 없음';
  const href=f.static_detail_path?`../${f.static_detail_path}`:'';
  return `<li><div><span>${esc(f.maker)}</span><strong>${esc(f.family_name)}</strong></div><b>${esc(ptLabel[main?.powertrain]||'표시 효율')} ${esc(efficiency)}</b>${href?`<a href="${esc(href)}">차량 보기</a>`:'<span>신고 사양만</span>'}</li>`;
}
function buildCars(){
  const rel='cars/',prefix='../',description='422종 신고 사양에서 제조사, 차명, 연료별 연비·전비를 찾고 제원이 확인된 차량의 자동차세와 연간 비용을 계산합니다.';
  const rows=initialFamilies();
  const schema={'@context':'https://schema.org','@graph':[{'@type':'CollectionPage','@id':pageUrl(rel)+'#page',url:pageUrl(rel),name:'차량 찾기',description,inLanguage:'ko-KR'},{'@type':'BreadcrumbList',itemListElement:[['홈',pageUrl('')],['차량 찾기',pageUrl(rel)]].map(([name,item],i)=>({'@type':'ListItem',position:i+1,name,item}))}]};
  const html=commonHead('차량 찾기',description,rel,prefix).replace('</head>',`<script type="application/ld+json">${JSON.stringify(schema).replaceAll('<','\\u003c')}</script></head>`)+`<body data-reference-page="catalog" class="studio-ui clear-site">${nav(prefix,'cars')}<main><section class="page-hero compact"><div class="db-shell"><h1>차량 찾기</h1><p>422종 신고 사양에서 연비와 자동차세를 찾습니다.</p></div></section><section class="db-section"><div class="db-shell"><noscript><section id="catalogStatic" class="catalog-static"><div class="catalog-static-head"><h2>제원 확인 차량 24종</h2><p>자바스크립트 없이 읽을 수 있는 첫 목록입니다.</p></div><ol>${rows.map(staticRow).join('')}</ol></section></noscript><div id="tableHost"></div><p class="source-strip">한국에너지공단 자동차 표시연비 자료 · 차량 422종 · 대표 사진 ${(photoIndex.records||[]).length}종</p></div></section></main>${footer(prefix)}<script src="../assets/catalog-consumer.js"></script></body></html>`;
  fs.writeFileSync(path.join(root,'cars/index.html'),html);
}

function rebuildInfoPages(){
  const pages={
    'terms':{title:'이용안내',description:'계산 범위와 공식 원문 우선 원칙을 안내합니다.',body:`<h2>계산 범위</h2><p>지금 연간 합계에는 자동차세와 연료·충전비만 들어 있습니다. 구매가격, 보험료, 정비비, 감가상각, 취득세는 포함하지 않습니다.</p><h2>표시 금액</h2><p>선택한 신고 사양과 입력 조건으로 계산한 참고값입니다. 실제 고지액과 결제 금액은 위택스, 지방자치단체, 주유소, 충전사업자 안내가 우선합니다.</p><h2>리콜</h2><p>모델별 공지는 대상 범위를 좁히기 위한 자료입니다. 개별 차량의 최종 대상 여부는 자동차리콜센터에서 차량번호 또는 차대번호로 확인해야 합니다.</p>`},
    'data-sources':{title:'데이터 출처',description:'표시연비, 자동차세, 유가, 리콜, 차량 사진의 출처와 갱신 기준입니다.',body:`<div class="source-ledger"><section><h2>연비·전비</h2><p><strong>한국에너지공단 자동차 표시연비 정보</strong></p><p>공개된 사양을 정기적으로 다시 확인합니다. 모델명, 연료, 복합·도심·고속 효율과 배기량을 원문 기준으로 보관합니다.</p></section><section><h2>자동차세</h2><p><strong>국가법령정보센터 지방세법·시행령</strong></p><p>비영업용 승용차 표준세율과 지방교육세를 적용합니다. 연납, 지역별 감면, 일할계산은 제외합니다.</p></section><section><h2>연료 가격</h2><p><strong>한국석유공사 오피넷 전국 평균</strong></p><p>매일 갱신을 시도합니다. 수집에 실패하면 마지막 정상값과 그 날짜를 표시합니다. 현재 기준일은 ${esc(fuel.price_as_of)}입니다.</p></section><section><h2>제조사 제원</h2><p><strong>현대자동차·기아·제네시스 공식 제원과 카탈로그</strong></p><p>전장, 전폭, 전고, 축거 등은 공식 문서에서 확인된 35종에만 연결합니다.</p></section><section><h2>리콜</h2><p><strong>국토교통부 자동차리콜센터</strong></p><p>공지 제목, 대상 차종, 생산기간과 시정방법을 정리합니다. 개별 차량 판정은 공식 조회 결과가 우선합니다.</p></section><section><h2>차량 사진</h2><p><strong>Wikimedia Commons 등 이용 조건 확인 자료</strong></p><p>대표 사진 ${(photoIndex.records||[]).length}종의 저작자, 원본과 라이선스를 사진 이용안내에 공개합니다.</p></section></div>`},
    'contact':{title:'오류 신고',description:'차량명, 사양, 수치, 사진 연결 오류를 제보할 때 필요한 항목입니다.',body:`<h2>제보할 내용</h2><p>문제가 보이는 주소와 항목을 고르고, 화면에 표시된 값과 확인한 공식 자료를 함께 적어 주세요. 재현 조건이 있으면 브라우저와 화면 너비도 도움이 됩니다.</p><form class="report-form" id="errorReport"><label>문제가 있는 주소<input name="url" type="url" value="" placeholder="https://"></label><label>항목<select name="type"><option>차량명·분류</option><option>연비·전비</option><option>자동차세·비용</option><option>사진·출처</option><option>링크·화면</option></select></label><label>확인한 내용<textarea name="detail" rows="6" required placeholder="표시된 값과 확인한 공식 자료를 적어 주세요."></textarea></label><button type="submit">제보 내용 복사</button><output id="reportStatus" aria-live="polite"></output></form><h2>개인정보를 적지 마세요</h2><p class="report-note">차량번호, 차대번호, 이름, 전화번호는 적지 마세요. 복사한 내용은 운영자에게 전달할 때 사용할 수 있습니다. 공개 자료의 주소만 포함해 주세요.</p>`}
  };
  for(const [slug,page] of Object.entries(pages)){
    const prefix='../',body=`<section class="page-hero compact"><div class="db-shell"><h1>${page.title}</h1><p>${page.description}</p></div></section><section class="db-section"><div class="db-shell narrow">${page.body}</div></section>`;
    const script=slug==='contact'?`<script>document.getElementById('errorReport').addEventListener('submit',async e=>{e.preventDefault();const data=new FormData(e.currentTarget),value=['오류 주소: '+(data.get('url')||location.href),'항목: '+data.get('type'),'내용: '+data.get('detail')].join('\\n');try{await navigator.clipboard.writeText(value);document.getElementById('reportStatus').textContent='제보 내용을 복사했습니다.'}catch{document.getElementById('reportStatus').textContent='복사할 수 없습니다. 내용을 직접 선택해 복사해 주세요.'}})</script>`:'';
    fs.writeFileSync(path.join(root,slug,'index.html'),commonHead(page.title,page.description,slug+'/',prefix)+`<body data-reference-page="information" class="studio-ui clear-site">${nav(prefix)}<main>${body}</main>${footer(prefix)}${script}</body></html>`);
  }
}

function addFamilyFallback(){
  const file=path.join(root,'cars/family/index.html');let html=fs.readFileSync(file,'utf8');
  const compact=families.map(f=>{const main=(f.powertrains||[]).find(p=>p.combined_efficiency&&p.powertrain!=='unknown');return `<li><strong>${esc(f.maker)} ${esc(f.family_name)}</strong>${main?` · ${range(main.combined_efficiency)} ${unit(main.powertrain)}`:''}</li>`}).join('');
  const fallback=`<noscript><section class="db-section family-noscript"><div class="db-shell"><h1>신고 사양 미리보기</h1><p>이 주소는 미리보기입니다. 정적 상세가 있는 차량은 차량 찾기에서 고유 주소로 연결됩니다.</p><details><summary>차량명과 복합 효율 보기</summary><ol>${compact}</ol></details></div></section></noscript>`;
  if(!html.includes('family-noscript'))html=html.replace('<main',fallback+'<main');
  fs.writeFileSync(file,html);
}

function unifyVehicleSchema(html,file,rel){
  const family=families.find(row=>row.static_detail_path&&`${row.static_detail_path.replace(/\/$/,'')}/index.html`===rel);if(!family)return html;
  const url=pageUrl(family.static_detail_path),prefix=prefixFor(file),makerSlug=family.maker==='현대'?'hyundai':family.maker==='기아'?'kia':family.maker==='제네시스'?'genesis':null;
  const main=(family.powertrains||[]).find(row=>row.combined_efficiency&&row.powertrain!=='unknown');
  const matching=calcRows.filter(row=>row.family_id===family.family_id&&row.full_cost_ready&&row.powertrain===main?.powertrain);
  const calc=matching.sort((a,b)=>Number(b.combined_efficiency||0)-Number(a.combined_efficiency||0))[0]||calcRows.find(row=>row.family_id===family.family_id&&row.full_cost_ready);
  const photo=photos.get(family.family_id);
  const kept=[];
  html=html.replace(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,(whole,json)=>{try{const parsed=JSON.parse(json),nodes=parsed['@graph']||[parsed];kept.push(...nodes.filter(node=>!['WebPage','Vehicle','Car','BreadcrumbList'].includes(node['@type'])));return ''}catch{return whole}});
  const title=text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1])||`${family.maker} ${family.family_name}`,description=html.match(/<meta name="description" content="([^"]*)"/)?.[1]||`${family.family_name} 표시연비와 자동차세`;
  const vehicle={'@type':'Vehicle','@id':url+'#vehicle',name:`${family.maker} ${family.family_name}`,url,brand:{'@type':'Brand',name:family.maker},fuelType:ptLabel[main?.powertrain]||undefined,image:photo?(photo.optimized?.files?.at(-1)?.path?pageUrl(photo.optimized.files.at(-1).path):photo.image_url):undefined,additionalProperty:[...(main?[{'@type':'PropertyValue',name:'복합 효율',value:range(main.combined_efficiency),unitText:unit(main.powertrain)}]:[]),...(calc?[{'@type':'PropertyValue',name:'연간 자동차세',value:annualTax(calc),unitText:'원'}]:[])]};
  Object.keys(vehicle).forEach(key=>vehicle[key]===undefined&&delete vehicle[key]);
  const crumbs=[['홈',pageUrl('')],['차량 찾기',pageUrl('cars/')],...(makerSlug?[[family.maker,pageUrl(`cars/${makerSlug}/`)]]:[]),[family.family_name,url]].map(([name,item],i)=>({'@type':'ListItem',position:i+1,name,item}));
  const graph=[{'@type':'WebPage','@id':url+'#page',url,name:title,description,inLanguage:'ko-KR',mainEntity:{'@id':url+'#vehicle'}},vehicle,{'@type':'BreadcrumbList',itemListElement:crumbs},...kept];
  return html.replace('</head>',`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':graph}).replaceAll('<','\\u003c')}</script></head>`);
}

function normalizePublicHtml(){
  const banned=[
    ['Phase 1','현재 계산'],['GitHub Actions 정기 실행','정기 갱신'],['GitHub Actions','자동 갱신'],['품질 게이트','공개 전 확인'],['SEO 상세 페이지','차량 상세 페이지'],['세대 미분류','연식 통합'],['raw_only','source_only'],['reviewed_override','confirmed_mapping'],['snapshot','저장 자료'],['workflow','갱신 절차'],['차량을 선택하면 상세 사양이 표시됩니다.','차량명과 복합 효율은 아래 목록에서도 확인할 수 있습니다.'],['공식 신고 데이터','한국에너지공단 표시연비'],['어떤 기준으로 차를 찾고 있나요?','연비·전비·자동차세 순위'],['구매가격까지 비교','하이브리드 연료비 차이로 가격 차를 나눠 보기'],['전체 차량</button>','신고 사양 전체</button>'],['주요 차량</button>','제원 확인된 35종</button>'],['가솔린와','가솔린과'],['디젤와','디젤과'],['LPG와','LPG와']
  ];
  const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()){if(!['assets','data','scripts'].includes(entry.name))walk(file);continue}
    if(entry.name!=='index.html')continue;
    let html=fs.readFileSync(file,'utf8'),prefix=prefixFor(file),rel=path.relative(root,file).replaceAll('\\','/');
    for(const [from,to] of banned)html=html.replaceAll(from,to);
    if(!/<link\s+rel="(?:shortcut )?icon"/i.test(html))html=html.replace('</head>',`<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%2317232d'/%3E%3Cpath d='M13 39h38l-5-14H18zM18 39v7m28-7v7' fill='none' stroke='white' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E"></head>`);
    const pageTitle=text(html.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]);
    const pageDescription=html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1]||'';
    if(pageTitle&&!/<meta\s+property="og:title"/i.test(html))html=html.replace('</head>',`<meta property="og:title" content="${esc(pageTitle)}"></head>`);
    if(!/<meta\s+property="og:description"/i.test(html))html=html.replace('</head>',`<meta property="og:description" content="${esc(pageDescription)}"></head>`);
    if(!/<meta\s+property="og:type"/i.test(html))html=html.replace('</head>','<meta property="og:type" content="website"></head>');
    html=html.replace(/<nav class="db-nav"[^>]*>[\s\S]*?<\/nav>/,nav(prefix,rel.startsWith('cars/')?'cars':rel.startsWith('compare/')?'compare':rel.startsWith('tools/')?'tools':rel.startsWith('rankings/')?'rankings':'').match(/<nav[\s\S]*<\/nav>/)[0]);
    if(!html.includes('assets/data-service.css'))html=html.replace('</head>',`<link rel="stylesheet" href="${prefix}assets/data-service.css"></head>`);
    html=html.replace(/<div class="metric-baseline" aria-hidden="true"><span>0<\/span>/g,'<div class="metric-baseline" aria-hidden="true"><span></span>');
    html=html.replace(/<p class="decision-source">(?:현대|제네시스)([\s\S]*?\[현대\] 그랜저)/g,'<p class="decision-source">현대·제네시스$1');
    if(rel.startsWith('compare/')&&rel!=='compare/index.html'&&!html.includes('comparison-lead')){
      const lead=text(html.match(/<p class="analysis-lead">([\s\S]*?)<\/p>/)?.[1]);
      if(lead)html=html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/,`$1<p class="comparison-lead">${esc(lead)}</p>`);
    }
    if(rel==='rankings/index.html')html=html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/,'<h1>연비·전비·자동차세 순위</h1>').replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/,'$1<p class="ranking-scope">제조사 제원이 연결된 차종만 포함합니다. 국내 판매 신차 전체 순위가 아닙니다.</p>');
    if(rel==='about/index.html')html=html.replace(/<h1[^>]*>내차데이터<\/h1>/,'<h1>신고 사양으로 자동차세와 연료비를 계산합니다</h1>');
    if(rel==='about/index.html')html=html.replace(/차량 판매 카탈로그를 복제하지 않고[^<]*/,'공식 신고 사양의 연비·전비와 자동차세·에너지비를 같은 조건으로 비교하는 자동차 데이터 서비스입니다.');
    if(rel==='guide/index.html')html=html.replaceAll('<span>읽기 →</span>','<span>계산 기준 확인 →</span>');
    if(rel==='compare/index.html'){
      html=html.replace(/<title>[^<]*<\/title>/,'<title>차량 비교 · 연비·전비·자동차세·에너지비 | 내차데이터</title>');
      html=html.replace("const first=ready[0]||allData.families[0],second=ready[1]||ready[0]||allData.families[1]||first;","const first=ready.find(f=>f.family_name==='쏘렌토')||ready[0]||allData.families[0],second=ready.find(f=>f.family_name==='싼타페')||ready[1]||ready[0]||allData.families[1]||first;");
      html=html.replace("function rawRowLabel(r){const eff=r.combined_efficiency==null?'연비없음':`${r.combined_efficiency}${r.powertrain==='electric'?' km/kWh':' km/L'}`;return `${r.raw_model} · ${ptLabel[r.powertrain]||r.powertrain} · ${eff}${r.displacement_cc?` · ${r.displacement_cc}cc`:''}`}","function rawRowLabel(r){const fuel=ptLabel[r.powertrain]||'';const wheel=String(r.raw_model||'').match(/(\\d{2})인치/)?.[1];const cam=/빌트인\\s*캠|빌트인캠/i.test(r.raw_model||'')?(/off|미적용/i.test(r.raw_model||'')?' · 캠 없음':' · 빌트인 캠'):'';const u=r.powertrain==='electric'?'km/kWh':r.powertrain==='hydrogen'?'km/kg':'km/L';const eff=r.combined_efficiency==null?'효율 없음':r.combined_efficiency+' '+u;return (r.family_name||r.raw_model)+' '+fuel+(wheel?' · '+wheel+'인치':'')+cam+' · '+eff}");
      html=html.replace("function fullRawUnit(r){return r.powertrain==='electric'?'km/kWh':'km/L'}","function fullRawUnit(r){return r.powertrain==='electric'?'km/kWh':r.powertrain==='hydrogen'?'km/kg':'km/L'}");
      html=html.replace("mode==='all'?'전체 공식 사양 중 계산 조건이 확인된 항목만 금액 비교에 사용합니다.':'제조사 공식 제원이 있는 차량끼리 비교합니다.'","mode==='all'?'신고 사양 중 세금 또는 에너지비를 계산할 수 있는 항목입니다.':'제조사 제원이 연결된 35종입니다.'");
    }
    if(rel==='tools/annual-cost/index.html'){
      const bench=defaultBenchmark(),money=value=>Math.round(value).toLocaleString('ko-KR')+'원';
      html=html.replace("const preferred=allData.families.find(f=>f.full_ready_count>0)||allData.families[0];","const preferred=allData.families.find(f=>f.family_name==='쏘렌토'&&f.full_ready_count>0)||allData.families.find(f=>f.full_ready_count>0)||allData.families[0];");
      html=html.replace("function rowLabel(r){const pt={gasoline:'휘발유',diesel:'경유',lpg:'LPG',hybrid:'하이브리드',phev:'PHEV',electric:'전기',hydrogen:'수소',unknown:'확인 중'}[r.powertrain]||r.powertrain;const eff=r.combined_efficiency==null?'연비없음':`${r.combined_efficiency}${r.powertrain==='electric'?' km/kWh':' km/L'}`;return `${r.raw_model} · ${pt} · ${eff}${r.displacement_cc?` · ${r.displacement_cc}cc`:''}`}","function rowLabel(r){const pt={gasoline:'휘발유',diesel:'경유',lpg:'LPG',hybrid:'하이브리드',phev:'플러그인 하이브리드',electric:'전기',hydrogen:'수소',unknown:''}[r.powertrain]||'';const wheel=String(r.raw_model||'').match(/(\\d{2})인치/)?.[1];const cam=/빌트인\\s*캠|빌트인캠/i.test(r.raw_model||'')?(/off|미적용/i.test(r.raw_model||'')?' · 캠 없음':' · 빌트인 캠'):'';const u=r.powertrain==='electric'?'km/kWh':r.powertrain==='hydrogen'?'km/kg':'km/L';const eff=r.combined_efficiency==null?'효율 없음':r.combined_efficiency+' '+u;return (r.family_name||r.raw_model)+' '+pt+(wheel?' · '+wheel+'인치':'')+cam+' · '+eff}");
      html=html.replace("assumption.textContent=`${r.maker} ${r.family_name} · ${r.generation_label} · ${r.raw_model} · 연 ${km.toLocaleString('ko-KR')}km · ${r.vehicle_class||'차종 미표기'}${r.energy_cost_ready&&p?` · ${fullFuelLabel(r)} ${p.toLocaleString('ko-KR')}${r.powertrain==='electric'?'원/kWh':'원/L'}`:''}`","assumption.textContent=`${r.maker} ${rowLabel(r)} · ${r.generation_label?.includes('미분류')?'연식 통합':r.generation_label||'연식 통합'} · 연 ${km.toLocaleString('ko-KR')}km · ${r.vehicle_class||'차종 미표기'}${r.energy_cost_ready&&p?` · ${fullFuelLabel(r)} ${p.toLocaleString('ko-KR')}${r.powertrain==='electric'?'원/kWh':'원/L'}`:''}`");
      html=html.replaceAll("r.generation_label==='세대 미분류'","r.generation_label?.includes('미분류')");
      html=html.replaceAll("r.generation_label==='연식 통합'","r.generation_label?.includes('미분류')");
      html=html.replaceAll("String(g).includes('확인 중')?'연식 통합':g","/(미분류|확인 중)/.test(String(g))?'연식 통합':g");
      html=html.replaceAll("r.generation_label?.includes('확인 중')?'연식 통합':r.generation_label||'연식 통합'","/(미분류|확인 중)/.test(r.generation_label||'')?'연식 통합':r.generation_label||'연식 통합'");
      // The public-copy pass also rewrites strings embedded in inline JavaScript.
      // Restore the full internal-value matcher so an unclassified generation is
      // always rendered as the consumer label "연식 통합" after every rebuild.
      html=html.replaceAll('/(확인 중|확인 중)/','/(미분류|확인 중)/');
      html=html.replace("generation.innerHTML=gens.map(g=>`<option value=\"${String(g).replace(/\"/g,'&quot;')}\">${g}</option>`).join('')","generation.innerHTML=gens.map(g=>`<option value=\"${String(g).replace(/\"/g,'&quot;')}\">${String(g).includes('미분류')?'연식 통합':g}</option>`).join('')");
      if(!html.includes('data-cost-benchmark'))html=html.replace('</main>',`<section class="db-section"><div class="db-shell"><div class="cost-benchmark" data-cost-benchmark><h2>같은 동력 사양과 비교</h2><p data-benchmark-scope>${bench?`${bench.vehicleClass} · ${ptLabel[bench.powertrain]} · 계산 가능한 신고 사양 ${bench.count}개 · 신차 세액 기준`:'차량을 선택하면 비교 범위가 표시됩니다.'}</p><div class="benchmark-values"><div><span>선택 사양</span><strong data-benchmark-current>${bench?money(bench.current):'—'}</strong></div><div><span>중앙값</span><strong data-benchmark-median>${bench?money(bench.mid):'—'}</strong></div><div><span>평균</span><strong data-benchmark-average>${bench?money(bench.avg):'—'}</strong></div></div><div class="benchmark-range"><div class="benchmark-track"><span data-benchmark-fill style="width:${bench?bench.percent:0}%"></span></div><div class="benchmark-rank"><b data-benchmark-diff>${bench?`${bench.current<=bench.mid?'중앙값보다 낮음':'중앙값보다 높음'} ${money(Math.abs(bench.current-bench.mid))}`:'—'}</b><span data-benchmark-rank>${bench?`낮은 비용부터 ${bench.rank} / ${bench.count} · ${bench.percent}% 위치`:'—'}</span></div></div></div></div></section></main>`).replace('</body>','<script src="../../assets/cost-benchmark.js"></script></body>');
    }
    if(/^rankings\/[^/]+\/index\.html$/.test(rel))html=html.replace(/<h2>([^<]+)<\/h2>/g,'<h3>$1</h3>');
    if(rel==='recalls/index.html')html=html.replace(/(<article[^>]*data-recall-id="g80-engine-nut-[\s\S]*?<div class="recall-card-meta"><span>)(?:현대|제네시스)(<\/span>)/,'$1현대·제네시스$2');
    html=unifyVehicleSchema(html,file,rel);
    fs.writeFileSync(file,html);
  }};walk(root);
}

function addVehicleKeylines(){
  for(const family of families.filter(row=>row.static_detail_path)){
    const file=path.join(root,family.static_detail_path,'index.html');if(!fs.existsSync(file))continue;
    let html=fs.readFileSync(file,'utf8');if(html.includes('vehicle-keyline'))continue;
    const answer=text(html.match(/<p class="answer">([\s\S]*?)<\/p>/)?.[1]);
    if(answer)html=html.replace(/(<div class="subtitle"[^>]*>[\s\S]*?<\/div>)/,`$1<p class="vehicle-keyline">${esc(answer.replace(/^.*?기준 /,''))}</p>`);
    html=html.replace(/(오피넷\s+)\d{4}[.-]\d{2}[.-]\d{2}(\s*유가)/g,`$1${fuel.price_as_of.replaceAll('-','.')}$2`);
    fs.writeFileSync(file,html);
  }
}

buildCars();
rebuildInfoPages();
addFamilyFallback();
normalizePublicHtml();
addVehicleKeylines();
console.log(`Prelaunch public audit applied: ${families.length} families, ${photoIndex.records.length} photos, fuel ${fuel.price_as_of}.`);
