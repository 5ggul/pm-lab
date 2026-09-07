(function(){
 const data=JSON.parse(document.getElementById('pm-data').textContent),form=document.getElementById('pm-form'),variant=document.getElementById('pm-variant'),distance=document.getElementById('pm-distance'),price=document.getElementById('pm-price');
 const money=n=>Math.round(n).toLocaleString('ko-KR')+'원';
 const range=a=>a[0]===a[1]?money(a[0]):money(a[0])+'–'+money(a[1]);
 const get=()=>data.variants.find(v=>v.id===variant.value);
 function render(){
  const v=get(),km=distance.valueAsNumber,p=price.valueAsNumber,valid=distance.validity.valid&&price.validity.valid&&Number.isFinite(km)&&Number.isFinite(p);
  const energy=document.getElementById('pm-energy'),total=document.getElementById('pm-total');
  if(!valid){energy.textContent='거리와 단가를 확인하세요';total.textContent='—';document.querySelectorAll('[data-km]').forEach(e=>e.textContent='—');return}
  const cost=k=>[CAR_COST_MATH.energyCost(k,v.combined[1],p),CAR_COST_MATH.energyCost(k,v.combined[0],p)];
  const tax=CAR_COST_MATH.annualTax(v.cc,v.fuel==='electric','2026-01',2026).total;
  energy.textContent=range(cost(km));total.textContent=range(cost(km).map(n=>n+tax));
  document.querySelectorAll('[data-km]').forEach(e=>e.textContent=range(cost(Number(e.dataset.km))));
 }
 let fuel=get().fuel;
 variant.addEventListener('change',()=>{const next=get().fuel;if(next!==fuel){price.value=next==='electric'?'':data.prices[next==='hybrid'?'gasoline':next]??'';fuel=next}render()});
 form.addEventListener('input',render);form.addEventListener('submit',e=>e.preventDefault());
})();
