import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pageUrl,siteConfig} from './site-config.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const families=JSON.parse(fs.readFileSync(path.join(root,'data/generated/family-detail-index.json'),'utf8')).families;
const photos=JSON.parse(fs.readFileSync(path.join(root,'data/vehicle-photo-index.json'),'utf8')).records;
const photoByFamily=new Map(photos.map(photo=>[photo.family_id,photo]));
const makers=[['hyundai','현대'],['kia','기아'],['genesis','제네시스']];
const powertrainLabel={gasoline:'가솔린',diesel:'디젤',lpg:'LPG',hybrid:'하이브리드',phev:'플러그인 하이브리드',electric:'전기',hydrogen:'수소',unknown:'기타'};
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const range=value=>value?value.min===value.max?String(value.min):`${value.min}–${value.max}`:null;
const picture=family=>{
  const photo=photoByFamily.get(family.family_id);
  if(!photo)return `<div class="maker-photo-empty" aria-label="대표 사진 없음"><span>${esc(family.maker)}</span><small>대표 사진 없음</small></div>`;
  const files=photo.optimized?.files||[],best=files.at(-1),src=best?`../../${best.path}`:photo.image_url;
  const srcset=files.map(file=>`../../${file.path} ${file.width}w`).join(',');
  return `<figure><picture>${srcset?`<source type="image/webp" srcset="${esc(srcset)}" sizes="(max-width:700px) 42vw, 240px">`:''}<img loading="lazy" decoding="async" src="${esc(src)}" width="${best?.width||photo.width||960}" height="${best?.height||photo.height||640}" alt="${esc(family.maker+' '+family.family_name+' 대표 차량')}"></picture><figcaption><a href="${esc(photo.source_page)}" target="_blank" rel="noopener">사진</a> · ${esc(photo.author)} · <a href="${esc(photo.license_url)}" target="_blank" rel="noopener">${esc(photo.license)}</a></figcaption></figure>`;
};

for(const [slug,maker] of makers){
  const rows=families.filter(family=>family.maker===maker).sort((a,b)=>a.family_name.localeCompare(b.family_name,'ko',{numeric:true}));
  const staticCount=rows.filter(row=>row.static_detail_path).length,photoCount=rows.filter(row=>photoByFamily.has(row.family_id)).length,specCount=rows.reduce((sum,row)=>sum+row.active_record_count,0);
  const cards=rows.map(family=>{
    const href=family.static_detail_path?`../../${family.static_detail_path.replace(/^cars\//,'cars/')}`:`../family/?id=${encodeURIComponent(family.family_id)}`;
    const trains=family.powertrains.map(item=>powertrainLabel[item.powertrain]||item.powertrain).join(' · ');
    const main=family.powertrains.find(item=>item.combined_efficiency);
    const efficiency=main?`${range(main.combined_efficiency)} ${main.powertrain==='electric'?'km/kWh':'km/L'}`:'공개 연비 없음';
    return `<article class="maker-model">${picture(family)}<div class="maker-model-copy"><p>${esc(trains||'공개 사양')}</p><h2><a href="${esc(href)}">${esc(family.family_name)}</a></h2><dl><div><dt>공개 사양</dt><dd>${family.active_record_count.toLocaleString('ko-KR')}개</dd></div><div><dt>복합 효율</dt><dd>${esc(efficiency)}</dd></div></dl><a class="maker-model-link" href="${esc(href)}">연비·세금·에너지비 <span aria-hidden="true">→</span></a></div></article>`;
  }).join('');
  const itemList={'@context':'https://schema.org','@type':'ItemList',name:`${maker} 차량 연비·자동차세`,numberOfItems:rows.length,itemListElement:rows.map((family,index)=>({'@type':'ListItem',position:index+1,name:`${maker} ${family.family_name}`,url:family.static_detail_path?pageUrl(family.static_detail_path):pageUrl(`cars/family/?id=${encodeURIComponent(family.family_id)}`)}))};
  const breadcrumb={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[['홈',pageUrl('')],['차량 찾기',pageUrl('cars/')],[maker,pageUrl(`cars/${slug}/`)]].map(([name,item],index)=>({'@type':'ListItem',position:index+1,name,item}))};
  const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${maker} 자동차 연비·자동차세 | 내차데이터</title><meta name="description" content="${maker} ${rows.length}개 차종, ${specCount.toLocaleString('ko-KR')}개 공개 사양의 연비·전비·자동차세·연간 에너지비를 차량별로 확인합니다."><meta name="robots" content="${siteConfig.robots}"><link rel="canonical" href="${pageUrl(`cars/${slug}/`)}"><link rel="stylesheet" href="../../assets/site.css"><link rel="stylesheet" href="../../assets/home.css"><link rel="stylesheet" href="../../assets/clear-ui.css"><link rel="stylesheet" href="../../assets/page-design.css"><link rel="stylesheet" href="../../assets/manufacturer-hubs.css"><script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':[itemList,breadcrumb]}).replaceAll('<','\\u003c')}</script></head><body data-reference-page="manufacturer" class="studio-ui clear-site"><header class="db-header"><div class="db-shell"><a class="db-logo" href="../../">내차데이터</a><nav class="db-nav" aria-label="주 메뉴"><a href="../../cars/" aria-current="page">차량 찾기</a><a href="../../compare/">비교</a><a href="../../rankings/">순위</a><a href="../../recalls/">리콜</a></nav></div></header><main><section class="maker-hero"><div class="db-shell"><p class="db-kicker">제조사별 차량</p><h1>${maker}</h1><p>차량별 연비·전비와 자동차세, 주행거리별 에너지비를 확인하세요.</p><div class="maker-totals"><span><b>${rows.length}</b> 차종</span><span><b>${specCount.toLocaleString('ko-KR')}</b> 사양</span><span><b>${photoCount}</b> 대표 사진</span><span><b>${staticCount}</b> 상세 해설</span></div></div></section><section class="db-section"><div class="db-shell"><div class="maker-toolbar"><h2>${maker} 차량 전체</h2><a href="../?maker=${encodeURIComponent(maker)}">조건을 넣어 찾기 →</a></div><div class="maker-model-grid">${cards}</div></div></section></main><footer class="page-footer"><strong>내차데이터</strong><p>자동차세와 연료·충전비를 같은 조건으로 비교합니다.</p><nav aria-label="이용 및 사이트 안내"><a href="../../tools/">계산 도구</a><a href="../../guide/">이용 가이드</a><a href="../../methodology/">계산 기준</a><a href="../../about/">소개</a><a href="../../terms/">이용안내</a><a href="../../privacy/">개인정보 처리방침</a><a href="../../contact/">오류 신고</a><a href="../../media-policy/">사진 이용안내</a></nav></footer></body></html>`;
  fs.writeFileSync(path.join(root,`cars/${slug}/index.html`),html);
  console.log(`${maker}: ${rows.length} families / ${specCount} specifications / ${photoCount} photos`);
}
