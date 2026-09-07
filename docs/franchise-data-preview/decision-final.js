'use strict';

function toolsPage(){
 setTitle('창업 계산기·도구');
 const tools=[
  ['⌕','창업 후보 검색기','예산·업종·점포규모·성장률·관심지역으로 조건에 맞는 후보를 좁힙니다.','/tools/candidate-finder'],
  ['₩','창업비용 계산기','공개비용 + 임대차 + 권리금 + 추가설비 + 운전자금','/tools/startup-cost'],
  ['▦','손익분기 시뮬레이터','매출·원가율·인건비·월세·수수료로 월 잉여와 단순 회수기간 계산','/tools/break-even'],
  ['◎','상권 밀도 계산기','지역·업종·반경을 선택해 동일업종 공급량과 밀도 비교','/tools/store-density'],
  ['⌂','월 고정비 계산기','월세·관리비·인건비·대출·보험·통신 등 월 고정비 구조 계산','/tools/monthly-fixed-cost']
 ];
 return `<div class="page"><section class="page-hero"><div class="shell">${crumb([{label:'계산기·도구'}])}<div class="page-head"><div><span class="eyebrow">DECISION TOOLS</span><h1>창업 계산기·도구</h1><p>브랜드를 읽고 끝나는 것이 아니라 후보 선정 → 비교 → 자금 → 상권 → 손익까지 이어집니다.</p></div></div></div></section><div class="shell content-wrap">${previewNotice()}<div class="tool-cards two">${tools.map(t=>`<article class="tool-card big"><span class="tool-icon">${t[0]}</span><h2>${t[1]}</h2><p>${t[2]}</p><a class="primary-button" href="#${t[3]}">도구 열기</a></article>`).join('')}</div></div></div>`;
}

function candidateFinderPage(){
 setTitle('창업 후보 검색기');
 const maxCost=Math.ceil(Math.max(...brands.map(b=>b.cost))/1000)*1000;
 return `<div class="page"><section class="page-hero"><div class="shell">${crumb([{label:'계산기',href:'/tools'},{label:'후보 검색기'}])}<div class="page-head"><div><span class="eyebrow">BRAND SHORTLIST</span><h1>창업 후보 검색기</h1><p>예산과 선호조건을 먼저 정하고, 조건을 통과하는 브랜드만 좁혀 봅니다. 결과는 추천이나 수익 보장이 아니라 입력 조건과의 일치도입니다.</p></div></div></div></section><div class="shell content-wrap">${previewNotice()}<div class="candidate-layout"><aside class="panel candidate-filter"><h2>내 조건</h2><div class="field"><label>업종</label><select id="candidateCategory"><option value="all">전체 업종</option>${Object.entries(categories).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('')}</select></div><div class="field"><label>최대 브랜드 초기비용 <small>만원</small></label><input id="candidateBudget" type="number" value="15000" min="0" max="${maxCost}" step="500"></div><div class="field"><label>최소 가맹점 수 <small>개</small></label><input id="candidateStores" type="number" value="50" min="0" step="10"></div><div class="field"><label>최소 점포 증감률 <small>%</small></label><input id="candidateGrowth" type="number" value="0" step="1"></div><div class="field"><label>관심 지역</label><select id="candidateRegion"><option value="all">지역 조건 없음</option>${regionKeys.map(r=>`<option value="${r}">${r}</option>`).join('')}</select></div><div class="field"><label>정렬 기준</label><select id="candidateSort"><option value="fit">조건 일치도</option><option value="cost">초기비용 낮은 순</option><option value="growth">성장률 높은 순</option><option value="stores">점포 많은 순</option><option value="sales">매출지표 높은 순</option></select></div><button id="candidateReset" class="outline-button full">기본값으로 초기화</button><p class="microcopy">임대보증금·권리금 등 점포별 비용은 여기서 제외합니다. 후보를 고른 뒤 창업비용 계산기에서 합산하세요.</p></aside><section class="candidate-results"><div class="section-head compact"><div><span class="eyebrow">MATCHED BRANDS</span><h2><span id="candidateCount">0</span>개 후보</h2><p id="candidateSummary">조건을 바꾸면 즉시 다시 계산됩니다.</p></div><button id="candidateCompare" class="primary-button" disabled>선택한 3개 비교</button></div><div class="candidate-selection" id="candidateSelection">비교할 브랜드를 최대 3개 선택하세요.</div><div id="candidateGrid" class="candidate-grid"></div></section></div><section class="panel formula-panel"><h2>조건 일치도 계산 방식</h2><p>필수 필터를 통과한 브랜드에 대해 예산 여유, 점포 규모, 최근 증감, 관심 지역 점포 비중을 정규화해 탐색용 일치도를 계산합니다. 이 값은 브랜드의 우수성·수익성·안전성을 평가하는 점수가 아닙니다.</p>${sourceLine()}</section></div></div>`;
}

function candidateFitScore(b,filters){
 const d=derived(b);let score=0,parts=0;
 if(filters.budget>0){score+=Math.max(0,Math.min(1,(filters.budget-b.cost)/filters.budget+0.5))*35;parts+=35}
 const scale=Math.min(1,Math.log10(Math.max(10,b.stores))/4);score+=scale*25;parts+=25;
 const growth=Math.max(0,Math.min(1,(d.yoy+10)/30));score+=growth*25;parts+=25;
 if(filters.region!=='all'){const total=Object.values(b.regions||{}).reduce((a,x)=>a+x,0)||1;score+=Math.min(1,(b.regions?.[filters.region]||0)/total*8)*15;parts+=15}
 else{score+=7.5;parts+=15}
 return Math.round(score/parts*100);
}
function candidateRows(filters){
 let list=brands.filter(b=>(filters.category==='all'||b.categorySlug===filters.category)&&(!filters.budget||b.cost<=filters.budget)&&b.stores>=filters.stores&&derived(b).yoy>=filters.growth);
 list=list.map(b=>({b,fit:candidateFitScore(b,filters),growth:derived(b).yoy,regionCount:filters.region==='all'?null:(b.regions?.[filters.region]||0)}));
 list.sort((x,y)=>filters.sort==='cost'?x.b.cost-y.b.cost:filters.sort==='growth'?y.growth-x.growth:filters.sort==='stores'?y.b.stores-x.b.stores:filters.sort==='sales'?y.b.sales-x.b.sales:y.fit-x.fit);
 return list;
}
function candidateCard(row,selected){const {b,fit,growth,regionCount}=row;return `<article class="candidate-card ${selected?'selected':''}" data-candidate="${b.slug}"><div class="candidate-card-top"><label class="candidate-check"><input type="checkbox" data-candidate-check="${b.slug}" ${selected?'checked':''}><span>비교 선택</span></label><span class="fit-badge">조건 일치 ${fit}</span></div><div class="brand-cell large">${avatar(b)}<div><small>${esc(b.category)}</small><h3><a href="#/brand/${b.slug}">${esc(b.name)}</a></h3></div></div><div class="candidate-metrics"><div><span>초기비용</span><b>${won(b.cost)}</b></div><div><span>가맹점</span><b>${num(b.stores)}개</b></div><div><span>점포 증감</span><b class="${growth>=0?'positive':'negative'}">${growth>=0?'+':''}${pct(growth)}</b></div>${regionCount!=null?`<div><span>관심지역 점포</span><b>${num(regionCount)}개</b></div>`:`<div><span>매출 관련 지표</span><b>${won(b.sales)}</b></div>`}</div><div class="candidate-actions"><a class="text-link" href="#/brand/${b.slug}">상세 보기 →</a><a class="text-link" href="#/tools/startup-cost?brand=${b.slug}">총 필요자금 계산 →</a></div></article>`}

function comparePage(aSlug,bSlug,cSlug){
 const r=route(),preferred=r.query.get('category'),fallback=preferred?catBrands(preferred):brands;
 const a=bySlug(aSlug||fallback[0]?.slug);const same=catBrands(a.categorySlug).filter(x=>x.slug!==a.slug);const b=bySlug(bSlug||same[0]?.slug||brands[1].slug);const c=bySlug(cSlug||same.find(x=>x.slug!==b.slug)?.slug||brands.find(x=>x.slug!==a.slug&&x.slug!==b.slug)?.slug);
 const set=[a,b,c],ds=set.map(derived);setTitle(`${a.name} · ${b.name} · ${c.name} 비교`);
 const minName=(key)=>set.reduce((x,y)=>x[key]<=y[key]?x:y).name,maxName=(key)=>set.reduce((x,y)=>x[key]>=y[key]?x:y).name;
 const row=(label,formatter,key,mode='raw')=>{const vals=set.map((x,i)=>mode==='growth'?ds[i].yoy:x[key]);const min=Math.min(...vals),max=Math.max(...vals);return `<tr><td><b>${label}</b></td>${vals.map(v=>`<td class="num">${formatter(v)}</td>`).join('')}<td class="num">${formatter(max-min)}</td></tr>`};
 return `<div class="page"><section class="page-hero"><div class="shell">${crumb([{label:'브랜드 비교'}])}<div class="page-head"><div><span class="eyebrow">3-WAY COMPARE</span><h1>브랜드 3개 동시 비교</h1><p>초기비용·점포규모·성장·매출 관련 지표를 세 후보까지 같은 기준으로 비교합니다.</p></div></div></div></section><div class="shell content-wrap">${previewNotice()}<div class="compare-builder compare-three panel">${set.map((x,i)=>`<div class="field"><label>브랜드 ${String.fromCharCode(65+i)}</label><select id="compare${String.fromCharCode(65+i)}">${brands.map(v=>`<option value="${v.slug}" ${v.slug===x.slug?'selected':''}>${v.name} · ${v.category}</option>`).join('')}</select></div>`).join('<span class="vs-mark">VS</span>')}</div><div class="compare-heads compare-three-heads">${set.map(x=>`<div class="compare-brand">${avatar(x)}<div><span>${x.category}</span><h2>${esc(x.name)}</h2></div></div>`).join('')}</div><div class="data-table-wrap"><table class="data-table compare-table three-way"><thead><tr><th>항목</th>${set.map(x=>`<th class="num">${esc(x.name)}</th>`).join('')}<th class="num">최대-최소</th></tr></thead><tbody>${row('초기비용',won,'cost')}${row('가맹점 수',v=>`${num(v)}개`,'stores')}${row('전년 대비',v=>`${v>=0?'+':''}${pct(v)}`,'yoy','growth')}${row('매출 관련 지표',won,'sales')}${row('직영점',v=>`${num(v)}개`,'direct')}</tbody></table></div><div class="insight-banner"><p><b>비교 요약.</b> 초기비용이 가장 낮은 후보는 <b>${esc(minName('cost'))}</b>, 점포 수가 가장 많은 후보는 <b>${esc(maxName('stores'))}</b>, 최근 점포 증감률이 가장 높은 후보는 <b>${esc(set[ds.indexOf(ds.reduce((x,y)=>x.yoy>=y.yoy?x:y))]?.name||a.name)}</b>입니다. 이 비교는 후보 압축용이며 실제 계약조건과 상권을 함께 확인해야 합니다.</p><span class="insight-label">3개 비교</span></div><div class="compare-next-grid">${set.map(x=>`<a class="next-card" href="#/tools/startup-cost?brand=${x.slug}"><b>${esc(x.name)}</b><span>내 임대조건으로 총 필요자금 계산 →</span></a>`).join('')}</div>${sourceLine()}</div></div>`;
}

function bindCandidateFinder(){
 const cat=document.getElementById('candidateCategory');if(!cat)return;
 const budget=document.getElementById('candidateBudget'),stores=document.getElementById('candidateStores'),growth=document.getElementById('candidateGrowth'),region=document.getElementById('candidateRegion'),sort=document.getElementById('candidateSort'),grid=document.getElementById('candidateGrid'),count=document.getElementById('candidateCount'),summary=document.getElementById('candidateSummary'),selection=document.getElementById('candidateSelection'),compare=document.getElementById('candidateCompare');
 let selected=[];
 const filters=()=>({category:cat.value,budget:Math.max(0,Number(budget.value)||0),stores:Math.max(0,Number(stores.value)||0),growth:Number(growth.value)||0,region:region.value,sort:sort.value});
 const renderSelection=()=>{const chosen=selected.map(bySlug);selection.innerHTML=chosen.length?`<b>비교 선택 ${chosen.length}/3</b> · ${chosen.map(x=>esc(x.name)).join(' · ')}`:'비교할 브랜드를 최대 3개 선택하세요.';compare.disabled=chosen.length<2;compare.textContent=chosen.length===2?'선택한 2개 비교':chosen.length===3?'선택한 3개 비교':'선택한 3개 비교'};
 const apply=()=>{const f=filters(),rows=candidateRows(f);count.textContent=rows.length;summary.textContent=`${f.category==='all'?'전체 업종':categories[f.category].name} · ${f.budget?won(f.budget)+' 이하':'예산 제한 없음'} · 점포 ${num(f.stores)}개 이상 · 증감 ${f.growth}% 이상${f.region!=='all'?` · ${f.region} 관심`:''}`;grid.innerHTML=rows.length?rows.slice(0,60).map(r=>candidateCard(r,selected.includes(r.b.slug))).join(''):`<div class="empty"><h2>조건을 통과한 브랜드가 없습니다.</h2><p>예산·점포 수·성장률 조건을 조금 넓혀 보세요.</p></div>`;renderSelection()};
 [cat,budget,stores,growth,region,sort].forEach(x=>{x.addEventListener('input',apply);x.addEventListener('change',apply)});
 grid.addEventListener('change',e=>{const box=e.target.closest('[data-candidate-check]');if(!box)return;const slug=box.dataset.candidateCheck;if(box.checked){if(selected.length>=3){box.checked=false;showToast('비교는 최대 3개까지 선택할 수 있습니다.');return}selected.push(slug)}else selected=selected.filter(x=>x!==slug);apply()});
 compare.addEventListener('click',()=>{if(selected.length>=2)navigate(`/compare/${selected.join('/')}`)});
 document.getElementById('candidateReset').addEventListener('click',()=>{cat.value='all';budget.value='15000';stores.value='50';growth.value='0';region.value='all';sort.value='fit';selected=[];apply()});apply();
}

function bindCompareThree(){
 const a=document.getElementById('compareA'),b=document.getElementById('compareB'),c=document.getElementById('compareC');if(!a||!b)return;
 const go=()=>navigate(`/compare/${a.value}/${b.value}${c?`/${c.value}`:''}`);a.addEventListener('change',go);b.addEventListener('change',go);c?.addEventListener('change',go);
}
