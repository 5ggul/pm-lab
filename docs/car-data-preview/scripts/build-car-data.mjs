import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const vehicleRoot=path.join(root,'data','vehicles');
const manifest=JSON.parse(fs.readFileSync(path.join(vehicleRoot,'manifest.json'),'utf8'));
const fuelPrice=JSON.parse(fs.readFileSync(path.join(root,'data','fuel-price.json'),'utf8'));
const recalls=JSON.parse(fs.readFileSync(path.join(root,'data','recalls.json'),'utf8'));
const assumptions=manifest.default_assumptions;
const annualKm=assumptions.annual_distance_km;
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const round=n=>Math.round(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt=n=>Number(n).toLocaleString('ko-KR');

function taxForVariant(v){
  if(v.fuel_type==='ev') return {base:100000,education:30000,total:130000};
  const cc=Number(v.displacement_cc),rate=cc<=1000?80:cc<=1600?140:200,base=cc*rate;
  return {base,education:base*.3,total:base*1.3};
}
function priceFor(v){
  if(v.fuel_type==='gasoline'||v.fuel_type==='hybrid') return fuelPrice.prices.gasoline;
  if(v.fuel_type==='diesel') return fuelPrice.prices.diesel;
  if(v.fuel_type==='lpg') return fuelPrice.prices.lpg;
  return null;
}
const combinedFor=v=>v.fuel_type==='ev'?v.energy_efficiency_combined_km_kwh:v.fuel_economy_combined;
const cityFor=v=>v.fuel_type==='ev'?v.energy_efficiency_city_km_kwh:v.fuel_economy_city;
const highwayFor=v=>v.fuel_type==='ev'?v.energy_efficiency_highway_km_kwh:v.fuel_economy_highway;
const fuelKey=v=>v.fuel_type==='ev'?'electric':v.fuel_type==='lpg'?'lpg':v.fuel_type==='diesel'?'diesel':'gas';
function label(v){
  const bits=[v.powertrain,v.drive];
  if(v.seats) bits.push(`${v.seats}인승`);
  if(v.wheel_inch) bits.push(`${v.wheel_inch}인치`);
  if(v.builtin_cam===true) bits.push('빌트인캠 적용');
  if(v.builtin_cam===false && /no-bic|no-cam/i.test(v.variant_id)) bits.push('빌트인캠 미적용');
  return bits.filter(Boolean).join(' · ');
}
function fileSourceUrl(image){
  if(image.source_url&&!/^https:\/\/commons\.wikimedia\.org\/?$/.test(image.source_url)) return image.source_url;
  const decoded=decodeURIComponent(image.url||''),m=decoded.match(/Special:Redirect\/file\/([^?]+)/i);
  return m?`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(m[1]).replace(/%2F/g,'/')}`:(image.source_url||'');
}
function licenseUrl(image){
  if(image.license_url) return image.license_url;
  if(/BY-SA 4\.0/i.test(image.license||'')) return 'https://creativecommons.org/licenses/by-sa/4.0/';
  if(/BY 4\.0/i.test(image.license||'')) return 'https://creativecommons.org/licenses/by/4.0/';
  return '';
}
function normalizeImage(image){const sourceUrl=fileSourceUrl(image),lic=licenseUrl(image);return {...image,source_url:sourceUrl,license_url:lic,sourceUrl,licenseUrl:lic}}
function compatibilityVariant(v){return {id:v.variant_id,label:label(v),powertrain:v.powertrain,fuel:fuelKey(v),fuelType:v.fuel_type,cc:v.displacement_cc??null,combined:combinedFor(v),city:cityFor(v)??null,highway:highwayFor(v)??null,grade:v.efficiency_grade??null,range:v.range_km??null,battery:v.battery_kwh??null,drive:v.drive,wheel:v.wheel_inch,seats:v.seats??null,builtinCam:v.builtin_cam??null,transmission:v.transmission??null,power:v.max_power??(v.motor_output_ps?`${v.motor_output_ps} PS`:null),torque:v.max_torque??(v.motor_torque_nm?`${v.motor_torque_nm} Nm`:null),motorOutputKw:v.motor_output_kw??null,curbWeight:v.curb_weight_kg??null};}
function vehicleToCatalog(v){
  const variants=v.variants.map(compatibilityVariant),repIndex=v.variants.findIndex(x=>x.variant_id===v.representative_variant_id);
  if(repIndex<0) throw new Error(`${v.id}: representative variant not found`);
  const sourceRep=v.variants[repIndex],rep=variants[repIndex],tax=taxForVariant(sourceRep),price=priceFor(sourceRep),imageMeta=normalizeImage(v.image);
  const energy=price==null?null:round(annualKm/combinedFor(sourceRep)*price),total=energy==null?null:round(tax.total+energy),energyKind=sourceRep.fuel_type==='ev'?'ev':'ice';
  return {id:v.id,maker:v.maker,model:v.display_name||v.model,generation:v.generation,code:v.code,yearLabel:String(v.model_year),segment:v.segment,type:/SUV|크로스오버/.test(v.body_type)?(energyKind==='ev'?'ev':'suv'):(energyKind==='ev'?'ev':'sedan'),energy:energyKind,path:`.${v.path}`,productionStart:v.production_start,aliases:v.aliases,indexable:v.indexable,reviewedOn:v.reviewed_on,coverageStatus:v.coverage_status,dimensions:v.dimensions,battery:v.battery??null,image:v.image.url,credit:`${v.image.author} · ${v.image.license}`,imageMeta,sourceName:v.sources.efficiency.name,sourceUrl:v.sources.efficiency.url,specSourceName:v.sources.specs?.name??null,specSourceUrl:v.sources.specs?.url??null,rep:{...rep,tax:round(tax.total),taxBase:round(tax.base),educationTax:round(tax.education),annualEnergy:energy,total},variants};
}
const sources=manifest.vehicles.map(entry=>{const data=readJson(path.join(vehicleRoot,entry.file));if(Boolean(data.indexable)!==Boolean(entry.indexable)) throw new Error(`${entry.id}: manifest indexable mismatch`);return {...data,display_name:entry.display_name};});
const cars=sources.map(vehicleToCatalog),publicCars=cars.filter(c=>c.indexable===true);
const catalog={generatedFrom:'data/vehicles/manifest.json',dataAsOf:fuelPrice.price_as_of,annualKm,taxYear:assumptions.tax_year,taxRuleEffectiveDate:assumptions.tax_rule_effective_date,taxRuleSource:assumptions.tax_rule_source,gasPrice:fuelPrice.prices.gasoline,dieselPrice:fuelPrice.prices.diesel,lpgPrice:fuelPrice.prices.lpg,fuelPriceSource:fuelPrice.source,fuelPriceAsOf:fuelPrice.price_as_of,fuelPriceStale:Boolean(fuelPrice.stale),cars};
const js=`/* GENERATED FILE. Source: data/vehicles/*.json + data/fuel-price.json */\nwindow.CAR_CATALOG=${JSON.stringify(catalog,null,2)};\nwindow.CAR_CATALOG.byId=Object.fromEntries(window.CAR_CATALOG.cars.map(c=>[c.id,c]));\nwindow.CAR_CATALOG.publicCars=window.CAR_CATALOG.cars.filter(c=>c.indexable===true);\nwindow.CAR_CATALOG.taxForCc=function(cc){const r=cc<=1000?80:cc<=1600?140:200;return Math.round(cc*r*1.3)};\nwindow.CAR_CATALOG.energyCost=function(v,km,price){return price?Math.round(km/v.combined*price):null};\n`;
fs.writeFileSync(path.join(root,'assets','catalog-data.js'),js);fs.mkdirSync(path.join(root,'data','generated'),{recursive:true});fs.writeFileSync(path.join(root,'data','generated','catalog.json'),JSON.stringify({...catalog,publicCars:publicCars.map(c=>c.id)},null,2)+'\n');

const marker=(name,html,body)=>{const start=`<!-- GENERATED:${name}:START -->`,end=`<!-- GENERATED:${name}:END -->`;if(body.includes(start))return body.replace(new RegExp(`${start}[\\s\\S]*?${end}`),`${start}${html}${end}`);return null;};
const photoCredit=c=>`<details class="photo-credit"><summary>사진 출처</summary><span>${esc(c.imageMeta.author)} · <a href="${esc(c.imageMeta.sourceUrl)}" target="_blank" rel="noopener">원본</a> · <a href="${esc(c.imageMeta.licenseUrl)}" target="_blank" rel="noopener">${esc(c.imageMeta.license)}</a> · 화면 표시용 크롭</span></details>`;
const carCard=c=>`<a class="car-card" href="${esc(c.path)}"><div class="car-card-media"><img loading="lazy" src="${esc(c.image)}" alt="${esc(c.model)}" width="900" height="600"></div>${photoCredit(c)}<div class="car-card-body"><div class="car-meta">${esc(c.maker)} · ${esc(c.segment)} · ${esc(c.yearLabel)}</div><h3>${esc(c.model)}</h3><div class="car-spec">${esc(c.rep.label)}</div><div class="car-numbers"><div class="car-number-row"><span>${c.energy==='ev'?'복합전비':'복합연비'}</span><strong>${c.rep.combined} ${c.energy==='ev'?'km/kWh':'km/L'}</strong></div><div class="car-number-row"><span>연간 정상 자동차세</span><strong>${fmt(c.rep.tax)}원</strong></div>${c.energy==='ev'?`<div class="car-number-row"><span>1회 충전거리</span><strong>${fmt(c.rep.range)} km</strong></div>`:`<div class="car-number-row"><span>20,000km 에너지비</span><strong>${fmt(c.rep.annualEnergy)}원</strong></div>`}</div><div class="car-arrow">사양별 상세 →</div></div></a>`;
const costRows=`<div class="cost-row head"><div>차량 / 기준 사양</div><div>효율</div><div>자동차세</div><div>에너지비</div><div>합계</div></div>`+publicCars.map(c=>`<div class="cost-row"><div><div class="model">${esc(c.model)}</div><small>${esc(c.rep.label)}</small></div><div><small class="mobile-label">효율</small><strong>${c.rep.combined} ${c.energy==='ev'?'km/kWh':'km/L'}</strong></div><div><small class="mobile-label">자동차세</small><span>${fmt(c.rep.tax)}원</span></div><div><small class="mobile-label">에너지비</small><span>${c.energy==='ev'?'충전단가 입력':fmt(c.rep.annualEnergy)+'원'}</span></div><a class="home-total" href="${c.energy==='ev'?'./tools/annual-cost/?car='+c.id:c.path}">${c.energy==='ev'?'계산 →':fmt(c.rep.total)+'원 →'}</a></div>`).join('');
const recentRecalls=recalls.notices.slice(0,5).map(n=>`<div class="recall-item"><div class="recall-date">${esc(n.date)}</div><div><div class="recall-title">${esc(n.title)}</div><div class="recall-model">${esc(n.maker)} · ${n.match==='model_family'?'모델군 연결':'관련 세부 사양'}</div></div><a href="./recalls/?id=${encodeURIComponent(n.id)}">보기 →</a></div>`).join('');
let homePath=path.join(root,'index.html'),home=fs.readFileSync(homePath,'utf8');
if(!home.includes('GENERATED:HOME-COST:START')) home=home.replace('<div id="homeCost" class="cost-table home-cost"></div>','<div id="homeCost" class="cost-table home-cost"><!-- GENERATED:HOME-COST:START --><!-- GENERATED:HOME-COST:END --></div>');
if(!home.includes('GENERATED:HOME-CATALOG:START')) home=home.replace('<div id="homeCatalog" class="catalog-grid"></div>','<div id="homeCatalog" class="catalog-grid"><!-- GENERATED:HOME-CATALOG:START --><!-- GENERATED:HOME-CATALOG:END --></div>');
if(!home.includes('GENERATED:HOME-RECALLS:START')) home=home.replace('<div id="homeRecalls" class="recall-list"></div>','<div id="homeRecalls" class="recall-list"><!-- GENERATED:HOME-RECALLS:START --><!-- GENERATED:HOME-RECALLS:END --></div>');
if(!home.includes('GENERATED:HOME-DATALIST:START')) home=home.replace(/<datalist id="allCars">[\s\S]*?<\/datalist>/,'<datalist id="allCars"><!-- GENERATED:HOME-DATALIST:START --><!-- GENERATED:HOME-DATALIST:END --></datalist>');
home=marker('HOME-COST',costRows,home)||home;home=marker('HOME-CATALOG',publicCars.map(carCard).join(''),home)||home;home=marker('HOME-RECALLS',recentRecalls,home)||home;home=marker('HOME-DATALIST',publicCars.map(c=>`<option value="${esc(c.model)}">`).join(''),home)||home;
const priceStrip=fuelPrice.stale?`유가 갱신 지연 · 마지막 정상 수신 ${fuelPrice.price_as_of.replaceAll('-','.')}`:`휘발유·경유·LPG: 오피넷 ${fuelPrice.price_as_of.replaceAll('-','.')}`;
home=home.replace(/<span data-fuel-price-strip>.*?<\/span>|<span>휘발유·LPG: 오피넷 [^<]+<\/span>/,`<span data-fuel-price-strip>${esc(priceStrip)}</span>`);fs.writeFileSync(homePath,home);

function modelSchema(car){const url=`https://5ggul.github.io/pm-lab/car-data-preview${car.path.slice(1)}`;return `<script type="application/ld+json" data-build-schema>{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"${esc(car.model)} 공식 사양·자동차세·에너지비","url":"${url}","dateModified":"${car.reviewedOn.replaceAll('.','-')}","mainEntity":{"@id":"${url}#vehicle"}},{"@type":"Vehicle","@id":"${url}#vehicle","name":"${esc(car.maker+' '+car.model)}","manufacturer":{"@type":"Organization","name":"${esc(car.maker)}"},"model":"${esc(car.model)}","bodyType":"${esc(car.segment)}"},{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"홈","item":"https://5ggul.github.io/pm-lab/car-data-preview/"},{"@type":"ListItem","position":2,"name":"${esc(car.maker)}"},{"@type":"ListItem","position":3,"name":"${esc(car.model)}","item":"${url}"}]}]}</script>`;}
function annotateMetrics(html){const map=[['복합연비','efficiency'],['복합전비','efficiency'],['연간 정상 자동차세','tax'],['연간 자동차세','tax'],['세금+유류비','annual-total'],['세금+에너지비','annual-total'],['1회 충전거리','range']];for(const [labelText,field] of map){const re=new RegExp(`<small>${labelText}<\\/small><b(?![^>]*data-field)`,`g`);html=html.replace(re,`<small>${labelText}</small><b data-field="${field}"`);}return html;}
for(const car of cars){const rel=car.path.slice(2)+'index.html',p=path.join(root,rel);if(!fs.existsSync(p))continue;let html=fs.readFileSync(p,'utf8');html=html.replace(/<script type="application\/ld\+json"(?: data-build-schema)?[^>]*>[\s\S]*?<\/script>/g,'');html=html.replace('</head>',modelSchema(car)+'</head>');html=annotateMetrics(html);if(html.includes('assets/model-lite.js')&&!html.includes('assets/car-utils.js')) html=html.replace(/<script src="([^"']*assets\/model-lite\.js)"><\/script>/,m=>m.replace('<script src="','<script src="').replace('</script>',`</script>`).replace('assets/model-lite.js','assets/car-utils.js')+m);const credit=photoCredit(car);html=html.replace(/<small>Photo:[\s\S]*?<\/small>|<small>[^<]*(?:Wikimedia Commons|CC BY)[^<]*<\/small>/,credit);fs.writeFileSync(p,html);}

const sorento=cars.find(c=>c.id==='sorento-mq4'),sorentoSource=sources.find(c=>c.id==='sorento-mq4');if(sorento){const p=path.join(root,'cars','kia','sorento-mq4','index.html');let html=fs.readFileSync(p,'utf8');const pick=[];const add=fn=>{const v=sorentoSource.variants.find(fn);if(v&&!pick.includes(v))pick.push(v)};add(v=>v.fuel_type==='gasoline'&&v.drive==='2WD'&&!v.builtin_cam);add(v=>v.fuel_type==='gasoline'&&v.builtin_cam);add(v=>v.fuel_type==='gasoline'&&v.drive==='4WD');add(v=>v.fuel_type==='diesel'&&v.drive==='2WD');add(v=>v.fuel_type==='hybrid'&&v.drive==='2WD');add(v=>v.fuel_type==='hybrid'&&v.drive==='4WD');const rows=pick.map(v=>`<div class="variant-row"><strong>${esc(label(v))}</strong><span>${v.fuel_economy_combined}</span><span>${v.fuel_economy_city}</span><span>${v.fuel_economy_highway}</span><span>${v.efficiency_grade??'—'}</span></div>`).join('');if(!html.includes('GENERATED:SORENTO-TABLE:START')) html=html.replace(/(<div class="variant-row head"><div>사양<\/div><div>복합<\/div><div>도심<\/div><div>고속<\/div><div>등급<\/div><\/div>)[\s\S]*?(<\/div><p class="source-line">)/,`$1<!-- GENERATED:SORENTO-TABLE:START --><!-- GENERATED:SORENTO-TABLE:END -->$2`);html=marker('SORENTO-TABLE',rows,html)||html;html=html.replace(/검수 완료 \d+개 신고 행/g,`${sorento.variants.length}개 신고 행`);fs.writeFileSync(p,html);}
console.log(`Built ${cars.length} vehicles / ${cars.reduce((n,c)=>n+c.variants.length,0)} variants / ${publicCars.length} public`);
