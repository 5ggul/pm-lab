import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {siteConfig} from './site-config.mjs';
import '../assets/cost-math.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const config=read('data/static-model-pages.json').records.filter(r=>r.status==='kea_editorial');
const calc=read('data/generated/all-car-calc-index.json');
const photos=read('data/vehicle-image-sources.json').records;
const manufacturerSpecs=read('data/manufacturer-spec-reviewed.json').records;
const base=siteConfig.baseUrl;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Math.round(n).toLocaleString('ko-KR')+'원';
const moneyRange=values=>{
 const clean=values.filter(Number.isFinite);
 if(!clean.length)return '—';
 const min=Math.min(...clean),max=Math.max(...clean);
 return min===max?money(min):`${money(min)}–${money(max)}`;
};
const fuelName={gasoline:'휘발유',diesel:'경유',hybrid:'하이브리드',lpg:'LPG',electric:'전기'};
const unit=p=>p==='electric'?'km/kWh':'km/L';
const tax=r=>r.tax_ready?globalThis.CAR_COST_MATH.annualTax(r.displacement_cc,r.powertrain==='electric','2026-01',2026).total:null;
const price=r=>r.powertrain==='electric'?null:calc.fuel_price.prices[r.powertrain==='hybrid'?'gasoline':r.powertrain];
const energyCost=r=>r.energy_cost_ready&&price(r)?20000/r.combined_efficiency*price(r):null;
const staticMap=new Map(read('data/static-model-pages.json').records.map(r=>[r.family_id,r.path]));

function uniqueRows(rows){
 const seen=new Set();return rows.filter(r=>{const k=[r.raw_model,r.powertrain,r.displacement_cc,r.combined_efficiency,r.city_efficiency,r.highway_efficiency,r.range_km].join('|');if(seen.has(k))return false;seen.add(k);return true});
}
function selectRows(rows){
 const picked=[];
 for(const pt of ['gasoline','hybrid','diesel','lpg','electric']){
  const group=rows.filter(r=>r.powertrain===pt&&r.energy_cost_ready).sort((a,b)=>b.full_cost_ready-a.full_cost_ready||b.combined_efficiency-a.combined_efficiency||a.raw_model.localeCompare(b.raw_model,'ko'));
  if(!group.length)continue;
  const candidates=[group[0],group[Math.floor((group.length-1)/2)],group[group.length-1],group.find(r=>r.tax_ready)].filter(Boolean);
  for(const row of candidates)if(!picked.includes(row))picked.push(row);
 }
 return uniqueRows(picked).slice(0,14);
}
function photoMarkup(m,photo,prefix){
 const files=photo.optimized?.files||[],largest=files.at(-1),src=largest?prefix+largest.path:photo.image_url;
 const srcset=files.map(f=>`${prefix}${f.path} ${f.width}w`).join(',');
 return `<figure class="dossier-photo"><img src="${esc(src)}"${srcset?` srcset="${esc(srcset)}" sizes="(max-width:820px) 100vw, 58vw"`:''} width="${photo.width}" height="${photo.height}" alt="${esc(m.maker+' '+m.model+' '+m.code+' 대표 차량 사진')}" fetchpriority="high"><figcaption>${esc(photo.generation)} 대표 사진 · 연식·트림에 따라 외관 차이<br><a href="${esc(photo.source_page)}">${esc(photo.author)}</a> · <a href="${esc(photo.license_url)}">${esc(photo.license)}</a></figcaption></figure>`;
}
function meterRows(rows){
 const groups=[];
 for(const pt of ['gasoline','hybrid','diesel','lpg','electric']){
  const values=rows.filter(r=>r.powertrain===pt&&r.energy_cost_ready).map(r=>r.combined_efficiency).filter(Number.isFinite);
  if(!values.length)continue;
  const min=Math.min(...values),max=Math.max(...values),scale=Math.max(max*1.08,1);
  groups.push(`<div class="dossier-meter"><div class="dossier-meter-label"><strong>${fuelName[pt]}</strong><span>${values.length}개 등록 사양</span></div><div class="dossier-track" aria-hidden="true"><i style="width:${Math.max(8,max/scale*100).toFixed(1)}%"></i></div><div class="dossier-meter-value">${min===max?max:min+'–'+max} <small>${unit(pt)}</small></div></div>`);
 }
 return groups.join('');
}
function taxText(r){const value=tax(r);return value==null?'<span class="dossier-na">배기량 연결 안 됨</span>':money(value)}
function costText(r){const value=energyCost(r);return value==null?(r.powertrain==='electric'?'<span class="dossier-na">충전단가 입력</span>':'<span class="dossier-na">계산 조건 없음</span>'):'약 '+money(value)}
function displacementOrRange(r){
 if(r.powertrain==='electric')return r.range_km?Number(r.range_km).toLocaleString('ko-KR')+'km':'—';
 return Number(r.displacement_cc)>0?Number(r.displacement_cc).toLocaleString('ko-KR')+'cc':'—';
}
function rowMarkup(r){return `<tr><th scope="row">${esc(r.raw_model)}</th><td>${fuelName[r.powertrain]||esc(r.powertrain)}</td><td>${r.combined_efficiency} ${unit(r.powertrain)}</td><td>${r.city_efficiency??'—'}</td><td>${r.highway_efficiency??'—'}</td><td>${displacementOrRange(r)}</td><td>${taxText(r)}</td><td>${costText(r)}</td></tr>`}
function minmax(values){const v=values.filter(Number.isFinite);return v.length?[Math.min(...v),Math.max(...v)]:[null,null]}
function fmtRange([a,b],suffix=''){return a==null?'—':`${a===b?a:a+'–'+b}${suffix}`}
function write(rel,html){const file=path.join(root,rel,'index.html');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,html.replace(/[ \t]+$/gm,''))}

for(const m of config){
 const sourceRows=uniqueRows(calc.rows.filter(r=>r.family_id===m.family_id&&m.generation_labels.includes(r.generation_label)&&['gasoline','hybrid','diesel','lpg','electric'].includes(r.powertrain)));
 const rows=selectRows(sourceRows),photo=photos.find(p=>p.family_id===m.family_id);
 if(!sourceRows.length||!rows.length||!photo)throw new Error(`Static model gate failed: ${m.family_id}`);
 if(!rows.some(r=>r.full_cost_ready))throw new Error(`No complete official cost row: ${m.family_id}`);
 const prefix='../../../',electricOnly=sourceRows.every(r=>r.powertrain==='electric'),eff=minmax(sourceRows.filter(r=>r.energy_cost_ready).map(r=>r.combined_efficiency));
 const manufacturerSpec=manufacturerSpecs.find(r=>r.family_id===m.family_id&&(!r.code||m.code.includes(r.code)||r.code.includes(m.code)));
 const hasElectric=sourceRows.some(r=>r.powertrain==='electric'),hasCombustion=sourceRows.some(r=>r.powertrain!=='electric');
 const physicalHeader=hasElectric&&hasCombustion?'배기량·1회 주행':electricOnly?'1회 주행':'배기량';
 const taxes=minmax(sourceRows.map(tax)),types=[...new Set(sourceRows.filter(r=>r.energy_cost_ready).map(r=>fuelName[r.powertrain]))];
 const canonical=base+m.path,title=`${m.model} ${m.code} 연비·자동차세·에너지비`;
 const schema={'@context':'https://schema.org','@graph':[{'@type':'WebPage','@id':canonical+'#page',url:canonical,name:title,inLanguage:'ko-KR',description:m.lead},{'@type':'BreadcrumbList',itemListElement:[['홈',base],['차량 찾기',base+'cars/'],[m.model,canonical]].map(([name,item],i)=>({'@type':'ListItem',position:i+1,name,item}))}]};
 const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${esc(title)} | 내차데이터</title><meta name="description" content="${esc(m.model+' '+m.code+'의 등록 사양 '+sourceRows.length+'개에서 연비·전비, 자동차세와 연 2만km 에너지비를 확인합니다.')}"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="${prefix}assets/site.css"><link rel="stylesheet" href="${prefix}assets/showroom-ui.css"><link rel="stylesheet" href="${prefix}assets/model-dossier.css"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script></head><body class="model-dossier${electricOnly?' is-electric':''}"><header class="db-header"><div class="db-shell"><a class="db-logo" href="${prefix}">내차데이터</a><nav class="db-nav" aria-label="주 메뉴"><a href="${prefix}cars/">차량 찾기</a><a href="${prefix}compare/">비교</a><a href="${prefix}rankings/fuel-economy/">연비 순위</a><a href="${prefix}recalls/">리콜</a></nav></div></header><main><section class="dossier-shell dossier-hero"><div class="dossier-intro"><div><p class="dossier-kicker">${esc(m.maker)} · ${esc(m.code)}</p><h1>${esc(m.model)}<span>연비·자동차세·에너지비</span></h1><p class="dossier-lead">${esc(m.lead)}</p></div><div class="dossier-index"><div><span>공개 사양</span><strong>${sourceRows.length}개</strong></div><div><span>동력 방식</span><strong>${types.length}종</strong></div><div><span>자료 기준</span><strong>공식 신고값</strong></div></div></div>${photoMarkup(m,photo,prefix)}</section>
<section class="dossier-section"><div class="dossier-shell"><div class="dossier-heading"><h2>연비·전비 범위</h2><p>${esc(m.reading)} 막대는 동력 방식별 최고값을 표시하며, km/L와 km/kWh는 서로 비교하지 않습니다.</p></div><div class="dossier-meters">${meterRows(sourceRows)}</div></div></section>
<section class="dossier-section"><div class="dossier-shell"><div class="dossier-heading"><h2>사양별 비용</h2><p>공식 등록 사양에서 연비와 세금 계산이 가능한 조건을 추렸습니다. 공개되지 않은 값은 비워 두었습니다.</p></div><div class="dossier-table-wrap" tabindex="0" role="region" aria-label="${esc(m.model)} 사양별 비용 표"><table class="dossier-table"><thead><tr><th>공식 등록 사양</th><th>동력</th><th>복합</th><th>도심</th><th>고속</th><th>${physicalHeader}</th><th>연 자동차세</th><th>2만km 에너지비</th></tr></thead><tbody>${rows.map(rowMarkup).join('')}</tbody></table></div><p class="dossier-note">자동차세는 비영업용 승용 신차 정상세액과 지방교육세 30%를 합산했습니다. 연납·차령 경감·개별 감면은 제외합니다. 전기차 충전비는 이용 요금 차이가 커 기본값을 만들지 않습니다.</p></div></section>
<section class="dossier-section"><div class="dossier-shell"><div class="dossier-heading"><h2>연비·세금·주행비</h2></div><div class="dossier-facts"><article><b>01</b><h3>${electricOnly?'복합전비':'복합연비·전비'}</h3><p>${fmtRange(eff,'')} ${electricOnly?'km/kWh':'(동력별 단위 확인)'}. 휠·구동·세부 사양이 다르면 같은 모델도 값이 달라집니다.</p></article><article><b>02</b><h3>연 자동차세</h3><p>${taxes[0]==null?'배기량이 연결된 행에서만 표시합니다.':moneyRange(taxes)}. 실제 고지액은 등록 시점과 차령에 따라 달라질 수 있습니다.</p></article><article><b>03</b><h3>연 20,000km</h3><p>내연기관은 거리 ÷ 복합연비 × 오피넷 단가로 계산합니다. 전기차는 실제 충전단가를 입력해 계산합니다.</p></article></div><div class="dossier-actions"><a href="${prefix}tools/annual-cost/?fa=${encodeURIComponent(m.family_id)}">내 조건으로 비용 계산</a><a href="${prefix}cars/family/?id=${encodeURIComponent(m.family_id)}">전체 연식·사양 보기</a><a href="${prefix}compare/?fa=${encodeURIComponent(m.family_id)}">다른 차량과 비교</a></div></div></section>
<section class="dossier-section"><div class="dossier-shell"><div class="dossier-heading"><h2>자료 출처</h2><p>연비·전비는 한국에너지공단 자동차 표시연비·에너지효율 공개 자료를 사용했습니다. 배기량이 공단 자료에 없는 사양은 제조사 공식 제원을 모델·동력별로 대조해 보완했습니다. 사진은 라이선스가 확인된 대표 이미지입니다.</p></div><div class="dossier-actions"><a href="${prefix}data-sources/">공식 데이터 출처</a>${manufacturerSpec?`<a href="${esc(manufacturerSpec.source.url)}">제조사 제원</a>`:''}<a href="${esc(calc.tax.source)}">자동차세 법령</a><a href="${prefix}methodology/">계산 기준</a><a href="${prefix}media-policy/">사진 이용안내</a></div><p class="dossier-note">자료 생성 ${esc(calc.generated_at.slice(0,10))} · 유가 ${esc(calc.fuel_price.price_as_of)} · 이 페이지는 ${m.generation_labels.map(esc).join(', ')} 등록 사양을 다룹니다. 보험·정비·구매가격·감가상각은 포함하지 않습니다.</p></div></section></main><footer class="db-footer"><div class="db-shell"><strong>내차데이터</strong><p>자동차세와 연료·충전비를 같은 조건으로 비교합니다.</p></div></footer></body></html>`;
 write(m.path,html);
}

const directory=path.join(root,'cars/models/index.html');
let index=fs.readFileSync(directory,'utf8').replace(/<!-- PRIORITY-MODELS:START -->[\s\S]*?<!-- PRIORITY-MODELS:END -->/g,'');
const cards=config.map(m=>`<a href="../../${m.path}"><span>${esc(m.maker)} · ${esc(m.code)}</span><strong>${esc(m.model)}</strong></a>`).join('');
const section=`<!-- PRIORITY-MODELS:START --><section class="dossier-section"><div class="dossier-shell"><div class="dossier-heading"><h2>공식 사양으로 더 보기</h2><p>현재 세대의 등록 사양과 대표 사진이 함께 확인된 차량입니다.</p></div><div class="dossier-directory">${cards}</div></div></section><!-- PRIORITY-MODELS:END -->`;
index=index.replace('</head>','<link rel="stylesheet" href="../../assets/model-dossier.css"></head>').replace('</main>',section+'</main>');
fs.writeFileSync(directory,index);
console.log(`Priority static model pages: ${config.length} models / ${config.reduce((n,m)=>n+calc.rows.filter(r=>r.family_id===m.family_id&&m.generation_labels.includes(r.generation_label)).length,0)} official rows.`);

await import('./build-decision-flows.mjs');
