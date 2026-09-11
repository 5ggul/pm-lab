import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve('docs/interior-cost-preview');
const SNAPSHOT=path.resolve('interior-cost-core/data/g2b-building-materials.json');
const BASE='/pm-lab/interior-cost-preview';
const SITE='https://5ggul.github.io/pm-lab/interior-cost-preview';
const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const write=(r,c)=>{const f=path.join(ROOT,r);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c)};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('ko-KR'):'-';

if(!fs.existsSync(SNAPSHOT))throw new Error('v20 G2B snapshot missing');
const data=JSON.parse(fs.readFileSync(SNAPSHOT,'utf8'));
if(data.source_id!=='PPS-G2B-PRICE-BUILDING-MATERIALS'||!Array.isArray(data.records)||!Array.isArray(data.unit_groups))throw new Error('v20 G2B snapshot invalid');
if(JSON.stringify(data).match(/serviceKey|invstDeptTelNo|invstOfclNm/i))throw new Error('v20 G2B snapshot contains forbidden fields');

const hubPath='data/index.html';
let hub=read(hubPath);
const header=hub.match(/<header[\s\S]*?<\/header>/)?.[0]||'';
const footer=hub.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
const cssRef=hub.match(/<link rel="stylesheet" href="[^"]*site-v19-bundle\.css[^"]*">/)?.[0]||'';
const jsRef=hub.match(/<script src="[^"]*app-v19-bundle\.js[^"]*" defer><\/script>/)?.[0]||'';
if(!header||!cssRef||!jsRef)throw new Error('v20 requires v19-generated data hub');

const collectedDate=String(data.collected_at||'').slice(0,10);
const latestNotice=(data.records||[]).map(x=>String(x.notice_at||'').slice(0,10)).filter(Boolean).sort().at(-1)||'';
const activeGroups=(data.groups||[]).filter(x=>x.captured_count>0);
const unitGroups=(data.unit_groups||[]).filter(x=>x.record_count>0);
const latestRecords=[...(data.records||[])].sort((a,b)=>String(b.notice_at).localeCompare(String(a.notice_at))).slice(0,100);

const termRows=(data.groups||[]).map(g=>`<tr><th scope="row">${esc(g.term)}</th><td>${fmt(g.captured_count)}${g.total_count>g.captured_count?` / ${fmt(g.total_count)}`:''}</td><td>${esc((g.units||[]).join(' · ')||'-')}</td><td>${g.capped?'일부 수집':'조회 범위 수집'}</td></tr>`).join('');
const unitRows=unitGroups.map(g=>`<tr><th scope="row">${esc(g.term)}</th><td>${esc(g.unit)}</td><td>${fmt(g.record_count)}</td><td>${fmt(g.min_price_krw)}원</td><td><b>${fmt(g.median_price_krw)}원</b></td><td>${fmt(g.max_price_krw)}원</td><td>${esc(String(g.latest_notice_at||'').slice(0,10))}</td></tr>`).join('');
const recordRows=latestRecords.map(r=>`<tr><td>${esc(r.product_name||r.query_term)}</td><td>${esc(r.item_name)}</td><td>${esc(r.unit||'-')}</td><td>${fmt(r.price_krw)}원</td><td>${esc(String(r.notice_at||'').slice(0,10))}</td><td>${esc(r.vat||'-')}</td></tr>`).join('');
const canonical=SITE+'/data/g2b-materials/';
const schema={
  '@context':'https://schema.org','@type':'Dataset',name:'조달청 나라장터 시설공통자재(건축) 가격 스냅샷',
  description:'조달청 나라장터 가격정보현황서비스의 시설공통자재(건축) 공개 가격을 단위별로 분리한 참고 데이터.',
  url:canonical,dateModified:collectedDate,
  creator:{'@type':'GovernmentOrganization',name:'조달청'},
  distribution:{'@type':'DataDownload',encodingFormat:'application/json',contentUrl:SITE+'/data/g2b-building-materials.json'}
};
const page=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><title>조달청 건축자재 가격 데이터 | 견적검수실</title><meta name="description" content="나라장터 시설공통자재(건축) 공개 가격을 품목·단위별로 분리해 확인합니다. 민간 인테리어 시장평균으로 사용하지 않습니다."><link rel="canonical" href="${canonical}">${cssRef}<script type="application/ld+json">${JSON.stringify(schema)}</script></head><body class="v9-ui v10-ui v11-ui v12-ui v13-ui v14-ui v19-ui v20-g2b" data-v19-role="data" data-v19-path="data/g2b-materials/index.html"><a class="v18-skip" href="#main-content">본문 바로가기</a>${header}<main id="main-content"><section class="v62-data-hero"><div class="site-shell"><p class="kicker">OFFICIAL · PPS G2B</p><h1>조달청 건축자재 가격</h1><p>시설공통자재(건축) 공개 가격을 단위가 같은 레코드끼리 분리해 봅니다.</p></div></section><section class="v6-section"><div class="site-shell"><div class="v6-section-head"><h2>현재 수집 상태</h2><p>수집 ${esc(collectedDate)} · 최신 게시 ${esc(latestNotice||'-')}</p></div><div class="table-wrap"><table class="v62-data-table"><thead><tr><th>지표</th><th>값</th><th>해석</th></tr></thead><tbody><tr><th scope="row">수집 레코드</th><td><b>${fmt(data.record_count)}건</b></td><td>조달청 공개 시설공통자재(건축)</td></tr><tr><th scope="row">검색 분류</th><td><b>${fmt(activeGroups.length)}개</b></td><td>응답이 있는 검색어 기준</td></tr><tr><th scope="row">단위별 묶음</th><td><b>${fmt(unitGroups.length)}개</b></td><td>서로 다른 단위를 합치지 않음</td></tr></tbody></table></div><p class="v6-index-note"><a class="v62-json" href="${BASE}/data/g2b-building-materials.json">원본 스냅샷 JSON</a></p></div></section><section class="v6-section"><div class="site-shell"><div class="v6-section-head"><h2>검색어별 수집 범위</h2><p>전체 결과 수가 페이지 제한을 넘는 경우 상태를 따로 표시합니다.</p></div><div class="table-wrap"><table class="v62-data-table"><thead><tr><th>분류</th><th>수집 / 전체</th><th>단위</th><th>상태</th></tr></thead><tbody>${termRows}</tbody></table></div></div></section><section class="v6-section"><div class="site-shell"><div class="v6-section-head"><h2>단위별 가격 분포</h2><p>같은 검색어라도 단위가 다르면 별도 행입니다. 중앙값은 해당 단위의 공개 레코드 중앙값입니다.</p></div><div class="table-wrap"><table class="v62-data-table"><thead><tr><th>분류</th><th>단위</th><th>N</th><th>최소</th><th>중앙값</th><th>최대</th><th>최근 게시</th></tr></thead><tbody>${unitRows}</tbody></table></div></div></section><section class="v6-section"><div class="site-shell"><div class="v6-section-head"><h2>최근 공개 레코드</h2><p>최신순 100건 · 규격과 VAT 조건을 함께 확인합니다.</p></div><div class="table-wrap"><table class="v62-data-table"><thead><tr><th>품명</th><th>규격명</th><th>단위</th><th>가격</th><th>게시일</th><th>VAT</th></tr></thead><tbody>${recordRows}</tbody></table></div></div></section><section class="v6-section"><div class="site-shell"><div class="v6-section-head"><h2>사용 범위</h2></div><div class="v13-source-boundary"><p><strong>사용 가능</strong> ${esc(data.interpretation?.valid_for)}</p><p><strong>직접 대체 금지</strong> ${esc(data.interpretation?.not_valid_for)}</p><p><strong>집계 기준</strong> ${esc(data.interpretation?.aggregation)}</p></div></div></section></main>${footer}${jsRef}</body></html>`;
write('data/g2b-materials/index.html',page);
write('data/g2b-building-materials.json',JSON.stringify(data,null,2)+'\n');
write('data/g2b-readiness-v20.json',JSON.stringify({version:'20.0.0',source_id:data.source_id,collected_at:data.collected_at,record_count:data.record_count,active_query_groups:activeGroups.length,unit_groups:unitGroups.length,no_secret_fields:true,private_market_average:false,preview_noindex:true,production_switch:false},null,2));

if(!hub.includes('/data/g2b-materials/')){
  hub=hub.replace('<div class="v62-data-links">',`<div class="v62-data-links"><a href="${BASE}/data/g2b-materials/"><strong>조달청 건축자재 가격</strong><span>나라장터 시설공통자재 · 단위별 가격 분포</span></a>`);
}
if(!hub.includes('조달청 건축자재 가격</th>')){
  hub=hub.replace('<tr><th>실제 견적 표본</th>',`<tr><th>조달청 건축자재 가격</th><td><b>${fmt(data.record_count)}건</b><small>${fmt(unitGroups.length)}개 단위별 묶음</small></td><td>${esc(collectedDate)}<small>공공 조달 참고</small></td><td>시설공통자재 공개 가격</td></tr><tr><th>실제 견적 표본</th>`);
}
write(hubPath,hub);
console.log(`Interior v20 G2B data page: ${data.record_count} records / ${unitGroups.length} unit groups`);
