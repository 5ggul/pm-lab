'use strict';
areaOpportunityCandidateRows=function(area,category,budget,stores,growth){
 return candidateRows({category,budget,stores,growth,region:area.sido,sort:'fit'}).map(row=>{
  const sidoStores=Number(row.b.regions?.[area.sido]||0),sidoShare=row.b.stores?sidoStores/row.b.stores*100:0;
  return {...row,sido:area.sido,sidoStores,sidoShare};
 });
};
areaOpportunityBrandCard=function(row,selected){const b=row.b;return `<article class="area-brand-card ${selected?'selected':''}"><div class="area-brand-head"><label class="candidate-check"><input type="checkbox" data-area-brand-check="${b.slug}" ${selected?'checked':''}><span>비교 선택</span></label><span class="fit-badge">조건 일치 ${row.fit}</span></div><div class="brand-cell large">${avatar(b)}<div><small>${esc(b.category)}</small><h3><a href="#/brand/${b.slug}">${esc(b.name)}</a></h3></div></div><div class="area-brand-metrics"><div><span>브랜드 초기비용</span><b>${won(b.cost)}</b></div><div><span>전국 가맹점</span><b>${num(b.stores)}개</b></div><div><span>${esc(row.sido)} 점포</span><b>${num(row.sidoStores)}개</b></div><div><span>${esc(row.sido)} 비중</span><b>${pct(row.sidoShare)}</b></div><div><span>최근 점포 증감</span><b class="${row.growth>=0?'positive':'negative'}">${row.growth>=0?'+':''}${pct(row.growth)}</b></div><div><span>매출 관련 지표</span><b>${won(b.sales)}</b></div></div><div class="candidate-actions"><a class="text-link" href="#/brand/${b.slug}">브랜드 상세 →</a><a class="text-link" href="#/tools/startup-cost?brand=${b.slug}">내 조건 비용 계산 →</a></div></article>`};
if(route().parts[0]==='tools'&&route().parts[1]==='area-opportunity')render();
