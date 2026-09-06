'use strict';
function render(){
 const r=route(),p=r.parts;let html;
 if(!p.length)html=home();
 else if(p[0]==='categories'&&p.length===1)html=categoriesPage();
 else if(p[0]==='category')html=categoryPage(p[1]);
 else if(p[0]==='brands')html=brandsPage();
 else if(p[0]==='brand')html=brandPage(p[1]);
 else if(p[0]==='compare')html=comparePage(p[1],p[2]);
 else if(p[0]==='rankings')html=rankingPage(p[1]||'cafe',p[2]||'stores');
 else if(p[0]==='areas'&&p.length===1)html=areasPage();
 else if(p[0]==='area')html=areaDetailPage(p[1],p[2]||'cafe');
 else if(p[0]==='tools'&&p.length===1)html=toolsPage();
 else if(p[0]==='tools'&&p[1]==='startup-cost')html=startupCostPage();
 else if(p[0]==='tools'&&p[1]==='break-even')html=breakEvenPage();
 else if(p[0]==='tools'&&p[1]==='store-density')html=storeDensityPage();
 else if(p[0]==='tools'&&p[1]==='monthly-fixed-cost')html=monthlyFixedCostPage();
 else if(p[0]==='guides'&&p.length===1)html=guidesPage();
 else if(p[0]==='guide')html=guidePage(p[1]);
 else if(p[0]==='methodology')html=methodologyPage();
 else if(p[0]==='sources')html=sourcesPage();
 else if(p[0]==='updates')html=updatesPage();
 else if(p[0]==='data-quality')html=dataQualityPage();
 else if(['about','privacy','terms','contact'].includes(p[0]))html=staticPage(p[0]);
 else html=notFound();
 const app=document.getElementById('app');app.innerHTML=html;bindPage();window.scrollTo({top:0,behavior:'instant'});console.info('[preview-page]',r.raw);
}
function bindGlobal(){
 document.addEventListener('click',e=>{
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action==='open-feedback')document.getElementById('feedbackModal').hidden=false;
  if(action==='close-feedback')document.getElementById('feedbackModal').hidden=true;
  if(action==='toggle-menu')document.getElementById('mobileMenu').classList.toggle('open');
  if(action==='copy-url'){navigator.clipboard?.writeText(location.href).then(()=>showToast('현재 화면 링크를 복사했습니다.')).catch(()=>showToast('주소창 URL을 복사해 주세요.'))}
  const brand=e.target.closest('[data-brand]');if(brand&&!e.target.closest('a,button,select,input'))navigate(`/brand/${brand.dataset.brand}`);
  const area=e.target.closest('[data-area]');if(area&&!e.target.closest('a,button,select,input'))navigate(`/area/${area.dataset.area}/${area.dataset.cat||'cafe'}`);
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('feedbackModal').hidden=true;const brand=e.target.closest?.('[data-brand]');if(brand&&(e.key==='Enter'||e.key===' ')){e.preventDefault();navigate(`/brand/${brand.dataset.brand}`)}});
 window.addEventListener('hashchange',()=>{document.getElementById('mobileMenu').classList.remove('open');render()});
}
function bindPage(){
 bindSearch();bindBrandDirectory();bindCompare();bindRanking();bindAreas();bindStartup();bindBreakEven();bindDensity();bindFixedCost();
}
function bindSearch(){
 const input=document.getElementById('brandSearchInput');if(!input)return;const box=document.getElementById('searchSuggestions');
 const update=()=>{const q=input.value.trim().toLowerCase();if(!q){box.classList.remove('open');return}const found=brands.filter(b=>[b.name,...b.aliases].some(x=>String(x).toLowerCase().includes(q))).slice(0,8);box.innerHTML=found.length?found.map(b=>`<button class="suggestion" data-suggest="${b.slug}"><b>${esc(b.name)}</b><span>${b.category} · ${won(b.cost)}</span></button>`).join(''):`<div class="suggestion"><b>검색 결과 없음</b><span>업종 디렉터리에서 찾아보세요.</span></div>`;box.classList.add('open')};
 input.addEventListener('input',update);document.getElementById('brandSearch')?.addEventListener('submit',e=>{e.preventDefault();const b=findBrand(input.value);if(b)navigate(`/brand/${b.slug}`);else showToast('일치하는 브랜드가 없습니다.')});box.addEventListener('click',e=>{const x=e.target.closest('[data-suggest]');if(x)navigate(`/brand/${x.dataset.suggest}`)});
}
function bindBrandDirectory(){
 const q=document.getElementById('listSearch'),cat=document.getElementById('categoryFilter'),sort=document.getElementById('brandSort');if(!q||!cat||!sort)return;
 const apply=()=>{const query=q.value.trim().toLowerCase(),catVal=cat.value;let list=(catVal==='all'?[...brands]:catBrands(catVal)).filter(b=>!query||[b.name,...b.aliases].some(x=>String(x).toLowerCase().includes(query)));if(sort.value==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'ko'));else list=rankCustom(list,sort.value);document.getElementById('brandGrid').innerHTML=list.length?list.map(brandCard).join(''):`<div class="empty" style="grid-column:1/-1"><h2>조건에 맞는 브랜드가 없습니다.</h2></div>`;document.getElementById('brandCount').textContent=list.length;document.getElementById('brandScope').textContent=catVal==='all'?'전체 업종':categories[catVal].name};q.addEventListener('input',apply);cat.addEventListener('change',apply);sort.addEventListener('change',apply);
}
function rankCustom(list,metric){return [...list].sort((a,b)=>{if(metric==='cost')return a.cost-b.cost;if(metric==='growth')return derived(b).yoy-derived(a).yoy;if(metric==='sales')return b.sales-a.sales;return b.stores-a.stores})}
function bindCompare(){const a=document.getElementById('compareA'),b=document.getElementById('compareB');if(!a||!b)return;const go=()=>navigate(`/compare/${a.value}/${b.value}`);a.addEventListener('change',go);b.addEventListener('change',go)}
function bindRanking(){const s=document.getElementById('rankingCategory');if(!s)return;s.addEventListener('change',()=>navigate(`/rankings/${s.value}/${route().parts[2]||'stores'}`))}
function bindAreas(){
 const sido=document.getElementById('areaSido'),cat=document.getElementById('areaCategory'),q=document.getElementById('areaSearch');if(!sido||!cat||!q)return;
 const apply=()=>{const query=q.value.trim().toLowerCase(),sv=sido.value,cv=cat.value,list=areas.filter(a=>(sv==='all'||a.sido===sv)&&(!query||`${a.sido} ${a.name}`.toLowerCase().includes(query)));document.getElementById('areaGrid').innerHTML=list.length?list.map(a=>areaCard(a,cv)).join(''):`<div class="empty" style="grid-column:1/-1"><h2>조건에 맞는 지역이 없습니다.</h2></div>`};sido.addEventListener('change',apply);cat.addEventListener('change',apply);q.addEventListener('input',apply);
}
const fieldVal=id=>Math.max(0,Number(document.getElementById(id)?.value)||0);
function bindStartup(){
 const brand=document.getElementById('costBrand');if(!brand)return;
 const calc=()=>{const b=bySlug(brand.value),lease=fieldVal('depositInput')+fieldVal('keyMoney'),fit=fieldVal('extraInterior')+fieldVal('equipment')+fieldVal('initialGoods'),working=fieldVal('workingCapital')+fieldVal('otherCost'),total=b.cost+lease+fit+working;document.getElementById('officialCost').textContent=won(b.cost);document.getElementById('leaseCost').textContent=won(lease);document.getElementById('fitoutCost').textContent=won(fit);document.getElementById('workingCost').textContent=won(working);document.getElementById('rentCost').textContent=`${won(fieldVal('monthlyRent'))}/월`;document.getElementById('startupTotal').textContent=won(total);document.getElementById('toBreakEven').href=`#/tools/break-even?investment=${Math.round(total)}`};document.querySelectorAll('.cost-input').forEach(x=>{x.addEventListener('input',calc);x.addEventListener('change',calc)});calc();
}
function bindBreakEven(){
 const rev=document.getElementById('revenue');if(!rev)return;const invParam=route().query.get('investment');if(invParam)document.getElementById('investment').value=invParam;
 const calc=()=>{const revenue=fieldVal('revenue'),material=revenue*fieldVal('materialPct')/100,fee=revenue*fieldVal('feePct')/100,fixed=fieldVal('labor')+fieldVal('rent')+fieldVal('royalty')+fieldVal('utilities')+fieldVal('beOther'),surplus=revenue-material-fee-fixed,investment=fieldVal('investment');document.getElementById('beRevenue').textContent=won(revenue);document.getElementById('materialCost').textContent=`− ${won(material)}`;document.getElementById('fixedCost').textContent=`− ${won(fixed)}`;document.getElementById('feeCost').textContent=`− ${won(fee)}`;document.getElementById('surplusResult').textContent=surplus>=0?won(surplus):`− ${won(Math.abs(surplus))}`;document.getElementById('paybackResult').textContent=surplus>0?`${(investment/surplus).toFixed(1)}개월`:'계산 불가'};document.querySelectorAll('.be-input').forEach(x=>x.addEventListener('input',calc));calc();
}
function bindDensity(){
 const areaEl=document.getElementById('densityArea'),catEl=document.getElementById('densityCategory'),radEl=document.getElementById('densityRadius');if(!areaEl||!catEl||!radEl)return;
 const calc=()=>{const a=areaBySlug(areaEl.value),cat=catEl.value,radius=Number(radEl.value),cnt=a.categoryCounts[cat],density=cnt/a.areaKm2,circleKm=Math.PI*Math.pow(radius/1000,2),estimate=density*circleKm,allDensities=areas.map(x=>x.categoryCounts[cat]/x.areaKm2),med=median(allDensities),ratio=density/med;document.getElementById('densityLocation').textContent=`${a.sido} ${a.name}`;document.querySelector('#radiusCircle span').textContent=radius>=1000?'1km':`${radius}m`;document.getElementById('radiusCircle').style.transform=`scale(${radius===300?.72:radius===500?.86:1})`;document.getElementById('densityStores').textContent=`${num(cnt)}곳`;document.getElementById('densityPerKm').textContent=`${density.toFixed(1)}곳/㎢`;document.getElementById('densityShare').textContent=pct(cnt/a.allStores*100);document.getElementById('radiusEstimate').textContent=`약 ${Math.max(1,Math.round(estimate))}곳`;document.getElementById('densityLevel').textContent=ratio>1.35?'업종 중앙값보다 높은 편':ratio<.75?'업종 중앙값보다 낮은 편':'업종 중앙값 부근';const ranked=Object.entries(a.categoryCounts).sort((x,y)=>y[1]-x[1]);document.getElementById('densityBars').innerHTML=ranked.slice(0,12).map(([k,v])=>`<div class="bar-row"><span class="bar-label">${categories[k].name}</span><span class="bar-track"><span class="bar-fill" style="width:${v/ranked[0][1]*100}%"></span></span><span class="bar-value">${num(v)}</span></div>`).join('')};[areaEl,catEl,radEl].forEach(x=>x.addEventListener('change',calc));calc();
}
function bindFixedCost(){
 if(!document.getElementById('fixedRent'))return;const calc=()=>{const lease=fieldVal('fixedRent')+fieldVal('fixedManage'),labor=fieldVal('fixedLabor'),etc=fieldVal('fixedLoan')+fieldVal('fixedInsurance')+fieldVal('fixedTech')+fieldVal('fixedOther'),total=lease+labor+etc,months=Math.max(1,fieldVal('fixedMonths'));document.getElementById('fixedLeaseResult').textContent=won(lease);document.getElementById('fixedLaborResult').textContent=won(labor);document.getElementById('fixedEtcResult').textContent=won(etc);document.getElementById('fixedTotal').textContent=`${won(total)}/월`;document.getElementById('cashBufferResult').textContent=won(total*months)};document.querySelectorAll('.fixed-input').forEach(x=>x.addEventListener('input',calc));calc();
}
bindGlobal();render();
