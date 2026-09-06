'use strict';

function render(){
  const r=route(), p=r.parts; let html;
  if(p.length===0) html=home();
  else if(p[0]==='brands') html=brandsPage();
  else if(p[0]==='brand') html=brandPage(p[1]);
  else if(p[0]==='compare') html=comparePage(p[1],p[2]);
  else if(p[0]==='rankings') html=rankingPage(p[1]||'cafe');
  else if(p[0]==='areas' && p.length===1) html=areasPage();
  else if(p[0]==='area') html=areaDetailPage(p[1]);
  else if(p[0]==='tools' && p[1]?.startsWith('startup-cost')) html=startupCostPage();
  else if(p[0]==='tools' && p[1]?.startsWith('break-even')) html=breakEvenPage();
  else if(p[0]==='methodology') html=methodologyPage();
  else if(p[0]==='sources') html=sourcesPage();
  else if(['about','privacy','terms','contact'].includes(p[0])) html=staticPage(p[0]);
  else html=notFound();
  document.getElementById('app').innerHTML=html;
  bindPage(); window.scrollTo({top:0,behavior:'instant'}); track('page_view',{route:r.raw});
}

function bindGlobal(){
  document.addEventListener('click',(e)=>{
    const act=e.target.closest('[data-action]')?.dataset.action;
    if(act==='open-feedback') document.getElementById('feedbackModal').hidden=false;
    if(act==='close-feedback') document.getElementById('feedbackModal').hidden=true;
    if(act==='toggle-menu') document.getElementById('mobileMenu').classList.toggle('open');
    if(act==='copy-url'){ navigator.clipboard?.writeText(location.href).then(()=>showToast('현재 화면 링크를 복사했습니다.')).catch(()=>showToast('주소창 URL을 복사해 주세요.')); }
    const card=e.target.closest('[data-brand]'); if(card && !e.target.closest('a,button')) navigate(`/brand/${card.dataset.brand}`);
    const area=e.target.closest('[data-area]'); if(area && !e.target.closest('a,button')) navigate(`/area/${area.dataset.area}`);
  });
  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') document.getElementById('feedbackModal').hidden=true; const c=e.target.closest?.('[data-brand]'); if(c && (e.key==='Enter'||e.key===' ')){e.preventDefault();navigate(`/brand/${c.dataset.brand}`);} });
  window.addEventListener('hashchange',()=>{ document.getElementById('mobileMenu').classList.remove('open'); render(); });
}

function bindPage(){
  const search=document.getElementById('brandSearchInput');
  if(search){ const suggestions=document.getElementById('searchSuggestions'); const update=()=>{const q=search.value.trim().toLowerCase(); if(!q){suggestions.classList.remove('open');return;} const found=brands.filter(b=>[b.name,b.corp,...b.aliases].some(x=>x.toLowerCase().includes(q))).slice(0,6); suggestions.innerHTML=found.length?found.map(b=>`<button class="suggestion" data-suggest="${b.slug}"><b>${esc(b.name)}</b><span>${b.category} · ${won(b.cost)}</span></button>`).join(''):`<div class="suggestion"><b>검색 결과 없음</b><span>다른 이름을 입력해 보세요</span></div>`; suggestions.classList.add('open');}; search.addEventListener('input',update); document.getElementById('brandSearch').addEventListener('submit',e=>{e.preventDefault(); const found=findBrand(search.value); if(found)navigate(`/brand/${found.slug}`);else showToast('일치하는 샘플 브랜드가 없습니다.');}); suggestions.addEventListener('click',e=>{const x=e.target.closest('[data-suggest]');if(x)navigate(`/brand/${x.dataset.suggest}`)}); document.querySelectorAll('[data-search]').forEach(x=>x.addEventListener('click',()=>{search.value=x.dataset.search; const b=findBrand(search.value); if(b)navigate(`/brand/${b.slug}`);})); }
  const listSearch=document.getElementById('listSearch'), catFilter=document.getElementById('categoryFilter');
  if(listSearch&&catFilter){const apply=()=>{const q=listSearch.value.toLowerCase().trim(),cat=catFilter.value; const filtered=brands.filter(b=>(cat==='all'||b.categorySlug===cat)&&(!q||[b.name,b.corp,...b.aliases].some(x=>x.toLowerCase().includes(q)))); document.getElementById('brandGrid').innerHTML=filtered.map(brandCard).join('')||`<div class="empty" style="grid-column:1/-1"><h2>조건에 맞는 브랜드가 없습니다.</h2><p>검색어나 업종을 바꿔 보세요.</p></div>`; document.getElementById('brandCount').textContent=filtered.length;};listSearch.addEventListener('input',apply);catFilter.addEventListener('change',apply);}
  const ca=document.getElementById('compareA'),cb=document.getElementById('compareB'); if(ca&&cb){const go=()=>navigate(`/compare/${ca.value}/${cb.value}`);ca.addEventListener('change',go);cb.addEventListener('change',go);}
  const rc=document.getElementById('rankingCategory'); if(rc)rc.addEventListener('change',()=>navigate(`/rankings/${rc.value}`));
  bindStartup(); bindBreakEven();
}

function findBrand(q=''){q=q.trim().toLowerCase();return brands.find(b=>[b.name,b.corp,...b.aliases].some(x=>x.toLowerCase()===q))||brands.find(b=>[b.name,b.corp,...b.aliases].some(x=>x.toLowerCase().includes(q)))}
function val(id){const el=document.getElementById(id);return el?Math.max(0,Number(el.value)||0):0;}
function bindStartup(){ const brandSel=document.getElementById('costBrand'); if(!brandSel)return; const calc=()=>{const b=bySlug(brandSel.value),lease=val('deposit')+val('keyMoney'),fit=val('extraInterior')+val('equipment')+val('initialGoods'),working=val('workingCapital')+val('otherCost'),total=b.cost+lease+fit+working; document.getElementById('officialCost').textContent=won(b.cost);document.getElementById('leaseCost').textContent=won(lease);document.getElementById('fitoutCost').textContent=won(fit);document.getElementById('workingCost').textContent=won(working);document.getElementById('rentCost').textContent=`${won(val('monthlyRent'))}/월`;document.getElementById('startupTotal').textContent=won(total);document.getElementById('toBreakEven').href=`#/tools/break-even?investment=${Math.round(total)}`;};brandSel.addEventListener('change',calc);document.querySelectorAll('.cost-input').forEach(x=>x.addEventListener('input',calc));calc(); }
function bindBreakEven(){ if(!document.getElementById('revenue'))return; const params=new URLSearchParams((location.hash.split('?')[1]||'')); if(params.get('investment'))document.getElementById('investment').value=params.get('investment'); const calc=()=>{const revenue=val('revenue'),material=revenue*val('materialPct')/100,fee=revenue*val('feePct')/100,fixed=val('labor')+val('rent')+val('royalty')+val('utilities')+val('beOther'),surplus=revenue-material-fee-fixed,investment=val('investment'); document.getElementById('beRevenue').textContent=won(revenue);document.getElementById('materialCost').textContent=`− ${won(material)}`;document.getElementById('fixedCost').textContent=`− ${won(fixed)}`;document.getElementById('feeCost').textContent=`− ${won(fee)}`;document.getElementById('surplusResult').textContent=`${surplus<0?'− ':''}${won(Math.abs(surplus))}`;document.getElementById('paybackResult').textContent=surplus>0?`${(investment/surplus).toFixed(1)}개월`:'회수기간 계산 불가';};document.querySelectorAll('.be-input,.cost-input').forEach(x=>x.addEventListener('input',calc));calc(); }
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),2200);}

bindGlobal(); render();
